"""Physical and astronomical constants (GAME_PLAN 6.1), SI units. Mirror of src/physics/constants.ts."""
import math

G = 6.6743e-11                     # m^3 kg^-1 s^-2
MU_SUN = 1.32712440018e20          # m^3/s^2
AU = 1.495978707e11                # m
YEAR = 3.15576e7                   # s (Julian year)
DAY = 86400                        # s
C_LIGHT = 299792458                # m/s
SOLAR_CONST_1AU = 1361             # W/m^2
P_RAD_1AU = SOLAR_CONST_1AU / C_LIGHT   # N/m^2, absorbing; x2 for reflecting
G0 = 9.80665                       # m/s^2
MT_TNT = 4.184e15                  # J
SUN_ACCEL_1AU = MU_SUN / (AU * AU) # m/s^2
MU_HOME = 3.986004418e14           # m^3/s^2
R_HOME = 6.371e6                   # m
TWO_PI = 2 * math.pi
