import { CarProfile } from '../../common/types';
import { clamp, lerp } from '../../common/math';

export class Drivetrain {
  private profile: CarProfile;
  private currentGear = 1; // 1 to 6, 0 = N, -1 = R
  private currentRpm = 2000;
  private shiftTimer = 0;
  private isShifting = false;
  private isDownshiftBlip = false;
  private targetBlipRpm = 2000;
  private reverseHoldTimer = 0;

  constructor(profile: CarProfile) {
    this.profile = profile;
    this.currentRpm = profile.engine.idleRpm;
  }

  /**
   * Linear interpolation of engine torque from RPM curve.
   */
  getEngineTorque(rpm: number): number {
    const curve = this.profile.engine.torqueCurve;
    if (rpm <= curve[0][0]) return curve[0][1];
    if (rpm >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

    for (let i = 0; i < curve.length - 1; i++) {
      const [rpm1, t1] = curve[i];
      const [rpm2, t2] = curve[i + 1];
      if (rpm >= rpm1 && rpm <= rpm2) {
        const factor = (rpm - rpm1) / (rpm2 - rpm1);
        return lerp(t1, t2, factor);
      }
    }
    return curve[0][1];
  }

  /**
   * Update drivetrain state for timestep dt (seconds).
   *
   * @param dt Timestep (s)
   * @param throttle Input throttle [0, 1]
   * @param brake Input brake [0, 1]
   * @param rearWheelAvgSpeed Average angular speed of driven rear wheels (rad/s)
   * @param carSpeedKmh Forward velocity of the vehicle (km/h)
   * @param tcTorqueFactor Torque reduction factor from Traction Control (0 to 1)
   */
  update(
    dt: number,
    throttle: number,
    brake: number,
    rearWheelAvgSpeed: number,
    carSpeedKmh: number,
    tcTorqueFactor = 1.0
  ): {
    wheelTorqueNm: number;
    rpm: number;
    rpmRatio: number;
    gear: number;
    isShifting: boolean;
    isDownshiftBlip: boolean;
    shiftLight: boolean;
  } {
    const { idleRpm, redlineRpm, limiterRpm, engineBrakeNm } = this.profile.engine;
    const { ratios, reverse, finalDrive, shiftTimeS, upshiftRpm, downshiftRpm } = this.profile.transmission;

    // Handle shift timeout
    if (this.isShifting) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.isShifting = false;
        this.isDownshiftBlip = false;
      }
    }

    // In reverse, the brake pedal acts as reverse throttle, and throttle pedal acts as brake
    const inReverse = this.currentGear === -1;
    const effectiveThrottle = inReverse ? brake : throttle;

    // Direction & Neutral/Reverse transition logic:
    // Standstill threshold: < 0.6 km/h (~0.16 m/s) is true standstill.
    // While rolling forward (>= 0.6 km/h), vehicle stays in 1st gear (1), never prematurely dropping to Neutral.
    // At true standstill (< 0.6 km/h), vehicle sits in Neutral (N = 0) with clutch open.
    // Pressing throttle drops into 1st gear (1) to launch; holding brake engages Reverse (-1).
    if (Math.abs(carSpeedKmh) < 0.6) {
      if (this.currentGear === -1) {
        // Was reversing and now stopped at standstill (< 0.6 km/h):
        if (throttle > 0.05) {
          // Driver tapped/pressed throttle: immediately engage 1st gear forward
          this.currentGear = 1;
          this.reverseHoldTimer = 0;
        } else if (brake <= 0.05) {
          // Driver released pedals: car is at rest, return to Neutral (N = 0)
          this.currentGear = 0;
          this.reverseHoldTimer = 0;
        } else {
          // Driver is actively holding brake to continue reverse drive
          // Keep currentGear = -1
        }
      } else {
        // Forward or neutral at standstill:
        if (throttle > 0.05) {
          this.currentGear = 1; // Engage 1st gear on throttle to launch
          this.reverseHoldTimer = 0;
        } else if (brake > 0.25) {
          // Holding brake while stopped: count hold timer to shift into reverse
          this.reverseHoldTimer += dt;
          if (this.reverseHoldTimer > 0.30) {
            this.currentGear = -1; // Switch to reverse after holding brake
            this.reverseHoldTimer = 0;
          } else {
            this.currentGear = 0; // Neutral while waiting for reverse hold threshold
          }
        } else {
          this.currentGear = 0; // Neutral at standstill when pedals released
          this.reverseHoldTimer = 0;
        }
      }
    } else {
      this.reverseHoldTimer = 0;
      // While moving forward (>= 0.6 km/h), transmission is in 1st gear minimum
      if (this.currentGear === 0 && carSpeedKmh >= 0.6) {
        this.currentGear = 1;
      }
    }

