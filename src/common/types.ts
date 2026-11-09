export enum TrackMode {
  NURBURGRING_24H = '24h',
  NORDSCHLEIFE = 'nordschleife',
  GP_STRECKE = 'gp_strecke',
  PROVING_GROUND = 'proving_ground',
}

export interface ControllerInput {
  seq: number;
  steer: number;      // Normalized -1.0 (full left) to +1.0 (full right)
  throttle: number;   // 0.0 or 1.0 (or analog 0..1)
  brake: number;      // 0.0 or 1.0 (or analog 0..1)
  buttons: number;    // Bitfield: bit 0 = Reset/Respawn, bit 1 = Toggle Camera
  timestamp: number;
}

export type TireCompound = 'slick_soft' | 'slick_medium' | 'slick_hard' | 'wet';

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  rpmRatio: number;   // 0.0 to 1.0 (normalized between idle and redline)
  gear: number;       // -1 = R, 0 = N, 1..6 = 1..6
  brake?: number;
  isShiftLightActive: boolean;
  isAbsActive: boolean;
  isTcActive: boolean;
  steerAngleDeg: number;
  engineTorqueNm: number;
  wheelSlipAngle: [number, number, number, number]; // FL, FR, RL, RR
  wheelSlipRatio: [number, number, number, number]; // FL, FR, RL, RR
  suspensionCompression: [number, number, number, number]; // FL, FR, RL, RR
  lateralG: number;
  longitudinalG: number;
  lapTimeSeconds: number;
  bestLapSeconds: number | null;
  liveDeltaMs?: number | null;
  currentSectorIndex?: number;
  sectorSplits?: SectorSplit[];
  sprint0to100Time: number | null;
  sprint0to200Time?: number | null;
  maxSpeedKmh?: number;
  distanceM?: number;
  brakeTempsC?: [number, number, number, number]; // Background brake rotor temperatures in °C (FL, FR, RL, RR)
  brakePadFriction?: [number, number, number, number]; // Effective pad friction coefficient mu_pad (FL, FR, RL, RR)
  brakeFadeFactor?: [number, number, number, number]; // 1.0 = no fade, < 1.0 = thermal fade above 750°C
  tireWear?: [number, number, number, number]; // 0.0 (fresh) to 1.0 (worn) per wheel
  tireHealthPercent?: [number, number, number, number]; // 100% down to 0% per wheel
  tireTempsC?: [number, number, number, number]; // Tire carcass temperature °C
  tireSlipEnergyJ?: [number, number, number, number]; // Accumulated slip energy (Joules)
  fuelLiters?: number; // Remaining fuel in liters
  fuelMassKg?: number; // Remaining fuel mass in kg (0.75 kg/L)
  totalMassKg?: number; // Dynamic chassis + fuel mass in kg
  tireCompound?: TireCompound;
  isHydroplaning?: boolean;
  surfaceWetness?: number; // 0.0 (dry) to 1.0 (soaked) at vehicle position
  isDownshiftBlip?: boolean; // Electronic throttle rev-matching blip during downshifts
  isShifting?: boolean; // Pneumatic sequential shift actuator active
  rttMs: number;
}

export interface PacejkaCoefficients {
  B: number;
  C: number;
  D: number;
  E: number;
}

export interface CarProfile {
  id: string;
  name: string;
  class: string;
  specs: {
    engine: string;
    powerPS: number;
    torqueNm: number;
    weightKg: number;
    topSpeedKmh?: number;
    topSpeedDrsKmh?: number;
  };
  chassis: {
    massKg: number;
    cgHeightM: number;
    frontWeightFraction: number;
    wheelbaseM: number;
    trackFrontM: number;
    trackRearM: number;
    inertiaTensor: [number, number, number];
  };
  suspension: {
    front: {
      springNPerM: number;
      bumpNsPerM: number;
      reboundNsPerM: number;
      travelM: number;
      antiRollNmPerRad: number;
    };
    rear: {
      springNPerM: number;
      bumpNsPerM: number;
      reboundNsPerM: number;
      travelM: number;
      antiRollNmPerRad: number;
    };
  };
  tires: {
    compound: string;
    front: {
      radiusM: number;
      widthM: number;
      pacejkaLat: PacejkaCoefficients;
      pacejkaLong: PacejkaCoefficients;
    };
    rear: {
      radiusM: number;
      widthM: number;
      pacejkaLat: PacejkaCoefficients;
      pacejkaLong: PacejkaCoefficients;
    };
  };
  steering: {
    maxWheelAngleDeg: number;
    maxRateDegPerS: number;
    highSpeedLockFraction: number;
    speedSensitivityStartKmh: number;
  };
  engine: {
    type?: 'ice' | 'hybrid' | 'electric'; // Powertrain architecture
    idleRpm: number;
    redlineRpm: number;
    limiterRpm: number;
    inertiaKgM2: number;
    engineBrakeNm: number;
    regenBrakeNm?: number; // Regenerative braking torque for hybrid/electric
    torqueCurve: [number, number][]; // [RPM, Nm]
  };
  transmission: {
    type: string;
    auto: boolean;
    ratios: number[];
    reverse: number;
    finalDrive: number;
    shiftTimeS: number;
    upshiftRpm: number;
    downshiftRpm: number;
  };
  brakes: {
    maxTorqueNm: number;
    frontBias: number;
    padFrictionCoeff?: number;
    initialTempC?: number;
  };
  aero: {
    dragCdA: number;
    downforceClA: number;
    aeroBalanceFront: number;
    drs?: {
      dragReduction: number;
      downforceReduction: number;
    };
  };
  assists: {
    tractionControl: number;
    abs: boolean;
    stability: number;
    counterSteer: number;
    throttleRampS: number;
    brakeRampS: number;
  };
}

