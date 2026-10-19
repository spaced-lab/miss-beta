#!/usr/bin/env python3
"""
WHAT: Clarity check for the baked robot voices (IDEAS 36): transcribe every clip in public/audio/voice/<voice>/ with
      Whisper base.en and score it against the line's text.
WHY:  Nobody on the project can listen to every voice after every tweak, and "sounds clear" is not a number. A
      speech recogniser is a fair stand-in for a first-time listener: if it cannot make out a line, a player in a
      noisy room may not either. scripts/gen_voice.py's mix was chosen this way (8/24 -> 17/24).
HOW:  .venv-voice/bin/python scripts/voice_check.py [voice ...]   (default: every voice folder)
      For each clip: whisper.transcribe (English, greedy, no prompt) -> normalise both texts (lower case, letters,
      digits and spaces; "beta" spelled out) -> word accuracy = 1 - word edit distance / words in the line. Prints a
      table per voice: mean word accuracy, lines exactly right, and the worst lines with what was heard.
      Deterministic for a given model and clip set. Needs the same venv as gen_voice.py plus openai-whisper; the
      model (base.en, about 140 MB) lives in the Whisper cache in the home directory, never in the repo.
LORE: G8 (the look, and the sound)
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio" / "voice"
LINES = json.loads((ROOT / "src" / "config" / "voice.json").read_text())


def norm(s: str) -> list[str]:
    """Lower case words, punctuation dropped. Example: norm("Welcome to MISS beta.") = ['welcome', 'to', 'miss', 'beta']."""
    s = s.lower().replace("β", " beta ").replace("-", " ")
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def word_accuracy(ref: list[str], hyp: list[str]) -> float:
    """1 - Levenshtein distance over words / len(ref), floored at 0. Example: (['a', 'b'], ['a', 'c']) -> 0.5."""
    d = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hyp, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
            prev, d[j] = d[j], cur
    return max(0.0, 1 - d[len(hyp)] / max(1, len(ref)))


def check(voice: str, model) -> dict:
    rows = []
    for vid, text in LINES.items():
        clip = OUT / voice / f"{vid}.ogg"
        if not clip.exists():
            rows.append((vid, 0.0, "(missing)"))
            continue
        heard = model.transcribe(str(clip), language="en", fp16=False, temperature=0.0, condition_on_previous_text=False)["text"].strip()
        rows.append((vid, word_accuracy(norm(text), norm(heard)), heard))
    acc = sum(r[1] for r in rows) / len(rows)
    exact = sum(1 for r in rows if r[1] >= 0.999)
    return {"voice": voice, "accuracy": acc, "exact": exact, "lines": len(rows), "rows": rows}


def main() -> int:
    import whisper

    voices = sys.argv[1:] or sorted(p.name for p in OUT.iterdir() if p.is_dir())
    model = whisper.load_model("base.en")
    results = [check(v, model) for v in voices]
    for r in results:
        print(f"{r['voice']:<10} word accuracy {r['accuracy'] * 100:5.1f}%   exact {r['exact']:2d}/{r['lines']}")
        for vid, a, heard in sorted(r["rows"], key=lambda x: x[1])[:4]:
            if a < 0.999:
                print(f"    {vid:<16} {a * 100:5.1f}%  heard: {heard[:70]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
