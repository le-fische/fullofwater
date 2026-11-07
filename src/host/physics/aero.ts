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

  constructor(profile: CarProfile) {
    this.profile = profile;
  }

  /**
   * Computes aerodynamic downforce and drag from vehicle forward velocity (m/s).
   * @param forwardSpeedMs Forward speed in m/s
   * @param drsActive Whether Drag Reduction System wing flap is open
   */
  computeForces(forwardSpeedMs: number, drsActive = false): AeroForces {
    const v2 = forwardSpeedMs * forwardSpeedMs;
    const dynamicPressure = 0.5 * this.airDensity * v2;

    let clA = this.profile.aero.downforceClA;
    let cdA = this.profile.aero.dragCdA;

    if (drsActive && this.profile.aero.drs) {
      cdA *= (1.0 - this.profile.aero.drs.dragReduction);
      clA *= (1.0 - this.profile.aero.drs.downforceReduction);
    }

    const totalDownforce = dynamicPressure * clA;
    const totalDrag = dynamicPressure * cdA;

    const frontFrac = this.profile.aero.aeroBalanceFront;
    const rearFrac = 1.0 - frontFrac;

    return {
      downforceFrontN: totalDownforce * frontFrac,
      downforceRearN: totalDownforce * rearFrac,
      totalDownforceN: totalDownforce,
      dragForceN: totalDrag,
    };
  }
}
