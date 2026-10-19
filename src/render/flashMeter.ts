// WHAT: A flash meter for the game's own effects (IDEAS 34, claim G8-1): counts general flashes and red flashes in a
//       sequence of captured frames by the WCAG 2.x definitions, per 10-degree field of view.
// WHY:  WCAG 2.3.1 (Three Flashes or Below Threshold) is the photosensitivity rule the game follows. The montage and
//       cutaways already keep to three screen changes a second; this measures what actually reaches the screen,
//       including effects that are not cuts (CRT flicker, glitch tears, impact flashes), against the area and
//       luminance thresholds, not only the count.
// HOW:  WCAG 2.x, "general flash and red flash thresholds": a flash is a pair of opposing changes in relative
//         luminance of 10 % or more of the maximum (Delta L >= 0.1) where the darker state is below 0.80, over a
//         combined area of at least 25 % of any 10-degree visual field (341 x 256 px of a 1024 x 768 screen at a
//         typical viewing distance); a red flash is a pair of opposing transitions involving saturated red
//         (R / (R + G + B) >= 0.8) with a change in (R - G - B) x 320 of more than 20. Content fails when there are
//         more than three general or more than three red flashes in any one-second period.
//       Frames are sRGB pixel arrays. Each field is a window of the frame the size of a 10-degree field, moved in
//       half-field steps. For each field the meter keeps a reference state; a frame whose pixels differ from it by a
//       qualifying change over >= 25 % of the field (same direction) is a transition and becomes the new reference.
//       Two transitions make a flash, so the busiest second's flashes are its transitions halved. Pure: no DOM; the browser driver feeds it frames.
//       Example: a full-screen white-black toggle every 100 ms is 5 flashes a second: FAIL. The same toggle in a
//       10 x 10 px square is no flash at all (under 25 % of a field).
// LORE: G8 (the look, and the sound)

/** sRGB channel (0..255) to linear light. Example: lin(255) = 1, lin(0) = 0, lin(128) is about 0.216. */
function lin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
const LIN = Float64Array.from({ length: 256 }, (_, c) => lin(c));

export interface FlashFrame {
  /** Milliseconds since the first frame. */
  t: number;
  width: number;
  height: number;
  /** RGBA, row major (ImageData.data). */
  rgba: Uint8ClampedArray;
}

export interface FlashReport {
  /** Most general flashes in any one-second window, over all fields. */
  generalPerSecond: number;
  /** Most red flashes in any one-second window, over all fields. */
  redPerSecond: number;
  /** True when either exceeds three a second (WCAG 2.3.1 fails). */
  fails: boolean;
  frames: number;
}

/** Per-pixel relative luminance and red metric of one frame. */
function measures(f: FlashFrame): { L: Float32Array; red: Float32Array; sat: Uint8Array } {
  const n = f.width * f.height;
  const L = new Float32Array(n);
  const red = new Float32Array(n);
  const sat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = f.rgba[i * 4] as number;
    const g = f.rgba[i * 4 + 1] as number;
    const b = f.rgba[i * 4 + 2] as number;
    L[i] = 0.2126 * (LIN[r] as number) + 0.7152 * (LIN[g] as number) + 0.0722 * (LIN[b] as number);
    const sum = r + g + b;
    sat[i] = sum > 0 && r / sum >= 0.8 ? 1 : 0;
    red[i] = Math.max(0, ((LIN[r] as number) - (LIN[g] as number) - (LIN[b] as number)) * 320);
  }
  return { L, red, sat };
}

/** Count events in the busiest one-second window (start inclusive, end exclusive). Example: [0, 300, 600, 900, 1400] -> 4. */
export function maxPerSecond(times: readonly number[]): number {
  let best = 0;
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while ((times[i] as number) - (times[j] as number) >= 1000) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
}

/**
 * Measure a frame sequence. `fieldPx` is the 10-degree field in the frames' own pixels: for a capture scaled from a
 * W x H canvas, pass { w: 341 x scale, h: 256 x scale } with scale = captured width / 1024 for a 1024-wide reference.
 */
export function measureFlashes(frames: readonly FlashFrame[], fieldPx: { w: number; h: number }): FlashReport {
  const first = frames[0];
  if (!first) return { generalPerSecond: 0, redPerSecond: 0, fails: false, frames: 0 };
  const W = first.width;
  const H = first.height;
  const fw = Math.max(1, Math.min(W, Math.round(fieldPx.w)));
  const fh = Math.max(1, Math.min(H, Math.round(fieldPx.h)));
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = 0; x + fw <= W; x += Math.max(1, Math.floor(fw / 2))) xs.push(x);
  for (let y = 0; y + fh <= H; y += Math.max(1, Math.floor(fh / 2))) ys.push(y);
  if (xs[xs.length - 1] !== W - fw) xs.push(W - fw);
  if (ys[ys.length - 1] !== H - fh) ys.push(H - fh);
  const ms = frames.map(measures);
  const area = fw * fh;
  let general = 0;
  let red = 0;
  for (const x0 of xs) {
    for (const y0 of ys) {
      // Reference state per field: the frame index of the last transition.
      let refG = 0;
      let refR = 0;
      const gTimes: number[] = [];
      const rTimes: number[] = [];
      for (let k = 1; k < frames.length; k++) {
        const a = ms[refG];
        const b = ms[k];
        const ar = ms[refR];
        if (!a || !b || !ar) continue;
        let up = 0;
        let down = 0;
        let rUp = 0;
        let rDown = 0;
        for (let y = y0; y < y0 + fh; y++) {
          for (let x = x0; x < x0 + fw; x++) {
            const i = y * W + x;
            const l0 = a.L[i] as number;
            const l1 = b.L[i] as number;
            if (Math.abs(l1 - l0) >= 0.1 && Math.min(l0, l1) < 0.8) {
              if (l1 > l0) up++;
              else down++;
            }
            if (((ar.sat[i] as number) || (b.sat[i] as number)) && Math.abs((b.red[i] as number) - (ar.red[i] as number)) > 20) {
              if ((b.red[i] as number) > (ar.red[i] as number)) rUp++;
              else rDown++;
            }
          }
        }
        const t = (frames[k] as FlashFrame).t;
        const dirG = up >= 0.25 * area ? 1 : down >= 0.25 * area ? -1 : 0;
        if (dirG !== 0) {
          gTimes.push(t);
          refG = k;
        }
        const dirR = rUp >= 0.25 * area ? 1 : rDown >= 0.25 * area ? -1 : 0;
        if (dirR !== 0) {
          rTimes.push(t);
          refR = k;
        }
      }
      // A flash is a pair of opposing transitions. Against a reference that moves with each transition, two
      // transitions in a row are always opposite or a further step the same way; both count, so a window's flashes
      // are its transitions halved (a slow ramp in steps of 0.1 is rare in this game and would read high: safe side).
      general = Math.max(general, Math.floor(maxPerSecond(gTimes) / 2));
      red = Math.max(red, Math.floor(maxPerSecond(rTimes) / 2));
    }
  }
  return { generalPerSecond: general, redPerSecond: red, fails: general > 3 || red > 3, frames: frames.length };
}
