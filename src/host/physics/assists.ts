import { CarProfile } from '../../common/types';
import { clamp, lerp, degToRad, radToDeg } from '../../common/math';

export class DrivingAssists {
  private profile: CarProfile;
  private currentRampedThrottle = 0;
  private currentRampedBrake = 0;
  private currentSteerAngleDeg = 0;

  private isTcActive = false;
  private isAbsActive = false;
  private isEspActive = false;

  // Dynamic setup overrides
  private tcLevel = 6; // 0 (off) to 10 (max)
  private absEnabled = true;
  private espGainOverride: number | null = null;
  private counterSteerOverride: number | null = null;
  private highSpeedLockOverride: number | null = null;

  constructor(profile: CarProfile) {
    this.profile = profile;
    this.absEnabled = profile.assists.abs ?? true;
    this.tcLevel = Math.round((profile.assists.tractionControl ?? 0.65) * 10);
  }

  public setTcLevel(level: number): void {
    this.tcLevel = clamp(Math.round(level), 0, 10);
  }

  public getTcLevel(): number {
    return this.tcLevel;
  }

  public setAbsEnabled(enabled: boolean): void {
    this.absEnabled = enabled;
  }

  public getAbsEnabled(): boolean {
    return this.absEnabled;
  }

  public setEspGain(gain: number): void {
    this.espGainOverride = clamp(gain, 0.0, 1.0);
  }

  public setCounterSteerGain(gain: number): void {
    this.counterSteerOverride = clamp(gain, 0.0, 1.0);
  }

  public setHighSpeedLockFraction(frac: number): void {
    this.highSpeedLockOverride = clamp(frac, 0.20, 0.60);
  }

  /**
   * Process and ramp digital throttle and brake inputs.
   */
  processPedalRamps(dt: number, rawThrottle: number, rawBrake: number): {
    throttle: number;
    brake: number;
  } {
    const { throttleRampS, brakeRampS } = this.profile.assists;

    // Throttle rise (0.18s) vs release (0.06s)
    const throttleRiseRate = 1.0 / Math.max(0.01, throttleRampS);
    const throttleDecayRate = 1.0 / 0.06;

    if (rawThrottle > this.currentRampedThrottle) {
      this.currentRampedThrottle = Math.min(
        rawThrottle,
        this.currentRampedThrottle + throttleRiseRate * dt
      );
    } else {
      this.currentRampedThrottle = Math.max(
        rawThrottle,
        this.currentRampedThrottle - throttleDecayRate * dt
      );
    }

    // Brake rise (0.12s) vs release (0.05s)
    const brakeRiseRate = 1.0 / Math.max(0.01, brakeRampS);
    const brakeDecayRate = 1.0 / 0.05;

    if (rawBrake > this.currentRampedBrake) {
      this.currentRampedBrake = Math.min(
        rawBrake,
        this.currentRampedBrake + brakeRiseRate * dt
      );
    } else {
      this.currentRampedBrake = Math.max(
        rawBrake,
        this.currentRampedBrake - brakeDecayRate * dt
      );
    }

    return {
      throttle: clamp(this.currentRampedThrottle, 0, 1),
      brake: clamp(this.currentRampedBrake, 0, 1),
    };
  }

  /**
   * Calculate speed-sensitive maximum steering lock and slew rate,
   * with automatic Counter-Steer Assist for slip recovery.
   */
  processSteering(
    dt: number,
    normalizedInputSteer: number,
    speedKmh: number,
    chassisSideslipRad = 0
  ): number {
    const { maxWheelAngleDeg, maxRateDegPerS, speedSensitivityStartKmh } =
      this.profile.steering;
    const highSpeedLockFraction = this.highSpeedLockOverride ?? this.profile.steering.highSpeedLockFraction;
    const counterSteerCoeff = this.counterSteerOverride ?? (this.profile.assists.counterSteer ?? 0.30);

    const absSpeed = Math.abs(speedKmh);

    // Compute max allowable steer angle at current speed
    let speedFactor = 1.0;
    if (absSpeed > speedSensitivityStartKmh) {
      const t = clamp((absSpeed - speedSensitivityStartKmh) / (250 - speedSensitivityStartKmh), 0, 1);
      speedFactor = lerp(1.0, highSpeedLockFraction, t);
    }

    // Standardized intuitive steering mapping:
    // normalizedInputSteer > 0 (Key D / Right Arrow / Tilt Right) steers vehicle RIGHT (towards -X in world space)
    // normalizedInputSteer < 0 (Key A / Left Arrow / Tilt Left) steers vehicle LEFT (towards +X in world space)
    const baseTargetAngleDeg = -normalizedInputSteer * maxWheelAngleDeg * speedFactor;

    // Counter-steer assist: only assists when driver is NOT actively turning into the corner,
    // or when the vehicle is in a true oversteer fishtail / slide recovery.
    // Never fights intentional cornering steering input.
    let counterSteerDeg = 0;
    if (absSpeed > 10.0 && Math.abs(normalizedInputSteer) < 0.15) {
      counterSteerDeg = radToDeg(chassisSideslipRad * counterSteerCoeff);
      // Clamp counter-steer assist authority to +/- 6 degrees
      counterSteerDeg = clamp(counterSteerDeg, -6.0, 6.0);
    }

    const targetAngleDeg = clamp(
      baseTargetAngleDeg + counterSteerDeg,
      -maxWheelAngleDeg,
      maxWheelAngleDeg
    );

    // Slew rate limiting (maxRateDegPerS = 320 deg/s)
    const maxDelta = maxRateDegPerS * dt;
    const delta = targetAngleDeg - this.currentSteerAngleDeg;
    this.currentSteerAngleDeg += clamp(delta, -maxDelta, maxDelta);

    return degToRad(this.currentSteerAngleDeg);
  }

