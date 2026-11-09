import RAPIER from '@dimforge/rapier3d-compat';
import { CarProfile, CarSetup, DEFAULT_CAR_SETUP, VehicleTelemetry } from '../../common/types';
import { clamp, lerp } from '../../common/math';
import { PacejkaTireModel } from './tire-model';
import { Drivetrain } from './drivetrain';
import { Aerodynamics } from './aero';
import { DrivingAssists } from './assists';
import { getSurfaceProperties } from './materials';
import { BrakeSystem } from './brakes';
import { TrackDryingLine } from './drying-line';

export const FUEL_DENSITY_KG_PER_LITER = 0.75; // 0.75 kg/L motorsport E20/racing fuel

export interface WheelState {
  hardpoint: [number, number, number]; // chassis-relative [x, y, z]
  isSteered: boolean;
  isDriven: boolean;
  radius: number;
  width: number;
  steerAngleRad: number;
  angularVelocity: number; // rad/s
  suspensionCompression: number; // m
  prevCompression: number;
  suspVel: number; // m/s (2nd-order pneumatic low-pass filtered damper velocity)
  normalForce: number; // N
  slipRatio: number;
  slipAngleRad: number;
  contactPointWorld: [number, number, number];
  isInContact: boolean;
  rotationalInertia: number; // kg m^2
  // Phase 3: Tyre degradation & thermal state
  slipEnergyJ: number; // Accumulated frictional slip work (Joules)
  tireWear: number; // 0.0 (fresh 100% grip) to 1.0 (worn out)
  tireTempC: number; // Carcass temperature (°C)
}

export class RaycastVehicle {
  public chassisBody: RAPIER.RigidBody;
  public chassisCollider: RAPIER.Collider;
  public profile: CarProfile;
  public setup: CarSetup;
  public drivetrain: Drivetrain;
  public aero: Aerodynamics;
  public assists: DrivingAssists;
  public brakes: BrakeSystem;

  public wheels: WheelState[];

  // Phase 3 & 5: Consumables, Fuel Mass & Pit Auto-Stop
  public fuelLiters = 60.0;
  public fuelCapacityLiters = 110.0;
  public consumablesEnabled = false; // Enabled dynamically in Phase 5 simulation
  public wearRateMultiplier = 0.0;
  public fuelBurnMultiplier = 0.0;
  public pitLimiterActive = false; // Phase 5: Automated 60 km/h pit speed limiter
  private lastBrakeInput = 0;

  // Phase 3: Weather & 2D Drying Line link
  public dryingLine?: TrackDryingLine;
  public currentTrackDistanceM = 0;
  public currentLateralOffsetM = 0;
  private isHydroplaningNow = false;
  private currentSurfaceWetness = 0;

  private world: RAPIER.World;
  public rapier: typeof RAPIER;

  // Telemetry caches
  private currentSpeedKmh = 0;
  private currentForwardSpeedMs = 0;
  private lateralG = 0;
  private longitudinalG = 0;
  private prevForwardSpeedMs = 0;
  private frontZ = 1.43;
  private rearZ = -1.08;

  // Scratch vectors for zero allocation in 240Hz tick
  private scratchRay = new RAPIER.Ray(new RAPIER.Vector3(0, 0, 0), new RAPIER.Vector3(0, -1, 0));

  private lastDrivetrainInfo = {
    wheelTorqueNm: 0,
    rpm: 2000,
    rpmRatio: 0,
    gear: 0,
    isShifting: false,
    isDownshiftBlip: false,
    shiftLight: false,
  };

