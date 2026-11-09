import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PRESET_LIVERIES, VehicleModelAdapter, LiveryTheme } from './livery-system';

export class ShowroomStage {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  private readonly turntableGroup: THREE.Group;
  private readonly carPivot: THREE.Group;
  private container: HTMLElement;

  // Car model state
  private carModel: THREE.Object3D | null = null;
  public isModelLoaded = false;
  private currentLiveryIndex = 0;
  public selectedCarNumber: string = PRESET_LIVERIES[0]?.carNumber || '80';

  // Materials
  private paintMaterial: THREE.MeshStandardMaterial;
  private caliperMaterial: THREE.MeshStandardMaterial;
  private rimMaterial: THREE.MeshStandardMaterial;
  private wingEndplateMaterial: THREE.MeshStandardMaterial;

  // Orbit / Swivel Controls state
  private isPointerDown = false;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private yaw = 0.65;              // Initial angle showing front 3/4 hero view
  private pitch = 0.28;            // ~16 deg elevation
  private distance = 5.2;          // Distance from car pivot
  private targetYaw = 0.65;
  private targetPitch = 0.28;
  private targetDistance = 5.2;

  // Auto-rotation
  private lastUserInteractTime = performance.now();
  private autoRotateSpeed = 0.18;   // rad/sec (~10.3 deg/sec)
  private isEnabled = false;

