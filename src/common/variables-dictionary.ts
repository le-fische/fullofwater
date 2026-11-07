/**
 * Vehicle & Simulation Variables Dictionary
 * Programmatic metadata registry mapping variable definitions, units,
 * constraints, tiers (global, homologation, setup, telemetry), and mapped engine functions.
 */

export type VariableTier = 'global' | 'homologation' | 'setup' | 'telemetry';

export type VariableCategory =
  | 'world'
  | 'chassis'
  | 'engine'
  | 'transmission'
  | 'suspension'
  | 'tires'
  | 'brakes'
  | 'aero'
  | 'steering'
  | 'assists'
  | 'sound'
  | 'telemetry';

export interface VariableMeta {
  id: string;
  name: string;
  category: VariableCategory;
  tier: VariableTier;
  unit: string;
  propertyPath: string;
  defaultValue: number | string | boolean | number[] | [number, number][];
  tunableMin?: number;
  tunableMax?: number;
  mappedFunction: string;
  description: string;
}

export const VARIABLES_DICTIONARY: VariableMeta[] = [
  // --- Global Simulation Constants ---
  {
    id: 'world_gravity',
    name: 'Universal Gravity',
    category: 'world',
    tier: 'global',
    unit: 'm/s^2',
    propertyPath: 'world.gravity',
    defaultValue: -9.81,
    mappedFunction: 'Rapier.World(new Vector3(0, -9.81, 0))',
    description: 'Downward vertical gravitational acceleration vector.',
  },
  {
    id: 'world_physics_hz',
    name: 'Physics Tick Frequency',
    category: 'world',
    tier: 'global',
    unit: 'Hz',
    propertyPath: 'world.physicsTickHz',
    defaultValue: 240,
    mappedFunction: 'RaycastVehicle.step(1/240)',
    description: 'Fixed high-rate deterministic simulation loop frequency.',
  },
  {
    id: 'world_air_density',
    name: 'Sea-Level Air Density',
    category: 'world',
    tier: 'global',
    unit: 'kg/m^3',
    propertyPath: 'world.airDensity',
    defaultValue: 1.225,
    mappedFunction: 'RaycastVehicle.stepAeroDynamics()',
    description: 'Standard atmospheric air density rho for aerodynamic forces.',
  },
  {
    id: 'world_speed_of_sound',
    name: 'Speed of Sound',
    category: 'world',
    tier: 'global',
    unit: 'm/s',
    propertyPath: 'world.speedOfSound',
    defaultValue: 343.0,
    mappedFunction: 'EngineAudioSynth.calcDoppler()',
    description: 'Speed of acoustic propagation in air for Doppler pitch calculations.',
  },

  // --- Chassis Blueprint Specs ---
  {
    id: 'chassis_mass',
    name: 'Total Curb Mass',
    category: 'chassis',
    tier: 'homologation',
    unit: 'kg',
    propertyPath: 'chassis.massKg',
    defaultValue: 1242,
    mappedFunction: 'Rapier.RigidBodyDesc.setMass()',
    description: 'Total dry vehicle mass without driver ballast.',
  },
  {
    id: 'chassis_cg_height',
    name: 'Center of Gravity Height',
    category: 'chassis',
    tier: 'homologation',
    unit: 'm',
    propertyPath: 'chassis.cgHeightM',
    defaultValue: 0.40,
    mappedFunction: 'RaycastVehicle.initChassisBody()',
    description: 'Vertical height of the mass center above ground surface.',
  },
  {
    id: 'chassis_wheelbase',
    name: 'Wheelbase',
    category: 'chassis',
    tier: 'homologation',
    unit: 'm',
    propertyPath: 'chassis.wheelbaseM',
    defaultValue: 2.513,
    mappedFunction: 'RaycastVehicle.initSuspensionRays()',
    description: 'Distance between front and rear axle centers.',
  },
  {
    id: 'chassis_track_front',
    name: 'Front Track Width',
    category: 'chassis',
    tier: 'homologation',
    unit: 'm',
    propertyPath: 'chassis.trackFrontM',
    defaultValue: 1.705,
    mappedFunction: 'RaycastVehicle.initSuspensionRays()',
    description: 'Center-to-center distance between front tires.',
  },
  {
    id: 'chassis_track_rear',
    name: 'Rear Track Width',
    category: 'chassis',
    tier: 'homologation',
    unit: 'm',
    propertyPath: 'chassis.trackRearM',
    defaultValue: 1.670,
    mappedFunction: 'RaycastVehicle.initSuspensionRays()',
    description: 'Center-to-center distance between rear tires.',
  },
  {
    id: 'chassis_polar_yaw_inertia',
    name: 'Polar Yaw Inertia (Izz)',
    category: 'chassis',
    tier: 'homologation',
    unit: 'kg*m^2',
    propertyPath: 'chassis.inertiaTensor[2]',
    defaultValue: 1850,
    mappedFunction: 'chassisBody.setMassProperties()',
    description: 'Polar rotational inertia around vertical yaw axis governing spin dynamics.',
  },

  // --- Engine & Powertrain Blueprint ---
  {
    id: 'engine_idle_rpm',
    name: 'Engine Idle Speed',
    category: 'engine',
    tier: 'homologation',
    unit: 'RPM',
    propertyPath: 'engine.idleRpm',
    defaultValue: 2000,
    mappedFunction: 'Drivetrain.step()',
    description: 'Stationary engine crankshaft idle speed.',
  },
  {
    id: 'engine_redline_rpm',
    name: 'Engine Peak Redline',
    category: 'engine',
    tier: 'homologation',
    unit: 'RPM',
    propertyPath: 'engine.redlineRpm',
    defaultValue: 9000,
    mappedFunction: 'Drivetrain.step()',
    description: 'Rated maximum operating engine crankshaft speed.',
  },
  {
    id: 'engine_limiter_rpm',
    name: 'Hard Rev Limiter',
    category: 'engine',
    tier: 'homologation',
    unit: 'RPM',
    propertyPath: 'engine.limiterRpm',
    defaultValue: 9250,
    mappedFunction: 'Drivetrain.step()',
    description: 'Hard fuel/ignition cut electronic rev limit.',
  },
  {
    id: 'engine_compression_brake',
    name: 'Engine Compression Braking',
    category: 'engine',
    tier: 'homologation',
    unit: 'Nm',
    propertyPath: 'engine.engineBrakeNm',
    defaultValue: 85,
    mappedFunction: 'Drivetrain.step()',
    description: 'Base compression drag torque scaled quadratically with engine RPM.',
  },

  // --- Transmission & Gearing Blueprint ---
  {
    id: 'transmission_final_drive',
    name: 'Base Final Drive Ratio',
    category: 'transmission',
    tier: 'homologation',
    unit: 'ratio',
    propertyPath: 'transmission.finalDrive',
    defaultValue: 3.44,
    mappedFunction: 'Drivetrain.getGearRatio()',
    description: 'Differential ring-and-pinion mechanical reduction ratio.',
  },
  {
    id: 'transmission_shift_time',
    name: 'Shift Actuator Duration',
    category: 'transmission',
    tier: 'homologation',
    unit: 's',
    propertyPath: 'transmission.shiftTimeS',
    defaultValue: 0.045,
    mappedFunction: 'Drivetrain.step()',
    description: 'Pneumatic gear change and ignition cut duration (45 ms).',
  },

  // --- Aerodynamics Blueprint ---
  {
    id: 'aero_drag_cda',
    name: 'Aerodynamic Drag Area (CdA)',
    category: 'aero',
    tier: 'homologation',
    unit: 'm^2',
    propertyPath: 'aero.dragCdA',
    defaultValue: 0.88,
    mappedFunction: 'RaycastVehicle.stepAeroDynamics()',
    description: 'Frontal drag area product governing aerodynamic air resistance.',
  },
  {
    id: 'aero_downforce_cla',
    name: 'Aerodynamic Downforce Area (ClA)',
    category: 'aero',
    tier: 'homologation',
    unit: 'm^2',
    propertyPath: 'aero.downforceClA',
    defaultValue: 2.85,
    mappedFunction: 'RaycastVehicle.stepAeroDynamics()',
    description: 'Downforce area product generating vertical aerodynamic tire loading.',
  },
  {
    id: 'aero_drs_drag_reduction',
    name: 'DRS Drag Reduction',
    category: 'aero',
    tier: 'homologation',
    unit: 'fraction',
    propertyPath: 'aero.drs.dragReduction',
    defaultValue: 0.28,
    mappedFunction: 'RaycastVehicle.stepAeroDynamics()',
    description: 'Drag area percentage reduction when rear wing DRS flap opens (28%).',
  },

  // --- Sound Design Blueprint ---
  {
    id: 'sound_gear_teeth',
    name: 'Spur Gear Mesh Teeth',
    category: 'sound',
    tier: 'homologation',
    unit: 'teeth',
    propertyPath: 'sound.gearMeshTeeth',
    defaultValue: 32,
    mappedFunction: 'EngineAudioSynth.setupTransmissionSound()',
    description: 'Spur gear tooth count producing straight-cut transmission whine.',
  },
  {
    id: 'sound_diff_ratio',
    name: 'Differential Whine Multiplier',
    category: 'sound',
    tier: 'homologation',
    unit: 'Hz/(km/h)',
    propertyPath: 'sound.diffWhineRatio',
    defaultValue: 11.2,
    mappedFunction: 'EngineAudioSynth.setupTransmissionSound()',
    description: 'Ground-speed proportional driveshaft/diff whine frequency multiplier.',
  },

  // --- Tunable Car Setup Variables (Pit Lane / Garage Screen) ---
  {
    id: 'setup_rear_wing_angle',
    name: 'Rear Wing Angle',
    category: 'aero',
    tier: 'setup',
    unit: 'deg',
    propertyPath: 'setup.rearWingAngleDeg',
    defaultValue: 10.0,
    tunableMin: 5.0,
    tunableMax: 18.0,
    mappedFunction: 'RaycastVehicle.stepAeroDynamics()',
    description: 'Rear wing angle of attack trading top speed for downforce.',
  },
  {
    id: 'setup_final_drive_ratio',
    name: 'Final Drive Ratio',
    category: 'transmission',
    tier: 'setup',
    unit: 'ratio',
    propertyPath: 'setup.finalDriveRatio',
    defaultValue: 3.44,
    tunableMin: 3.20,
    tunableMax: 3.65,
    mappedFunction: 'Drivetrain.getGearRatio()',
    description: 'Adjustable final drive: 3.20 (Le Mans), 3.44 (Std), 3.65 (Sprint).',
  },
  {
    id: 'setup_upshift_rpm',
    name: 'Upshift Target RPM',
    category: 'transmission',
    tier: 'setup',
    unit: 'RPM',
    propertyPath: 'setup.upshiftRpm',
    defaultValue: 8800,
    tunableMin: 8600,
    tunableMax: 8900,
    mappedFunction: 'Drivetrain.step()',
    description: 'Engine RPM target triggering sequential electro-pneumatic upshifts.',
  },
  {
    id: 'setup_front_spring_rate',
    name: 'Front Spring Stiffness',
    category: 'suspension',
    tier: 'setup',
    unit: 'N/m',
    propertyPath: 'setup.frontSpringNPerM',
    defaultValue: 145000,
    tunableMin: 120000,
    tunableMax: 180000,
    mappedFunction: 'RaycastVehicle.stepSuspension()',
    description: 'Front coilover spring rate resisting dive and governing front roll.',
  },
  {
    id: 'setup_rear_spring_rate',
    name: 'Rear Spring Stiffness',
    category: 'suspension',
    tier: 'setup',
    unit: 'N/m',
    propertyPath: 'setup.rearSpringNPerM',
    defaultValue: 165000,
    tunableMin: 140000,
    tunableMax: 200000,
    mappedFunction: 'RaycastVehicle.stepSuspension()',
    description: 'Rear coilover spring rate stabilizing vehicle under aero load.',
  },
  {
    id: 'setup_front_brake_bias',
    name: 'Front Brake Bias',
    category: 'brakes',
    tier: 'setup',
    unit: 'fraction',
    propertyPath: 'setup.frontBrakeBias',
    defaultValue: 0.57,
    tunableMin: 0.50,
    tunableMax: 0.64,
    mappedFunction: 'BrakeSystem.calcClampingForce()',
    description: 'Hydraulic brake pressure balance percentage delivered to front axle.',
  },
  {
    id: 'setup_max_brake_torque',
    name: 'Peak Brake Torque Clamp',
    category: 'brakes',
    tier: 'setup',
    unit: 'Nm',
    propertyPath: 'setup.maxBrakeTorqueNm',
    defaultValue: 6800,
    tunableMin: 5000,
    tunableMax: 7500,
    mappedFunction: 'BrakeSystem.calcClampingForce()',
    description: 'Mechanical hydraulic caliper clamping torque ceiling.',
  },
  {
    id: 'setup_tc_level',
    name: 'Traction Control Level',
    category: 'assists',
    tier: 'setup',
    unit: 'level',
    propertyPath: 'setup.tcLevel',
    defaultValue: 6,
    tunableMin: 0,
    tunableMax: 10,
    mappedFunction: 'Assists.stepTractionControl()',
    description: 'Traction control intervention intensity: 0=Off, 10=Maximum.',
  },
  {
    id: 'setup_esp_gain',
    name: 'ESP Stability Damping Gain',
    category: 'assists',
    tier: 'setup',
    unit: 'gain',
    propertyPath: 'setup.espGain',
    defaultValue: 0.45,
    tunableMin: 0.00,
    tunableMax: 1.00,
    mappedFunction: 'Assists.stepEsp()',
    description: 'Active yaw damping moment gain opposing sudden chassis spins.',
  },
  {
    id: 'setup_counter_steer_gain',
    name: 'Counter-Steer Assist Gain',
    category: 'assists',
    tier: 'setup',
    unit: 'gain',
    propertyPath: 'setup.counterSteerGain',
    defaultValue: 0.30,
    tunableMin: 0.00,
    tunableMax: 1.00,
    mappedFunction: 'Assists.stepCounterSteer()',
    description: 'Dynamic stabilizing steering torque assisting driver in catching drifts.',
  },
];

export class VariablesDictionary {
  private static byId: Map<string, VariableMeta> = new Map(
    VARIABLES_DICTIONARY.map((v) => [v.id, v])
  );

  static getVariable(id: string): VariableMeta | undefined {
    return this.byId.get(id);
  }

  static getVariablesByCategory(category: VariableCategory): VariableMeta[] {
    return VARIABLES_DICTIONARY.filter((v) => v.category === category);
  }

  static getVariablesByTier(tier: VariableTier): VariableMeta[] {
    return VARIABLES_DICTIONARY.filter((v) => v.tier === tier);
  }

  static getTunableVariables(): VariableMeta[] {
    return VARIABLES_DICTIONARY.filter((v) => v.tier === 'setup');
  }
}
