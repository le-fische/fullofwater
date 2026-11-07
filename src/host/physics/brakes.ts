export interface BrakeConfig {
  maxTorqueNm: number;
  frontBias: number;
  padFrictionCoeff?: number;
  initialTempC?: number;
}

export class BrakeSystem {
  // Disc temperatures per wheel in degrees Celsius: [FL, FR, RL, RR]
  public tempsC: [number, number, number, number];

  private config: BrakeConfig;

  // Thermal capacity (Joules / Kelvin) of ventilated motorsport rotors
  // Front: 390mm x 35mm cast iron/carbon alloy (~8.2 kg, cp = 500 J/(kg*K)) -> 4,100 J/K
  // Rear:  355mm x 32mm cast iron/carbon alloy (~6.4 kg, cp = 500 J/(kg*K)) -> 3,200 J/K
  private readonly thermalMassFront = 4100;
  private readonly thermalMassRear = 3200;
  private readonly ambientTempC = 25.0;

  constructor(config: BrakeConfig) {
    this.config = config;
    const initT = config.initialTempC ?? 25.0;
    this.tempsC = [initT, initT, initT, initT];
  }

  /**
   * Computes available mechanical brake torque for a specific wheel given pedal position.
   * Wheel indices: 0 = FL, 1 = FR, 2 = RL, 3 = RR.
   */
  computeWheelBrakeTorque(wheelIndex: number, brakePedal: number): number {
    const isFront = wheelIndex < 2;
    const bias = isFront ? this.config.frontBias : 1.0 - this.config.frontBias;
    // 0.5 splits axle torque to left/right wheel
    return brakePedal * this.config.maxTorqueNm * 0.5 * bias;
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
    }
  }

  reset(initialTempC: number = 25.0): void {
    this.tempsC = [initialTempC, initialTempC, initialTempC, initialTempC];
  }
}
