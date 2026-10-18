// WHAT: Slow-push deflection (GAME_PLAN 6.12 and the 20.2 pushers): forces on the body and the integrated arc.
// WHY:  These produce mm/s per year on 100 m class bodies. They are for small threats, fine-tuning after
//       a big push, and fragment sweeping. The numbers show on their own that they do not stop a kilometre
//       rock with three years' warning; that is correct, and the NOT VIABLE ones are shown so the number
//       is on screen (tether, electrostatic, Yarkovsky).
// HOW:  Each method gives a force on the body (N) from its spec; a = F / M along track (sign chosen by the
//       planner). The ground truth is an RK4 arc of the body with the constant along-track acceleration from
//       rendezvous to the end of the push, then new elements. Gravity tractor: a = G m_sc / d^2 with hover
//       distance d = 1.5 R and canted thrust F = 1.3 m_sc G M / d^2 (propellant via the rocket equation).
//       Python mirror: pymiss/physics/slow_push.py.
// LORE: D6 (slow push), D9 (Yarkovsky), O13 (integration)

import { KNOBS } from '../config/knobs';
import type { Vec2 } from '../util/vec';
import { AU, G, G0, P_RAD_1AU, SOLAR_CONST_1AU, YEAR } from './constants';
import { stateToElements } from './elements';
import { integrate, type State4 } from './integrate';
import { propagate, type Elements } from './kepler';

export type PushMethod = 'GRAVITY_TRACTOR' | 'ENHANCED_TRACTOR' | 'ION_BEAM' | 'LASER' | 'GROUND_LASER' | 'MIRRORS' | 'MASS_DRIVER' | 'TUGBOAT' | 'MAGNETIC' | 'TETHER' | 'ELECTROSTATIC' | 'ESAIL' | 'SAIL_ON_BODY' | 'NET_TUG' | 'FUSION_TUG' | 'ORION_TUG' | 'DE_STAR' | 'TRACTORBEAM';

export interface PushSpec {
  method: PushMethod;
  /** Tier index 0..2 where the method has tiers. */
  tier: number;
}

export interface PushForce {
  /** Force on the body, N (0 for NOT VIABLE methods). */
  force: number;
  /** Equivalent for a one-off centre-of-mass shift, m (tether), else 0. */
  comShift: number;
  viable: boolean;
  note: string;
}

/**
 * Gravity tractor pull on the body, N: F = G m_sc M / d^2 with hover distance d = hover R.
 * Example: m_sc 1000 kg, M 1.41e9 kg (100 m stony), R 50 m, hover 1.5 -> d 75 m, F = 0.0167 N.
 */
export function gravityTractorForce(mSc: number, M: number, R: number, hover: number = KNOBS.TRACTOR_HOVER_FACTOR): number {
  const d = hover * R;
  return (G * mSc * M) / (d * d);
}

/** Laser ablation thrust, N: F = C_m P. Example: 1 MW at C_m 3e-5 N/W -> 30 N. */
export function laserForce(powerW: number, cm: number = KNOBS.LASER_CM_N_PER_W): number {
  return cm * powerW;
}

