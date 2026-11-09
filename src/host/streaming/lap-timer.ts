import { SectorSplit } from '../../common/types';

export const SECTOR_COUNT = 9;

export const NORDSCHLEIFE_9_SECTOR_NAMES: string[] = [
  'S1 · Hatzenbach',
  'S2 · Flugplatz',
  'S3 · Fuchsröhre',
  'S4 · Adenauer Forst',
  'S5 · Breidscheid',
  'S6 · Kesselchen',
  'S7 · Karussell',
  'S8 · Pflanzgarten',
  'S9 · Döttinger Höhe',
];

export interface LapTelemetry {
  currentLapTimeMs: number;
  lastLapTimeMs: number | null;
  bestLapTimeMs: number | null;
  lapCount: number;
  isLapValid: boolean;
  lapProgressRatio: number; // 0.0 to 1.0
  trackDistanceM: number;
  currentSectorIndex: number; // 0..8 (S1..S9)
  currentSectorName: string;
  // Phase 3.4: Full 9-sector timing breakdown & live +/- delta splits
  sectors: SectorSplit[];
  sectorSplits: SectorSplit[];
  currentSectorTimesMs: (number | null)[];
  bestLapSectorTimesMs: (number | null)[];
  purpleSectorTimesMs: (number | null)[];
  liveDeltaMs: number | null; // Live continuous +/- delta vs best lap (negative = faster/green, positive = slower/red)
  lastSectorDeltaMs: number | null;
  theoreticalBestLapMs: number | null;
}

