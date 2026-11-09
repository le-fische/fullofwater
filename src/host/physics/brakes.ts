export interface BrakeConfig {
  maxTorqueNm: number;
  frontBias: number;
  padFrictionCoeff?: number;
  initialTempC?: number;
}

export class BrakeSystem {
  // Disc temperatures per wheel in degrees Celsius: [FL, FR, RL, RR]
  public tempsC: [number, number, number, number];
  public padFrictionCoeffs: [number, number, number, number];
  public fadeFactors: [number, number, number, number];

  private config: BrakeConfig;
  private basePadFriction: number;

  // Thermal threshold above which pad outgassing & glaze causes thermal fade
  public static readonly THERMAL_FADE_THRESHOLD_C = 750.0;

  // Thermal capacity (Joules / Kelvin) of ventilated motorsport rotors
  // Front: 390mm x 35mm cast iron/carbon alloy (~8.2 kg, cp = 500 J/(kg*K)) -> 4,100 J/K
  // Rear:  355mm x 32mm cast iron/carbon alloy (~6.4 kg, cp = 500 J/(kg*K)) -> 3,200 J/K
  private readonly thermalMassFront = 4100;
  private readonly thermalMassRear = 3200;
  private readonly ambientTempC = 25.0;

  constructor(config: BrakeConfig) {
    this.config = { ...config };
    this.basePadFriction = config.padFrictionCoeff ?? 0.42;
    const initT = config.initialTempC ?? 25.0;
    this.tempsC = [initT, initT, initT, initT];
    this.padFrictionCoeffs = [
      this.basePadFriction,
      this.basePadFriction,
      this.basePadFriction,
      this.basePadFriction,
    ];
    this.fadeFactors = [1.0, 1.0, 1.0, 1.0];
  }

  public setFrontBias(frontBias: number): void {
    this.config.frontBias = Math.max(0.45, Math.min(0.70, frontBias));
  }

  public getFrontBias(): number {
    return this.config.frontBias;
  }

  public setMaxTorqueNm(maxTorqueNm: number): void {
    this.config.maxTorqueNm = Math.max(2500, Math.min(9000, maxTorqueNm));
  }

  public getMaxTorqueNm(): number {
    return this.config.maxTorqueNm;
  }

  /**
   * Computes thermal fade multiplier [0.40 .. 1.0] for a rotor temperature T (°C).
   * Below 750°C: 1.0 (full pad bite).
   * Above 750°C: progressive thermal fade reducing pad friction coefficient.
   */
  public computeFadeFactorForTemp(tempC: number): number {
    if (tempC <= BrakeSystem.THERMAL_FADE_THRESHOLD_C) {
      return 1.0;
    }
    const excessC = tempC - BrakeSystem.THERMAL_FADE_THRESHOLD_C;
    return Math.max(0.40, 1.0 - 0.0017 * excessC);
  }

  /**
   * Phase 5 Full Non-Linear Brake Thermal Efficiency Model:
   * - Cold bite (< 200°C): Pad friction reduced (mu_pad ~ 0.32, factor ~ 0.76)
   * - Optimal operating window (350°C - 650°C): Peak stopping friction (mu_pad ~ 0.44, factor ~ 1.05)
   * - High-temperature thermal fade (> 750°C): Pad glaze & outgassing linearly degrades
   *   friction down to mu_pad ~ 0.18 at 1,100°C (fade factor ~ 0.43).
   */
  public computeThermalEfficiency(tempC: number): {
    efficiency: number;
    padFrictionCoeff: number;
    operatingZone: 'cold' | 'optimal' | 'warm' | 'fade';
  } {
    let factor = 1.0;
    let zone: 'cold' | 'optimal' | 'warm' | 'fade' = 'warm';

    if (tempC < 200.0) {
      // Cold bite: 0.76 at 25°C ramping to 0.95 at 200°C
      factor = 0.76 + (tempC / 200.0) * 0.19;
      zone = 'cold';
    } else if (tempC >= 350.0 && tempC <= 650.0) {
      // Optimal motorsport thermal window
      factor = 1.05;
      zone = 'optimal';
    } else if (tempC > BrakeSystem.THERMAL_FADE_THRESHOLD_C) {
      // Thermal fade
      const excess = tempC - BrakeSystem.THERMAL_FADE_THRESHOLD_C;
      factor = Math.max(0.43, 1.0 - 0.00165 * excess);
      zone = 'fade';
    } else {
      factor = 1.0;
      zone = 'warm';
    }

    const padFrictionCoeff = this.basePadFriction * factor;
    return { efficiency: factor, padFrictionCoeff, operatingZone: zone };
  }

