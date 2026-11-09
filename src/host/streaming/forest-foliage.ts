import * as THREE from 'three';
import { SplinePoint } from './centerline';

/**
 * Procedural Evergreen Pine / Spruce Tree Geometry.
 * Builds a multi-tiered coniferous tree featuring a dark woody bark trunk and
 * 3 overlapping evergreen needle foliage cones.
 * Merged into a single BufferGeometry with vertex colors for single-draw-call instancing.
 */
function buildTreeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let vertexOffset = 0;

  function appendGeometry(
    geom: THREE.BufferGeometry,
    r: number,
    g: number,
    b: number,
    offsetY: number,
    scaleY = 1.0,
    scaleXZ = 1.0
  ) {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const idx = geom.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(
        pos.getX(i) * scaleXZ,
        pos.getY(i) * scaleY + offsetY,
        pos.getZ(i) * scaleXZ
      );
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      // Subtle organic needle variation
      const noise = (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * 0.02;
      colors.push(
        Math.max(0.02, Math.min(0.9, r + noise)),
        Math.max(0.04, Math.min(0.9, g + noise * 1.3)),
        Math.max(0.02, Math.min(0.9, b + noise * 0.8))
      );
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }
    vertexOffset += pos.count;
  }

  // 1. Trunk: 6-sided tapered dark bark cylinder with deep 2.4m subterranean root
  // Prevents trunk bottoms from ever showing an air gap on steep Eifel embankments
  const trunkGeom = new THREE.CylinderGeometry(0.20, 0.42, 6.2, 6);
  appendGeometry(trunkGeom, 0.22, 0.14, 0.08, 0.7); // Spans Y = -2.4m to +3.8m
  trunkGeom.dispose();

  // 2. Foliage Tier 1 (Bottom wide cone)
  const cone1 = new THREE.ConeGeometry(2.4, 4.2, 7);
  appendGeometry(cone1, 0.07, 0.18, 0.08, 4.8);
  cone1.dispose();

  // 3. Foliage Tier 2 (Middle cone)
  const cone2 = new THREE.ConeGeometry(1.85, 3.8, 7);
  appendGeometry(cone2, 0.09, 0.22, 0.09, 7.2);
  cone2.dispose();

  // 4. Foliage Tier 3 (Top crown cone)
  const cone3 = new THREE.ConeGeometry(1.25, 3.4, 7);
  appendGeometry(cone3, 0.11, 0.26, 0.11, 9.4);
  cone3.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();

  return merged;
}

/**
 * Shared tree base geometry and material reused across all chunk instanced meshes.
 */
let sharedTreeGeometry: THREE.BufferGeometry | null = null;
let sharedTreeMaterial: THREE.MeshStandardMaterial | null = null;

function getSharedTreeResources(): {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
} {
  if (!sharedTreeGeometry) {
    sharedTreeGeometry = buildTreeGeometry();
  }
  if (!sharedTreeMaterial) {
    sharedTreeMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: false,
      side: THREE.FrontSide,
    });
  }
  return { geometry: sharedTreeGeometry, material: sharedTreeMaterial };
}

/**
 * Simple deterministic pseudo-random number generator for chunk foliage seeding.
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
2D Spatial Clearance Grid for Trackside Obstacles.
Guarantees zero vegetation encroaches within the safety runoff corridor of ANY track segment.
*/
class TrackSpatialGrid {
  private cellSize = 35;
  private grid = new Map<string, number[]>();