    // Calculate gear ratio
    let currentRatio = 0;
    if (this.currentGear === -1) {
      currentRatio = -reverse;
    } else if (this.currentGear >= 1 && this.currentGear <= 6) {
      currentRatio = ratios[this.currentGear - 1];
    }

    const totalRatio = currentRatio * finalDrive;

    // Calculate drivetrain-coupled RPM from driven wheel speed
    const wheelRpm = (Math.abs(rearWheelAvgSpeed) * 60) / (2 * Math.PI);
    const coupledRpm = Math.abs(wheelRpm * totalRatio);

    // Target RPM with idle floor
    let targetRpm = Math.max(idleRpm, coupledRpm);

    // Dynamic launch clutch slip in 1st gear / reverse (slips up to ~22 km/h)
    if ((this.currentGear === 1 || this.currentGear === -1) && Math.abs(carSpeedKmh) < 22) {
      const lockupFraction = Math.min(1.0, Math.abs(carSpeedKmh) / 22.0);
      const launchSlipRpm = idleRpm + effectiveThrottle * 4000;
      targetRpm = Math.max(targetRpm, lerp(launchSlipRpm, coupledRpm, lockupFraction));
    } else if (this.currentGear === 0) {
      targetRpm = Math.max(targetRpm, idleRpm + effectiveThrottle * (redlineRpm - idleRpm));
    }

    // Limiter bounce
    if (targetRpm > limiterRpm) {
      targetRpm = limiterRpm;
    }

    // Smooth engine RPM response (rev-matching blip on downshifts overrides normal deceleration)
    if (this.isShifting && this.isDownshiftBlip) {
      this.currentRpm = lerp(this.currentRpm, this.targetBlipRpm, 1 - Math.exp(-42.0 * dt));
    } else {
      const rpmBlendSpeed = targetRpm > this.currentRpm ? 28.0 : 18.0;
      this.currentRpm = lerp(this.currentRpm, targetRpm, 1 - Math.exp(-rpmBlendSpeed * dt));
    }
    this.currentRpm = clamp(this.currentRpm, idleRpm, limiterRpm);

    // Helper to compute theoretical road speed (km/h) for given engine RPM in a gear ratio
    const rearRadius = this.profile.tires.rear.radiusM;
    const speedAtRpm = (rpm: number, ratio: number) => {
      const totRatio = Math.abs(ratio * finalDrive);
      return (rpm / totRatio) * ((2 * Math.PI * rearRadius) / 60) * 3.6;
    };

    // Automatic sequential shifting logic (when not already shifting)
    if (!this.isShifting && this.currentGear > 0) {
      const currentRatio = ratios[this.currentGear - 1];
      const speedAtUpshift = speedAtRpm(upshiftRpm, currentRatio);

      // Upshift: triggered when engine reaches upshift RPM (8800) and ground speed is mechanically matched
      if (
        this.currentGear < 6 &&
        throttle > 0.35 &&
        this.currentRpm >= upshiftRpm &&
        carSpeedKmh >= speedAtUpshift * 0.88
      ) {
        this.currentGear++;
        this.isShifting = true;
        this.shiftTimer = shiftTimeS;
      }
      // Downshift: triggered when engine RPM drops below downshift threshold or car slows into lower gear speed range
      else if (this.currentGear > 1) {
        const lowerRatio = ratios[this.currentGear - 2];
        const lowerGearUpshiftSpeed = speedAtRpm(upshiftRpm, lowerRatio);
        const lowerGearRpmAtSpeed = (Math.abs(carSpeedKmh) / lowerGearUpshiftSpeed) * upshiftRpm;

        // Ensure downshifting will not over-rev past redline
        if (lowerGearRpmAtSpeed <= redlineRpm * 0.96) {
          const currentGearDownshiftSpeed = speedAtRpm(downshiftRpm, currentRatio);
          if (
            this.currentRpm <= downshiftRpm ||
            carSpeedKmh < currentGearDownshiftSpeed ||
            (carSpeedKmh < 32 && this.currentGear > 1)
          ) {
            this.currentGear--;
            this.isShifting = true;
            this.shiftTimer = shiftTimeS;
            // Electronic throttle rev-matching blip (auto-blip) for seamless dog-ring engagement
            this.isDownshiftBlip = true;
            this.targetBlipRpm = clamp(lowerGearRpmAtSpeed * 1.05, idleRpm, redlineRpm * 0.98);
          }
        }
      }
    }

