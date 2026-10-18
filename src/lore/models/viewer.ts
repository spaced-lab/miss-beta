// WHAT: Draws a catalog model into a box: auto-rotating wireframe, scale bar, title, facts, source.
// WHY:  The Learning Center's right pane shows the device a topic talks about when there is no lab.
// HOW:  Fit the model's extent to the box, yaw = t * spin, a fixed 0.35 rad pitch, perspective focal 4x the
//       extent. Fine parts draw thinner and dimmer. Roles map through Surface.role (MONO falls back to ink).
// LORE: G8 (the look)

import type { Surface } from '../../render/canvas';
import { drawText, drawTextFit, wrapText } from '../../render/vectorFont';
import type { Box } from '../labs/lab';
import type { Model } from './catalog';
import { extent, project } from './mesh';

export function drawModel(s: Surface, m: Model, box: Box, t: number): void {
  const p = s.palette;
  drawTextFit(s, m.title, box.x, box.y, 10, box.w, { color: p.hot, glow: 1 });
  const plotH = Math.min(box.w * 0.85, box.h - 150);
  const parts = m.build(t);
  const ext = extent(parts);
  const k = (Math.min(box.w, plotH) * 0.42) / ext;
  const view = { yaw: t * 0.35, pitch: 0.35, cx: box.x + box.w / 2, cy: box.y + 22 + plotH / 2, k, focal: ext * 4 };
  for (const part of parts) {
    const pts = project(part, view);
    const color = s.role(part.role);
    for (let i = 0; i + 3 < pts.length; i += 4) {
      s.stroke([pts[i] ?? 0, pts[i + 1] ?? 0, pts[i + 2] ?? 0, pts[i + 3] ?? 0], { color, glow: part.fine ? 0.2 : 0.7, width: part.fine ? 0.8 : 1.2, alpha: part.fine ? 0.55 : 1 });
    }
  }
  // Scale bar under the model.
  const sbY = box.y + 22 + plotH + 6;
  const sbW = m.scaleBar * k;
  s.stroke([box.x + 8, sbY, box.x + 8 + sbW, sbY], { color: p.ink, glow: 0.3 });
  s.stroke([box.x + 8, sbY - 3, box.x + 8, sbY + 3], { color: p.ink, glow: 0 });
  s.stroke([box.x + 8 + sbW, sbY - 3, box.x + 8 + sbW, sbY + 3], { color: p.ink, glow: 0 });
  drawText(s, `${m.scaleBar} M`, box.x + 14 + sbW, sbY - 4, 8, { color: p.dim, glow: 0 });
  let y = sbY + 16;
  for (const f of m.facts) {
    for (const l of wrapText(f, box.w, 8)) {
      if (y > box.y + box.h - 24) break;
      drawText(s, l, box.x, y, 8, { color: p.ink, glow: 0.2 });
      y += 12;
    }
    y += 3;
  }
  for (const l of wrapText(`SOURCE: ${m.source}`, box.w, 7)) {
    if (y > box.y + box.h - 8) break;
    drawText(s, l, box.x, y, 7, { color: p.dim, glow: 0 });
    y += 10;
  }
}