  constructor(private samples: SplinePoint[]) {
    for (let i = 0; i < samples.length; i++) {
      const sp = samples[i];
      const cx = Math.floor(sp.position.x / this.cellSize);
      const cz = Math.floor(sp.position.z / this.cellSize);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const key = `${cx + dx},${cz + dz}`;
          let list = this.grid.get(key);
          if (!list) {
            list = [];
            this.grid.set(key, list);
          }
          list.push(i);
        }
      }
    }
  }

  /**
   * Checks whether a 2D world coordinate (x, z) falls within trackWidth/2 + margin
   * of ANY track centerline segment across the entire circuit, OR crosses the Voronoi
   * midpoint into another non-adjacent track segment's corridor.
   */
  public isNearAnyTrackSegment(x: number, z: number, margin = 12.0, ownerIdx = -1): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const indices = this.grid.get(`${cx},${cz}`);
    if (!indices) return false;

    const total = this.samples.length;
    let ownerDistSq = Infinity;
    if (ownerIdx >= 0) {
      const osp = this.samples[ownerIdx];
      const odx = x - osp.position.x;
      const odz = z - osp.position.z;
      ownerDistSq = odx * odx + odz * odz;
    }

    for (const idx of indices) {
      const sp = this.samples[idx];
      const dx = x - sp.position.x;
      const dz = z - sp.position.z;
      const dSq = dx * dx + dz * dz;
      const threshold = (sp.trackWidth / 2) + margin;
      if (dSq < threshold * threshold) {
        return true;
      }

      // Voronoi corridor ownership check: reject trees that cross closer to a non-adjacent track segment
      if (ownerIdx >= 0) {
        const idxDiff = Math.min(Math.abs(idx - ownerIdx), total - Math.abs(idx - ownerIdx));
        if (idxDiff >= 18 && dSq < ownerDistSq + 15.0) {
          return true;
        }
      }
    }
    return false;
  }
}

/**
 * Generates dense 3D Eifel mountain forest foliage for a track chunk using THREE.InstancedMesh.
 * Renders hundreds of multi-tiered pine/spruce trees in a single GPU draw call.
 */
export class ForestFoliage {
  private static cachedGrid: TrackSpatialGrid | null = null;
  private static cachedSamples: SplinePoint[] | null = null;

  public static getSpatialGrid(samples: SplinePoint[]): TrackSpatialGrid {
    if (this.cachedSamples !== samples || !this.cachedGrid) {
      this.cachedGrid = new TrackSpatialGrid(samples);
      this.cachedSamples = samples;
    }
    return this.cachedGrid;
  }

  public static createChunkFoliage(
    samples: SplinePoint[],
    startIndex: number,
    endIndex: number,
    chunkIndex: number
  ): THREE.InstancedMesh {
    const { geometry, material } = getSharedTreeResources();
    const grid = this.getSpatialGrid(samples);

    const sampleCount = endIndex - startIndex;
    const totalSamples = samples.length;

    // Phase 5 Step 5.2: Multi-Layer Dense Forest Immersion ("The Green Hell")
    // 3-Tier Vegetation Hierarchy:
    // Tier 1: Roadside undergrowth & shrubs immediately behind Armco (5.5m - 10.0m)
    // Tier 2: Mature Scots pine & spruce with overhanging canopy (10.0m - 26.0m)
    // Tier 3: Deep mountain forest backdrop up ridges and valleys (26.0m - 65.0m)
    // Supports 600–900 trees per 2 km chunk within a single GPU draw call
    const MAX_TREES = sampleCount * 3 + 250;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_TREES);
    instancedMesh.name = `foliage_chunk_${chunkIndex}`;
    instancedMesh.receiveShadow = true;
    instancedMesh.castShadow = false; // Disable tree shadows to maximize 120 FPS performance

    const rng = seededRandom(chunkIndex * 7919 + 43);

    const dummy = new THREE.Object3D();
    let instanceIdx = 0;

