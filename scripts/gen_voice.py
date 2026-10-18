#!/usr/bin/env python3
"""
WHAT: Render the canned robot voice lines (IDEAS 21) to public/audio/voice/{female,male}/<ID>.ogg and write the
      id -> text manifest src/config/voice.json.
WHY:  The game loads nothing remote and synthesises no speech at run time, so the lines are baked offline once and
      committed as tiny Opus files. Kokoro-82M (hexgrad, Apache-2.0) is a free, local, small TTS model; its British
      voices bf_emma and bm_fable are read through a channel vocoder so they sound like a 1980s mission computer
      rather than a person.
HOW:  One-time setup (torch does not support the system Python 3.14; the venv and the model cache stay out of git):
          uv venv -p 3.12 .venv-voice
          uv pip install -p .venv-voice/bin/python kokoro soundfile numpy pip \
              "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
          .venv-voice/bin/python scripts/gen_voice.py
      Needs espeak-ng (brew) for out-of-dictionary words and ffmpeg for Opus. The model weights download to the
      Hugging Face cache in the home directory, never into the repo.
      Chain per clip: Kokoro at 24 kHz -> resample to 16 kHz -> 24-band channel vocoder (the band envelopes of the
      speech drive the same bands of a buzz carrier at a fixed low pitch, plus a little noise in the top bands for
      consonants) -> mixed with 45 % of the dry voice and a dash of 30 Hz ring modulation -> band-pass 250-4000 Hz
      -> coarse quantise -> normalise -> ffmpeg libopus mono ~20 kbit/s. Deterministic apart from the TTS model.
      NOTE: the mix was picked with data: a Whisper base.en transcription of 12 lines x 2 voices scored a pure
      vocoder (20 bands, telephone band, heavy quantise) 8/24 and this mix 17/24, the rest near-misses ("Pause").
LORE: G8 (the look); the lines are UI, not lore.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio" / "voice"
MANIFEST = ROOT / "src" / "config" / "voice.json"
FFMPEG = "/opt/homebrew/bin/ffmpeg" if pathlib.Path("/opt/homebrew/bin/ffmpeg").exists() else "ffmpeg"

VOICES = {"female": ("bf_emma", 120.0), "male": ("bm_fable", 90.0)}  # Kokoro voice, carrier pitch in Hz
SR_IN = 24000
SR = 16000
BANDS = 24
DRY = 0.45  # share of the plain (band-limited) voice kept under the vocoder: intelligibility on short words
ENV_HZ = 80.0  # band envelope smoothing, Hz: higher keeps consonant onsets crisper
RING = 0.08  # share of 30 Hz ring-modulated dry voice (the buzz)
QUANT = 96  # quantise levels per unit amplitude: lower is grittier
BAND = (250.0, 4000.0)  # final telephone band, Hz
BITRATE = "20k"

LINES = {
    "LAUNCHING": "Launching.",
    "BUILDING": "Building.",
    "RESEARCHING": "Research complete.",
    "PROGRAM_FUNDED": "Program funded.",
    "THREAT_DETECTED": "New threat detected.",
    "IMPACT_IMMINENT": "Impact imminent.",
    "INTERCEPT": "Intercept.",
    "DEFLECTED": "Deflection confirmed.",
    "MISS": "Target will miss. Earth is safe.",
    "PARTIAL": "Partial deflection.",
    "HIT": "Impact. Earth has been hit.",
    "DISRUPTED": "Target disrupted.",
    "FRAGMENTS": "Fragments detected.",
    "EVACUATE": "Evacuation ordered.",
    "ROUND_START": "New round.",
    "GAME_OVER": "Game over.",
    "WARP": "Warp engaged.",
    "PAUSED": "Paused.",
    "AUTOPLAY": "Autoplay engaged. Watch and learn.",
    "PLAN_COMMITTED": "Plan committed.",
    "WELCOME": "Welcome to MISS beta.",
    "FINALE": "Strange game. The only option is to keep working to protect your planet. "
              "Shall we play a game of chess, or will you help us save the world?",
}


def resample(x: np.ndarray, sr_from: int, sr_to: int) -> np.ndarray:
    """Band-limited resample by FFT (fine for clips of a few seconds)."""
    n = int(round(len(x) * sr_to / sr_from))
    spec = np.fft.rfft(x)
    keep = n // 2 + 1
    out = np.zeros(keep, dtype=complex)
    m = min(keep, len(spec))
    out[:m] = spec[:m]
    return np.fft.irfft(out, n) * (n / len(x))


def bandpass(x: np.ndarray, lo: float, hi: float, sr: int) -> np.ndarray:
    """Zero-phase band-pass in the frequency domain with soft linear skirts (lo = 0 gives a low-pass)."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    w_lo = np.ones_like(f) if lo <= 0 else np.clip((f - lo * 0.8) / (lo * 0.2), 0, 1)
    w_hi = np.clip((hi * 1.15 - f) / (hi * 0.15), 0, 1)
    return np.fft.irfft(spec * w_lo * w_hi, len(x))


