/**
 * Track Pipeline: Spline Extrusion & 11-Chunk Generator
 * Partitioning 20.8 km loop into ~2 km chunks with 100m collision overlap.
 */

export interface CenterlineSample {
  distanceMeters: number;
  position: [number, number, number]; // [x, y, z]
  tangent: [number, number, number];
  normal: [number, number, number];
  binormal: [number, number, number];
  bankingRad: number;
  trackWidthM: number;
}

export interface ChunkManifest {
  totalLengthMeters: number;
  chunkCount: number;
  chunks: {
    index: number;
    name: string;
    startDistanceM: number;
    endDistanceM: number;
    collisionStartDistanceM: number;
    collisionEndDistanceM: number;
    bounds: {
      min: [number, number, number];
      max: [number, number, number];
    };
    visualMesh: string;
    collisionMesh: string;
  }[];
  startFinishDistanceM: number;
}

export class TrackSweeper {
  public static readonly CHUNK_COUNT = 11;
  public static readonly TOTAL_LENGTH_M = 20832; // Nordschleife ~20.832 km
  public static readonly OVERLAP_M = 100; // 100m overlap to prevent physics tunneling

  /**
   * Generates chunk partition definitions for the 20.8 km circuit.
   */
  static generateChunkManifest(totalLengthM: number = 20710): ChunkManifest {
    const total = totalLengthM;
    const chunkLength = total / this.CHUNK_COUNT;
    const manifest: ChunkManifest = {
      totalLengthMeters: total,
      chunkCount: this.CHUNK_COUNT,
      startFinishDistanceM: 0,
      chunks: [],
    };

    for (let i = 0; i < this.CHUNK_COUNT; i++) {
      const start = i * chunkLength;
      const end = (i + 1) * chunkLength;
      const colStart = Math.max(0, start - this.OVERLAP_M);
      const colEnd = Math.min(total, end + this.OVERLAP_M);

      const chunkPad = String(i).padStart(2, '0');
      manifest.chunks.push({
        index: i,
        name: `chunk_${chunkPad}`,
        startDistanceM: start,
        endDistanceM: end,
        collisionStartDistanceM: colStart,
        collisionEndDistanceM: colEnd,
        bounds: {
          min: [-2000, 300, -2000],
          max: [2000, 650, 2000],
        },
        visualMesh: `/assets/track/chunks/chunk_${chunkPad}.glb`,
        collisionMesh: `/assets/track/chunks/chunk_${chunkPad}.col.glb`,
      });
    }

    return manifest;
  }
}
