export interface LapTelemetry {
  currentLapTimeMs: number;
  lastLapTimeMs: number | null;
  bestLapTimeMs: number | null;
  lapCount: number;
  isLapValid: boolean;
  lapProgressRatio: number; // 0.0 to 1.0
  trackDistanceM: number;
  currentSectorName: string;
}

/**
 * Lap Timing Engine for Nürburgring Nordschleife.
 * Manages start/finish line crossings, sector updates, and lap invalidations.
 */
export class NordschleifeLapTimer {
  private lapStartTime: number | null = null;
  private currentLapTime = 0;
  private lastLapTime: number | null = null;
  private bestLapTime: number | null = null;
  private lapCount = 0;
  private isLapValid = true;

  private prevDistance = 0;
  private hasPassedHalfway = false;
  private totalLengthM: number;

  constructor(totalLengthM = 20710) {
    this.totalLengthM = totalLengthM;
  }

  public setTotalLength(totalLengthM: number): void {
    this.totalLengthM = totalLengthM;
    this.reset();
  }

  /**
   * Updates lap timing based on projected track distance.
   */
  public update(trackDistanceM: number, isOffTrack: boolean, nowMs = performance.now()): LapTelemetry {
    // Invalidate lap if driver cuts track excessively
    if (isOffTrack && this.lapStartTime !== null) {
      this.isLapValid = false;
    }

    // Start timer on first movement past start line
    if (this.lapStartTime === null && trackDistanceM > 10 && trackDistanceM < 100) {
      this.lapStartTime = nowMs;
      this.lapCount = 1;
      this.isLapValid = true;
      this.hasPassedHalfway = false;
    }

    // Update running timer
    if (this.lapStartTime !== null) {
      this.currentLapTime = nowMs - this.lapStartTime;
    }

    // Check halfway gate (e.g. past Breidscheid at ~10,000m)
    if (trackDistanceM > this.totalLengthM * 0.45 && trackDistanceM < this.totalLengthM * 0.75) {
      this.hasPassedHalfway = true;
    }

    // Detect Start/Finish crossing (from >20,500m to <300m)
    const crossedFinishLine = this.prevDistance > this.totalLengthM - 400 && trackDistanceM < 300;
    if (crossedFinishLine && this.hasPassedHalfway) {
      this.lastLapTime = this.currentLapTime;

      if (this.isLapValid) {
        if (this.bestLapTime === null || this.lastLapTime < this.bestLapTime) {
          this.bestLapTime = this.lastLapTime;
        }
      }

      // Reset for next lap
      this.lapCount++;
      this.lapStartTime = nowMs;
      this.currentLapTime = 0;
      this.isLapValid = true;
      this.hasPassedHalfway = false;
    }

    this.prevDistance = trackDistanceM;

    return {
      currentLapTimeMs: this.currentLapTime,
      lastLapTimeMs: this.lastLapTime,
      bestLapTimeMs: this.bestLapTime,
      lapCount: this.lapCount,
      isLapValid: this.isLapValid,
      lapProgressRatio: Math.min(1.0, Math.max(0.0, trackDistanceM / this.totalLengthM)),
      trackDistanceM,
      currentSectorName: '',
    };
  }

  /**
   * Resets timer state (e.g., when car respawns).
   */
  public reset(): void {
    this.lapStartTime = null;
    this.currentLapTime = 0;
    this.isLapValid = true;
    this.hasPassedHalfway = false;
    this.prevDistance = 0;
  }
}