/** Force a method applies to a body of mass M and radius R at heliocentric distance r (m). */
export function pushForce(spec: PushSpec, M: number, R: number, r: number, iron = false): PushForce {
  const t = spec.tier;
  switch (spec.method) {
    case 'GRAVITY_TRACTOR': {
      const mSc = KNOBS.TRACTOR_SC_MASS_KG[t] ?? 1000;
      return { force: gravityTractorForce(mSc, M, R), comShift: 0, viable: true, note: `m_sc ${mSc} kg hovering at ${KNOBS.TRACTOR_HOVER_FACTOR} R` };
    }
    case 'ENHANCED_TRACTOR': {
      const mSc = (KNOBS.TRACTOR_SC_MASS_KG[t] ?? 1000) + 2e4;
      const d = KNOBS.TRACTOR_HOVER_FACTOR * R;
      return { force: (G * mSc * M) / (d * d), comShift: 0, viable: true, note: `tractor plus a 20 t boulder` };
    }
    case 'ION_BEAM':
      return { force: KNOBS.ION_BEAM_N[t] ?? 0.1, comShift: 0, viable: true, note: `beam ${KNOBS.ION_BEAM_N[t]} N, Isp ${KNOBS.ION_ISP_S} s` };
    case 'LASER':
      return { force: laserForce(KNOBS.LASER_POWER_W[t] ?? 5e4), comShift: 0, viable: true, note: `${(KNOBS.LASER_POWER_W[t] ?? 0) / 1e3} kW optical, C_m 3e-5 N/W` };
    case 'GROUND_LASER':
      return { force: KNOBS.LASER_CM_N_PER_W * KNOBS.GROUND_LASER_POWER_W * KNOBS.GROUND_LASER_ATM_EFF, comShift: 0, viable: true, note: `1 MW through the atmosphere (x0.3), only within ${KNOBS.GROUND_LASER_RANGE_AU} AU` };
    case 'MIRRORS': {
      const A = KNOBS.MIRROR_AREA_M2[t] ?? 1e3;
      const P = 0.6 * SOLAR_CONST_1AU * A * (AU / r) * (AU / r);
      return { force: KNOBS.MIRROR_CM_N_PER_W * P, comShift: 0, viable: true, note: `${A} m^2 of mirrors, fouling 10%/month` };
    }
    case 'MASS_DRIVER':
      return { force: (KNOBS.MASS_DRIVER_MDOT[t] ?? 0.1) * KNOBS.MASS_DRIVER_VE, comShift: 0, viable: true, note: `${KNOBS.MASS_DRIVER_MDOT[t]} kg/s at ${KNOBS.MASS_DRIVER_VE} m/s; needs landing and anchoring` };
    case 'TUGBOAT':
      return { force: KNOBS.TUGBOAT_ETA_SPIN * (t >= 1 ? KNOBS.TUGBOAT_F_CHEM_N : KNOBS.TUGBOAT_F_ION_N), comShift: 0, viable: true, note: `eta_spin ${KNOBS.TUGBOAT_ETA_SPIN} unless despun` };
    case 'MAGNETIC':
      return iron ? { force: KNOBS.MAGNETIC_ETA_SPIN * KNOBS.TUGBOAT_F_ION_N, comShift: 0, viable: true, note: 'contact induction tug, iron only' } : { force: 0, comShift: 0, viable: false, note: 'NOT VIABLE: the body is not iron' };
    case 'TETHER': {
      const shift = (KNOBS.TETHER_L_M * KNOBS.TETHER_MASS_KG) / (M + KNOBS.TETHER_MASS_KG);
      return { force: 0, comShift: shift, viable: shift > 1e5, note: `COM shift ${shift.toFixed(0)} m with a ${KNOBS.TETHER_L_M / 1e3} km tether: NOT VIABLE` };
    }
    case 'ELECTROSTATIC':
      return { force: 0, comShift: 0, viable: false, note: 'screened by solar-wind plasma (Debye length ~10 m): F ~ 0. NOT VIABLE' };
    case 'ESAIL':
      return { force: KNOBS.ESAIL_N_PER_KM * KNOBS.ESAIL_TETHER_KM * (AU / r), comShift: 0, viable: true, note: `${KNOBS.ESAIL_TETHER_KM} km of tether: ${(KNOBS.ESAIL_N_PER_KM * KNOBS.ESAIL_TETHER_KM * 1e3).toFixed(0)} mN` };
    case 'SAIL_ON_BODY': {
      const A = 1e6;
      return { force: 2 * P_RAD_1AU * A * (AU / r) * (AU / r), comShift: 0, viable: true, note: '1 km^2 sail on the body: ~9 N at 1 AU' };
    }
    // --- SPECULATIVE (SCI-FI mode, 20.3) ---
    case 'NET_TUG':
      return { force: KNOBS.NET_TUG_N[t] ?? 10, comShift: 0, viable: true, note: `CNT net, ${KNOBS.NET_TUG_N[t] ?? 10} N tug; momentum coupling 100%, no beta uncertainty` };
    case 'FUSION_TUG':
      return { force: KNOBS.FUSION_TUG_N, comShift: 0, viable: true, note: '50 kN continuous: a year on 1e11 kg gives ~15 m/s; no fusion engine exists' };
    case 'ORION_TUG':
      return { force: KNOBS.ORION_PULSE_NS / KNOBS.ORION_PULSE_PERIOD_S, comShift: 0, viable: true, note: `pulse units of ${KNOBS.ORION_PULSE_NS.toExponential(0)} N s every ${KNOBS.ORION_PULSE_PERIOD_S} s; never built, treaty-barred` };
    case 'DE_STAR':
      return { force: KNOBS.LASER_CM_N_PER_W * KNOBS.DE_STAR_POWER_W, comShift: 0, viable: true, note: `${(KNOBS.DE_STAR_POWER_W / 1e9).toFixed(0)} GW phased array at L1; works within ${KNOBS.DE_STAR_RANGE_AU} AU without a flight` };
    // --- FICTION (SIMULATION mode, 20.4) ---
    case 'TRACTORBEAM':
      return { force: 1e6, comShift: 0, viable: true, note: '1e6 N at any range, no reaction mass: momentum conservation violated' };
  }
}

/** Yarkovsky drift of a ~1 km body, m, over `seconds`: ~2e-4 AU/Myr. Always shown as NOT VIABLE. */
export function yarkovskyDrift(seconds: number): number {
  return (2e-4 * AU * seconds) / (1e6 * YEAR);
}

/** Propellant for a gravity tractor hovering for tau seconds: F = 1.3 m_sc G M / d^2, rocket equation. */
export function tractorPropellant(mSc: number, M: number, R: number, tau: number, isp = KNOBS.ION_ISP_S): number {
  const d = KNOBS.TRACTOR_HOVER_FACTOR * R;
  const F = (KNOBS.TRACTOR_THRUST_FACTOR * mSc * G * M) / (d * d);
  const mdot = F / (isp * G0);
  return mdot * tau;
}

export interface PushArc {
  elements: Elements;
  /** Total along-track dv delivered, m/s. */
  dv: number;
}

/**
 * Integrate the body under its own gravity plus a constant along-track acceleration `a` (m/s^2, signed:
 * positive speeds it up) from t0 to t1, returning the new elements at t1.
 */
export function integratePush(el: Elements, mu: number, t0: number, t1: number, a: number, h = KNOBS.PUSH_DT, allowUnbound = el.e > 1): PushArc {
  const s0 = propagate(el, mu, t0);
  const state: State4 = [s0.r.x, s0.r.y, s0.v.x, s0.v.y];
  const f = (_t: number, s: State4): State4 => {
    const r2 = s[0] * s[0] + s[1] * s[1];
    const r3 = r2 * Math.sqrt(r2);
    const vm = Math.hypot(s[2], s[3]) || 1;
    return [s[2], s[3], (-mu * s[0]) / r3 + (a * s[2]) / vm, (-mu * s[1]) / r3 + (a * s[3]) / vm];
  };
  const end = integrate(f, state, t0, t1, h);
  const r: Vec2 = { x: end[0], y: end[1] };
  const v: Vec2 = { x: end[2], y: end[3] };
  return { elements: stateToElements(r, v, mu, t1, allowUnbound), dv: a * (t1 - t0) };
}