  /**
   * Returns current effective pad friction coefficient mu_pad for wheel index [0..3].
   */
  public getPadFrictionCoeff(wheelIndex: number): number {
    const fade = this.computeFadeFactorForTemp(this.tempsC[wheelIndex]);
    this.fadeFactors[wheelIndex] = fade;
    this.padFrictionCoeffs[wheelIndex] = this.basePadFriction * fade;
    return this.padFrictionCoeffs[wheelIndex];
  }

  /**
   * Computes available mechanical brake torque for a specific wheel given pedal position,
   * accounting for front/rear hydraulic bias AND thermal brake fade above 750°C.
   * Wheel indices: 0 = FL, 1 = FR, 2 = RL, 3 = RR.
   */
  computeWheelBrakeTorque(wheelIndex: number, brakePedal: number): number {
    const isFront = wheelIndex < 2;
    const bias = isFront ? this.config.frontBias : 1.0 - this.config.frontBias;
    const fadeFactor = this.computeFadeFactorForTemp(this.tempsC[wheelIndex]);
    this.fadeFactors[wheelIndex] = fadeFactor;
    this.padFrictionCoeffs[wheelIndex] = this.basePadFriction * fadeFactor;

    // 0.5 splits axle torque to left/right wheel, scaled by thermal fade factor
    return brakePedal * this.config.maxTorqueNm * 0.5 * bias * fadeFactor;
  }

  /**
   * Background thermal simulation loop.
   * Dissipates mechanical brake power (P = tau * omega) into rotor heat,
   * with convective cooling from air ducts proportional to car velocity.
   */
  updateThermal(
    dt: number,
    carSpeedKmh: number,
    wheelBrakeTorques: [number, number, number, number],
    wheelOmegas: [number, number, number, number]
  ): void {
    const carSpeedMs = Math.abs(carSpeedKmh) / 3.6;
    // Convective air cooling increases linearly with road speed
    const coolingRate = 0.035 * (1.0 + carSpeedMs / 22.0);

    for (let i = 0; i < 4; i++) {
      const isFront = i < 2;
      const thermalMass = isFront ? this.thermalMassFront : this.thermalMassRear;

      // Power dissipated into heat: P = tau * omega (Watts = J/s)
      const powerWatts = Math.abs(wheelBrakeTorques[i] * wheelOmegas[i]);
      const heatDeltaC = (powerWatts * dt) / thermalMass;

      // Convective cooling toward ambient temperature
      const tempDiff = this.tempsC[i] - this.ambientTempC;
      const coolDeltaC = coolingRate * tempDiff * dt;

      this.tempsC[i] = Math.max(this.ambientTempC, this.tempsC[i] + heatDeltaC - coolDeltaC);
      const fade = this.computeFadeFactorForTemp(this.tempsC[i]);
      this.fadeFactors[i] = fade;
      this.padFrictionCoeffs[i] = this.basePadFriction * fade;
    }
  }

  reset(initialTempC: number = 25.0): void {
    this.tempsC = [initialTempC, initialTempC, initialTempC, initialTempC];
    for (let i = 0; i < 4; i++) {
      const fade = this.computeFadeFactorForTemp(initialTempC);
      this.fadeFactors[i] = fade;
      this.padFrictionCoeffs[i] = this.basePadFriction * fade;
    }
  }
}