/**
 * Tunable Car Setup parameters editable by the player in the Pit Lane / Garage screen.
 * These override or scale the baseline homologation values from CarProfile.
 */
export interface CarSetup {
  // Aerodynamics
  rearWingAngleDeg: number;       // e.g. 5.0° (low drag) to 18.0° (high downforce)
  drsEnabled: boolean;           // Whether DRS is installed/operational

  // Transmission & Gearing
  finalDriveRatio: number;       // e.g. 3.20 (Le Mans), 3.44 (Standard), 3.65 (Sprint)
  gearRatioSet: 'short' | 'standard' | 'long';
  upshiftRpm: number;            // Driver-preferred shift target (8600 - 8900 RPM)

  // Suspension & Anti-Roll
  frontSpringNPerM: number;      // Front coil stiffness (120,000 - 180,000 N/m)
  rearSpringNPerM: number;       // Rear coil stiffness (140,000 - 200,000 N/m)
  frontAntiRollNmPerRad: number; // Front ARB stiffness (70,000 - 120,000 Nm/rad)
  rearAntiRollNmPerRad: number;  // Rear ARB stiffness (50,000 - 100,000 Nm/rad)
  rideHeightOffsetM: number;     // Suspension perch offset (-0.010m to +0.015m)

  // Brakes
  frontBrakeBias: number;        // Front balance fraction (0.50 to 0.64, default 0.57)
  maxBrakeTorqueNm: number;      // Peak pedal torque clamp (3600 to 5200 Nm)

  // Tires
  tireCompound: 'slick_soft' | 'slick_medium' | 'slick_hard' | 'wet';
  tirePressureBarFront: number;  // Cold tire pressure (1.4 - 2.2 bar)
  tirePressureBarRear: number;

  // Steering & Driver Electronics
  tcLevel: number;               // 0 (Off) to 10 (Max intervention)
  absLevel: number;              // 0 (Off) to 10 (Max intervention)
  absEnabled: boolean;           // Master ABS toggle
  espGain: number;               // 0.0 to 1.0 (Stability yaw damping)
  counterSteerGain: number;      // 0.0 to 1.0 (Counter-steer assist)
  highSpeedLockFraction: number; // 0.25 to 0.50 (Steering lock clamp at 250+ km/h)

  // Consumables & Strategy (Phase 3)
  fuelLoadL: number;             // Starting / pit refuel load in liters (5 to 110 L, 0.75 kg/L)
}

export type WeatherCondition = 'clear' | 'drizzle' | 'heavy_rain' | 'dry' | 'light_rain';

export interface EnvironmentState {
  timeOfDayHours: number;        // 0.0 to 24.0 (e.g. 14.0 = midday, 19.5 = sunset, 23.0 = night)
  timeScale: number;             // Progression multiplier (0 = paused, 1 = real-time, 60 = 1 min/sec)
  weather: WeatherCondition;
  ambientTrackWetness?: number;  // 0.0 (dry) to 1.0 (drenched)
  globalWetness?: number;
  rainIntensity: number;         // 0.0 to 1.0
  headlightsOn: boolean;
  wipersOn?: boolean;
  ambientTempC?: number;
  trackTempC?: number;
}

export interface SectorSplit {
  sectorIndex: number;           // 0 to 8 (S1 to S9)
  sectorName: string;
  currentMs: number | null;
  bestMs: number | null;
  sessionBestMs: number | null;  // Purple sector
  deltaMs: number | null;        // +/- vs best lap sector
  status: 'pending' | 'purple' | 'green' | 'yellow';
}

export const DEFAULT_CAR_SETUP: CarSetup = {
  rearWingAngleDeg: 10.0,
  drsEnabled: false,
  finalDriveRatio: 3.44,
  gearRatioSet: 'standard',
  upshiftRpm: 8800,
  frontSpringNPerM: 125000,
  rearSpringNPerM: 145000,
  frontAntiRollNmPerRad: 95000,
  rearAntiRollNmPerRad: 75000,
  rideHeightOffsetM: 0.0,
  frontBrakeBias: 0.57,
  maxBrakeTorqueNm: 6800,
  tireCompound: 'slick_medium',
  tirePressureBarFront: 1.8,
  tirePressureBarRear: 1.8,
  tcLevel: 6,
  absLevel: 8,
  absEnabled: true,
  espGain: 0.45,
  counterSteerGain: 0.30,
  highSpeedLockFraction: 0.35,
  fuelLoadL: 60,
};
