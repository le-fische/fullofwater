import { clamp, lerp } from '../../common/math';

export interface WetGripEvaluation {
  effectiveFrictionMultiplier: number;
  localWaterDepth: number; // 0.0 (bone dry) to 1.0 (standing water)
  isHydroplaning: boolean;
  hydroplaningFactor: number; // 0.0 (full contact) to 0.70 (severe aquaplaning)
}

/**
 * 2D Dynamic Drying Line & Wet Surface Physics Engine.
 * Maintains a 2D occupancy/moisture grid (longitudinal track distance x lateral offset)
 * where rainfall accumulates water across the track and passing vehicles displace
 * standing water along the racing groove.
 */
export class TrackDryingLine {
  public readonly numLongBins: number;
  public readonly numLatBins: number;
  public readonly maxLateralM: number = 6.0; // -6.0m to +6.0m across road ribbon
  private totalLengthM: number;
  private grid: Float32Array;
  private baseWetness = 0.0;
  private rainIntensity = 0.0;

  constructor(totalLengthM = 20710, numLongBins = 512, numLatBins = 15) {
    this.totalLengthM = Math.max(100, totalLengthM);
    this.numLongBins = numLongBins;
    this.numLatBins = numLatBins;
    this.grid = new Float32Array(numLongBins * numLatBins);
  }

  public setRainIntensity(rainIntensity: number): void {
    this.rainIntensity = clamp(rainIntensity, 0.0, 1.0);
    if (this.rainIntensity > 0.01 && this.baseWetness < 0.25) {
      // Seed initial moisture film when rain starts
      this.fillUniformWetness(0.35 * this.rainIntensity);
    }
  }

  public getAmbientWetness(): number {
    return this.baseWetness;
  }

  public step(dt: number): void {
    this.stepEnvironment(dt, this.rainIntensity);
  }

  public setTotalLength(totalLengthM: number): void {
    this.totalLengthM = Math.max(100, totalLengthM);
    this.fillUniformWetness(this.baseWetness);
  }

  /**
   * Initializes or resets the entire 2D track surface to a uniform wetness level [0..1].
   */
  public fillUniformWetness(wetness: number): void {
    const w = clamp(wetness, 0.0, 1.0);
    this.baseWetness = w;
    this.grid.fill(w);
  }

  public getBaseWetness(): number {
    return this.baseWetness;
  }