  constructor(world: RAPIER.World, rapier: typeof RAPIER, profile: CarProfile, spawnPos = { x: 0, y: 0.8, z: 0 }, spawnYaw = 0) {
    this.world = world;
    this.rapier = rapier;
    this.profile = JSON.parse(JSON.stringify(profile)) as CarProfile;
    this.setup = {
      ...DEFAULT_CAR_SETUP,
      frontSpringNPerM: profile.suspension.front.springNPerM,
      rearSpringNPerM: profile.suspension.rear.springNPerM,
      frontAntiRollNmPerRad: profile.suspension.front.antiRollNmPerRad,
      rearAntiRollNmPerRad: profile.suspension.rear.antiRollNmPerRad,
      frontBrakeBias: profile.brakes.frontBias,
      maxBrakeTorqueNm: profile.brakes.maxTorqueNm,
      finalDriveRatio: profile.transmission.finalDrive,
      upshiftRpm: profile.transmission.upshiftRpm,
      tireCompound: (profile.tires.compound as CarSetup['tireCompound']) || 'slick_medium',
    };
    this.fuelLiters = this.setup.fuelLoadL;

    this.drivetrain = new Drivetrain(this.profile);
    this.aero = new Aerodynamics(this.profile);
    this.assists = new DrivingAssists(this.profile);
    this.brakes = new BrakeSystem(this.profile.brakes);

    // 1. Create chassis rigid body with Continuous Collision Detection (CCD) enabled
    // Eliminates high-speed boundary tunneling & noclipping during 300+ km/h barrier impacts
    const qy = Math.sin(spawnYaw / 2);
    const qw = Math.cos(spawnYaw / 2);
    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
      .setRotation({ x: 0, y: qy, z: 0, w: qw })
      .setCanSleep(false)
      .setLinearDamping(0.001) // Minimal numerical damping: authentic aerodynamic drag (Cd*A) governs equilibrium top speed
      .setAngularDamping(2.0)  // Heavy rotational damping to eliminate chassis roll/pitch wobbling
      .setCcdEnabled(true);

    this.chassisBody = world.createRigidBody(bodyDesc);
    this.chassisBody.enableCcd(true);

    // Set mass & inertia tensor from spec
    // Note: Rapier coordinate axes are X (right), Y (up), Z (forward)
    // inertiaTensor is [pitch(X), roll(Z), yaw(Y)] in automotive spec
    const { massKg, inertiaTensor, wheelbaseM, trackFrontM, trackRearM, frontWeightFraction } = profile.chassis;
    const pitchInertia = inertiaTensor[0]; // ~1650 around pitch axis X
    const yawInertia = inertiaTensor[2];   // ~1850 around yaw axis Y (vertical)
    const rollInertia = inertiaTensor[1];  // ~420 around roll axis Z (forward)

    this.chassisBody.setAdditionalMassProperties(
      massKg,
      new rapier.Vector3(0, 0, 0),
      new rapier.Vector3(pitchInertia, yawInertia, rollInertia),
      new rapier.Quaternion(0, 0, 0, 1),
      true
    );

    // Box collider approximating upper cabin/chassis dimensions for barrier and obstacle collisions.
    // Elevated to translation (0, 0.72, 0) with half-height 0.22 so the bottom edge is at +0.50m (+0.85m world),
    // guaranteeing the chassis cuboid NEVER scrapes or snags on road or banked bowl triangles under heavy
    // braking pitch, compressions, or small-wheeled vehicles while still colliding with 1.15m Armco barriers.
    const colliderDesc = rapier.ColliderDesc.cuboid(0.82, 0.22, 1.98)
      .setTranslation(0, 0.72, 0)
      .setFriction(0.1)
      .setRestitution(0.0);

    this.chassisCollider = world.createCollider(colliderDesc, this.chassisBody);

    // 2. Setup 4 wheels hardpoints
    const frontZ = (1.0 - frontWeightFraction) * wheelbaseM; // ~ +1.43m
    const rearZ = -frontWeightFraction * wheelbaseM;          // ~ -1.08m
    this.frontZ = frontZ;
    this.rearZ = rearZ;
    const frontHalfTrack = trackFrontM / 2;                   // ~ 0.852m
    const rearHalfTrack = trackRearM / 2;                     // ~ 0.835m

    const frontTireRadius = profile.tires.front.radiusM;
    const rearTireRadius = profile.tires.rear.radiusM;

    // Wheel rotational inertia Iw = 0.5 * m * r^2 (~14kg per wheel/tire assembly)
    const frontInertia = 0.5 * 14.0 * frontTireRadius * frontTireRadius;
    const rearInertia = 0.5 * 16.0 * rearTireRadius * rearTireRadius;

    this.wheels = [
      // FL (0)
      {
        hardpoint: [-frontHalfTrack, 0.05, frontZ],
        isSteered: true,
        isDriven: false,
        radius: frontTireRadius,
        width: profile.tires.front.widthM,
        steerAngleRad: 0,
        angularVelocity: 0,
        suspensionCompression: 0,
        prevCompression: 0,
        suspVel: 0,
        normalForce: (massKg * 9.81 * frontWeightFraction) / 2,
        slipRatio: 0,
        slipAngleRad: 0,
        contactPointWorld: [0, 0, 0],
        isInContact: false,
        rotationalInertia: frontInertia,
        slipEnergyJ: 0,
        tireWear: 0,
        tireTempC: 75,
      },
      // FR (1)
      {
        hardpoint: [frontHalfTrack, 0.05, frontZ],
        isSteered: true,
        isDriven: false,
        radius: frontTireRadius,
        width: profile.tires.front.widthM,
        steerAngleRad: 0,
        angularVelocity: 0,
        suspensionCompression: 0,
        prevCompression: 0,
        suspVel: 0,
        normalForce: (massKg * 9.81 * frontWeightFraction) / 2,
        slipRatio: 0,
        slipAngleRad: 0,
        contactPointWorld: [0, 0, 0],
        isInContact: false,
        rotationalInertia: frontInertia,
        slipEnergyJ: 0,
        tireWear: 0,
        tireTempC: 75,
      },
      // RL (2)
      {
        hardpoint: [-rearHalfTrack, 0.05, rearZ],
        isSteered: false,
        isDriven: true,
        radius: rearTireRadius,
        width: profile.tires.rear.widthM,
        steerAngleRad: 0,
        angularVelocity: 0,
        suspensionCompression: 0,
        prevCompression: 0,
        suspVel: 0,
        normalForce: (massKg * 9.81 * (1 - frontWeightFraction)) / 2,
        slipRatio: 0,
        slipAngleRad: 0,
        contactPointWorld: [0, 0, 0],
        isInContact: false,
        rotationalInertia: rearInertia,
        slipEnergyJ: 0,
        tireWear: 0,
        tireTempC: 75,
      },
      // RR (3)
      {
        hardpoint: [rearHalfTrack, 0.05, rearZ],
        isSteered: false,
        isDriven: true,
        radius: rearTireRadius,
        width: profile.tires.rear.widthM,
        steerAngleRad: 0,
        angularVelocity: 0,
        suspensionCompression: 0,
        prevCompression: 0,
        suspVel: 0,
        normalForce: (massKg * 9.81 * (1 - frontWeightFraction)) / 2,
        slipRatio: 0,
        slipAngleRad: 0,
        contactPointWorld: [0, 0, 0],
        isInContact: false,
        rotationalInertia: rearInertia,
        slipEnergyJ: 0,
        tireWear: 0,
        tireTempC: 75,
      },
    ];

    this.updateDynamicMassAndBalance();
  }

  /**
   * Computes total vehicle mass (dry chassis + 0.75 kg/L fuel) and updates
   * Rapier RigidBody mass and longitudinal Center of Mass shift.
   */
  public updateDynamicMassAndBalance(): void {
    const dryMassKg = this.profile.chassis.massKg;
    const fuelMassKg = Math.max(0, this.fuelLiters) * FUEL_DENSITY_KG_PER_LITER;
    const totalMassKg = dryMassKg + fuelMassKg;

    // Front fuel tank sits at Z = +0.95m forward of dry CG.
    // Shifting fuel load shifts longitudinal center of mass and front/rear weight balance.
    const tankZ = 0.95;
    const comZShift = (fuelMassKg * tankZ) / totalMassKg;

    const { inertiaTensor } = this.profile.chassis;
    const massScale = totalMassKg / dryMassKg;
    const pitchInertia = inertiaTensor[0] * massScale;
    const yawInertia = inertiaTensor[2] * massScale;
    const rollInertia = inertiaTensor[1] * massScale;

    this.chassisBody.setAdditionalMassProperties(
      totalMassKg,
      new this.rapier.Vector3(0, 0, comZShift),
      new this.rapier.Vector3(pitchInertia, yawInertia, rollInertia),
      new this.rapier.Quaternion(0, 0, 0, 1),
      true
    );
  }

