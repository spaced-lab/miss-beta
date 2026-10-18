"""Orbit uncertainty and impact probability. Mirror of src/physics/uncertainty.ts (GAME_PLAN 6.14)."""
import math

SIGMA_V_BY_TIER = [0.005, 0.001, 0.0002]
SIGMA_V_INITIAL = 0.02
SIGMA_V_ARC_REF_DAYS = 30


def erf(x: float) -> float:
    sign = -1 if x < 0 else 1
    ax = abs(x)
    t = 1 / (1 + 0.3275911 * ax)
    y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * math.exp(-ax * ax)
    return sign * y


def phi(x: float) -> float:
    return 0.5 * (1 + erf(x / math.sqrt(2)))


def sigma_v_for_tier(tier: int) -> float:
    return SIGMA_V_BY_TIER[max(0, min(len(SIGMA_V_BY_TIER) - 1, tier))]


def sigma_v_with_arc(tier: int, arc_days: float) -> float:
    floor = sigma_v_for_tier(tier)
    if arc_days <= 0:
        return max(floor, SIGMA_V_INITIAL)
    return max(floor, SIGMA_V_INITIAL * math.sqrt(SIGMA_V_ARC_REF_DAYS / arc_days))


def sigma_b(sigma_v: float, t_remaining: float) -> float:
    return 3 * sigma_v * max(0.0, t_remaining)


def impact_probability(d_min: float, b_crit: float, sb: float) -> float:
    if sb <= 0:
        return 1.0 if d_min < b_crit else 0.0
    return phi((d_min + b_crit) / sb) - phi((d_min - b_crit) / sb)

BETA_ASSESS_DELAY = [60 * 86400.0, 20 * 86400.0, 5 * 86400.0]


def beta_assess_delay(tier: int) -> float:
    """Seconds after an impact before beta is assessed, by tracking tier. Mirror of betaAssessDelay."""
    i = max(0, min(len(BETA_ASSESS_DELAY) - 1, tier))
    return BETA_ASSESS_DELAY[i]
