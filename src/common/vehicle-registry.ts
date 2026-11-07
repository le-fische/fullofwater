/**
 * Modular Multi-Vehicle Database & Registry
 * Supports multi-class vehicle management, stock vs race variants,
 * and sandbox vehicle rosters (GT, F1, Prototype, Street Stock, and Sandbox Tuk-Tuk).
 */

import { CarProfile } from './types';

export interface VehicleCatalogEntry extends CarProfile {
  trim: 'race' | 'stock';
  category: 'gt' | 'f1' | 'prototype' | 'street' | 'sandbox';
  year: number;
  description: string;
}

// 1. Porsche 911 RSR-19 (GT / GTE Race)
export const PORSCHE_992_RSR: VehicleCatalogEntry = {
  id: 'porsche_911_rsr_19_992',
  name: 'Porsche 911 RSR-19 (992)',
  class: 'GTE',
  category: 'gt',
  trim: 'race',
  year: 2022,
  description: 'Mid-rear 4.2L NA flat-six endurance racing thoroughbred with high aerodynamic downforce.',
  specs: {
    engine: '4.2L Naturally Aspirated Flat-6',
    powerPS: 515,
    torqueNm: 470,
    weightKg: 1242,
    topSpeedKmh: 298,
    topSpeedDrsKmh: 318,
  },
  chassis: {
    massKg: 1242,
    cgHeightM: 0.40,
    frontWeightFraction: 0.43,
    wheelbaseM: 2.455,
    trackFrontM: 1.540,
    trackRearM: 1.540,
    inertiaTensor: [1650, 420, 1850],
  },
  suspension: {
    front: {
      springNPerM: 125000,
      bumpNsPerM: 14000,
      reboundNsPerM: 16000,
      travelM: 0.095,
      antiRollNmPerRad: 95000,
    },
    rear: {
      springNPerM: 145000,
      bumpNsPerM: 16000,
      reboundNsPerM: 18000,
      travelM: 0.095,
      antiRollNmPerRad: 105000,
    },
  },
  tires: {
    compound: 'slick_medium',
    front: {
      radiusM: 0.342,
      widthM: 0.305,
      pacejkaLat: { B: 12.5, C: 1.85, D: 1.68, E: 0.95 },
      pacejkaLong: { B: 14.5, C: 1.65, D: 1.55, E: 0.95 },
    },
    rear: {
      radiusM: 0.354,
      widthM: 0.315,
      pacejkaLat: { B: 12.5, C: 1.85, D: 1.75, E: 0.95 },
      pacejkaLong: { B: 14.5, C: 1.65, D: 1.55, E: 0.95 },
    },
  },
  steering: {
    maxWheelAngleDeg: 34.0,
    maxRateDegPerS: 340.0,
    highSpeedLockFraction: 0.35,
    speedSensitivityStartKmh: 65.0,
  },
  engine: {
    type: 'ice',
    idleRpm: 2000,
    redlineRpm: 9000,
    limiterRpm: 9250,
    inertiaKgM2: 0.11,
    engineBrakeNm: 85,
    torqueCurve: [
      [2000, 280],
      [3500, 360],
      [5500, 440],
      [7200, 470],
      [8200, 460],
      [9000, 420],
      [9250, 370],
    ],
  },
  transmission: {
    type: 'sequential',
    auto: true,
    ratios: [3.18, 2.25, 1.78, 1.48, 1.26, 1.10],
    reverse: -3.20,
    finalDrive: 3.44,
    shiftTimeS: 0.045,
    upshiftRpm: 8800,
    downshiftRpm: 6200,
  },
  brakes: {
    maxTorqueNm: 6800,
    frontBias: 0.57,
    padFrictionCoeff: 0.48,
    initialTempC: 180,
  },
  aero: {
    dragCdA: 0.88,
    downforceClA: 2.85,
    aeroBalanceFront: 0.42,
    drs: {
      dragReduction: 0.28,
      downforceReduction: 0.35,
    },
  },
  assists: {
    tractionControl: 0.65,
    abs: true,
    stability: 0.45,
    counterSteer: 0.30,
    throttleRampS: 0.05,
    brakeRampS: 0.05,
  },
};