  public getFuelMassKg(): number {
    return Math.max(0, this.fuelLiters) * FUEL_DENSITY_KG_PER_LITER;
  }

  public getTotalMassKg(): number {
    return this.profile.chassis.massKg + this.getFuelMassKg();
  }

  public getSetup(): CarSetup {
    return { ...this.setup };
  }

  /**
   * Applies tunable CarSetup parameters from the Pit Lane / Garage UI or Controller.
   */
  public applySetup(partialSetup: Partial<CarSetup>): CarSetup {
    this.setup = { ...this.setup, ...partialSetup };

    this.aero.setRearWingAngleDeg(this.setup.rearWingAngleDeg);
    this.brakes.setFrontBias(this.setup.frontBrakeBias);
    this.brakes.setMaxTorqueNm(this.setup.maxBrakeTorqueNm);
    this.drivetrain.setFinalDriveRatio(this.setup.finalDriveRatio);
    this.drivetrain.setUpshiftRpm(this.setup.upshiftRpm);

    this.profile.suspension.front.springNPerM = this.setup.frontSpringNPerM;
    this.profile.suspension.rear.springNPerM = this.setup.rearSpringNPerM;
    this.profile.suspension.front.antiRollNmPerRad = this.setup.frontAntiRollNmPerRad;
    this.profile.suspension.rear.antiRollNmPerRad = this.setup.rearAntiRollNmPerRad;

    this.assists.setTcLevel(this.setup.tcLevel);
    if (this.setup.absEnabled !== undefined) {
      this.assists.setAbsEnabled(this.setup.absEnabled);
    } else {
      this.assists.setAbsEnabled(this.setup.absLevel > 0);
    }
    this.assists.setEspGain(this.setup.espGain);
    this.assists.setCounterSteerGain(this.setup.counterSteerGain);
    this.assists.setHighSpeedLockFraction(this.setup.highSpeedLockFraction);

    if (partialSetup.fuelLoadL !== undefined) {
      this.fuelLiters = clamp(partialSetup.fuelLoadL, 0, this.fuelCapacityLiters);
      this.updateDynamicMassAndBalance();
    }

    return this.setup;
  }

  /**
   * Phase 5: Configures dynamic consumables simulation (tyre degradation & fuel mass depletion).
   */
  public setConsumablesEnabled(enabled: boolean, wearMultiplier = 1.0, fuelBurnMultiplier = 1.0): void {
    this.consumablesEnabled = enabled;
    this.wearRateMultiplier = enabled ? wearMultiplier : 0.0;
    this.fuelBurnMultiplier = enabled ? fuelBurnMultiplier : 0.0;
  }

  /**
   * Phase 5: Toggles or sets the automated 60 km/h pit speed limiter.
   */
  public setPitLimiter(active: boolean): void {
    this.pitLimiterActive = active;
  }

  public togglePitLimiter(): boolean {
    this.pitLimiterActive = !this.pitLimiterActive;
    return this.pitLimiterActive;
  }

  /**
   * Pit stop service: fits fresh tires (0% wear), resets brake temps, and refuels to target load.
   */
  public serviceCar(freshTires = true, targetFuelLiters?: number): void {
    if (freshTires) {
      for (const w of this.wheels) {
        w.slipEnergyJ = 0;
        w.tireWear = 0;
        w.tireTempC = 80;
      }
    }
    if (targetFuelLiters !== undefined) {
      this.setup.fuelLoadL = clamp(targetFuelLiters, 5, this.fuelCapacityLiters);
      this.fuelLiters = this.setup.fuelLoadL;
    } else {
      this.fuelLiters = this.setup.fuelLoadL;
    }
    this.brakes.reset(120);
    this.updateDynamicMassAndBalance();
  }

  /**
   * Returns compound grip & wear rate characteristics.
   */
  public getCompoundCharacteristics(): { gripScale: number; wearRateScale: number } {
    switch (this.setup.tireCompound) {
      case 'slick_soft':
        return { gripScale: 1.07, wearRateScale: 1.50 };
      case 'slick_hard':
        return { gripScale: 0.94, wearRateScale: 0.62 };
      case 'wet':
        return { gripScale: 0.92, wearRateScale: 1.15 };
      case 'slick_medium':
      default:
        return { gripScale: 1.00, wearRateScale: 1.00 };
    }
  }

  /**
   * Returns effective Pacejka peak friction multiplier D for a wheel after accounting
   * for compound selection and accumulated slip-energy wear.
   */
  public getEffectiveWheelGripMultiplier(wheelIndex: number): number {
    const w = this.wheels[wheelIndex];
    const { gripScale } = this.getCompoundCharacteristics();
    // Wear reduces peak Pacejka D by up to 35% at 100% wear
    const wearPenalty = 1.0 - 0.35 * clamp(w.tireWear, 0.0, 1.0);
    return gripScale * wearPenalty;
  }