  /**
   * Steps ambient rainfall accumulation and natural evaporation across all 2D grid cells.
   */
  public stepEnvironment(dt: number, rainIntensity: number, evaporationRate = 0.004): void {
    const netRate = rainIntensity * 0.035 - evaporationRate * (1.0 - rainIntensity * 0.7);
    if (Math.abs(netRate) < 1e-6) return;

    const delta = netRate * dt;
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = clamp(this.grid[i] + delta, 0.0, 1.0);
    }
    this.baseWetness = clamp(this.baseWetness + delta, 0.0, 1.0);
  }

  private getLongBin(distanceM: number): number {
    const wrapped = ((distanceM % this.totalLengthM) + this.totalLengthM) % this.totalLengthM;
    const idx = Math.floor((wrapped / this.totalLengthM) * this.numLongBins);
    return clamp(idx, 0, this.numLongBins - 1);
  }

  private getLatBin(lateralOffsetM: number): number {
    const norm = (lateralOffsetM + this.maxLateralM) / (2 * this.maxLateralM);
    const idx = Math.floor(norm * this.numLatBins);
    return clamp(idx, 0, this.numLatBins - 1);
  }

  /**
   * Displaces standing water at a vehicle's wheel or axle track position,
   * carving a drying racing groove along the active trajectory.
   */
  public clearWaterAlongGroove(
    distanceM: number,
    lateralOffsetM: number,
    speedKmh: number,
    dryingStrength = 0.08
  ): void {
    if (Math.abs(speedKmh) < 5.0) return;

    const longIdx = this.getLongBin(distanceM);
    const leftWheelLat = lateralOffsetM - 0.85;
    const rightWheelLat = lateralOffsetM + 0.85;

    const speedFactor = clamp(Math.abs(speedKmh) / 140.0, 0.15, 1.5);
    const removal = dryingStrength * speedFactor;

    for (const wheelLat of [leftWheelLat, rightWheelLat, lateralOffsetM]) {
      const latIdx = this.getLatBin(wheelLat);
      const centerWeight = wheelLat === lateralOffsetM ? 0.55 : 1.0;

      // Clear primary cell and partial adjacent lateral cells
      for (let dLat = -1; dLat <= 1; dLat++) {
        const lBin = clamp(latIdx + dLat, 0, this.numLatBins - 1);
        const falloff = dLat === 0 ? 1.0 : 0.45;
        const cellIdx = longIdx * this.numLatBins + lBin;
        this.grid[cellIdx] = Math.max(0.0, this.grid[cellIdx] - removal * centerWeight * falloff);
      }
    }
  }

  /**
   * Queries standing water depth [0..1] at a specific (distanceM, lateralOffsetM) coordinate.
   */
  public getWaterDepthAt(distanceM: number, lateralOffsetM: number): number {
    // Off-track beyond road ribbon retains full ambient wetness
    if (Math.abs(lateralOffsetM) > this.maxLateralM) {
      return this.baseWetness;
    }

    const wrapped = ((distanceM % this.totalLengthM) + this.totalLengthM) % this.totalLengthM;
    const fLong = (wrapped / this.totalLengthM) * this.numLongBins;
    const i0 = Math.floor(fLong) % this.numLongBins;
    const i1 = (i0 + 1) % this.numLongBins;
    const tLong = fLong - Math.floor(fLong);

    const normLat = clamp((lateralOffsetM + this.maxLateralM) / (2 * this.maxLateralM), 0, 0.9999);
    const fLat = normLat * (this.numLatBins - 1);
    const j0 = Math.floor(fLat);
    const j1 = Math.min(this.numLatBins - 1, j0 + 1);
    const tLat = fLat - j0;

    const w00 = this.grid[i0 * this.numLatBins + j0];
    const w10 = this.grid[i1 * this.numLatBins + j0];
    const w01 = this.grid[i0 * this.numLatBins + j1];
    const w11 = this.grid[i1 * this.numLatBins + j1];

    const w0 = lerp(w00, w10, tLong);
    const w1 = lerp(w01, w11, tLong);
    return clamp(lerp(w0, w1, tLat), 0.0, 1.0);
  }

  /**
   * Computes the average wetness along the center racing groove vs off-line edges.
   */
  public getGrooveVsOfflineSummary(): { grooveWetness: number; offlineWetness: number } {
    const centerBin = Math.floor(this.numLatBins / 2);
    const edgeBin = 1;
    let grooveSum = 0;
    let edgeSum = 0;

    for (let i = 0; i < this.numLongBins; i++) {
      grooveSum += this.grid[i * this.numLatBins + centerBin];
      edgeSum += this.grid[i * this.numLatBins + edgeBin];
    }

    return {
      grooveWetness: grooveSum / this.numLongBins,
      offlineWetness: edgeSum / this.numLongBins,
    };
  }

  /**
   * Evaluates effective surface friction multiplier including:
   * - 40% wet surface friction reduction (mu_wet = mu_dry * (1 - 0.40 * waterDepth))
   * - Slick-tire hydroplaning above 145 km/h in standing water (waterDepth > 0.25)
   * - Wet treaded tire water evacuation advantage
   */
  public evaluateWetGrip(
    baseDryFriction: number,
    distanceM: number,
    lateralOffsetM: number,
    speedKmh: number,
    tireCompound: 'slick_soft' | 'slick_medium' | 'slick_hard' | 'wet' = 'slick_medium'
  ): WetGripEvaluation {
    const waterDepth = this.getWaterDepthAt(distanceM, lateralOffsetM);

    if (waterDepth <= 0.001) {
      // Bone-dry surface: wet treaded tires are slightly softer/squirmier on dry tarmac (0.91x)
      const dryCompoundScale = tireCompound === 'wet' ? 0.91 : 1.0;
      return {
        effectiveFrictionMultiplier: baseDryFriction * dryCompoundScale,
        localWaterDepth: 0.0,
        isHydroplaning: false,
        hydroplaningFactor: 0.0,
      };
    }

    // 1. Baseline 40% surface friction reduction at full wetness (1.0 -> 0.60)
    const wetSurfaceMultiplier = 1.0 - 0.40 * waterDepth;

    // 2. Slick-tire hydroplaning vs grooved wet-tire water evacuation
    let hydroplaningFactor = 0.0;
    let isHydroplaning = false;
    let compoundWetScale = 1.0;

    if (tireCompound === 'wet') {
      // Grooved Michelin rain tires channel standing water and boost wet grip
      compoundWetScale = lerp(0.91, 1.24, waterDepth);
    } else {
      // Slick tires suffer severe aquaplaning when water depth > 0.25 and speed > 145 km/h
      const absSpeed = Math.abs(speedKmh);
      if (waterDepth > 0.25 && absSpeed > 145.0) {
        const waterExcess = (waterDepth - 0.25) / 0.75;
        const speedExcess = clamp((absSpeed - 145.0) / 85.0, 0.0, 1.0);
        hydroplaningFactor = clamp(waterExcess * speedExcess * 0.65, 0.0, 0.65);
        isHydroplaning = hydroplaningFactor > 0.08;
      }
    }

    const effectiveFrictionMultiplier =
      baseDryFriction * wetSurfaceMultiplier * compoundWetScale * (1.0 - hydroplaningFactor);

    return {
      effectiveFrictionMultiplier: Math.max(0.12, effectiveFrictionMultiplier),
      localWaterDepth: waterDepth,
      isHydroplaning,
      hydroplaningFactor,
    };
  }
}