// 2. Formula Apex 2026 (Open-Wheel Formula 1)
export const FORMULA_APEX_2026: VehicleCatalogEntry = {
  id: 'formula_apex_2026',
  name: 'Formula Apex 2026',
  class: 'Formula 1',
  category: 'f1',
  trim: 'race',
  year: 2026,
  description: '1.6L V6 Turbo-hybrid 1000 PS open-wheel single seater with extreme ground effect downforce.',
  specs: {
    engine: '1.6L V6 Turbo-Hybrid (ICE + MGU-K)',
    powerPS: 1000,
    torqueNm: 650,
    weightKg: 798,
    topSpeedKmh: 355,
    topSpeedDrsKmh: 368,
  },
  chassis: {
    massKg: 798,
    cgHeightM: 0.28,
    frontWeightFraction: 0.46,
    wheelbaseM: 3.600,
    trackFrontM: 1.600,
    trackRearM: 1.550,
    inertiaTensor: [850, 240, 950],
  },
  suspension: {
    front: {
      springNPerM: 280000,
      bumpNsPerM: 12000,
      reboundNsPerM: 16000,
      travelM: 0.045,
      antiRollNmPerRad: 160000,
    },
    rear: {
      springNPerM: 320000,
      bumpNsPerM: 14000,
      reboundNsPerM: 18000,
      travelM: 0.045,
      antiRollNmPerRad: 140000,
    },
  },
  tires: {
    compound: 'slick_soft',
    front: {
      radiusM: 0.360,
      widthM: 0.305,
      pacejkaLat: { B: 15.0, C: 1.90, D: 1.85, E: 0.95 },
      pacejkaLong: { B: 16.0, C: 1.70, D: 1.90, E: 0.95 },
    },
    rear: {
      radiusM: 0.360,
      widthM: 0.405,
      pacejkaLat: { B: 15.0, C: 1.90, D: 2.15, E: 0.95 },
      pacejkaLong: { B: 16.0, C: 1.70, D: 2.20, E: 0.95 },
    },
  },
  steering: {
    maxWheelAngleDeg: 16.0,
    maxRateDegPerS: 380.0,
    highSpeedLockFraction: 0.28,
    speedSensitivityStartKmh: 25.0,
  },
  engine: {
    type: 'hybrid',
    idleRpm: 4000,
    redlineRpm: 15000,
    limiterRpm: 15250,
    inertiaKgM2: 0.055,
    engineBrakeNm: 60,
    regenBrakeNm: 350,
    torqueCurve: [
      [4000, 320],
      [7000, 480],
      [10500, 650],
      [12500, 620],
      [14500, 560],
      [15250, 490],
    ],
  },
  transmission: {
    type: 'sequential',
    auto: true,
    ratios: [3.40, 2.60, 2.10, 1.75, 1.50, 1.30, 1.15, 1.02],
    reverse: -3.50,
    finalDrive: 3.10,
    shiftTimeS: 0.020,
    upshiftRpm: 14500,
    downshiftRpm: 10500,
  },
  brakes: {
    maxTorqueNm: 8500,
    frontBias: 0.55,
    padFrictionCoeff: 0.55,
    initialTempC: 350,
  },
  aero: {
    dragCdA: 1.10,
    downforceClA: 5.20,
    aeroBalanceFront: 0.44,
    drs: {
      dragReduction: 0.38,
      downforceReduction: 0.42,
    },
  },
  assists: {
    tractionControl: 0.0, // F1 regulations: 0 TC
    abs: false,           // F1 regulations: 0 ABS
    stability: 0.20,
    counterSteer: 0.25,
    throttleRampS: 0.08,
    brakeRampS: 0.06,
  },
};