  /**
   * Fixed-timestep physics update at 240 Hz.
   */
  step(dt: number, rawSteerInput: number, rawThrottleInput: number, rawBrakeInput: number): void {
    // Reset forces & torques from previous tick before applying new tick forces
    this.chassisBody.resetForces(true);
    this.chassisBody.resetTorques(true);
    this.isHydroplaningNow = false;

    const chassisPos = this.chassisBody.translation();
    const chassisRot = this.chassisBody.rotation();
    const chassisLinvel = this.chassisBody.linvel();
    const chassisAngvel = this.chassisBody.angvel();

    // Compute chassis orientation vectors in world coordinates
    // Quaternion to forward (+Z), up (+Y), right (+X)
    const qx = chassisRot.x, qy = chassisRot.y, qz = chassisRot.z, qw = chassisRot.w;

    // Forward vector (+Z in chassis space)
    const fwdX = 2 * (qx * qz + qw * qy);
    const fwdY = 2 * (qy * qz - qw * qx);
    const fwdZ = 1 - 2 * (qx * qx + qy * qy);

    // Up vector (+Y in chassis space)
    const upX = 2 * (qx * qy - qw * qz);
    const upY = 1 - 2 * (qx * qx + qz * qz);
    const upZ = 2 * (qy * qz + qw * qx);

    // Right vector (+X in chassis space)
    const rightX = 1 - 2 * (qy * qy + qz * qz);
    const rightY = 2 * (qx * qy + qw * qz);
    const rightZ = 2 * (qx * qz - qw * qy);

    // Speed metrics
    this.currentForwardSpeedMs = chassisLinvel.x * fwdX + chassisLinvel.y * fwdY + chassisLinvel.z * fwdZ;
    this.currentSpeedKmh = this.currentForwardSpeedMs * 3.6;

    // Accelerations (G) with low-pass filtering and standstill silence
    const rawLongAccel = (this.currentForwardSpeedMs - this.prevForwardSpeedMs) / (dt * 9.81);
    this.prevForwardSpeedMs = this.currentForwardSpeedMs;

    const latVel = chassisLinvel.x * rightX + chassisLinvel.y * rightY + chassisLinvel.z * rightZ;

    if (Math.abs(this.currentForwardSpeedMs) < 0.25) {
      this.longitudinalG = 0;
      this.lateralG = 0;
    } else {
      this.longitudinalG = lerp(this.longitudinalG, rawLongAccel, 1 - Math.exp(-14 * dt));
      this.lateralG = lerp(this.lateralG, (latVel * chassisAngvel.y) / 9.81, 1 - Math.exp(-14 * dt));
    }

    // Chassis sideslip angle beta = atan2(vy, vx)
    const forwardSpeedRef = Math.max(1.0, Math.abs(this.currentForwardSpeedMs));
    const chassisSideslipRad = Math.atan2(latVel, forwardSpeedRef);

    // 1. Process driver assists & pedal ramps with Counter-Steer Assist
    let { throttle, brake } = this.assists.processPedalRamps(dt, rawThrottleInput, rawBrakeInput);

    // Phase 5: Automated 60 km/h Pit Lane Speed Limiter Governor
    if (this.pitLimiterActive && this.currentSpeedKmh > 59.5) {
      const overspeedKmh = this.currentSpeedKmh - 59.5;
      throttle = Math.max(0, throttle - overspeedKmh * 0.35);
    }
    this.lastBrakeInput = brake;
    const steerAngleRad = this.assists.processSteering(
      dt,
      rawSteerInput,
      this.currentSpeedKmh,
      chassisSideslipRad
    );

    // 2. Active Stability Control (ESP): Apply yaw damping moment to eliminate spins
    const chassisYawRateRadPerS = chassisAngvel.x * upX + chassisAngvel.y * upY + chassisAngvel.z * upZ;
    const espStabilizingTorque = this.assists.processStabilityControl(
      this.currentForwardSpeedMs,
      steerAngleRad,
      chassisYawRateRadPerS
    );

    if (Math.abs(espStabilizingTorque) > 0.1) {
      this.chassisBody.addTorque(
        {
          x: upX * espStabilizingTorque,
          y: upY * espStabilizingTorque,
          z: upZ * espStabilizingTorque,
        },
        true
      );
    }

    // 3. Aerodynamics: Apply front and rear downforce at axle hardpoints
    const aero = this.aero.computeForces(this.currentForwardSpeedMs);
    const hpFrontWorld = {
      x: chassisPos.x + fwdX * this.frontZ,
      y: chassisPos.y + fwdY * this.frontZ,
      z: chassisPos.z + fwdZ * this.frontZ,
    };
    const hpRearWorld = {
      x: chassisPos.x + fwdX * this.rearZ,
      y: chassisPos.y + fwdY * this.rearZ,
      z: chassisPos.z + fwdZ * this.rearZ,
    };
    this.chassisBody.addForceAtPoint(
      { x: -upX * aero.downforceFrontN, y: -upY * aero.downforceFrontN, z: -upZ * aero.downforceFrontN },
      hpFrontWorld,
      true
    );
    this.chassisBody.addForceAtPoint(
      { x: -upX * aero.downforceRearN, y: -upY * aero.downforceRearN, z: -upZ * aero.downforceRearN },
      hpRearWorld,
      true
    );

    // Apply drag opposing linear velocity
    const speed = Math.sqrt(chassisLinvel.x * chassisLinvel.x + chassisLinvel.y * chassisLinvel.y + chassisLinvel.z * chassisLinvel.z);
    if (speed > 0.1) {
      const dragFactor = -aero.dragForceN / speed;
      this.chassisBody.addForce(
        { x: chassisLinvel.x * dragFactor, y: chassisLinvel.y * dragFactor, z: chassisLinvel.z * dragFactor },
        true
      );
    }

    // 3. Traction control evaluation
    const rearSlipRatios: [number, number] = [this.wheels[2].slipRatio, this.wheels[3].slipRatio];
    const tcFactor = this.assists.processTractionControl(rearSlipRatios, this.currentSpeedKmh);

    // 4. Drivetrain update
    const rearAvgSpeed = (this.wheels[2].angularVelocity + this.wheels[3].angularVelocity) / 2.0;
    const dtInfo = this.drivetrain.update(
      dt,
      throttle,
      brake,
      rearAvgSpeed,
      this.currentSpeedKmh,
      tcFactor
    );
    this.lastDrivetrainInfo = dtInfo;

    // 5. Wheel Raycast Suspension, Brakes & Tire Dynamics
    const maxTravel = this.profile.suspension.front.travelM; // 0.065m
    const wheelBrakeTorques: [number, number, number, number] = [0, 0, 0, 0];
    const wheelOmegas: [number, number, number, number] = [
      this.wheels[0].angularVelocity,
      this.wheels[1].angularVelocity,
      this.wheels[2].angularVelocity,
      this.wheels[3].angularVelocity,
    ];

    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const isFront = i < 2;
      const restSuspensionLength = isFront ? 0.13 : 0.12;
      const suspConfig = isFront ? this.profile.suspension.front : this.profile.suspension.rear;
      const tireConfig = isFront ? this.profile.tires.front : this.profile.tires.rear;

      if (w.isSteered) {
        w.steerAngleRad = steerAngleRad;
      }

      // Hardpoint in world coordinates
      const hp = w.hardpoint;
      const hpWorldX = chassisPos.x + hp[0] * rightX + hp[1] * upX + hp[2] * fwdX;
      const hpWorldY = chassisPos.y + hp[0] * rightY + hp[1] * upY + hp[2] * fwdY;
      const hpWorldZ = chassisPos.z + hp[0] * rightZ + hp[1] * upZ + hp[2] * fwdZ;

      // Down vector in world coords
      const downX = -upX;
      const downY = -upY;
      const downZ = -upZ;

      // Raycast downwards
      const maxRayDist = restSuspensionLength + maxTravel + w.radius;
      this.scratchRay.origin.x = hpWorldX;
      this.scratchRay.origin.y = hpWorldY;
      this.scratchRay.origin.z = hpWorldZ;
      this.scratchRay.dir.x = downX;
      this.scratchRay.dir.y = downY;
      this.scratchRay.dir.z = downZ;

      const hit = this.world.castRayAndGetNormal(
        this.scratchRay,
        maxRayDist,
        true,
        undefined,
        undefined,
        undefined,
        this.chassisBody
      );

      if (hit && hit.timeOfImpact < maxRayDist) {
        const hitDist = hit.timeOfImpact;

        // Retrieve surface properties from Rapier collider
        const hitCollider = (hit as any).collider ?? null;
        const surfaceName = (hitCollider?.userData as any)?.surface;
        const surfaceProp = getSurfaceProperties(surfaceName);

        // Phase 5 Step 5.11: Procedural Multi-Band Road Surface Bump Dynamics
        // Overlay continuous asphalt undulations & tar expansion seams onto wheel contact
        const sMed = Math.sin(hpWorldX * 0.38 + hpWorldZ * 0.42) * Math.cos(hpWorldZ * 0.28) * 0.012;
        const sShort = Math.sin(hpWorldX * 6.28 + hpWorldZ * 6.28) * 0.005;
        const bumpOffset = sMed + sShort;

        // Compression: deflection from rest with tactile road micro-undulations
        const currentLength = (hitDist - bumpOffset) - w.radius;
        const rawCompression = clamp(restSuspensionLength - currentLength, 0, maxTravel);

        // 2nd-order pneumatic contact patch compliance filter:
        // Smooths C0 triangle facet edge transitions at 250+ km/h so damper velocity never spikes
        const compression = w.isInContact
          ? lerp(w.suspensionCompression, rawCompression, 0.28)
          : rawCompression;
        w.suspensionCompression = compression;

        // Suspension velocity with initial contact spike protection & 2nd-order low-pass filtering
        let suspVel = 0;
        if (w.isInContact) {
          const rawVel = (compression - w.prevCompression) / dt;
          w.suspVel = lerp(w.suspVel, clamp(rawVel, -1.5, 1.5), 0.22);
          suspVel = w.suspVel;
        } else {
          w.suspVel = 0;
        }
        w.prevCompression = compression;
        w.isInContact = true;

        // Critically damped suspension (damping ratio zeta >= 1.0):
        // Absorbs bumps monotonically in a single stroke with zero pogo rebound or wobbling
        const baseDamper = suspVel > 0 ? suspConfig.bumpNsPerM : suspConfig.reboundNsPerM;
        const damperForce = baseDamper * suspVel;

        let suspForce = suspConfig.springNPerM * compression + damperForce;
        // Clamp to positive normal force with bump stop headroom
        suspForce = clamp(suspForce, 0, 14000);

        w.normalForce = suspForce;

        // Contact point in world coords
        const hitX = hpWorldX + downX * hitDist;
        const hitY = hpWorldY + downY * hitDist;
        const hitZ = hpWorldZ + downZ * hitDist;
        w.contactPointWorld = [hitX, hitY, hitZ];

        // Velocity at contact point
        // Vp = Vchassis + omega x r
        const rx = hitX - chassisPos.x;
        const ry = hitY - chassisPos.y;
        const rz = hitZ - chassisPos.z;

        const vpX = chassisLinvel.x + (chassisAngvel.y * rz - chassisAngvel.z * ry);
        const vpY = chassisLinvel.y + (chassisAngvel.z * rx - chassisAngvel.x * rz);
        const vpZ = chassisLinvel.z + (chassisAngvel.x * ry - chassisAngvel.y * rx);

        // Wheel forward & right directions in world space (accounting for steer angle)
        const cosS = Math.cos(w.steerAngleRad);
        const sinS = Math.sin(w.steerAngleRad);

        const wheelFwdX = fwdX * cosS + rightX * sinS;
        const wheelFwdY = fwdY * cosS + rightY * sinS;
        const wheelFwdZ = fwdZ * cosS + rightZ * sinS;

        const wheelRightX = rightX * cosS - fwdX * sinS;
        const wheelRightY = rightY * cosS - fwdY * sinS;
        const wheelRightZ = rightZ * cosS - fwdZ * sinS;

        // Contact patch velocity projections
        const vx = vpX * wheelFwdX + vpY * wheelFwdY + vpZ * wheelFwdZ;
        const vy = vpX * wheelRightX + vpY * wheelRightY + vpZ * wheelRightZ;

        // Drive & Brake Torques
        let driveTorqueOnWheel = 0;
        if (w.isDriven) {
          driveTorqueOnWheel = dtInfo.wheelTorqueNm * 0.5; // open differential split
        }

        // When in reverse, brake pedal is reverse gas, and throttle pedal is reverse brake
        const inReverse = dtInfo.gear === -1;
        const effectiveBrakePedal = inReverse ? throttle : brake;
        const isDrivingThrottle = inReverse ? (brake > 0.01) : (throttle > 0.01);

        const rawBrakeTorque = this.brakes.computeWheelBrakeTorque(i, effectiveBrakePedal);
        // Apply ABS assist
        const effectiveBrakeTorque = this.assists.processAbs(w.slipRatio, rawBrakeTorque);
        wheelBrakeTorques[i] = effectiveBrakeTorque;

        // Longitudinal wheel spin coupling:
        if (!w.isDriven && effectiveBrakePedal <= 0.01) {
          // Free-rolling undriven front wheels match road velocity (zero parasitic drag)
          w.angularVelocity = vx / w.radius;
        } else if (w.isDriven && effectiveBrakePedal <= 0.01 && isDrivingThrottle) {
          // Driven rear wheels under driving throttle maintain optimal traction slip (~8-10% slip ratio)
          const baseRoadSpin = vx / w.radius;
          const launchBonus = Math.abs(vx) < 10.0 ? Math.sign(vx || 1) * 14.0 * (1.0 - Math.abs(vx) / 10.0) : 0;
          const targetDriveSpin = baseRoadSpin * 1.09 + launchBonus;
          w.angularVelocity = lerp(w.angularVelocity, targetDriveSpin, 1 - Math.exp(-32 * dt));
        }

        // Compute effective surface friction (dry surface * wet drying line / hydroplaning * tire wear & compound)
        const wheelLatOffset = this.currentLateralOffsetM + hp[0];
        let surfaceFriction = surfaceProp.frictionMultiplier;
        if (this.dryingLine) {
          const wetEval = this.dryingLine.evaluateWetGrip(
            surfaceProp.frictionMultiplier,
            this.currentTrackDistanceM + hp[2],
            wheelLatOffset,
            this.currentSpeedKmh,
            this.setup.tireCompound
          );
          surfaceFriction = wetEval.effectiveFrictionMultiplier;
          if (wetEval.isHydroplaning) {
            this.isHydroplaningNow = true;
          }
          if (i === 0) {
            this.currentSurfaceWetness = wetEval.localWaterDepth;
          }
        }

        const tireWearGripMult = this.getEffectiveWheelGripMultiplier(i);
        const totalFrictionMultiplier = surfaceFriction * tireWearGripMult;

        // Compute tire forces via Pacejka Magic Formula modulated by surface friction & tire wear
        const tireForces = PacejkaTireModel.computeForces(
          vx,
          vy,
          w.angularVelocity,
          w.radius,
          suspForce,
          tireConfig.pacejkaLong,
          tireConfig.pacejkaLat,
          totalFrictionMultiplier
        );

        // Phase 3.2: Slip energy wear accumulation E_slip = integral |F_tire * v_slip| dt
        if (this.consumablesEnabled && Math.abs(vx) > 0.5) {
          const vSlipLong = Math.abs(w.angularVelocity * w.radius - vx);
          const vSlipLat = Math.abs(vy);
          const slipPowerWatts = Math.abs(tireForces.fx) * vSlipLong + Math.abs(tireForces.fy) * vSlipLat;
          const deltaEnergyJ = slipPowerWatts * dt;
          w.slipEnergyJ += deltaEnergyJ;

          const { wearRateScale } = this.getCompoundCharacteristics();
          // Full tread life ~ 18 MJ of cumulative slip work per tire
          const wearIncrement = (deltaEnergyJ / 18_000_000) * wearRateScale * this.wearRateMultiplier;
          w.tireWear = clamp(w.tireWear + wearIncrement, 0.0, 1.0);

          // Update tire carcass temperature from slip power and convective air cooling
          const targetAmbient = this.currentSurfaceWetness > 0.2 ? 45 : 68;
          const heatGainC = (slipPowerWatts * dt) / 2800;
          const coolLossC = (w.tireTempC - targetAmbient) * 0.028 * dt;
          w.tireTempC = clamp(w.tireTempC + heatGainC - coolLossC, 25, 145);
        }

        if (!w.isDriven && effectiveBrakePedal <= 0.01) {
          // Free-rolling wheel produces zero longitudinal braking drag (only rolling resistance applies)
          tireForces.fx = 0;
          tireForces.slipRatio = 0;
        } else if (w.isDriven && !isDrivingThrottle && effectiveBrakePedal <= 0.01) {
          // Drivetrain engine braking / compression drag retarding authority
          const engineBrakeForceN = (dtInfo.wheelTorqueNm * 0.5) / w.radius;
          tireForces.fx = engineBrakeForceN;
        }

        // Physical Caliper Clamping Limit:
        // A vehicle's brake system cannot exert more retarding force on the road than the mechanical
        // torque clamp of its calipers (F_clamp = tau_brake / r_wheel).
        // This ensures stopping distance scales faithfully with car mass, momentum, and brake properties.
        if (effectiveBrakePedal > 0.01) {
          const maxRetardingForce = effectiveBrakeTorque / w.radius;
          if (Math.abs(vx) < 1.2) {
            // Low-speed brake clamping: direct mechanical caliper retarding force opposing road motion.
            // Prevents Pacejka slip-ratio collapse from eliminating brake authority below 4 km/h.
            const roadFrictionLimit = surfaceProp.frictionMultiplier * suspForce;
            const lowSpeedBrakeN = Math.min(maxRetardingForce, roadFrictionLimit);
            tireForces.fx = -Math.sign(vx) * lowSpeedBrakeN;
          } else if (vx * tireForces.fx < 0) {
            tireForces.fx = Math.sign(tireForces.fx) * Math.min(Math.abs(tireForces.fx), maxRetardingForce);
          }
        }

        // Mechanical Axle Drive Torque Limit:
        // A driven wheel cannot exert more propulsive traction force on the road than the mechanical
        // torque delivered by the powertrain to the wheel axle (F_propulsive <= tau_drive / r_wheel).
        // This ensures vehicle acceleration in higher gears accurately reflects actual engine horsepower.
        if (w.isDriven && tireForces.fx > 0 && driveTorqueOnWheel > 0) {
          const maxPropulsiveForce = driveTorqueOnWheel / w.radius;
          tireForces.fx = Math.min(tireForces.fx, maxPropulsiveForce);
        }

        w.slipRatio = tireForces.slipRatio;
        w.slipAngleRad = tireForces.slipAngle;

        // Update wheel spin velocity (omega)
        const drivetrainInertia = w.isDriven ? 2.0 : 0.0;
        const totalInertia = w.rotationalInertia + drivetrainInertia;

        // Numerical chatter prevention: brake torque cannot reverse wheel rotation direction in a single step
        const maxStopTorque = (totalInertia * Math.abs(w.angularVelocity)) / dt;
        const clampedBrakeTorque = Math.min(effectiveBrakeTorque, maxStopTorque);
        const brakeTorqueDir = w.angularVelocity > 0 ? -clampedBrakeTorque : (w.angularVelocity < 0 ? clampedBrakeTorque : 0);
        
        // Physical tire road reaction torque (tau = -Fx * r) balancing drive torque
        const tireReactionTorque = -tireForces.fx * w.radius;
        const netTorque = driveTorqueOnWheel + brakeTorqueDir + (w.isDriven ? tireReactionTorque : 0);
        w.angularVelocity += (netTorque / totalInertia) * dt;

        // Ground rolling relaxation: wheel spin relaxes toward road speed vx / r under tire contact
        const targetRoadSpin = vx / w.radius;
        w.angularVelocity = lerp(w.angularVelocity, targetRoadSpin, 1 - Math.exp(-32 * dt));

        // 1. Suspension force pushes UP on chassis at the suspension hardpoint
        this.chassisBody.addForceAtPoint(
          { x: upX * suspForce, y: upY * suspForce, z: upZ * suspForce },
          { x: hpWorldX, y: hpWorldY, z: hpWorldZ },
          true
        );

        // Surface rolling resistance / displacement drag (e.g. high deceleration in gravel traps)
        const rollingDragN = surfaceProp.rollingResistanceCoeff * suspForce;
        const dragDir = vx > 0.05 ? -1 : (vx < -0.05 ? 1 : 0);
        const rollingDragX = dragDir * rollingDragN * wheelFwdX;
        const rollingDragY = dragDir * rollingDragN * wheelFwdY;
        const rollingDragZ = dragDir * rollingDragN * wheelFwdZ;

        // 2. Tire traction & cornering forces act at the ground contact patch
        const tireForceX = tireForces.fx * wheelFwdX + tireForces.fy * wheelRightX + rollingDragX;
        const tireForceY = tireForces.fx * wheelFwdY + tireForces.fy * wheelRightY + rollingDragY;
        const tireForceZ = tireForces.fx * wheelFwdZ + tireForces.fy * wheelRightZ + rollingDragZ;

        this.chassisBody.addForceAtPoint(
          { x: tireForceX, y: tireForceY, z: tireForceZ },
          { x: hitX, y: hitY, z: hitZ },
          true
        );
      } else {
        w.isInContact = false;
        w.prevCompression = 0;
        w.suspensionCompression = 0;
        w.suspVel = 0;
        w.normalForce = 0;
        w.slipRatio = 0;
        w.slipAngleRad = 0;
        // Free spin decay in air
        w.angularVelocity *= Math.exp(-1.5 * dt);
      }
    }