  // Bound event listeners
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnWheel = this.onWheel.bind(this);
  private boundOnResize = () => this.onResize(window.innerWidth, window.innerHeight);

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene setup with luxury dark motorsport studio ambiance
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080b);
    this.scene.fog = new THREE.FogExp2(0x07080b, 0.032);

    // 2. Camera setup (45 deg FOV for authentic automotive studio perspective)
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.updateCameraOffset(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', this.boundOnResize);

    // 3. Materials
    this.paintMaterial = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      roughness: 0.18,
      metalness: 0.25,
      name: 'Showroom_Paint',
    });
    this.caliperMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.2,
      name: 'Showroom_Caliper',
    });
    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.30,
      metalness: 0.85,
      name: 'Showroom_Rim',
    });
    this.wingEndplateMaterial = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.3,
      name: 'Showroom_Endplate',
    });

    // 4. Groups
    this.turntableGroup = new THREE.Group();
    this.carPivot = new THREE.Group();
    this.turntableGroup.add(this.carPivot);
    this.scene.add(this.turntableGroup);

    // 5. Build studio podium, perimeter LED halo, and lighting
    this.buildStudioStage();
    this.setupStudioLighting();

    // 6. Asynchronously load the authentic Porsche 911 GT3 RS
    this.loadVehicleModel();
  }

  public get currentLivery(): LiveryTheme {
    return PRESET_LIVERIES[this.currentLiveryIndex];
  }

  public get liveryIndex(): number {
    return this.currentLiveryIndex;
  }

  /**
   * Builds the circular turntable podium and reflective studio floor.
   */
  private buildStudioStage(): void {
    // 1. Studio Podium Cylinder (machined dark obsidian plinth)
    const podiumGeo = new THREE.CylinderGeometry(2.72, 2.88, 0.16, 128);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x0b0c10,
      roughness: 0.32,
      metalness: 0.72,
    });
    const podiumMesh = new THREE.Mesh(podiumGeo, podiumMat);
    podiumMesh.position.set(0, 0.08, 0);
    podiumMesh.receiveShadow = true;
    podiumMesh.castShadow = true;
    this.scene.add(podiumMesh);

    // 2. Turntable Center Platter (satin architectural carbon surface)
    const centerDiskGeo = new THREE.CylinderGeometry(2.58, 2.58, 0.006, 128);
    const centerDiskMat = new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.42,
      metalness: 0.48,
    });
    const centerDisk = new THREE.Mesh(centerDiskGeo, centerDiskMat);
    centerDisk.position.set(0, 0.163, 0);
    centerDisk.receiveShadow = true;
    this.scene.add(centerDisk);

    // 3. Subtle Brushed Platinum Chamfer Ring along outer turntable perimeter
    const haloGeo = new THREE.TorusGeometry(2.69, 0.005, 16, 128);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xe4e4e7,
      transparent: true,
      opacity: 0.16,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.set(0, 0.165, 0);
    this.scene.add(haloMesh);

    // 4. Glossy reflective studio floor plane
    const floorGeo = new THREE.CircleGeometry(28, 128);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050608,
      roughness: 0.18,
      metalness: 0.85,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0, 0);
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // 5. Contact shadow plane under turntable
    const shadowGeo = new THREE.CircleGeometry(3.6, 64);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.72,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0, 0.002, 0);
    this.scene.add(shadowMesh);
  }

  /**
   * High-contrast automotive studio lighting setup.
   */
  private setupStudioLighting(): void {
    // 1. Ambient studio fill
    const ambientLight = new THREE.AmbientLight(0x24262e, 1.45);
    this.scene.add(ambientLight);

    // 2. Main Key Spotlight (front-left hero light casting crisp car shadow)
    const keySpot = new THREE.SpotLight(0xffffff, 4.8, 24, Math.PI / 4.0, 0.4, 1.0);
    keySpot.position.set(3.6, 4.4, 3.8);
    keySpot.target.position.set(0, 0.5, 0);
    keySpot.castShadow = true;
    keySpot.shadow.mapSize.width = 2048;
    keySpot.shadow.mapSize.height = 2048;
    keySpot.shadow.bias = -0.0002;
    keySpot.shadow.camera.near = 1.0;
    keySpot.shadow.camera.far = 15;
    this.scene.add(keySpot);
    this.scene.add(keySpot.target);

    // 3. Rim / Accent Spotlight (rear-right cool silver studio backlight outlining wing & roofline)
    const rimSpot = new THREE.SpotLight(0xe2e8f0, 3.6, 22, Math.PI / 3.6, 0.5, 1.0);
    rimSpot.position.set(-3.8, 3.4, -3.5);
    rimSpot.target.position.set(0, 0.6, 0);
    this.scene.add(rimSpot);
    this.scene.add(rimSpot.target);

    // 4. Soft overhead diffuser light (fills body curves and carbon weave)
    const topLight = new THREE.DirectionalLight(0xf8fafc, 1.35);
    topLight.position.set(0, 6.0, 0);
    topLight.target.position.set(0, 0, 0);
    this.scene.add(topLight);
    this.scene.add(topLight.target);

    // 5. Low ground floor bounce light
    const floorBounce = new THREE.DirectionalLight(0x18181b, 0.75);
    floorBounce.position.set(0, -2, 0);
    this.scene.add(floorBounce);
  }

  /**
   * Loads the authentic Porsche 911 GT3 RS 3D model with Draco decompression.
   */
  private loadVehicleModel(): void {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      '/assets/cars/porsche_992_rsr/model.glb',
      (gltf) => {
        const carModel = gltf.scene;
        this.carModel = carModel;

        // 1. Strip civilian license plates, helper dummies, and cameras
        VehicleModelAdapter.sanitizeModel(carModel);

        // 2. Apply active livery theme with user-selected car number
        VehicleModelAdapter.applyLivery(
          carModel,
          PRESET_LIVERIES[this.currentLiveryIndex],
          this.paintMaterial,
          this.caliperMaterial,
          this.rimMaterial,
          this.wingEndplateMaterial,
          this.selectedCarNumber
        );

        // 3. Extract and attach 4 authentic 3D wheels to the turntable with 1:1 concentric hub mounting
        this.extractAndAttachWheels(carModel);

        // 4. Position chassis on turntable: sits flush with podium surface at Y = 0.2144m, Z = 0.0m
        carModel.position.set(0, 0.2144, 0);
        carModel.scale.set(1.0, 1.0, 1.0);

        // Enable shadows across all meshes
        carModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.carPivot.add(carModel);
        this.isModelLoaded = true;
        console.log('✅ Showroom Stage: Porsche 911 RSR loaded onto 3D turntable platform.');
      },
      undefined,
      (err) => {
        console.warn('Showroom Stage: Failed to load 3D GLB model:', err);
      }
    );
  }

  /**
   * Extracts and mounts all 4 wheels (calipers, ventilated discs, rims, tires) to the showroom platform.
   * Concurrently centered with 1:1 precision inside the wheel well arches.
   */
  private extractAndAttachWheels(carModel: THREE.Object3D): void {
    const wheelNodeFL = carModel.getObjectByName('Wheel_Node_FL');
    const wheelNodeFR = carModel.getObjectByName('Wheel_Node_FR');

    if (!wheelNodeFL || !wheelNodeFR) {
      console.warn('Showroom Stage: Could not locate Wheel_Node_FL / Wheel_Node_FR in model.');
      return;
    }

    // Exact surveyed wheel hub centers from 3D model geometry:
    // Front Hub: X = ±0.770m, Y = 0.5190m (podium 0.2144 + hub 0.3046), Z = +1.1688m
    // Rear Hub:  X = ±0.770m, Y = 0.5190m, Z = -1.2867m
    const wheelConfigs = [
      { node: wheelNodeFL, isRight: false, pos: new THREE.Vector3(-0.7693, 0.5190,  1.1688) },
      { node: wheelNodeFR, isRight: true,  pos: new THREE.Vector3( 0.7701, 0.5190,  1.1688) },
      { node: wheelNodeFL, isRight: false, pos: new THREE.Vector3(-0.7693, 0.5190, -1.2867) },
      { node: wheelNodeFR, isRight: true,  pos: new THREE.Vector3( 0.7701, 0.5190, -1.2867) },
    ];

    for (const config of wheelConfigs) {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.copy(config.pos);

      // Calipers
      config.node.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.toLowerCase().includes('caliper')) {
          const cal = child.clone(true);
          cal.material = this.caliperMaterial;
          wheelAssembly.add(cal);
        }
      });

      // Spin container with rims and Michelin tires
      const spinNode = config.node.getObjectByName(config.isRight ? 'Spin_Node_FR' : 'Spin_Node_FL');
      if (spinNode) {
        const clonedSpin = spinNode.clone(true);
        clonedSpin.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const name = child.name.toLowerCase();
            if (name.includes('rim')) {
              child.material = this.rimMaterial;
            }
          }
        });
        wheelAssembly.add(clonedSpin);
      }

      this.carPivot.add(wheelAssembly);
    }

    // Hide static in-chassis wheel nodes from carModel
    const groupDynamics = carModel.getObjectByName('Group_Dynamics');
    if (groupDynamics) {
      groupDynamics.visible = false;
    }
  }

  /**
   * Switches livery in real-time on the turntable.
   */
  public setLivery(index: number): LiveryTheme {
    this.currentLiveryIndex = (index + PRESET_LIVERIES.length) % PRESET_LIVERIES.length;
    const livery = PRESET_LIVERIES[this.currentLiveryIndex];

    if (this.carModel) {
      VehicleModelAdapter.applyLivery(
        this.carModel,
        livery,
        this.paintMaterial,
        this.caliperMaterial,
        this.rimMaterial,
        this.wingEndplateMaterial,
        this.selectedCarNumber
      );
    }

    return livery;
  }

  /**
   * Updates user-chosen competition race number in real time.
   */
  public setCarNumber(num: string): void {
    this.selectedCarNumber = num.trim();
    if (this.carModel) {
      VehicleModelAdapter.applyLivery(
        this.carModel,
        PRESET_LIVERIES[this.currentLiveryIndex],
        this.paintMaterial,
        this.caliperMaterial,
        this.rimMaterial,
        this.wingEndplateMaterial,
        this.selectedCarNumber
      );
    }
  }

  public nextLivery(): LiveryTheme {
    return this.setLivery(this.currentLiveryIndex + 1);
  }

  public prevLivery(): LiveryTheme {
    return this.setLivery(this.currentLiveryIndex - 1);
  }

  /**
   * Pointer & Wheel Swivel Controls.
   */
  private onPointerDown(e: PointerEvent): void {
    // Only capture primary button
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.isPointerDown = true;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;
    this.lastUserInteractTime = performance.now();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isPointerDown) return;
    const deltaX = e.clientX - this.prevPointerX;
    const deltaY = e.clientY - this.prevPointerY;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;

    // Swivel yaw (horizontal drag) and tilt pitch (vertical drag)
    // Natural direct-manipulation controls: dragging right rotates the car right, dragging up pitches camera up
    this.targetYaw -= deltaX * 0.007;
    this.targetPitch -= deltaY * 0.005;

    // Clamp pitch elevation: 0.06 rad (~3.4 deg low stance) to 1.15 rad (~66 deg top view)
    this.targetPitch = Math.max(0.06, Math.min(1.15, this.targetPitch));
    this.lastUserInteractTime = performance.now();
  }

  private onPointerUp(): void {
    this.isPointerDown = false;
    this.lastUserInteractTime = performance.now();
  }

  private onWheel(e: WheelEvent): void {
    // Zoom distance clamped between 3.2m (tight aero detail) and 8.5m (wide showroom)
    this.targetDistance += e.deltaY * 0.005;
    this.targetDistance = Math.max(3.2, Math.min(8.5, this.targetDistance));
    this.lastUserInteractTime = performance.now();
  }

  public setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;

    if (enabled) {
      this.container.addEventListener('pointerdown', this.boundOnPointerDown);
      window.addEventListener('pointermove', this.boundOnPointerMove);
      window.addEventListener('pointerup', this.boundOnPointerUp);
      this.container.addEventListener('wheel', this.boundOnWheel, { passive: true });
      this.lastUserInteractTime = performance.now();
    } else {
      this.container.removeEventListener('pointerdown', this.boundOnPointerDown);
      window.removeEventListener('pointermove', this.boundOnPointerMove);
      window.removeEventListener('pointerup', this.boundOnPointerUp);
      this.container.removeEventListener('wheel', this.boundOnWheel);
      this.isPointerDown = false;
    }
  }

  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.updateCameraOffset(width, height);
  }

  /**
   * Adjusts the camera projection frustum offset so the 3D car sits perfectly
   * centered in the visible area to the right of the docked side menu.
   */
  public updateCameraOffset(width: number, height: number): void {
    if (width < 860) {
      this.camera.clearViewOffset();
    } else {
      // Left docked menu is min(460px, 36vw).
      // Center of remaining viewport is shifted right by half the sidebar width.
      const sidebarWidth = Math.min(460, Math.round(width * 0.36));
      this.camera.setViewOffset(width, height, -Math.round(sidebarWidth / 2), 0, width, height);
    }
  }

  public clearFrustumOffset(): void {
    this.camera.clearViewOffset();
  }

  /**
   * Main render update loop for showroom mode.
   */
  public updateAndRender(renderer: THREE.WebGLRenderer, dt: number): void {
    const now = performance.now();

    // Idle auto-rotation resumes smoothly 1.5s after user interaction stops
    if (!this.isPointerDown && now - this.lastUserInteractTime > 1500) {
      this.targetYaw += this.autoRotateSpeed * dt;
    }

    // Smooth inertial lerp
    const lerpFactor = 1 - Math.exp(-12 * dt);
    this.yaw += (this.targetYaw - this.yaw) * lerpFactor;
    this.pitch += (this.targetPitch - this.pitch) * lerpFactor;
    this.distance += (this.targetDistance - this.distance) * lerpFactor;

    // Calculate camera position in spherical coordinates around car focal center (0, 0.55, 0)
    const focalCenter = new THREE.Vector3(0, 0.55, 0);
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);

    const camX = focalCenter.x + this.distance * cosPitch * sinYaw;
    const camY = focalCenter.y + this.distance * sinPitch;
    const camZ = focalCenter.z + this.distance * cosPitch * cosYaw;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(focalCenter);

    // Render showroom frame
    renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.boundOnResize);
    this.setEnabled(false);
  }
}
