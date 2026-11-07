import { PacejkaCoefficients } from '../../common/types';

export interface TireForces {
  fx: number; // Longitudinal force (N)
  fy: number; // Lateral force (N)
  slipRatio: number; // kappa
  slipAngle: number; // alpha (radians)
}

/**
 * Pacejka Magic Formula tire friction model with friction ellipse combined slip.
 * Evaluates: F = D * sin(C * arctan(B * s - E * (B * s - arctan(B * s))))
 */
export class PacejkaTireModel {
  /**
   * Calculate single-axis Pacejka force.
   */
  private static evaluatePacejka(
    slip: number,
    Fz: number,
    coef: PacejkaCoefficients,
    frictionMultiplier: number = 1.0
  ): number {
    const B = coef.B;
    const C = coef.C;
    const D = coef.D * Fz * frictionMultiplier; // Peak force = friction coefficient * normal load * surface multiplier
    const E = coef.E;

    const Bs = B * slip;
    const force = D * Math.sin(C * Math.atan(Bs - E * (Bs - Math.atan(Bs))));
    return force;
  }

  /**
   * Compute combined longitudinal and lateral tire forces under load Fz.
   *
   * @param vx Wheel contact patch forward velocity (m/s)
   * @param vy Wheel contact patch lateral velocity (m/s)
   * @param wheelAngularVelocity Wheel rotational velocity (rad/s)
   * @param tireRadius Loaded tire radius (m)
   * @param normalLoad Vertical downforce on wheel Fz (N)
   * @param coefLong Longitudinal Pacejka coefficients
   * @param coefLat Lateral Pacejka coefficients
   * @param frictionMultiplier Surface friction multiplier (1.0 = asphalt, 0.35 = grass, etc.)
   */
  static computeForces(
    vx: number,
    vy: number,
    wheelAngularVelocity: number,
    tireRadius: number,
    normalLoad: number,
    coefLong: PacejkaCoefficients,
    coefLat: PacejkaCoefficients,
    frictionMultiplier: number = 1.0
  ): TireForces {
    if (normalLoad <= 1.0) {
      return { fx: 0, fy: 0, slipRatio: 0, slipAngle: 0 };
    }

    const rw = wheelAngularVelocity * tireRadius;
    const absVx = Math.abs(vx);
    const maxV = Math.max(absVx, Math.abs(rw), 0.1);

    // Longitudinal slip ratio kappa = (rw - vx) / max(|vx|, |rw|)
    const slipRatio = (rw - vx) / maxV;

    // Lateral slip angle alpha = -atan2(vy, |vx|)
    // (using small velocity threshold to avoid singularity at standstill)
    const slipAngle = -Math.atan2(vy, Math.max(absVx, 1.0));

    // Pure slip forces scaled by surface friction multiplier
    let fx = this.evaluatePacejka(slipRatio, normalLoad, coefLong, frictionMultiplier);
    let fy = this.evaluatePacejka(slipAngle, normalLoad, coefLat, frictionMultiplier);

    // Peak limits for friction ellipse
    const fxMax = coefLong.D * normalLoad * frictionMultiplier;
    const fyMax = coefLat.D * normalLoad * frictionMultiplier;

    // Combined slip friction ellipse
    // (fx / fxMax)^2 + (fy / fyMax)^2 <= 1.0
    if (fxMax > 0 && fyMax > 0) {
      const qx = fx / fxMax;
      const qy = fy / fyMax;
      const combined = Math.sqrt(qx * qx + qy * qy);

      if (combined > 1.0) {
        fx /= combined;
        fy /= combined;
      }
    }

    return {
      fx,
      fy,
      slipRatio,
      slipAngle,
    };
  }
}
