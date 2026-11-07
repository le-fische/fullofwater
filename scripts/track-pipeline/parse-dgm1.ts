/**
 * Track Pipeline: DGM1 Lidar DEM Parser & Bilinear Elevation Interpolator
 * Processes 1m digital terrain elevation models for Rheinland-Pfalz.
 */

export interface ElevationPoint {
  x: number; // UTM or local meters
  y: number;
  z: number; // Elevation in meters
}

export class Dgm1Parser {
  private grid = new Map<string, number>();
  private minX = Infinity;
  private maxX = -Infinity;
  private minY = Infinity;
  private maxY = -Infinity;

  /**
   * Loads an XYZ ASCII or raster grid.
   */
  loadFromAscii(data: string): void {
    const lines = data.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(/[\s,]+/);
      if (parts.length >= 3) {
        const x = Math.round(parseFloat(parts[0]));
        const y = Math.round(parseFloat(parts[1]));
        const z = parseFloat(parts[2]);

        this.grid.set(`${x},${y}`, z);
        this.minX = Math.min(this.minX, x);
        this.maxX = Math.max(this.maxX, x);
        this.minY = Math.min(this.minY, y);
        this.maxY = Math.max(this.maxY, y);
      }
    }
  }

  /**
   * Sample elevation with bilinear interpolation.
   */
  sampleElevation(x: number, y: number, fallbackZ = 500.0): number {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;

    const z00 = this.grid.get(`${x0},${y0}`) ?? fallbackZ;
    const z10 = this.grid.get(`${x1},${y0}`) ?? fallbackZ;
    const z01 = this.grid.get(`${x0},${y1}`) ?? fallbackZ;
    const z11 = this.grid.get(`${x1},${y1}`) ?? fallbackZ;

    const fx = x - x0;
    const fy = y - y0;

    const z0 = z00 * (1 - fx) + z10 * fx;
    const z1 = z01 * (1 - fx) + z11 * fx;

    return z0 * (1 - fy) + z1 * fy;
  }
}
