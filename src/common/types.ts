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

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  rpmRatio: number;   // 0.0 to 1.0 (normalized between idle and redline)
  gear: number;       // -1 = R, 0 = N, 1..6 = 1..6
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
  sprint0to100Time: number | null;
  sprint0to200Time?: number | null;
  maxSpeedKmh?: number;
  distanceM?: number;
  brakeTempsC?: [number, number, number, number]; // Background brake rotor temperatures in °C (FL, FR, RL, RR)
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
  espGain: number;               // 0.0 to 1.0 (Stability yaw damping)
  counterSteerGain: number;      // 0.0 to 1.0 (Counter-steer assist)
  highSpeedLockFraction: number; // 0.25 to 0.50 (Steering lock clamp at 250+ km/h)
}
