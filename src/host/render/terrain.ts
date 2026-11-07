import * as THREE from 'three';
import demData from '../../../tracks/nordschleife/dem.json';

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

    // 1. Populate vertex positions and UVs
    for (let iz = 0; iz < nz; iz++) {
      const z = z0 + iz * step;
      for (let ix = 0; ix < nx; ix++) {
        const x = x0 + ix * step;
        const idx = iz * nx + ix;
        const y = h[idx];

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

    return { mesh, geometry, material };
  }

  public setEnabled(enabled: boolean): void {
    this.mesh.visible = enabled;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