// 3. Porsche 963 LMDh (Le Mans Prototype Hypercar)
export const PORSCHE_963_LMDH: VehicleCatalogEntry = {
  id: 'porsche_963_lmdh',
  name: 'Porsche 963 LMDh',
  class: 'Hypercar',
  category: 'prototype',
  trim: 'race',
  year: 2023,
  description: '4.6L twin-turbo V8 + Bosch MGU hybrid prototype competing for overall 24 Hours of Le Mans victory.',
  specs: {
    engine: '4.6L Twin-Turbo V8 + Bosch Hybrid MGU',
    powerPS: 680,
    torqueNm: 600,
    weightKg: 1030,
    topSpeedKmh: 340,
    topSpeedDrsKmh: 340,
  },
  chassis: {
    massKg: 1030,
    cgHeightM: 0.34,
    frontWeightFraction: 0.45,
    wheelbaseM: 3.148,
    trackFrontM: 1.620,
    trackRearM: 1.600,
    inertiaTensor: [1250, 310, 1400],
  },
  suspension: {
    front: {
      springNPerM: 190000,
      bumpNsPerM: 9500,
      reboundNsPerM: 13500,
      travelM: 0.055,
      antiRollNmPerRad: 125000,
    },
    rear: {
      springNPerM: 210000,
      bumpNsPerM: 10500,
      reboundNsPerM: 14500,
      travelM: 0.055,
      antiRollNmPerRad: 110000,
    },
  },
  tires: {
    compound: 'slick_medium',
    front: {
      radiusM: 0.355,
      widthM: 0.310,
      pacejkaLat: { B: 13.5, C: 1.88, D: 1.65, E: 0.95 },
      pacejkaLong: { B: 15.0, C: 1.68, D: 1.70, E: 0.95 },
    },
    rear: {
      radiusM: 0.355,
      widthM: 0.310,
      pacejkaLat: { B: 13.5, C: 1.88, D: 1.85, E: 0.95 },
      pacejkaLong: { B: 15.0, C: 1.68, D: 1.85, E: 0.95 },
    },
  },
  steering: {
    maxWheelAngleDeg: 19.0,
    maxRateDegPerS: 340.0,
    highSpeedLockFraction: 0.32,
    speedSensitivityStartKmh: 20.0,
  },
  engine: {
    type: 'hybrid',
    idleRpm: 2500,
    redlineRpm: 10000,
    limiterRpm: 10250,
    inertiaKgM2: 0.085,
    engineBrakeNm: 75,
    regenBrakeNm: 280,
    torqueCurve: [
      [2500, 380],
      [4500, 520],
      [7500, 600],
      [9000, 580],
      [10250, 510],
    ],
  },
  transmission: {
    type: 'sequential',
    auto: true,
    ratios: [3.20, 2.35, 1.85, 1.52, 1.28, 1.10, 0.96],
    reverse: -3.30,
    finalDrive: 3.25,
    shiftTimeS: 0.035,
    upshiftRpm: 9700,
    downshiftRpm: 7200,
  },
  brakes: {
    maxTorqueNm: 7600,
    frontBias: 0.56,
    padFrictionCoeff: 0.52,
    initialTempC: 220,
  },
  aero: {
    dragCdA: 0.95,
    downforceClA: 4.10,
    aeroBalanceFront: 0.45,
  },
  assists: {
    tractionControl: 0.55,
    abs: true,
    stability: 0.35,
    counterSteer: 0.28,
    throttleRampS: 0.14,
    brakeRampS: 0.10,
  },
};

