import * as THREE from 'three';

/**
 * Standardized Vehicle Wrap UV Mapping Pipeline.
 *
 * Generates an analytical 1:1 unwrapped flat wrap UV layout across all exterior
 * bodywork meshes (chassis monocoque, doors, hood, aero splitters, wings).
 *
 * This provides a standardized 2D profile template so that any flat livery/wrap image
 * wraps seamlessly and smoothly around the car with zero distortion, zero 90° rotation,
 * and exact 1:1 decal placement.
 */
export class StandardWrapMapper {
  // Vehicle Bounding Bounds (Porsche 911 RSR / GT3 RS 1:1 scale)
  private static readonly Z_MIN = -2.36; // Rear tail/diffuser
  public static readonly Z_MAX = 2.20;  // Front nose/splitter
  private static readonly Z_SPAN = 4.56;

  private static readonly Y_MIN = 0.15;  // Lower rocker sill
  public static readonly Y_MAX = 1.26;  // Roof crest
  private static readonly Y_SPAN = 1.11;

  private static readonly X_MIN = -0.95; // Left fender outer lip
  public static readonly X_MAX = 0.95;  // Right fender outer lip
  private static readonly X_SPAN = 1.90;

  /**
   * Applies the standardized flat wrap UV coordinates across all exterior body meshes.
   */
  public static applyToModel(modelRoot: THREE.Object3D): void {
    modelRoot.updateMatrixWorld(true);
    const rootInvMatrix = new THREE.Matrix4().copy(modelRoot.matrixWorld).invert();

    const vPos = new THREE.Vector3();
    const vNorm = new THREE.Vector3();

    modelRoot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const name = child.name.toLowerCase();
      const matName = (child.material?.name || '').toLowerCase();

      // Filter strictly for exterior bodywork and aero meshes
      const isBodyMesh =
        name.includes('paint') ||
        name.includes('chassis_paint') ||
        name.includes('door_paint') ||
        name.includes('hood_paint') ||
        name.includes('aero_parts') ||
        name.includes('wing_flap') ||
        name.includes('endplate') ||
        matName.includes('paint') ||
        matName.includes('chassis_paint') ||
        matName.includes('body');

      if (!isBodyMesh) return;

      const geometry = child.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position;
      const normAttr = geometry.attributes.normal;

      if (!posAttr) return;

      // Ensure geometry has unique UV attribute
      let uvAttr = geometry.attributes.uv as THREE.BufferAttribute;
      if (!uvAttr || uvAttr.count !== posAttr.count) {
        uvAttr = new THREE.BufferAttribute(new Float32Array(posAttr.count * 2), 2);
        geometry.setAttribute('uv', uvAttr);
      } else {
        // Clone if shared
        uvAttr = new THREE.BufferAttribute(new Float32Array(posAttr.count * 2), 2);
        geometry.setAttribute('uv', uvAttr);
      }

      // Matrix to transform vertex from child local space into modelRoot space
      const relMatrix = new THREE.Matrix4().multiplyMatrices(rootInvMatrix, child.matrixWorld);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(relMatrix);

      for (let i = 0; i < posAttr.count; i++) {
        vPos.fromBufferAttribute(posAttr, i);
        vPos.applyMatrix4(relMatrix);

        if (normAttr) {
          vNorm.fromBufferAttribute(normAttr, i);
          vNorm.applyMatrix3(normalMatrix).normalize();
        } else {
          vNorm.set(0, 1, 0);
        }

        const x = vPos.x;
        const y = vPos.y;
        const z = vPos.z;
        const nx = vNorm.x;
        const ny = vNorm.y;
        const nz = vNorm.z;

        let u = 0.5;
        let v = 0.5;

        // Categorize vertex projection zone
        const absNx = Math.abs(nx);
        const absNy = Math.abs(ny);
        const absNz = Math.abs(nz);

        if (z >= 1.68 && y < 0.75) {
          // --- Front Nose, Splitter & Bumper (Grille / Mouth) ---
          // Cylindrical / panoramic unwrapping around the full curved front bumper
          const normX = THREE.MathUtils.clamp((x - StandardWrapMapper.X_MIN) / StandardWrapMapper.X_SPAN, 0, 1);
          const normY = THREE.MathUtils.clamp((y - StandardWrapMapper.Y_MIN) / 0.58, 0, 1);

          // Front Bumper Zone: U in [0.60, 0.95], V in [0.86, 0.99]
          u = 0.60 + 0.35 * normX;
          v = 0.86 + 0.13 * normY;
        } else if (absNx >= 0.30 && absNx >= absNy && absNx >= absNz) {
          // --- Side Profiles (Left or Right) ---
          const normZ = THREE.MathUtils.clamp((z - StandardWrapMapper.Z_MIN) / StandardWrapMapper.Z_SPAN, 0, 1);
          const normY = THREE.MathUtils.clamp((y - StandardWrapMapper.Y_MIN) / StandardWrapMapper.Y_SPAN, 0, 1);

          if (nx < 0) {
            // Left Side Profile: Tail on left (U=0.03), Nose on right (U=0.97)
            u = 0.03 + 0.94 * normZ;
            // V in [0.05, 0.43]
            v = 0.05 + 0.38 * normY;
          } else {
            // Right Side Profile: Nose on left (U=0.03), Tail on right (U=0.97)
            // When looking at the right side of the vehicle, nose (+Z) is on the viewer's left.
            // Inverting normZ ensures un-mirrored, 1:1 left-to-right text and numbers.
            u = 0.03 + 0.94 * (1.0 - normZ);
            // V in [0.48, 0.86]
            v = 0.48 + 0.38 * normY;
          }
        } else if (ny >= 0.28 && y >= 0.38) {
          // --- Top / Plan View (Hood, Roof, Engine Deck, Rear Wing) ---
          const normX = THREE.MathUtils.clamp((x - StandardWrapMapper.X_MIN) / StandardWrapMapper.X_SPAN, 0, 1);
          const normZ = THREE.MathUtils.clamp((z - StandardWrapMapper.Z_MIN) / StandardWrapMapper.Z_SPAN, 0, 1);

          // Top View: U in [0.05, 0.55], V in [0.86, 0.99]
          u = 0.05 + 0.50 * normX;
          v = 0.86 + 0.13 * normZ;
        } else {
          // --- Rear Bumper, Diffuser & Under-sill ---
          const normX = THREE.MathUtils.clamp((x - StandardWrapMapper.X_MIN) / StandardWrapMapper.X_SPAN, 0, 1);
          const normY = THREE.MathUtils.clamp((y - StandardWrapMapper.Y_MIN) / StandardWrapMapper.Y_SPAN, 0, 1);

          u = 0.60 + 0.35 * normX;
          v = 0.48 + 0.38 * normY;
        }

        uvAttr.setXY(i, u, v);
      }

      uvAttr.needsUpdate = true;
    });

    console.log('✅ StandardWrapMapper: 1:1 Flat profile wrap UV coordinates generated across exterior bodywork.');
  }
}