    // Compute wheel drive torque
    let driveTorque = 0;

    if (!this.isShifting && currentRatio !== 0) {
      if (effectiveThrottle > 0.01) {
        const peakTorque = this.getEngineTorque(this.currentRpm);
        // Clutch engagement ramp at low speed (crisp launch bite)
        const clutchFactor = this.currentGear === 1 ? clamp(Math.abs(carSpeedKmh) / 3.0, 0.96, 1.0) : 1.0;

        // Fuel / ignition cut at rev limiter (Porsche flat-6 high-rpm protection)
        let limiterCut = 1.0;
        if (this.currentRpm >= limiterRpm) {
          limiterCut = 0.0;
        } else if (this.currentRpm > redlineRpm) {
          limiterCut = Math.max(0.0, 1.0 - (this.currentRpm - redlineRpm) / (limiterRpm - redlineRpm));
        }

        const engineTorque = peakTorque * effectiveThrottle * tcTorqueFactor * clutchFactor * limiterCut;

        // Mechanical coupling: if wheels are spinning faster than limiter RPM, engine provides compression drag
        if (coupledRpm > limiterRpm && this.currentGear > 0) {
          driveTorque = -engineBrakeNm * Math.abs(totalRatio) * 2.0;
        } else {
          // Total wheel torque = engineTorque * gearRatio * finalDrive * efficiency (~94%)
          driveTorque = engineTorque * totalRatio * 0.94;
        }
      } else {
        // Engine braking / coasting (effectiveThrottle <= 0.01)
        if (Math.abs(rearWheelAvgSpeed) > 0.4) {
          // 1. Dynamic internal compression drag (vacuum pumping loss + rotational friction)
          // Scales quadratically with engine RPM
          const rpmRatio = clamp((this.currentRpm - idleRpm) / (redlineRpm - idleRpm), 0, 1);
          // Baseline mechanical friction (~50% of engineBrakeNm) + quadratic piston pumping losses (~up to 160% at redline)
          const compressionDragNm = engineBrakeNm * (0.50 + 1.10 * rpmRatio * rpmRatio);

          // 2. Powertrain-specific drag architecture (ICE vs Hybrid vs Electric)
          const pType = this.profile.engine.type || 'ice';
          let totalRetardationNm = compressionDragNm;

          if (pType === 'hybrid') {
            // ICE compression drag + MGU-K regen generator harvesting
            const regenNm = this.profile.engine.regenBrakeNm ?? 120;
            // Electrical regeneration fades below 20 km/h
            const regenFactor = clamp(Math.abs(carSpeedKmh) / 20.0, 0, 1);
            totalRetardationNm = compressionDragNm + regenNm * regenFactor;
          } else if (pType === 'electric') {
            // Pure electric regen drag without reciprocal piston pumping losses
            const regenNm = this.profile.engine.regenBrakeNm ?? 180;
            const regenFactor = clamp(Math.abs(carSpeedKmh) / 15.0, 0, 1);
            totalRetardationNm = regenNm * regenFactor;
          }

          // 3. Low-speed clutch disengagement in 1st gear / reverse (prevents stall and allows smooth coast to stop)
          let clutchEngagement = 1.0;
          if (Math.abs(this.currentGear) === 1) {
            clutchEngagement = clamp((Math.abs(carSpeedKmh) - 0.3) / 3.5, 0.20, 1.0);
          }

          driveTorque = -Math.sign(rearWheelAvgSpeed) * totalRetardationNm * Math.abs(totalRatio) * clutchEngagement;
        } else {
          driveTorque = 0;
        }
      }
    }

    const rpmRatio = clamp((this.currentRpm - idleRpm) / (redlineRpm - idleRpm), 0, 1);
    const shiftLight = this.currentRpm >= upshiftRpm;

    return {
      wheelTorqueNm: driveTorque,
      rpm: this.currentRpm,
      rpmRatio,
      gear: this.currentGear,
      isShifting: this.isShifting,
      isDownshiftBlip: this.isDownshiftBlip,
      shiftLight,
    };
  }

  reset(): void {
    this.currentGear = 0; // Neutral at standstill
    this.currentRpm = this.profile.engine.idleRpm;
    this.shiftTimer = 0;
    this.isShifting = false;
    this.isDownshiftBlip = false;
    this.targetBlipRpm = this.profile.engine.idleRpm;
    this.reverseHoldTimer = 0;
  }
}