    // Update background thermal simulation of brake discs
    this.brakes.updateThermal(dt, this.currentSpeedKmh, wheelBrakeTorques, wheelOmegas);

    // Phase 3.2: Dynamic Fuel Mass Depletion (0.75 kg/L)
    if (this.consumablesEnabled && this.fuelLiters > 0) {
      const idleBurnLPerS = 0.004;
      const loadBurnLPerS = 0.042 * throttle * Math.max(0.25, dtInfo.rpmRatio);
      const burnedLiters = (idleBurnLPerS + loadBurnLPerS) * this.fuelBurnMultiplier * dt;
      const prevMassInt = Math.round(this.getTotalMassKg() * 100);
      this.fuelLiters = Math.max(0, this.fuelLiters - burnedLiters);
      const newMassInt = Math.round(this.getTotalMassKg() * 100);
      if (newMassInt !== prevMassInt) {
        this.updateDynamicMassAndBalance();
      }
    }

    // Displace standing water along the 2D drying line when wheels roll on track
    if (this.dryingLine && Math.abs(this.currentSpeedKmh) > 5.0) {
      this.dryingLine.clearWaterAlongGroove(
        this.currentTrackDistanceM,
        this.currentLateralOffsetM,
        this.currentSpeedKmh,
        0.04 * dt * 60
      );
    }

