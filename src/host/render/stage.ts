import * as THREE from 'three';

export class RenderStage {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public sunLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Daytime sky
    // Gentle atmospheric haze allowing clear sightlines beyond 5 km down the high-speed runway
    this.scene.fog = new THREE.Fog(0x87ceeb, 800, 8500);

    this.camera = new THREE.PerspectiveCamera(
      64,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    // Hemisphere ambient light (sky/ground contrast)
    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x444455, 0.7);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Directional sunlight casting shadows
    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    this.sunLight.position.set(80, 140, 50);
    this.sunLight.castShadow = true;

    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;

    const shadowDist = 80;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  /**
   * Translates the directional light shadow volume to follow the car across kilometers.
   */
  updateLight(targetPos: THREE.Vector3): void {
    this.sunLight.position.set(targetPos.x + 80, targetPos.y + 140, targetPos.z + 50);
    this.sunLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
    this.sunLight.target.updateMatrixWorld();
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
