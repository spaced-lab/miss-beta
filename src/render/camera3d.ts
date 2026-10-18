// WHAT: The wireframe-3-D camera (GAME_PLAN 24.3): a pure projection that tilts the orbit plane.
// WHY:  Physics stays 2-D (z = 0 for every body); the tilt is only a camera, so the sim never changes.
// HOW:  Screen-plane offsets (dx, dy) from the view centre are rotated about the screen x axis by `pitch`:
//       y' = dy cos(pitch), z' = dy sin(pitch); perspective scale = focal / (focal + z'). Pitch 0 is the
//       top-down view (identity). `tiltZ` lifts a point off the plane (the tumbling polyhedron).
// LORE: O3 (vectors), G8 (the look)

export interface Camera {
  /** Pitch in radians, 0 top-down to about 1.05 (60 deg). */
  pitch: number;
  /** Focal length in CSS px; larger is flatter perspective. */
  focal: number;
}

export const CAMERA_PITCHES: readonly number[] = [0, Math.PI / 6, Math.PI / 3];

/** Project a screen-plane offset (dx, dy) and height z (px) to the tilted screen offset. */
export function tilt(cam: Camera, dx: number, dy: number, z = 0): [number, number] {
  if (cam.pitch === 0 && z === 0) return [dx, dy];
  const c = Math.cos(cam.pitch);
  const si = Math.sin(cam.pitch);
  const y2 = dy * c - z * si;
  const z2 = dy * si + z * c;
  const k = cam.focal / (cam.focal + z2);
  return [dx * k, y2 * k];
}

/** A seeded wireframe polyhedron (an irregular octahedron) tumbling with time, as projected segments. */
export function polyhedron(cam: Camera, cx: number, cy: number, r: number, t: number, shape: ArrayLike<number>): number[][] {
  const v: [number, number, number][] = [];
  const k = (i: number): number => (shape.length > 0 ? (shape[i % shape.length] as number) : 1);
  const axes: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const a = t * 0.7;
  const b = t * 0.4;
  for (let i = 0; i < axes.length; i++) {
    const [x, y, z] = axes[i] as [number, number, number];
    const s = r * k(i);
    // Rotate about y then x.
    const x1 = x * Math.cos(a) + z * Math.sin(a);
    const z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(b) - z1 * Math.sin(b);
    const z2 = y * Math.sin(b) + z1 * Math.cos(b);
    v.push([x1 * s, y2 * s, z2 * s]);
  }
  const edges: [number, number][] = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];
  return edges.map(([i, j]) => {
    const p = v[i] as [number, number, number];
    const q = v[j] as [number, number, number];
    const [px, py] = tilt(cam, p[0], p[1], p[2]);
    const [qx, qy] = tilt(cam, q[0], q[1], q[2]);
    return [cx + px, cy + py, cx + qx, cy + qy];
  });
}
