export type SurfaceType = 'asphalt' | 'concrete_kerb' | 'grass' | 'gravel' | 'rumble_kerb';

export interface SurfaceProperties {
  type: SurfaceType;
  name: string;
  frictionMultiplier: number;  // Multiplier on Pacejka peak friction D (1.0 = baseline dry asphalt)
  rollingResistanceCoeff: number; // Opposing drag coefficient per unit normal load Fz
  bumpAmplitudeM: number;       // Micro-bump suspension displacement amplitude (m)
  bumpFrequencyHz: number;      // Kerb rumble oscillation frequency factor
}

export const SURFACE_CATALOG: Record<SurfaceType, SurfaceProperties> = {
  asphalt: {
    type: 'asphalt',
    name: 'Racing Asphalt',
    frictionMultiplier: 1.0,
    rollingResistanceCoeff: 0.015,
    bumpAmplitudeM: 0.0,
    bumpFrequencyHz: 0.0,
  },
  concrete_kerb: {
    type: 'concrete_kerb',
    name: 'Concrete Kerb',
    frictionMultiplier: 0.90,
    rollingResistanceCoeff: 0.020,
    bumpAmplitudeM: 0.008,
    bumpFrequencyHz: 35.0,
  },
  rumble_kerb: {
    type: 'rumble_kerb',
    name: 'Serrated Rumble Strip',
    frictionMultiplier: 0.85,
    rollingResistanceCoeff: 0.025,
    bumpAmplitudeM: 0.018,
    bumpFrequencyHz: 48.0,
  },
  grass: {
    type: 'grass',
    name: 'Trackside Grass',
    frictionMultiplier: 0.35,
    rollingResistanceCoeff: 0.040,
    bumpAmplitudeM: 0.012,
    bumpFrequencyHz: 12.0,
  },
  gravel: {
    type: 'gravel',
    name: 'Gravel Runoff Trap',
    frictionMultiplier: 0.45,
    rollingResistanceCoeff: 0.280, // Heavy displacement drag that stops runaway cars
    bumpAmplitudeM: 0.025,
    bumpFrequencyHz: 16.0,
  },
};

export function getSurfaceProperties(type?: string): SurfaceProperties {
  if (type && type in SURFACE_CATALOG) {
    return SURFACE_CATALOG[type as SurfaceType];
  }
  return SURFACE_CATALOG.asphalt;
}
