/**
 * Common mathematical helpers and One Euro filter for smooth, low-latency filtering.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function deadzone(value: number, threshold: number): number {
  if (Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * ((Math.abs(value) - threshold) / (1 - threshold));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Low-pass filter component for One Euro Filter.
 */
class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = alpha * value + (1.0 - alpha) * this.s!;
    this.s = this.y;
    return this.y;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

/**
 * 1€ Filter (One Euro Filter)
 * Designed by Géry Casiez, Nicolas Roussel, and Daniel Vogel.
 * Provides adaptive filtering: smooth at low speeds to eliminate jitter,
 * low lag at high speeds for responsive twitch inputs.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }

  private computeAlpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / Math.max(rate, 1e-5);
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestampSec: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampSec;
      return this.xFilter.filter(value, 1.0);
    }

    const dt = Math.max(timestampSec - this.lastTime, 1e-4);
    this.lastTime = timestampSec;
    const rate = 1.0 / dt;

    // Estimate derivative
    const prevX = this.xFilter.hasLast() ? this.xFilter.last() : value;
    const dx = (value - prevX) * rate;
    const edx = this.dxFilter.filter(dx, this.computeAlpha(rate, this.dCutoff));

    // Dynamic cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, this.computeAlpha(rate, cutoff));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}