// 4. Porsche 911 GT3 RS (992 Street Stock)
export const PORSCHE_992_GT3_STREET: VehicleCatalogEntry = {
  id: 'porsche_992_gt3_street',
  name: 'Porsche 911 GT3 RS (992 Street)',
  class: 'Street Supercar',
  category: 'street',
  trim: 'stock',
  year: 2023,
  description: 'Production road-legal track weapon with active aero, street Michelin Cup 2 R tires, and road compliance.',
  specs: {
    engine: '4.0L Naturally Aspirated Flat-6',
    powerPS: 525,
    torqueNm: 465,
    weightKg: 1450,
    topSpeedKmh: 296,
    topSpeedDrsKmh: 305,
  },
  chassis: {
    massKg: 1450,
    cgHeightM: 0.44,
    frontWeightFraction: 0.41,
    wheelbaseM: 2.457,
    trackFrontM: 1.630,
    trackRearM: 1.600,
    inertiaTensor: [1850, 480, 2050],
  },
  suspension: {
    front: {
      springNPerM: 100000,
      bumpNsPerM: 5500,
      reboundNsPerM: 7500,
      travelM: 0.090,
      antiRollNmPerRad: 65000,
    },
    rear: {
      springNPerM: 140000,
      bumpNsPerM: 6500,
      reboundNsPerM: 8500,
      travelM: 0.090,
      antiRollNmPerRad: 55000,
    },
  },
  tires: {
    compound: 'street_sport',
    front: {
      radiusM: 0.340,
      widthM: 0.275,
      pacejkaLat: { B: 11.0, C: 1.70, D: 1.30, E: 0.90 },
      pacejkaLong: { B: 12.0, C: 1.60, D: 1.35, E: 0.90 },
    },
    rear: {
      radiusM: 0.365,
      widthM: 0.335,
      pacejkaLat: { B: 11.0, C: 1.70, D: 1.40, E: 0.90 },
      pacejkaLong: { B: 12.0, C: 1.60, D: 1.45, E: 0.90 },
    },
  },
  steering: {
    maxWheelAngleDeg: 28.0,
    maxRateDegPerS: 300.0,
    highSpeedLockFraction: 0.40,
    speedSensitivityStartKmh: 15.0,
  },
  engine: {
    type: 'ice',
    idleRpm: 1200,
    redlineRpm: 9000,
    limiterRpm: 9200,
    inertiaKgM2: 0.14,
    engineBrakeNm: 75,
    torqueCurve: [
      [1200, 240],
      [3000, 340],
      [5000, 420],
      [6300, 465],
      [8500, 450],
      [9200, 390],
    ],
  },
  transmission: {
    type: 'dual_clutch',
    auto: true,
    ratios: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84],
    reverse: -3.40,
    finalDrive: 4.10,
    shiftTimeS: 0.080,
    upshiftRpm: 8800,
    downshiftRpm: 5500,
  },
  brakes: {
    maxTorqueNm: 5800,
    frontBias: 0.60,
    padFrictionCoeff: 0.44,
    initialTempC: 80,
  },
  aero: {
    dragCdA: 0.92,
    downforceClA: 1.45,
    aeroBalanceFront: 0.38,
    drs: {
      dragReduction: 0.22,
      downforceReduction: 0.30,
    },
  },
  assists: {
    tractionControl: 0.80,
    abs: true,
    stability: 0.70,
    counterSteer: 0.40,
    throttleRampS: 0.22,
    brakeRampS: 0.15,
  },
};

