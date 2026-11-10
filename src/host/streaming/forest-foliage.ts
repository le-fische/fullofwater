import * as THREE from 'three';
import { SplinePoint } from './centerline';
import demData from '../../../tracks/nordschleife/dem.json';

/**
 * Samples the 3D SRTM DEM terrain elevation at any (x, z) world coordinate.
 * Plants tree roots securely on the terrain surface with zero floating.
 */
function getTerrainElevation(x: number, z: number): number {
  const gx = (x - demData.x0) / demData.step;
  const gz = (z - demData.z0) / demData.step;
  if (gx < 0 || gx >= demData.nx - 1 || gz < 0 || gz >= demData.nz - 1) {
    return 600.0;
  }
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const i00 = iz * demData.nx + ix;
  const i10 = i00 + 1;
  const i01 = i00 + demData.nx;
  const i11 = i01 + 1;
  const h00 = demData.h[i00];
  const h10 = demData.h[i10];
  const h01 = demData.h[i01];
  const h11 = demData.h[i11];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

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

  // 1. Trunk: 7-sided tapered dark bark cylinder with deep 5.0m subterranean root
  // Prevents trunk bottoms from ever showing an air gap on steep Eifel embankments
  const trunkGeom = new THREE.CylinderGeometry(0.35, 0.70, 14.0, 7);
  appendGeometry(trunkGeom, 0.20, 0.13, 0.07, 2.0); // Spans Y = -5.0m to +9.0m
  trunkGeom.dispose();

  // 2. Foliage Tier 1 (Bottom expansive canopy)
  const cone1 = new THREE.ConeGeometry(5.0, 7.5, 8);
  appendGeometry(cone1, 0.05, 0.17, 0.07, 8.5);
  cone1.dispose();

  // 3. Foliage Tier 2 (Middle canopy)
  const cone2 = new THREE.ConeGeometry(4.0, 7.0, 8);
  appendGeometry(cone2, 0.07, 0.22, 0.08, 13.0);
  cone2.dispose();

  // 4. Foliage Tier 3 (Upper crown)
  const cone3 = new THREE.ConeGeometry(2.8, 6.0, 8);
  appendGeometry(cone3, 0.09, 0.26, 0.10, 17.5);
  cone3.dispose();

  // 5. Foliage Tier 4 (Spire apex)
  const cone4 = new THREE.ConeGeometry(1.6, 4.5, 7);
  appendGeometry(cone4, 0.11, 0.30, 0.12, 21.0);
  cone4.dispose();

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
  public isNearAnyTrackSegment(x: number, z: number, margin = 5.2, ownerIdx = -1): boolean {
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
        if (idxDiff >= 32 && dSq < ownerDistSq * 0.75) {
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
    // Tier 1: Roadside canopy immediately behind Armco (20m - 28m tall)
    // Tier 2: Mature towering canopy pines & spruce (24m - 36m tall)
    // Tier 3: Deep mountain ridge forest giants (28m - 44m tall)
    // Supports 1,500–2,200 towering trees per 2 km chunk within a single GPU draw call
    const MAX_TREES = sampleCount * 4 + 400;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_TREES);
    instancedMesh.name = `foliage_chunk_${chunkIndex}`;
    instancedMesh.receiveShadow = true;
    instancedMesh.castShadow = false; // Disable tree shadows to maximize 120 FPS performance

    const rng = seededRandom(chunkIndex * 7919 + 43);

    const dummy = new THREE.Object3D();
    let instanceIdx = 0;

    // Sample along chunk with 5m steps
    for (let i = 0; i < sampleCount; i++) {
      const idx = ((startIndex + i) % totalSamples + totalSamples) % totalSamples;
      const sp = samples[idx];

      const pos = sp.position;
      // Use horizontal lateral vector (y = 0) so trees do not float in the sky on banked corners
      const hRight = new THREE.Vector3(sp.tangent.z, 0, -sp.tangent.x).normalize();

      // Only suppress trees directly over the modern GP pit building and concrete paddock
      const onGpPaddockBuilding = pos.x > -1400 && pos.x < -1050 && pos.z > 3100 && pos.z < 3550;
      if (onGpPaddockBuilding) {
        continue;
      }

      const barrierOffset = sp.trackWidth * 0.5 + 5.0; // edge of Armco guardrail

      // Helper to compute ground elevation on the embankment so trees are NEVER buried in trenches
      const getGroundY = (tx: number, tz: number, latDist: number) => {
        const latMag = Math.abs(latDist);
        const embT = Math.min(1.0, Math.max(0.0, (latMag - barrierOffset) / 35.0));
        const demY = getTerrainElevation(tx, tz);
        const embSurfaceY = THREE.MathUtils.lerp(pos.y, demY, embT * 0.75);
        return Math.max(demY, embSurfaceY);
      };

      // Populate both flanks with 3-tier dense towering vegetation
      for (const side of [-1, 1] as const) {
        if (instanceIdx >= MAX_TREES) break;

        // Tier 1: Roadside canopy immediately behind Armco (1.5m - 5.5m behind guardrail)
        if (rng() > 0.15) {
          const lateralDist = side * (barrierOffset + 1.5 + rng() * 4.0);
          const longJitter = (rng() - 0.5) * 4.0;
          const scale = 0.85 + rng() * 0.35; // 20m to 28m tall roadside trees
          const treePos = new THREE.Vector3(pos.x, pos.y, pos.z)
            .addScaledVector(hRight, lateralDist)
            .addScaledVector(sp.tangent, longJitter);
          treePos.y = getGroundY(treePos.x, treePos.z, lateralDist);

          if (!grid.isNearAnyTrackSegment(treePos.x, treePos.z, 5.2, idx)) {
            dummy.position.copy(treePos);
            dummy.rotation.set((rng() - 0.5) * 0.06, rng() * Math.PI * 2, (rng() - 0.5) * 0.06);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(instanceIdx++, dummy.matrix);
          }
        }

        // Tier 2: Mature towering canopy pines & spruce (6.0m - 20.0m behind guardrail)
        const numTier2 = rng() > 0.30 ? 2 : 1;
        for (let k = 0; k < numTier2; k++) {
          if (instanceIdx >= MAX_TREES) break;
          const lateralDist = side * (barrierOffset + 6.0 + rng() * 15.0);
          const longJitter = (rng() - 0.5) * 5.0;
          const scale = 1.05 + rng() * 0.50; // 24m to 36m tall mature canopy

          const treePos = new THREE.Vector3(pos.x, pos.y, pos.z)
            .addScaledVector(hRight, lateralDist)
            .addScaledVector(sp.tangent, longJitter);
          treePos.y = getGroundY(treePos.x, treePos.z, lateralDist);

          if (!grid.isNearAnyTrackSegment(treePos.x, treePos.z, 5.5, idx)) {
            dummy.position.copy(treePos);
            dummy.rotation.set((rng() - 0.5) * 0.06, rng() * Math.PI * 2, (rng() - 0.5) * 0.06);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(instanceIdx++, dummy.matrix);
          }
        }

        // Tier 3: Deep mountain ridge forest giants (20.0m - 55.0m behind guardrail)
        if (rng() > 0.15) {
          const lateralDist = side * (barrierOffset + 20.0 + rng() * 35.0);
          const longJitter = (rng() - 0.5) * 6.0;
          const scale = 1.20 + rng() * 0.65; // 28m to 43m tall forest giants

          const treePos = new THREE.Vector3(pos.x, pos.y, pos.z)
            .addScaledVector(hRight, lateralDist)
            .addScaledVector(sp.tangent, longJitter);
          treePos.y = getGroundY(treePos.x, treePos.z, lateralDist);

          if (!grid.isNearAnyTrackSegment(treePos.x, treePos.z, 5.8, idx)) {
            dummy.position.copy(treePos);
            dummy.rotation.set((rng() - 0.5) * 0.06, rng() * Math.PI * 2, (rng() - 0.5) * 0.06);
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