/**
 * 9-Sector Lap Timing & Live Delta Split Engine.
 * Manages start/finish line crossings, 9-sector splits, purple/green/yellow status,
 * continuous distance-interpolated live delta (+/-), and lap invalidations.
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

  // 9-Sector Timing State
  private currentSectorIndex = 0;
  private currentSectorTimesMs: (number | null)[] = new Array(SECTOR_COUNT).fill(null);
  private bestLapSectorTimesMs: (number | null)[] = new Array(SECTOR_COUNT).fill(null);
  private bestLapCumulativeMs: (number | null)[] = new Array(SECTOR_COUNT).fill(null);
  private purpleSectorTimesMs: (number | null)[] = new Array(SECTOR_COUNT).fill(null);
  private sectorDeltasMs: (number | null)[] = new Array(SECTOR_COUNT).fill(null);
  private sectorStatuses: ('pending' | 'purple' | 'green' | 'yellow')[] = new Array(SECTOR_COUNT).fill('pending');
  private lastSectorDeltaMs: number | null = null;

  constructor(totalLengthM = 20710) {
    this.totalLengthM = Math.max(100, totalLengthM);
  }

  public setTotalLength(totalLengthM: number): void {
    this.totalLengthM = Math.max(100, totalLengthM);
    this.reset();
  }

  /**
   * Phase 4.5: Latches lap invalidation on crash / recovery respawn.
   */
  public invalidateCurrentLap(): void {
    this.isLapValid = false;
  }

  /**
   * Seeds a reference best lap (and 9-sector splits) for immediate delta comparison if desired.
   */
  public seedReferenceBestLap(totalMs: number, sectorSplitsMs?: number[]): void {
    this.bestLapTime = totalMs;
    if (sectorSplitsMs && sectorSplitsMs.length === SECTOR_COUNT) {
      this.bestLapSectorTimesMs = [...sectorSplitsMs];
    } else {
      const avgSec = totalMs / SECTOR_COUNT;
      this.bestLapSectorTimesMs = new Array(SECTOR_COUNT).fill(avgSec);
    }

    let cum = 0;
    for (let i = 0; i < SECTOR_COUNT; i++) {
      const sTime = this.bestLapSectorTimesMs[i]!;
      cum += sTime;
      this.bestLapCumulativeMs[i] = cum;
      if (this.purpleSectorTimesMs[i] === null || sTime < this.purpleSectorTimesMs[i]!) {
        this.purpleSectorTimesMs[i] = sTime;
      }
    }
  }

  /**
   * Computes continuous live delta (ms) at current trackDistanceM against best lap profile.
   */
  private computeLiveDeltaMs(trackDistanceM: number, currentLapTimeMs: number): number | null {
    if (this.bestLapTime === null || this.lapStartTime === null || currentLapTimeMs <= 0) {
      return null;
    }

    const sectorLength = this.totalLengthM / SECTOR_COUNT;
    const clampedDist = Math.max(0, Math.min(this.totalLengthM, trackDistanceM));
    const exactSectorFloat = clampedDist / sectorLength;
    const secIdx = Math.min(SECTOR_COUNT - 1, Math.floor(exactSectorFloat));
    const secFrac = exactSectorFloat - secIdx;

    // Interpolate expected best lap elapsed time at this exact distance
    const prevCum = secIdx === 0 ? 0 : (this.bestLapCumulativeMs[secIdx - 1] ?? (this.bestLapTime * (secIdx / SECTOR_COUNT)));
    const nextCum = this.bestLapCumulativeMs[secIdx] ?? (this.bestLapTime * ((secIdx + 1) / SECTOR_COUNT));
    const expectedTimeAtDist = prevCum + (nextCum - prevCum) * secFrac;

    if (expectedTimeAtDist <= 50) return null;
    return currentLapTimeMs - expectedTimeAtDist;
  }

  private recordSectorCompletion(sectorIdx: number, elapsedLapTimeMs: number): void {
    if (sectorIdx < 0 || sectorIdx >= SECTOR_COUNT) return;

    // Compute previous cumulative elapsed time up to sectorIdx - 1
    let prevCumElapsed = 0;
    for (let i = 0; i < sectorIdx; i++) {
      if (this.currentSectorTimesMs[i] !== null) {
        prevCumElapsed += this.currentSectorTimesMs[i]!;
      }
    }

    const sectorDurationMs = Math.max(1, elapsedLapTimeMs - prevCumElapsed);
    this.currentSectorTimesMs[sectorIdx] = sectorDurationMs;

    const refBestSector = this.bestLapSectorTimesMs[sectorIdx];
    const refPurpleSector = this.purpleSectorTimesMs[sectorIdx];

    if (refBestSector !== null) {
      const delta = sectorDurationMs - refBestSector;
      this.sectorDeltasMs[sectorIdx] = delta;
      this.lastSectorDeltaMs = delta;
    } else {
      this.sectorDeltasMs[sectorIdx] = 0;
      this.lastSectorDeltaMs = 0;
    }

    if (this.isLapValid) {
      if (refPurpleSector === null || sectorDurationMs <= refPurpleSector) {
        this.purpleSectorTimesMs[sectorIdx] = sectorDurationMs;
        this.sectorStatuses[sectorIdx] = 'purple';
      } else if (refBestSector !== null && sectorDurationMs <= refBestSector) {
        this.sectorStatuses[sectorIdx] = 'green';
      } else {
        this.sectorStatuses[sectorIdx] = 'yellow';
      }
    } else {
      this.sectorStatuses[sectorIdx] =
        refBestSector !== null && sectorDurationMs <= refBestSector ? 'green' : 'yellow';
    }
  }

  /**
   * Updates lap & 9-sector timing based on projected track distance.
   */
  public update(trackDistanceM: number, isOffTrack: boolean, nowMs = performance.now()): LapTelemetry {
    // Invalidate lap if driver cuts track excessively
    if (isOffTrack && this.lapStartTime !== null) {
      this.isLapValid = false;
    }

    const sectorLength = this.totalLengthM / SECTOR_COUNT;
    const newSectorIdx = Math.min(
      SECTOR_COUNT - 1,
      Math.max(0, Math.floor(trackDistanceM / sectorLength))
    );

    // Start timer on first movement past start line
    if (this.lapStartTime === null && trackDistanceM > 10 && trackDistanceM < 250) {
      this.lapStartTime = nowMs;
      this.lapCount = 1;
      this.isLapValid = true;
      this.hasPassedHalfway = false;
      this.currentSectorIndex = 0;
      this.currentSectorTimesMs.fill(null);
      this.sectorDeltasMs.fill(null);
      this.sectorStatuses.fill('pending');
      this.lastSectorDeltaMs = null;
    }

    // Update running timer
    if (this.lapStartTime !== null) {
      this.currentLapTime = nowMs - this.lapStartTime;

      // Detect forward progression across sector gates (S1 -> S2 -> ... -> S9)
      if (newSectorIdx > this.currentSectorIndex && newSectorIdx - this.currentSectorIndex <= 4) {
        // Fill any intermediate crossed sectors proportionally
        const steps = newSectorIdx - this.currentSectorIndex;
        let prevCum = 0;
        for (let i = 0; i < this.currentSectorIndex; i++) {
          prevCum += this.currentSectorTimesMs[i] ?? 0;
        }
        const totalSpanMs = Math.max(1, this.currentLapTime - prevCum);
        const perStepMs = totalSpanMs / steps;

        for (let s = 0; s < steps; s++) {
          const idx = this.currentSectorIndex + s;
          this.recordSectorCompletion(idx, prevCum + perStepMs * (s + 1));
        }
        this.currentSectorIndex = newSectorIdx;
      }
    }

    // Check halfway gate (e.g. past Breidscheid at ~10,000m)
    if (trackDistanceM > this.totalLengthM * 0.45 && trackDistanceM < this.totalLengthM * 0.75) {
      this.hasPassedHalfway = true;
    }

    // Detect Start/Finish crossing (from near end of circuit to start)
    const finishGateThreshold = Math.min(400, this.totalLengthM * 0.15);
    const crossedFinishLine =
      this.prevDistance > this.totalLengthM - finishGateThreshold &&
      trackDistanceM < finishGateThreshold;

    if (crossedFinishLine && this.hasPassedHalfway && this.lapStartTime !== null) {
      this.lastLapTime = this.currentLapTime;

      // Complete remaining sectors up to S9 (index 8)
      let prevCum = 0;
      let missingStart = SECTOR_COUNT - 1;
      for (let i = 0; i < SECTOR_COUNT; i++) {
        if (this.currentSectorTimesMs[i] !== null) {
          prevCum += this.currentSectorTimesMs[i]!;
        } else {
          missingStart = Math.min(missingStart, i);
        }
      }
      const missingCount = SECTOR_COUNT - missingStart;
      const remMs = Math.max(1, this.lastLapTime - prevCum);
      for (let i = missingStart; i < SECTOR_COUNT; i++) {
        const stepNum = i - missingStart + 1;
        this.recordSectorCompletion(i, prevCum + (remMs * stepNum) / missingCount);
      }

      if (this.isLapValid) {
        if (this.bestLapTime === null || this.lastLapTime < this.bestLapTime) {
          this.bestLapTime = this.lastLapTime;
          this.bestLapSectorTimesMs = [...this.currentSectorTimesMs];

          let cum = 0;
          for (let i = 0; i < SECTOR_COUNT; i++) {
            const st = this.bestLapSectorTimesMs[i] ?? this.bestLapTime / SECTOR_COUNT;
            cum += st;
            this.bestLapCumulativeMs[i] = cum;
          }
        }
      }

      // Reset for next lap
      this.lapCount++;
      this.lapStartTime = nowMs;
      this.currentLapTime = 0;
      this.isLapValid = true;
      this.hasPassedHalfway = false;
      this.currentSectorIndex = 0;
      this.currentSectorTimesMs.fill(null);
      this.sectorDeltasMs.fill(null);
      this.sectorStatuses.fill('pending');
    }

    this.prevDistance = trackDistanceM;

    const liveDeltaMs = this.computeLiveDeltaMs(trackDistanceM, this.currentLapTime);

    const sectors: SectorSplit[] = [];
    let theoreticalBest: number | null = 0;
    for (let i = 0; i < SECTOR_COUNT; i++) {
      if (this.purpleSectorTimesMs[i] === null) {
        theoreticalBest = null;
      } else if (theoreticalBest !== null) {
        theoreticalBest += this.purpleSectorTimesMs[i]!;
      }

      sectors.push({
        sectorIndex: i,
        sectorName: NORDSCHLEIFE_9_SECTOR_NAMES[i] || `S${i + 1}`,
        currentMs: this.currentSectorTimesMs[i],
        bestMs: this.bestLapSectorTimesMs[i],
        sessionBestMs: this.purpleSectorTimesMs[i],
        deltaMs: this.sectorDeltasMs[i],
        status: this.sectorStatuses[i],
      });
    }

    return {
      currentLapTimeMs: this.currentLapTime,
      lastLapTimeMs: this.lastLapTime,
      bestLapTimeMs: this.bestLapTime,
      lapCount: this.lapCount,
      isLapValid: this.isLapValid,
      lapProgressRatio: Math.min(1.0, Math.max(0.0, trackDistanceM / this.totalLengthM)),
      trackDistanceM,
      currentSectorIndex: this.currentSectorIndex,
      currentSectorName: NORDSCHLEIFE_9_SECTOR_NAMES[this.currentSectorIndex] || `S${this.currentSectorIndex + 1}`,
      sectors,
      sectorSplits: sectors,
      currentSectorTimesMs: [...this.currentSectorTimesMs],
      bestLapSectorTimesMs: [...this.bestLapSectorTimesMs],
      purpleSectorTimesMs: [...this.purpleSectorTimesMs],
      liveDeltaMs,
      lastSectorDeltaMs: this.lastSectorDeltaMs,
      theoreticalBestLapMs: theoreticalBest,
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
    this.currentSectorIndex = 0;
    this.currentSectorTimesMs.fill(null);
    this.sectorDeltasMs.fill(null);
    this.sectorStatuses.fill('pending');
    this.lastSectorDeltaMs = null;
  }
}
