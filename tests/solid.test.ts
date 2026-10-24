import { describe, expect, it } from 'vitest';
import { chunkAt, cratered, dent, extent, fracture, icosahedron, makeBody, projectChunk, pullBack, restingChunk, roughen, rotate3, subdivide } from '../src/render/cinematics/solid';
import { Rng } from '../src/sim/rng';

function outward(p: { v: Float64Array; f: number[][] }): boolean {
  for (const [a, b, c] of p.f as [number, number, number][]) {
    const ax = p.v[a * 3] ?? 0, ay = p.v[a * 3 + 1] ?? 0, az = p.v[a * 3 + 2] ?? 0;
    const bx = p.v[b * 3] ?? 0, by = p.v[b * 3 + 1] ?? 0, bz = p.v[b * 3 + 2] ?? 0;
    const cx = p.v[c * 3] ?? 0, cy = p.v[c * 3 + 1] ?? 0, cz = p.v[c * 3 + 2] ?? 0;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    // A lathe's apex rings make zero-area triangles; they have no side to face.
    if (Math.hypot(nx, ny, nz) < 1e-12) continue;
    if (nx * (ax + bx + cx) + ny * (ay + by + cy) + nz * (az + bz + cz) <= 0) return false;
  }
  return true;
}

describe('solid bodies', () => {
  it('the icosahedron and its subdivision are closed, outward-facing meshes', () => {
    const i = icosahedron();
    expect(i.v.length / 3).toBe(12);
    expect(i.f.length).toBe(20);
    expect(outward(i)).toBe(true);
    const sub = subdivide(i);
    expect(sub.v.length / 3).toBe(42);
    expect(sub.f.length).toBe(80);
    expect(outward(sub)).toBe(true);
    for (let k = 0; k < sub.v.length; k += 3) expect(Math.hypot(sub.v[k] ?? 0, sub.v[k + 1] ?? 0, sub.v[k + 2] ?? 0)).toBeCloseTo(1, 6);
  });
  it('roughening keeps the faces outward and the body seeded', () => {
    const a = makeBody(new Rng(5));
    const b = makeBody(new Rng(5));
    expect(Array.from(a.v)).toEqual(Array.from(b.v));
    expect(outward(a)).toBe(true);
    expect(a.f.length).toBe(320);
    expect(roughen(icosahedron(), new Rng(1), 0, 1).v).toEqual(icosahedron().v);
    const plain = subdivide(subdivide(icosahedron()));
    expect(dent(plain, new Rng(1), 0, 0.4, 0.2).v).toEqual(plain.v);
    const dented = dent(plain, new Rng(1), 3, 0.4, 0.2);
    let moved = 0;
    for (let k = 0; k < plain.v.length; k += 3) if (Math.hypot(dented.v[k] ?? 0, dented.v[k + 1] ?? 0, dented.v[k + 2] ?? 0) < 0.999) moved++;
    expect(moved).toBeGreaterThan(3);
  });
  it('a crater flattens the hit side only', () => {
    const body = roughen(icosahedron(), new Rng(2), 0, 1);
    const c = cratered(body, 1, 1, 0, 0.3);
    for (let k = 0; k < c.v.length; k += 3) expect(c.v[k] ?? 0).toBeLessThanOrEqual(0.7 + 1e-9);
    expect(cratered(body, 1, 1, 0, 0).v).toEqual(body.v);
  });
  it('rotation keeps length and a quarter turn about z sends x to y', () => {
    const [x, y, z] = rotate3(1, 0, 0, 0, 0, Math.PI / 2);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
    const [a, b, c] = rotate3(1, 2, 3, 0.4, 1.1, 2.2);
    expect(Math.hypot(a, b, c)).toBeCloseTo(Math.hypot(1, 2, 3));
  });
  it('chunks move and tumble on straight lines from their start time', () => {
    const rng = new Rng(9);
    const [c] = fracture(rng, 60, 1, 0.5, 10, 10, 0, 1, 'fragment', 0.3, 0);
    if (!c) throw new Error('no chunk');
    expect(c.size).toBeCloseTo(30);
    const q0 = chunkAt(c, 0.5);
    expect(q0.x).toBe(c.x);
    const q = chunkAt(c, 2);
    // One second at 10 px/s, scaled by (R / size)^0.3 = 2^0.3 for a half-size piece.
    expect(Math.hypot(q.x - c.x, q.y - c.y, q.z - c.z)).toBeCloseTo(10 * Math.pow(2, 0.3), 5);
  });
  it('fracture sizes fall from the largest and small pieces fly faster', () => {
    const cs = fracture(new Rng(3), 80, 12, 0.5, 20, 20, 1, 0, 'fragment', 0);
    expect(cs.length).toBe(12);
    for (let i = 1; i < cs.length; i++) expect(cs[i]?.size ?? 0).toBeLessThanOrEqual(cs[i - 1]?.size ?? 0);
    const speed = (c: (typeof cs)[number]): number => Math.hypot(c.vx, c.vy, c.vz);
    expect(speed(cs[11] as (typeof cs)[number])).toBeGreaterThan(speed(cs[0] as (typeof cs)[number]));
  });
  it('the cloud extent grows and the camera backs away only past the fit', () => {
    const cs = fracture(new Rng(4), 50, 8, 0.4, 30, 60, 1, 0, 'fragment', 0);
    expect(extent(cs, 0)).toBeLessThan(extent(cs, 3));
    expect(extent([], 1)).toBe(0);
    expect(pullBack(100, 300)).toBe(1);
    expect(pullBack(600, 300)).toBeCloseTo(0.5);
  });
  it('a projected body shows some front faces and a closed silhouette', () => {
    const body = restingChunk(makeBody(new Rng(7)), 40, new Rng(8));
    const p = projectChunk(body, 0.3, 100, 100, 1);
    expect(p.faces.length).toBeGreaterThan(80);
    expect(p.faces.length).toBeLessThan(320);
    expect(p.silhouette.length / 4).toBeGreaterThanOrEqual(6);
    for (const f of p.faces) expect(f.lit).toBeGreaterThanOrEqual(0);
  });
});

