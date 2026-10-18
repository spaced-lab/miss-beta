// Detection gauge (owner backlog 9): geometry helpers, the threshold rule, and the needles' behaviour on the model.
import { describe, expect, it } from 'vitest';
import { approachSunAngle, gaugeVerdict, readGauge, referenceStats, sizeGrid, sizeLabel, thresholdSize, tiltAboutNode, trailingLoss, viewGeometry3 } from '../src/sim/gauge';
import { defaultActiveNetworks } from '../src/sim/detection';
import { AU } from '../src/physics/constants';

describe('GAUGE helpers', () => {
  it('size grid spans 1 m to 10 km at six points a decade', () => {
    const g = sizeGrid();
    expect(g.length).toBe(25);
    expect(g[0]).toBeCloseTo(1, 9);
    expect(g[24]).toBeCloseTo(10000, 6);
  });
  it('threshold interpolates in log size', () => {
    expect(thresholdSize([10, 100], [0.2, 0.8], 0.5)).toBeCloseTo(31.62, 1);
    expect(thresholdSize([10, 100], [0.6, 0.8], 0.5)).toBe(10);
    expect(thresholdSize([10, 100], [0.1, 0.2], 0.5)).toBeNull();
  });
  it('tilt about the node keeps length and lifts the cross-node part', () => {
    const v = tiltAboutNode({ x: 0, y: 1 }, { x: 1, y: 0 }, Math.PI / 2);
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(1, 12);
    const w = tiltAboutNode({ x: 3, y: 4 }, { x: 0.6, y: 0.8 }, 0.7);
    expect(Math.hypot(w.x, w.y, w.z)).toBeCloseTo(5, 12);
  });
  it('sky rate and trailing loss match the doc examples', () => {
    const g = viewGeometry3({ x: AU, y: 0.05 * AU, z: 0 }, { x: 8000, y: 0, z: 0 }, { x: AU, y: 0 }, { x: 0, y: 0 });
    expect(g.rate).toBeCloseTo(1.07e-6, 8);
    expect(trailingLoss(g.rate)).toBeCloseTo(1.8, 1);
    expect(trailingLoss(0)).toBe(0);
  });
  it('approach angle: a rock arriving from the Sun side reads 0 deg', () => {
    expect(approachSunAngle({ x: AU, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 9);
    expect(approachSunAngle({ x: AU, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180, 9);
  });
  it('labels and verdicts', () => {
    expect(sizeLabel(85)).toBe('85 M');
    expect(sizeLabel(1400)).toBe('1.4 KM');
    expect(sizeLabel(null)).toBe('> 10 KM');
    expect(gaugeVerdict(85, 3 * 3.15576e7, false, 140)).toBe('THIS ROCK: 85 M. YOUR DEFLECT NEEDLE: 140 M. YOU SAW IT BY LUCK.');
  });
});

describe('GAUGE on the model', () => {
  it('has ordinary, sunward and hyperbolic reference rocks', () => {
    const r = referenceStats();
    expect(r.total - r.hyperbolic).toBeGreaterThan(20);
    expect(r.sunward).toBeGreaterThan(5);
    expect(r.hyperbolic).toBeGreaterThan(10);
  });
  it('needles are ordered sensibly and move as networks and years are added', () => {
    const today = readGauge(defaultActiveNetworks(), {}, 2026);
    const d = today.needles.DEFLECT ?? Infinity;
    const e = today.needles.EVACUATE ?? Infinity;
    // Three weeks of warning is easier than a year; interstellar visitors are the hardest; fireballs see metres.
    expect(e).toBeLessThanOrEqual(d);
    expect(today.needles.INTERSTELLAR ?? Infinity).toBeGreaterThan(d);
    expect(today.needles.AFTERMATH).toBe(1);
    // Today's DEFLECT needle sits in the tens of metres to low hundreds (the model; real catalogs: see F11).
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(300);
    // Rubin's survey years fill the catalog: the needle falls over a decade.
    const later = readGauge(defaultActiveNetworks(), {}, 2036);
    expect(later.needles.DEFLECT ?? Infinity).toBeLessThan(d);
    // Removing every survey but fireball sensors leaves no needle on the bar.
    const none = readGauge(['AIRBURST'], {}, 2026);
    expect(none.needles.DEFLECT).toBeNull();
    // Curves never fall with size (bigger is brighter, common random numbers).
    for (const c of Object.values(today.curves)) for (let i = 1; i < c.length; i++) expect(c[i] ?? 0).toBeGreaterThanOrEqual((c[i - 1] ?? 0) - 1e-12);
  }, 60000);
});