    // Standstill damping, low-speed coast-down, and static hold:
    // If the car is slowing down without driving throttle (< 0.85 m/s ≈ 3 km/h):
    const inReverseMode = dtInfo.gear === -1;
    const isDrivingActive = inReverseMode ? (brake > 0.05) : (throttle > 0.05);
    const effectiveBrakeInput = inReverseMode ? throttle : brake;

    // Automatic reverse coast-down: releasing pedals while reversing halts vehicle into Neutral
    if (inReverseMode && !isDrivingActive) {
      const linvel = this.chassisBody.linvel();
      this.chassisBody.setLinvel(
        { x: linvel.x * 0.985, y: linvel.y, z: linvel.z * 0.985 },
        true
      );
    }

    if (!isDrivingActive && Math.abs(this.currentForwardSpeedMs) < 0.85) {
      const linvel = this.chassisBody.linvel();
      const angvel = this.chassisBody.angvel();
      // If brakes are applied even lightly, stop firmly; if coasting, apply smooth low-speed deceleration to 0
      const holdDamping = effectiveBrakeInput > 0.02
        ? 0.75
        : (Math.abs(this.currentForwardSpeedMs) < 0.35 ? 0.88 : 0.95);

      this.chassisBody.setLinvel(
        { x: linvel.x * holdDamping, y: linvel.y, z: linvel.z * holdDamping },
        true
      );
      this.chassisBody.setAngvel(
        { x: angvel.x * holdDamping, y: angvel.y * holdDamping, z: angvel.z * holdDamping },
        true
      );
      if (Math.abs(this.currentForwardSpeedMs) < 0.06) {
        this.currentForwardSpeedMs = 0;
        this.currentSpeedKmh = 0;
      }
    }
  }

  getTelemetry(): VehicleTelemetry {
    const dtInfo = this.lastDrivetrainInfo;
    const cleanSpeed = Math.abs(this.currentSpeedKmh) < 0.35 ? 0 : this.currentSpeedKmh;

    return {
      speedKmh: cleanSpeed,
      brake: this.lastBrakeInput,
      rpm: dtInfo.rpm,
      rpmRatio: dtInfo.rpmRatio,
      gear: dtInfo.gear,
      isShiftLightActive: dtInfo.shiftLight,
      isAbsActive: this.assists.getAbsActive(),
      isTcActive: this.assists.getTcActive(),
      steerAngleDeg: this.assists.getSteerAngleDeg(),
      engineTorqueNm: dtInfo.wheelTorqueNm,
      wheelSlipAngle: [
        this.wheels[0].slipAngleRad,
        this.wheels[1].slipAngleRad,
        this.wheels[2].slipAngleRad,
        this.wheels[3].slipAngleRad,
      ],
      wheelSlipRatio: [
        this.wheels[0].slipRatio,
        this.wheels[1].slipRatio,
        this.wheels[2].slipRatio,
        this.wheels[3].slipRatio,
      ],
      suspensionCompression: [
        this.wheels[0].suspensionCompression,
        this.wheels[1].suspensionCompression,
        this.wheels[2].suspensionCompression,
        this.wheels[3].suspensionCompression,
      ],
      lateralG: this.lateralG,
      longitudinalG: this.longitudinalG,
      brakeTempsC: [...this.brakes.tempsC],
      brakePadFriction: [...this.brakes.padFrictionCoeffs],
      brakeFadeFactor: [...this.brakes.fadeFactors],
      tireWear: [
        this.wheels[0].tireWear,
        this.wheels[1].tireWear,
        this.wheels[2].tireWear,
        this.wheels[3].tireWear,
      ],
      tireHealthPercent: [
        Math.round((1 - this.wheels[0].tireWear) * 100),
        Math.round((1 - this.wheels[1].tireWear) * 100),
        Math.round((1 - this.wheels[2].tireWear) * 100),
        Math.round((1 - this.wheels[3].tireWear) * 100),
      ],
      tireTempsC: [
        Math.round(this.wheels[0].tireTempC),
        Math.round(this.wheels[1].tireTempC),
        Math.round(this.wheels[2].tireTempC),
        Math.round(this.wheels[3].tireTempC),
      ],
      tireSlipEnergyJ: [
        Math.round(this.wheels[0].slipEnergyJ),
        Math.round(this.wheels[1].slipEnergyJ),
        Math.round(this.wheels[2].slipEnergyJ),
        Math.round(this.wheels[3].slipEnergyJ),
      ],
      fuelLiters: Number(this.fuelLiters.toFixed(2)),
      fuelMassKg: Number(this.getFuelMassKg().toFixed(2)),
      totalMassKg: Number(this.getTotalMassKg().toFixed(2)),
      tireCompound: this.setup.tireCompound,
      isHydroplaning: this.isHydroplaningNow,
      surfaceWetness: this.currentSurfaceWetness,
      isDownshiftBlip: dtInfo.isDownshiftBlip,
      isShifting: dtInfo.isShifting,
      lapTimeSeconds: 0,
      bestLapSeconds: null,
      sprint0to100Time: null,
      rttMs: 0,
    };
  }

  respawn(x = 0, y = 0.8, z = 0, angleYaw = 0): void {
    const qy = Math.sin(angleYaw / 2);
    const qw = Math.cos(angleYaw / 2);

    this.chassisBody.setTranslation({ x, y, z }, true);
    this.chassisBody.setRotation({ x: 0, y: qy, z: 0, w: qw }, true);
    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    this.drivetrain.reset();
    this.assists.reset();
    this.brakes.reset();
    this.lastDrivetrainInfo = {
      wheelTorqueNm: 0,
      rpm: this.profile.engine.idleRpm,
      rpmRatio: 0,
      gear: 0,
      isShifting: false,
      isDownshiftBlip: false,
      shiftLight: false,
    };

    for (const w of this.wheels) {
      w.angularVelocity = 0;
      w.suspensionCompression = 0;
      w.prevCompression = 0;
      w.suspVel = 0;
      w.slipRatio = 0;
      w.slipAngleRad = 0;
      w.slipEnergyJ = 0;
      w.tireWear = 0;
      w.tireTempC = 75;
    }
    this.fuelLiters = this.setup.fuelLoadL;
    this.isHydroplaningNow = false;
    this.updateDynamicMassAndBalance();
  }

  public setReverseLock(locked: boolean): void {
    this.drivetrain.setReverseLock(locked);
  }

  public dispose(): void {
    if (this.chassisBody) {
      try {
        this.world.removeRigidBody(this.chassisBody);
      } catch (e) {
        console.warn('RaycastVehicle: Error removing rigid body:', e);
      }
    }
  }
}
