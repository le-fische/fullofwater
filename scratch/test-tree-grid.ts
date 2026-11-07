import { NordschleifeCenterline } from '../src/host/streaming/centerline';
import * as THREE from 'three';

class TrackSpatialGrid {
  private cellSize = 25;
  private grid = new Map<string, Array<{ x: number; z: number; halfW: number }>>();

  constructor(samples: Array<{ position: THREE.Vector3; trackWidth: number }>) {
    for (const sp of samples) {
      const cx = Math.floor(sp.position.x / this.cellSize);
      const cz = Math.floor(sp.position.z / this.cellSize);
      const key = `${cx},${cz}`;
      let list = this.grid.get(key);
      if (!list) {
        list = [];
        this.grid.set(key, list);
      }
      list.push({ x: sp.position.x, z: sp.position.z, halfW: sp.trackWidth / 2 });
    }
  }

  isOnTrack(x: number, z: number, safetyMargin = 4.0): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const list = this.grid.get(key);
        if (list) {
          for (const pt of list) {
            const distSq = (x - pt.x) * (x - pt.x) + (z - pt.z) * (z - pt.z);
            const clearDist = pt.halfW + safetyMargin;
            if (distSq < clearDist * clearDist) {
              return true; // Too close to track!
            }
          }
        }
      }
    }
    return false;
  }
}

function test() {
  const cl = new NordschleifeCenterline('nordschleife');
  const grid = new TrackSpatialGrid(cl.samples);

  // Test point on track
  const pOnTrack = cl.samples[100].position;
  console.log(`Point on track at index 100: is on track? ${grid.isOnTrack(pOnTrack.x, pOnTrack.z)} (Expected: true)`);

  // Test point 20m away from track
  const b = cl.samples[100].binormal;
  const pOffTrack = pOnTrack.clone().addScaledVector(b, 20.0);
  console.log(`Point 20m off track: is on track? ${grid.isOnTrack(pOffTrack.x, pOffTrack.z)} (Expected: false)`);
}

test();