  /**
   * Electronic Stability Control (ESP):
   * Calculates stabilizing yaw torque opposing excessive oversteer yaw rate.
   */
  processStabilityControl(
    forwardSpeedMs: number,
    steerAngleRad: number,
    actualYawRateRadPerS: number
  ): number {
    const stabilityGain = this.espGainOverride ?? (this.profile.assists.stability ?? 0.45);
    // Low-speed steering freedom: allow natural pivot and rotation in low-speed hairpins/corners (< 65 km/h)
    const lowSpeedEspScale = clamp((Math.abs(forwardSpeedMs) - 5.0) / 12.0, 0.0, 1.0);
    const activeStabilityGain = stabilityGain * lowSpeedEspScale;

    if (activeStabilityGain <= 0.01 || Math.abs(forwardSpeedMs) < 3.0) {
      this.isEspActive = false;
      return 0;
    }

    const wheelbase = this.profile.chassis.wheelbaseM;
    // Expected yaw rate based on neutral bicycle model without artificial understeer
    const targetYawRate =
      (forwardSpeedMs * Math.tan(steerAngleRad)) /
      (wheelbase * (1.0 + 0.00015 * forwardSpeedMs * forwardSpeedMs));

    const yawError = actualYawRateRadPerS - targetYawRate;
    const deadband = 0.08; // rad/s allowance for natural slip

    if (Math.abs(yawError) > deadband) {
      this.isEspActive = true;
      const activeError = yawError > 0 ? (yawError - deadband) : (yawError + deadband);
      // Stabilizing torque scaled with yaw inertia (1850 kg*m^2)
      const yawInertia = this.profile.chassis.inertiaTensor[2] || 1850;
      const stabilizingTorque = -activeStabilityGain * activeError * yawInertia * 3.5;
      return clamp(stabilizingTorque, -6000, 6000);
    }

    this.isEspActive = false;
    return 0;
  }

  /**
   * Traction Control: limits rear wheel drive torque when longitudinal slip ratio > 0.15.
   * Disables at low speeds (< 20 km/h) to allow standing start launches.
   */
  processTractionControl(rearSlipRatios: [number, number], speedKmh = 50): number {
    if (this.tcLevel <= 0 || Math.abs(speedKmh) < 20) {
      this.isTcActive = false;
      return 1.0;
    }

    const tcStrength = this.tcLevel / 6.0; // 1.0 at baseline level 6
    const maxRearSlip = Math.max(rearSlipRatios[0], rearSlipRatios[1]);
    const slipThreshold = clamp(0.24 - this.tcLevel * 0.01, 0.12, 0.24);

    if (maxRearSlip > slipThreshold) {
      this.isTcActive = true;
      // Progressive reduction of drive torque
      const excess = maxRearSlip - slipThreshold;
      const reduction = clamp(excess * 2.5 * tcStrength, 0.0, clamp(0.45 * tcStrength, 0.15, 0.75));
      return 1.0 - reduction;
    }

    this.isTcActive = false;
    return 1.0;
  }

  /**
   * Anti-lock Braking System: modulates brake torque when wheel slip ratio drops below threshold.
   * Includes motorsport trail-braking steer-assist (Bosch Motorsport ABS M5 profile):
   * When steering into a turn under braking, ABS relieves front pressure deeper to preserve
   * lateral cornering grip and eliminate corner-entry understeer.
   */
  processAbs(
    slipRatio: number,
    rawBrakeTorque: number,
    isSteeredWheel = false,
    steerAngleAbsRad = 0
  ): number {
    if (!this.absEnabled) {
      this.isAbsActive = false;
      return rawBrakeTorque;
    }
    // Steered front wheels under corner entry steer target a tighter slip window (-0.12)
    // to preserve lateral cornering force fy on the friction circle
    const isTrailBraking = isSteeredWheel && steerAngleAbsRad > 0.04;
    const absThreshold = isTrailBraking ? -0.12 : -0.16;

    if (slipRatio < absThreshold) {
      this.isAbsActive = true;
      // Motorsport ABS pressure modulation: relieves pressure smoothly to maintain peak tire grip
      // In straight line: floor at 0.45. In trail-braking: floor at 0.35 to allow front tires to steer
      const minFactor = isTrailBraking ? 0.35 : 0.45;
      const factor = clamp(1.0 - (absThreshold - slipRatio) * 1.8, minFactor, 1.0);
      return rawBrakeTorque * factor;
    }

    return rawBrakeTorque;
  }

  getTcActive(): boolean {
    return this.isTcActive;
  }

  getAbsActive(): boolean {
    return this.isAbsActive;
  }

  getEspActive(): boolean {
    return this.isEspActive;
  }

  getSteerAngleDeg(): number {
    return this.currentSteerAngleDeg;
  }

  reset(): void {
    this.currentRampedThrottle = 0;
    this.currentRampedBrake = 0;
    this.currentSteerAngleDeg = 0;
    this.isTcActive = false;
    this.isAbsActive = false;
    this.isEspActive = false;
  }
}