describe('lathe meshes and vehicles', () => {
  it('a revolved profile faces outward and a two-sided fin always shows a front', async () => {
    const { lathe, flat, projectChunk } = await import('../src/render/cinematics/solid');
    const cone = lathe([[0, -1], [1, 0], [0, 1]], 6);
    expect(cone.v.length / 3).toBe(18);
    expect(cone.f.length).toBe(24);
    expect(outward(cone)).toBe(true);
    const fin = flat([[0, 0, 0], [0, 1, 0], [1, 1, 0]]);
    const c = { poly: fin, size: 10, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: 0.3, ay: 0.2, az: 0.1, wx: 0, wy: 0, wz: 0, t0: 0, role: 'craft' as const, hot: 0 };
    const p = projectChunk(c, 0, 0, 0, 1);
    expect(p.faces.length).toBe(1);
    expect(p.silhouette.length / 4).toBe(3);
  });
  it('a falling stage follows a parabola', async () => {
    const { chunkAt } = await import('../src/render/cinematics/solid');
    const c = { poly: { v: new Float64Array(0), f: [] }, size: 1, x: 0, y: 0, z: 0, vx: 10, vy: -20, vz: 0, ax: 0, ay: 0, az: 0, wx: 0, wy: 0, wz: 0, t0: 1, role: 'craft' as const, hot: 0, g: 40 };
    const q = chunkAt(c, 3);
    expect(q.x).toBe(20);
    expect(q.y).toBeCloseTo(-40 + 0.5 * 40 * 4);
  });
  it('vehicles have nozzles per tier and their bells point down the heading', async () => {
    const { vehicle, localToScreen } = await import('../src/render/cinematics/vehicle');
    expect(vehicle(1).nozzles.length).toBe(1);
    expect(vehicle(3).nozzles.length).toBe(3);
    expect(vehicle(2).bands.length).toBe(1);
    expect(vehicle(3).poly.f.length).toBeGreaterThan(vehicle(1).poly.f.length);
    const [x, y] = localToScreen(0, 1, 0, 50, 0.7, Math.PI / 2);
    expect(x).toBeCloseTo(-50);
    expect(Math.abs(y)).toBeLessThan(1e-9);
  });
});
