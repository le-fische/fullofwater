import * as THREE from 'three';
import demData from '../../../tracks/nordschleife/dem.json';
import nordData from '../../../tracks/nordschleife/osm_nordschleife.json';
import gpData from '../../../tracks/gp/osm_gp.json';
import h24Data from '../../../tracks/24h/osm_24h.json';

/**
 * Authentic 3D Eifel Mountain Landscape Terrain.
 * Generates an 8 km x 6.6 km continuous mountain terrain mesh from SRTM DEM elevation data,
 * filling the entire geographical footprint around the Nürburgring Nordschleife, 24h,
 * and Grand Prix circuits with realistic rolling green hills, valleys, and forests.
 */
export class EifelTerrain {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshStandardMaterial;

  constructor() {
    const { mesh, geometry, material } = this.buildTerrain();
    this.mesh = mesh;
    this.geometry = geometry;
    this.material = material;
  }

  private buildTerrain(): {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    material: THREE.MeshStandardMaterial;
  } {
    const { x0, z0, step, nx, nz, h } = demData;

    const vertexCount = nx * nz;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);

    // Build 2D spatial hash grid of all circuit centerlines with elevation
    const trackGrid = new Map<string, [number, number, number][]>();
    const CELL = 50.0;
    const addPoints = (pts: number[][]) => {
      for (const p of pts) {
        const cx = Math.floor(p[0] / CELL);
        const cz = Math.floor(p[2] / CELL);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const key = `${cx + dx},${cz + dz}`;
            let list = trackGrid.get(key);
            if (!list) {
              list = [];
              trackGrid.set(key, list);
            }
            list.push([p[0], p[1], p[2]]);
          }
        }
      }
    };
    addPoints(nordData.points);
    addPoints(gpData.points);
    addPoints(h24Data.points);

    // 1. Populate vertex positions and UVs
    for (let iz = 0; iz < nz; iz++) {
      const z = z0 + iz * step;
      for (let ix = 0; ix < nx; ix++) {
        const x = x0 + ix * step;
        const idx = iz * nx + ix;
        let y = h[idx];

        // Safety guarantee: Ensure DEM terrain vertices within the road corridor
        // are strictly below the road surface so they NEVER noclip through the road or kerbs
        const cx = Math.floor(x / CELL);
        const cz = Math.floor(z / CELL);
        const candidates = trackGrid.get(`${cx},${cz}`);
        if (candidates) {
          let minD = 99999;
          let nearestRoadY = y;
          for (const [px, py, pz] of candidates) {
            const d = Math.hypot(x - px, z - pz);
            if (d < minD) {
              minD = d;
              nearestRoadY = py;
            }
          }
          if (minD <= 52.0) {
            const maxAllowedY = nearestRoadY - 2.20;
            if (y > maxAllowedY) y = maxAllowedY;
          } else if (minD < 90.0) {
            const t = (minD - 52.0) / (90.0 - 52.0);
            const blend = 0.5 * (1.0 - Math.cos(t * Math.PI));
            const maxAllowedY = nearestRoadY - 2.20 + blend * 14.0;
            if (y > maxAllowedY) y = maxAllowedY;
          }
        }

        const vIdx3 = idx * 3;
        positions[vIdx3] = x;
        positions[vIdx3 + 1] = y;
        positions[vIdx3 + 2] = z;

        const vIdx2 = idx * 2;
        uvs[vIdx2] = ix / (nx - 1);
        uvs[vIdx2 + 1] = iz / (nz - 1);
      }
    }

    // 2. Generate triangular grid indices
    const quadCount = (nx - 1) * (nz - 1);
    const indices = new Uint32Array(quadCount * 6);
    let iIdx = 0;

    for (let iz = 0; iz < nz - 1; iz++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const row1 = iz * nx + ix;
        const row2 = (iz + 1) * nx + ix;

        // Quad vertices: a, b, c, d
        const a = row1;
        const b = row1 + 1;
        const c = row2;
        const d = row2 + 1;

        // Front-facing winding (CCW when viewed from above)
        indices[iIdx++] = a;
        indices[iIdx++] = c;
        indices[iIdx++] = b;

        indices[iIdx++] = b;
        indices[iIdx++] = c;
        indices[iIdx++] = d;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // 3. Compute organic Eifel forest & meadow vertex colors with slope and elevation shading
    const normalAttr = geometry.getAttribute('normal');

    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const idx = iz * nx + ix;
        const y = h[idx];
        const ny = normalAttr.getY(idx);

        // Elevation-based base color:
        // Low valley meadows (<400m) -> deep evergreen forest hills (400-560m) -> alpine crests (>560m)
        let r = 0.16;
        let g = 0.36;
        let b = 0.14;

        if (y < 410) {
          // Lush valley grass (Breidscheid, Adenau)
          r = 0.19;
          g = 0.42;
          b = 0.16;
        } else if (y < 560) {
          // Dense evergreen Eifel spruce & pine forest
          const t = (y - 410) / (560 - 410);
          r = THREE.MathUtils.lerp(0.15, 0.11, t);
          g = THREE.MathUtils.lerp(0.34, 0.25, t);
          b = THREE.MathUtils.lerp(0.13, 0.09, t);
        } else {
          // Highland ridges and summits (Hohe Acht, Nürburg Castle crest)
          const t = Math.min(1.0, (y - 560) / (720 - 560));
          r = THREE.MathUtils.lerp(0.12, 0.22, t);
          g = THREE.MathUtils.lerp(0.26, 0.30, t);
          b = THREE.MathUtils.lerp(0.10, 0.16, t);
        }

        // Slope shading: steep valley ravines (ny < 0.85) expose slate rock and dark forest floor
        if (ny < 0.90) {
          const steepness = (0.90 - ny) / 0.40;
          const rockBlend = Math.min(1.0, steepness);
          r = THREE.MathUtils.lerp(r, 0.12, rockBlend);
          g = THREE.MathUtils.lerp(g, 0.15, rockBlend);
          b = THREE.MathUtils.lerp(b, 0.11, rockBlend);
        }

        // Subtle organic noise variation across forest patches
        const noise = Math.sin(ix * 0.45) * Math.cos(iz * 0.45) * 0.04;
        r = Math.max(0.05, Math.min(0.9, r + noise));
        g = Math.max(0.08, Math.min(0.9, g + noise * 1.2));
        b = Math.max(0.04, Math.min(0.9, b + noise * 0.8));

        const vIdx3 = idx * 3;
        colors[vIdx3] = r;
        colors[vIdx3 + 1] = g;
        colors[vIdx3 + 2] = b;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'EifelMountainLandscape';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false; // Always visible across the 8 km horizon

    // Build dense evergreen mountain forest canopy across the Eifel ridges
    this.buildMountainForest(mesh, positions, nx, nz);

    return { mesh, geometry, material };
  }

  private buildMountainForest(
    parentMesh: THREE.Mesh,
    positions: Float32Array,
    nx: number,
    nz: number
  ): void {
    // 26m tall majestic mountain evergreen tree geometry
    const treeGeo = new THREE.ConeGeometry(7.0, 26.0, 6);
    treeGeo.translate(0, 13.0, 0);

    const treeMat = new THREE.MeshStandardMaterial({
      color: 0x113318, // Dense dark Eifel mountain pine needle
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true,
    });

    // Build 2D spatial hash grid of all circuit centerlines
    const trackGrid = new Map<string, [number, number][]>();
    const CELL = 50.0;
    const addPoints = (pts: number[][]) => {
      for (const p of pts) {
        const cx = Math.floor(p[0] / CELL);
        const cz = Math.floor(p[2] / CELL);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const key = `${cx + dx},${cz + dz}`;
            let list = trackGrid.get(key);
            if (!list) {
              list = [];
              trackGrid.set(key, list);
            }
            list.push([p[0], p[2]]);
          }
        }
      }
    };
    addPoints(nordData.points);
    addPoints(gpData.points);
    addPoints(h24Data.points);

    const isNearTrack = (tx: number, tz: number, minDist = 36.0): boolean => {
      const cx = Math.floor(tx / CELL);
      const cz = Math.floor(tz / CELL);
      const candidates = trackGrid.get(`${cx},${cz}`);
      if (!candidates) return false;
      const minDistSq = minDist * minDist;
      for (const [px, pz] of candidates) {
        const dx = tx - px;
        const dz = tz - pz;
        if (dx * dx + dz * dz < minDistSq) return true;
      }
      return false;
    };

    // Dense mountain forest blanket: 12,000 towering trees covering ridges, valleys, and horizons
    const MAX_MOUNTAIN_TREES = 12000;
    const forestMesh = new THREE.InstancedMesh(treeGeo, treeMat, MAX_MOUNTAIN_TREES);
    forestMesh.name = 'Eifel_Distant_Mountain_Forest';
    forestMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let count = 0;

    for (let iz = 1; iz < nz - 1; iz++) {
      for (let ix = 1; ix < nx - 1; ix++) {
        if (count >= MAX_MOUNTAIN_TREES) break;

        const idx = iz * nx + ix;
        const x = positions[idx * 3];
        const y = positions[idx * 3 + 1];
        const z = positions[idx * 3 + 2];

        // Forest-bearing mountain elevations (hillsides, valleys, summits)
        if (y < 350.0 || y > 720.0) continue;

        // Skip modern GP pit building and concrete paddock
        if (x > -1400 && x < -1050 && z > 3100 && z < 3550) continue;

        const treesPerCell = (y > 420.0 && y < 660.0) ? 3 : 2;
        for (let t = 0; t < treesPerCell; t++) {
          if (count >= MAX_MOUNTAIN_TREES) break;

          const angle = (t / treesPerCell) * Math.PI * 2 + (ix * 7.3 + iz * 11.9);
          const rad = 6.0 + Math.abs(Math.sin(ix * 3.1 + iz * 5.7 + t)) * 24.0;
          const tx = x + Math.cos(angle) * rad;
          const tz = z + Math.sin(angle) * rad;

          // 36m clearance from track centerline (leaves road and verges completely clear)
          if (isNearTrack(tx, tz, 36.0)) continue;

          // Elevation with subtle organic variation
          const ty = y + (Math.sin(tx * 0.05) + Math.cos(tz * 0.05)) * 1.5;
          const scale = 0.85 + Math.abs(Math.sin(count * 7.3)) * 0.75; // 22m to 42m tall mountain trees!

          dummy.position.set(tx, ty - 1.2, tz);
          dummy.rotation.set(0, Math.sin(count * 1.7) * Math.PI, 0);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();

          forestMesh.setMatrixAt(count++, dummy.matrix);
        }
      }
    }

    forestMesh.count = count;
    forestMesh.instanceMatrix.needsUpdate = true;
    parentMesh.add(forestMesh);
  }

  public setEnabled(enabled: boolean): void {
    this.mesh.visible = enabled;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
