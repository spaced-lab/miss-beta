// WHAT: Which Learning Center topic explains each tech track, program and options row.
// WHY:  Owner, 2026-10-18: obvious ways to jump from OPTIONS, the tech tree and the programs panel into the
//       Learning Center and back. One table keeps the links in one place and testable against EDUCATION.md.
// HOW:  Plain maps; screens call `topicForTrack` etc. and route to the center, which returns on Esc.
// LORE: G2 (screens and HUD), G4 (programs)

export const TRACK_TOPIC: Readonly<Record<string, string>> = {
  LAUNCH: 'D8', IMPACTOR: 'D3', NAV: 'O11', SAIL: 'D7', PROPULSION: 'D8', SWARM: 'D4', TERMINAL: 'D3',
  TRACKING: 'F8', AUTONOMY: 'D12', WARHEADS: 'D5', 'SLOW PUSH': 'D6', NET: 'D10',
};

export const PROGRAM_TOPIC: Readonly<Record<string, string>> = {
  INTL_COORDINATION: 'F10', CIVIL_DEFENSE_READY: 'D10', GROUND_SURVEY_EXPANSION: 'F5', SPACE_IR_SURVEYOR: 'F4',
  SUNWARD_SENTINEL: 'F3', RADAR_NET: 'F6', PRECURSOR_FLEET: 'D3', INTERCEPTOR_STOCKPILE: 'D3', HEAVY_LAUNCH_CADENCE: 'D8',
  ORBITAL_DEPOT: 'D8', NUCLEAR_READINESS: 'D5', GROUND_LASER: 'D6', L4_L5_SENTINELS: 'F7', VENUS_ORBIT_IR: 'F7',
  LUNAR_FARSIDE_STATION: 'F7', SAIL_SWARM_DEPOT: 'D7', ORBITAL_LASER_ARRAY: 'D6', LUNAR_MASS_DRIVER: 'D8',
  FUSION_TUG_FLEET: 'D6', DISASSEMBLER_SWARM: 'D10', NANOFORGE_SEEDS: 'D13', THRUSTER_SWARM: 'D13', SHEPHERD_NETWORK: 'D13',
  SEED_FLEET: 'D13', L4_L5_PICKET: 'D13', SAIL_KITS: 'D13', INTERCEPTOR_ON_STANDBY: 'T6', MOON_BASE: 'T7', MARS_CITIES: 'T7', GIANT_MOON_OUTPOSTS: 'T7',
};

export const OPTION_TOPIC: Readonly<Record<string, string>> = {
  'COLOR MODE': 'G8', COLOUR: 'G8', 'CRT EFFECTS': 'G8', GLOW: 'G8', SOUND: 'G8', UNITS: 'O1', 'REDUCE MOTION': 'G8',
  'TEXT SIZE': 'G8', 'LEARNING LEVEL': 'G1', TIPS: 'G1', 'INTERSTELLAR RATE': 'T6', 'EXPERIMENTAL TECH': 'D14',
  'AUTOPLAY SPEED': 'G1', 'DEMO LENGTH': 'G1',
};

export const topicForTrack = (track: string): string => TRACK_TOPIC[track] ?? 'G4';
export const topicForProgram = (id: string): string => PROGRAM_TOPIC[id] ?? 'G4';
export const topicForOption = (label: string): string => OPTION_TOPIC[label] ?? 'G8';