def envelope(x: np.ndarray, sr: int, cutoff: float) -> np.ndarray:
    """Rectify, then low-pass at `cutoff` Hz: the slow loudness contour of one band."""
    return np.maximum(bandpass(np.abs(x), 0, cutoff, sr), 0)


def vocode(speech: np.ndarray, pitch: float, sr: int) -> np.ndarray:
    """Channel vocoder: each speech band's envelope multiplies the same band of a fixed-pitch buzz; sum the bands."""
    n = len(speech)
    t = np.arange(n) / sr
    saw = 2 * ((t * pitch) % 1.0) - 1
    square = np.sign(np.sin(2 * np.pi * pitch * 2 * t))
    noise = np.random.default_rng(7).standard_normal(n) * 0.25
    carrier = 0.7 * saw + 0.3 * square
    edges = np.geomspace(150, 5500, BANDS + 1)
    out = np.zeros(n)
    for lo, hi in zip(edges[:-1], edges[1:]):
        env = envelope(bandpass(speech, lo, hi, sr), sr, ENV_HZ)
        src = carrier if hi < 3000 else 0.6 * carrier + noise  # top bands get hiss for s / t / k
        out += bandpass(src, lo, hi, sr) * env
    return out


def robot(speech: np.ndarray, pitch: float) -> np.ndarray:
    x = resample(speech.astype(np.float64), SR_IN, SR)
    x = x / (np.max(np.abs(x)) + 1e-9)
    y = vocode(x, pitch, SR)
    y = y / (np.max(np.abs(y)) + 1e-9)
    ring = x * np.sign(np.sin(2 * np.pi * 30 * np.arange(len(x)) / SR))  # 30 Hz ring-mod buzz of the dry voice
    y = (1 - DRY) * (1 - RING) * y + RING * ring + DRY * x
    y = bandpass(y, BAND[0], BAND[1], SR)  # telephone band
    y = y / (np.max(np.abs(y)) + 1e-9)
    y = np.round(y * QUANT) / QUANT  # coarse quantise: lo-fi grit
    pad = np.zeros(int(0.05 * SR))
    y = np.concatenate([pad, y, pad])
    return (y / (np.max(np.abs(y)) + 1e-9) * 0.89).astype(np.float32)


def main() -> int:
    import soundfile as sf
    from kokoro import KPipeline

    pipe = KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")
    total = 0
    for folder, (voice, pitch) in VOICES.items():
        (OUT / folder).mkdir(parents=True, exist_ok=True)
        for vid, text in LINES.items():
            audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=voice, speed=0.95)])
            y = robot(audio, pitch)
            dst = OUT / folder / f"{vid}.ogg"
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                sf.write(tmp.name, y, SR)
                subprocess.run(
                    [FFMPEG, "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-c:a", "libopus",
                     "-b:a", BITRATE, "-application", "voip", "-map_metadata", "-1", str(dst)],
                    check=True,
                )
            total += dst.stat().st_size
            print(f"{folder}/{vid}.ogg {dst.stat().st_size} B")
    MANIFEST.write_text(json.dumps(LINES, indent=2) + "\n")
    print(f"total {total} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