    // Sample along chunk with 5m to 10m steps
    for (let i = 0; i < sampleCount; i++) {
      const idx = ((startIndex + i) % totalSamples + totalSamples) % totalSamples;
      const sp = samples[idx];

      const pos = sp.position;
      // Use horizontal lateral vector (y = 0) so trees do not float in the sky on banked corners
      const hRight = new THREE.Vector3(sp.tangent.z, 0, -sp.tangent.x).normalize();

      // Suppress wild mountain trees inside the modern Grand Prix Stadium Arena
      // (X in [-2350, -700], Z in [2650, 4750]) where grandstands, pit facilities, and runoffs reside
      const inStadiumCenterline = pos.x > -2350 && pos.x < -700 && pos.z > 2650 && pos.z < 4750;
      if (inStadiumCenterline) {
        continue;
      }

      // Skip trees directly on the high-speed Grand Prix pitlane / paddock straight
      if (sp.landmark && sp.landmark.name.includes('GP Start-Ziel') && Math.abs(sp.turnRate) < 0.002) {
        continue;
      }

      const barrierOffset = sp.trackWidth * 0.5 + 5.0;

      // Populate both flanks with 3-tier dense vegetation
      for (const side of [-1, 1] as const) {
        if (instanceIdx >= MAX_TREES) break;

        // Tier 1: Roadside undergrowth & saplings (5.5m - 10.0m behind barrier)
        if (rng() > 0.30) {
          const lateralDist = side * (barrierOffset + 1.2 + rng() * 4.5);
          const longJitter = (rng() - 0.5) * 4.0;
          const scale = 0.55 + rng() * 0.35; // 4.5m to 8.5m compact roadside shrubs/spruce
          const treePos = new THREE.Vector3(pos.x, pos.y, pos.z)
            .addScaledVector(hRight, lateralDist)
            .addScaledVector(sp.tangent, longJitter);
          treePos.y -= 0.25;

          if (!grid.isNearAnyTrackSegment(treePos.x, treePos.z, 10.5, idx)) {
            dummy.position.copy(treePos);
            dummy.rotation.set((rng() - 0.5) * 0.08, rng() * Math.PI * 2, (rng() - 0.5) * 0.08);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(instanceIdx++, dummy.matrix);
          }
        }

        // Tier 2: Mature canopy pines & spruce (10.0m - 26.0m behind barrier)
        const numTier2 = rng() > 0.40 ? 1 : 2;
        for (let k = 0; k < numTier2; k++) {
          if (instanceIdx >= MAX_TREES) break;
          const lateralDist = side * (barrierOffset + 6.0 + rng() * 16.0);
          const longJitter = (rng() - 0.5) * 5.0;
          const scale = 0.90 + rng() * 0.70; // 10.0m to 18.0m mature trees
          const dFromBarrier = Math.max(0, Math.abs(lateralDist) - 10.05);
          const yDrop = 0.35 + (dFromBarrier / 35.0) * 2.25;

          const treePos = new THREE.Vector3(pos.x, pos.y, pos.z)
            .addScaledVector(hRight, lateralDist)
            .addScaledVector(sp.tangent, longJitter);
          treePos.y -= yDrop;

          if (!grid.isNearAnyTrackSegment(treePos.x, treePos.z, 11.0, idx)) {
            dummy.position.copy(treePos);
            dummy.rotation.set((rng() - 0.5) * 0.08, rng() * Math.PI * 2, (rng() - 0.5) * 0.08);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(instanceIdx++, dummy.matrix);
          }
        }

        // Tier 3: Deep mountain ridge forest backdrop (26.0m - 60.0m)
        if (rng() > 0.25) {
          const lateralDist = side * (barrierOffset + 22.0 + rng() * 34.0);
          const longJitter = (rng() - 0.5) * 6.0;
          const scale = 1.10 + rng() * 0.85; // 14.0m to 24.0m deep forest giants
          const dFromBarrier = Math.max(0, Math.abs(lateralDist) - 10.05);
          const yDrop = 0.65 + (dFromBarrier / 35.0) * 3.5;

          const treePos = new THREE.Vector3(pos.x, pos.y, pos.z)
            .addScaledVector(hRight, lateralDist)
            .addScaledVector(sp.tangent, longJitter);
          treePos.y -= yDrop;

          if (!grid.isNearAnyTrackSegment(treePos.x, treePos.z, 12.0, idx)) {
            dummy.position.copy(treePos);
            dummy.rotation.set((rng() - 0.5) * 0.08, rng() * Math.PI * 2, (rng() - 0.5) * 0.08);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(instanceIdx++, dummy.matrix);
          }
        }
      }
    }

    instancedMesh.count = instanceIdx;
    instancedMesh.instanceMatrix.needsUpdate = true;

    return instancedMesh;
  }
}