// 5. Bajaj Auto RE Tuk-Tuk (Stock Sandbox Novelty)
export const TUK_TUK_STOCK: VehicleCatalogEntry = {
  id: 'autorickshaw_tuk_tuk',
  name: 'Bajaj RE Auto Tuk-Tuk (Stock)',
  class: 'Novelty / Micro',
  category: 'sandbox',
  trim: 'stock',
  year: 2020,
  description: '198cc single-cylinder 9.5 PS three-wheeled urban legend. High center of gravity, narrow track, and pure comedy.',
  specs: {
    engine: '198cc Single-Cylinder 4-Stroke Air-Cooled',
    powerPS: 9.5,
    torqueNm: 16.5,
    weightKg: 340,
    topSpeedKmh: 65,
  },
  chassis: {
    massKg: 340,
    cgHeightM: 0.62, // High CG makes aggressive cornering hilariously prone to 2-wheel tipping!
    frontWeightFraction: 0.35,
    wheelbaseM: 2.000,
    trackFrontM: 0.300, // Three-wheeler approximation (single front tire)
    trackRearM: 1.150, // Narrow rear axle
    inertiaTensor: [280, 180, 320],
  },
  suspension: {
    front: {
      springNPerM: 22000,
      bumpNsPerM: 1800,
      reboundNsPerM: 2400,
      travelM: 0.110,
      antiRollNmPerRad: 5000,
    },
    rear: {
      springNPerM: 35000,
      bumpNsPerM: 2200,
      reboundNsPerM: 3000,
      travelM: 0.110,
      antiRollNmPerRad: 8000,
    },
  },
  tires: {
    compound: 'street_sport',
    front: {
      radiusM: 0.220, // Small 8" scooter wheels
      widthM: 0.100,
      pacejkaLat: { B: 8.0, C: 1.40, D: 0.85, E: 0.85 },
      pacejkaLong: { B: 9.0, C: 1.40, D: 0.90, E: 0.85 },
    },
    rear: {
      radiusM: 0.220,
      widthM: 0.100,
      pacejkaLat: { B: 8.0, C: 1.40, D: 0.95, E: 0.85 },
      pacejkaLong: { B: 9.0, C: 1.40, D: 0.95, E: 0.85 },
    },
  },
  steering: {
    maxWheelAngleDeg: 38.0, // High steering lock for tight alley u-turns
    maxRateDegPerS: 450.0,
    highSpeedLockFraction: 0.45,
    speedSensitivityStartKmh: 12.0,
  },
  engine: {
    type: 'ice',
    idleRpm: 1400,
    redlineRpm: 5500,
    limiterRpm: 5800,
    inertiaKgM2: 0.040,
    engineBrakeNm: 18,
    torqueCurve: [
      [1400, 12],
      [2800, 16.5],
      [4200, 15.0],
      [5500, 11.0],
      [5800, 6.0],
    ],
  },
  transmission: {
    type: 'sequential',
    auto: true,
    ratios: [3.80, 2.40, 1.60, 1.10],
    reverse: -4.00,
    finalDrive: 4.80,
    shiftTimeS: 0.120,
    upshiftRpm: 5200,
    downshiftRpm: 2800,
  },
  brakes: {
    maxTorqueNm: 950,
    frontBias: 0.35,
    padFrictionCoeff: 0.38,
    initialTempC: 40,
  },
  aero: {
    dragCdA: 1.25, // Boxy brick aerodynamics
    downforceClA: 0.00, // Zero downforce
    aeroBalanceFront: 0.50,
  },
  assists: {
    tractionControl: 0.0,
    abs: false,
    stability: 0.10,
    counterSteer: 0.15,
    throttleRampS: 0.25,
    brakeRampS: 0.20,
  },
};

