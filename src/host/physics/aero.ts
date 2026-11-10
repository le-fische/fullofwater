import { CarProfile } from '../../common/types';

export interface AeroForces {
  downforceFrontN: number;
  downforceRearN: number;
  totalDownforceN: number;
  dragForceN: number;
}

export class Aerodynamics {
  private profile: CarProfile;
  private airDensity = 1.225; // kg/m^3 at sea level
  private rearWingAngleDeg = 10.0; // Baseline 10.0 deg

  constructor(profile: CarProfile) {
    this.profile = profile;
  }

  /**
   * Adjusts rear wing angle of attack (5.0° low-drag trim to 18.0° high-downforce trim).
   * Baseline homologation is 10.0°.
   */
  public setRearWingAngleDeg(angleDeg: number): void {
    this.rearWingAngleDeg = Math.max(5.0, Math.min(18.0, angleDeg));
  }

  public getRearWingAngleDeg(): number {
    return this.rearWingAngleDeg;
  }

  /**
   * Computes aerodynamic downforce and drag from vehicle forward velocity (m/s).
   * @param forwardSpeedMs Forward speed in m/s
   * @param drsActive Whether Drag Reduction System wing flap is open
   */
  computeForces(forwardSpeedMs: number, drsActive = false): AeroForces {
    const v2 = forwardSpeedMs * forwardSpeedMs;
    const dynamicPressure = 0.5 * this.airDensity * v2;

    // Wing angle delta from 10.0° baseline modulates downforce and drag
    const wingDelta = this.rearWingAngleDeg - 10.0;
    const wingClFactor = 1.0 + wingDelta * 0.032; // +25.6% at 18°, -16% at 5°
    const wingCdFactor = 1.0 + wingDelta * 0.018; // +14.4% drag at 18°, -9% at 5°

    let clA = this.profile.aero.downforceClA * wingClFactor;
    let cdA = this.profile.aero.dragCdA * wingCdFactor;

    if (drsActive && this.profile.aero.drs) {
      cdA *= (1.0 - this.profile.aero.drs.dragReduction);
      clA *= (1.0 - this.profile.aero.drs.downforceReduction);
    }

    const totalDownforce = dynamicPressure * clA;
    const totalDrag = dynamicPressure * cdA;

    // Steeper rear wing shifts aero balance slightly rearward
    const frontFrac = Math.max(0.35, Math.min(0.52, this.profile.aero.aeroBalanceFront - wingDelta * 0.003));
    const rearFrac = 1.0 - frontFrac;

    return {
      downforceFrontN: totalDownforce * frontFrac,
      downforceRearN: totalDownforce * rearFrac,
      totalDownforceN: totalDownforce,
      dragForceN: totalDrag,
    };
  }
}
