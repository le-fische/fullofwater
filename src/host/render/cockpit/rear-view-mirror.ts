import * as THREE from 'three';

export class RearViewMirrorRenderer {
  private renderTarget: THREE.WebGLRenderTarget;
  private rearCamera: THREE.PerspectiveCamera;
  private screenMaterial: THREE.MeshBasicMaterial | null = null;
  private targetMesh: THREE.Mesh | null = null;
  private isEnabled = true;
  private frameCount = 0;

  constructor() {
    // 512x256 2:1 widescreen aspect ratio for crisp digital mirror
    this.renderTarget = new THREE.WebGLRenderTarget(512, 256, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      generateMipmaps: false,
    });

    // Rear camera facing backward out the rear window (tight 200m frustum skips distant terrain & trees)
    this.rearCamera = new THREE.PerspectiveCamera(65, 512 / 256, 0.2, 200);
  }

  /**
   * Bind a cockpit's rear-view screen mesh to receive the live rear-camera feed.
   */
  bindScreen(mesh: THREE.Mesh | null): void {
    this.targetMesh = mesh;
    if (mesh) {
      this.screenMaterial = new THREE.MeshBasicMaterial({
        map: this.renderTarget.texture,
      });
      mesh.material = this.screenMaterial;
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Render the rear-view feed before the main camera renders.
   */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    carPos: THREE.Vector3,
    carQuat: THREE.Quaternion,
    carRootGroup?: THREE.Group
  ): void {
    if (!this.isEnabled || !this.targetMesh) return;

    // Alternate frame updates: 30-60 Hz mirror update rate saves 50% GPU/CPU geometry passes
    this.frameCount++;
    if (this.frameCount % 2 !== 0) return;

    // Position rear camera at the rear exterior of the car (above rear bumper / spoiler base at Z = -2.25m, Y = 1.05m)
    // Mounted outside the vehicle looking backward -Z, completely clear of interior cabin, seats, and roll cage
    const rearCamOffset = new THREE.Vector3(0, 1.05, -2.25).applyQuaternion(carQuat);
    const camPos = carPos.clone().add(rearCamOffset);
    this.rearCamera.position.copy(camPos);

    // Look backward (-Z direction) down the track
    const lookDir = new THREE.Vector3(0, -0.04, -50).applyQuaternion(carQuat);
    this.rearCamera.lookAt(camPos.clone().add(lookDir));

    // Temporarily hide the car body so the camera doesn't see inside its own roof panel
    if (carRootGroup) {
      carRootGroup.visible = false;
    }

    const currentRenderTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, this.rearCamera);
    renderer.setRenderTarget(currentRenderTarget);

    if (carRootGroup) {
      carRootGroup.visible = true;
    }
  }

  dispose(): void {
    this.renderTarget.dispose();
    if (this.screenMaterial) {
      this.screenMaterial.dispose();
    }
  }
}