// 6. Tuk-Tuk Turbo Hayabusa (Sandbox Special)
export const TUK_TUK_HAYABUSA_TURBO: VehicleCatalogEntry = {
  id: 'tuk_tuk_turbo_hayabusa',
  name: 'Tuk-Tuk Turbo Hayabusa (Sandbox Extreme)',
  class: 'Sandbox Special',
  category: 'sandbox',
  trim: 'race',
  year: 2024,
  description: '1,340cc Suzuki Hayabusa Turbo swapped 250 PS Tuk-Tuk. Terrifying power-to-weight ratio, wheelie-prone sandbox beast.',
  specs: {
    engine: '1,340cc Turbocharged Inline-4 Motorcycle Engine',
    powerPS: 250,
    torqueNm: 220,
    weightKg: 380,
    topSpeedKmh: 215,
  },
  chassis: {
    massKg: 380,
    cgHeightM: 0.54,
    frontWeightFraction: 0.38,
    wheelbaseM: 2.100,
    trackFrontM: 0.400,
    trackRearM: 1.350, // Widened rear axle to survive 250 PS
    inertiaTensor: [340, 210, 420],
  },
  suspension: {
    front: {
      springNPerM: 55000,
      bumpNsPerM: 3500,
      reboundNsPerM: 5000,
      travelM: 0.075,
      antiRollNmPerRad: 25000,
    },
    rear: {
      springNPerM: 75000,
      bumpNsPerM: 4500,
      reboundNsPerM: 6500,
      travelM: 0.075,
      antiRollNmPerRad: 35000,
    },
  },
  tires: {
    compound: 'slick_soft',
    front: {
      radiusM: 0.260,
      widthM: 0.140,
      pacejkaLat: { B: 11.5, C: 1.70, D: 1.45, E: 0.90 },
      pacejkaLong: { B: 12.5, C: 1.60, D: 1.50, E: 0.90 },
    },
    rear: {
      radiusM: 0.280,
      widthM: 0.220, // Wide motorcycle slick on rear
      pacejkaLat: { B: 12.5, C: 1.75, D: 1.65, E: 0.90 },
      pacejkaLong: { B: 13.5, C: 1.65, D: 1.75, E: 0.90 },
    },
  },
  steering: {
    maxWheelAngleDeg: 32.0,
    maxRateDegPerS: 400.0,
    highSpeedLockFraction: 0.30,
    speedSensitivityStartKmh: 16.0,
  },
  engine: {
    type: 'ice',
    idleRpm: 1800,
    redlineRpm: 11000,
    limiterRpm: 11300,
    inertiaKgM2: 0.065,
    engineBrakeNm: 45,
    torqueCurve: [
      [1800, 60],
      [4500, 140],
      [7500, 220],
      [9500, 215],
      [11000, 180],
      [11300, 120],
    ],
  },
  transmission: {
    type: 'sequential',
    auto: true,
    ratios: [2.61, 1.93, 1.52, 1.28, 1.13, 1.04],
    reverse: -3.20,
    finalDrive: 3.20,
    shiftTimeS: 0.045,
    upshiftRpm: 10500,
    downshiftRpm: 6800,
  },
  brakes: {
    maxTorqueNm: 2800,
    frontBias: 0.50,
    padFrictionCoeff: 0.48,
    initialTempC: 90,
  },
  aero: {
    dragCdA: 1.15,
    downforceClA: 0.30,
    aeroBalanceFront: 0.40,
  },
  assists: {
    tractionControl: 0.40,
    abs: true,
    stability: 0.30,
    counterSteer: 0.35,
    throttleRampS: 0.12,
    brakeRampS: 0.10,
  },
};

export const VEHICLE_DATABASE: Record<string, VehicleCatalogEntry> = {
  porsche_911_rsr_19_992: PORSCHE_992_RSR,
  formula_apex_2026: FORMULA_APEX_2026,
  porsche_963_lmdh: PORSCHE_963_LMDH,
  porsche_992_gt3_street: PORSCHE_992_GT3_STREET,
  autorickshaw_tuk_tuk: TUK_TUK_STOCK,
  tuk_tuk_turbo_hayabusa: TUK_TUK_HAYABUSA_TURBO,
};

export class VehicleRegistry {
  static getVehicle(id: string): VehicleCatalogEntry {
    return VEHICLE_DATABASE[id] ?? PORSCHE_992_RSR;
  }

  static getAllVehicles(): VehicleCatalogEntry[] {
    return Object.values(VEHICLE_DATABASE);
  }

  static getVehiclesByCategory(category: VehicleCatalogEntry['category']): VehicleCatalogEntry[] {
    return Object.values(VEHICLE_DATABASE).filter((v) => v.category === category);
  }

  static getVehiclesByTrim(trim: 'race' | 'stock'): VehicleCatalogEntry[] {
    return Object.values(VEHICLE_DATABASE).filter((v) => v.trim === trim);
  }

  static registerVehicle(entry: VehicleCatalogEntry): void {
    VEHICLE_DATABASE[entry.id] = entry;
  }
}
