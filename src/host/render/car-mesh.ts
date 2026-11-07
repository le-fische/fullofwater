import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RaycastVehicle } from '../physics/raycast-vehicle';
import { CockpitRig } from './cockpit/types';
import { CockpitFactory } from './cockpit/cockpit-factory';
import {
  LiveryTheme,
  PRESET_LIVERIES,
  VehicleModelAdapter,
} from './livery-system';

export class CarMeshRig {
  public rootGroup = new THREE.Group();
  public chassisGroup = new THREE.Group();
  public cockpit!: CockpitRig;
  public wheelMeshes: THREE.Group[] = [];

  private steerGroups: THREE.Group[] = [];
  private spinGroups: THREE.Group[] = [];
  private wheelSpinAngles: number[] = [0, 0, 0, 0];

  private proxyGroup = new THREE.Group();
  private modelGroup = new THREE.Group();
  private carModelRoot: THREE.Object3D | null = null;

  // Standardized PBR Materials
  private paintMaterial!: THREE.MeshStandardMaterial;
  private caliperMaterial!: THREE.MeshStandardMaterial;
  private rimMaterial!: THREE.MeshStandardMaterial;
  private wingEndplateMaterial!: THREE.MeshStandardMaterial;

  private currentLiveryIndex = 0;
  private activeCarNumber: string = PRESET_LIVERIES[0]?.carNumber || '80';
  private isModelLoaded = false;
  private vehicle: RaycastVehicle;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, vehicle: RaycastVehicle) {
    this.scene = scene;
    this.vehicle = vehicle;
    this.rootGroup.add(this.chassisGroup);
    scene.add(this.rootGroup);

    this.chassisGroup.add(this.proxyGroup);
    this.chassisGroup.add(this.modelGroup);

    this.initStandardMaterials();
    this.buildProxyChassis();
    this.setupCockpit();
    this.buildWheels();
    this.loadGlbModel();
  }

  private initStandardMaterials(): void {
    const livery = PRESET_LIVERIES[this.currentLiveryIndex];

    this.paintMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(livery.primaryColor),
      roughness: 0.18,
      metalness: 0.25,
      envMapIntensity: 1.5,
    });

    this.caliperMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(livery.caliperColor),
      roughness: 0.35,
      metalness: 0.2,
    });

    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(livery.rimColor),
      roughness: 0.30,
      metalness: 0.85,
    });

    this.wingEndplateMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(livery.accentColor),
      roughness: 0.30,
      metalness: 0.40,
    });

    // Apply initial livery skin
    VehicleModelAdapter.applyLivery(
      this.proxyGroup,
      livery,
      this.paintMaterial,
      this.caliperMaterial,
      this.rimMaterial,
      this.wingEndplateMaterial
    );
  }

  /**
   * Sets the standardized competition livery by index and optional custom car number.
   */
  public setLivery(index: number, customCarNumber?: string): string {
    this.currentLiveryIndex = (index + PRESET_LIVERIES.length) % PRESET_LIVERIES.length;
    const livery = PRESET_LIVERIES[this.currentLiveryIndex];
    if (customCarNumber !== undefined && customCarNumber.trim().length > 0) {
      this.activeCarNumber = customCarNumber.trim();
    }

    if (this.carModelRoot) {
      VehicleModelAdapter.applyLivery(
        this.carModelRoot,
        livery,
        this.paintMaterial,
        this.caliperMaterial,
        this.rimMaterial,
        this.wingEndplateMaterial,
        this.activeCarNumber
      );
    } else {
      VehicleModelAdapter.applyLivery(
        this.proxyGroup,
        livery,
        this.paintMaterial,
        this.caliperMaterial,
        this.rimMaterial,
        this.wingEndplateMaterial,
        this.activeCarNumber
      );
    }

    return `${livery.name} #${this.activeCarNumber}`;
  }

  public setCarNumber(num: string): void {
    this.activeCarNumber = num.trim();
    this.setLivery(this.currentLiveryIndex, this.activeCarNumber);
  }

  /**
   * Cycles to the next standardized competition livery.
   */
  public cyclePaintColor(): string {
    return this.setLivery(this.currentLiveryIndex + 1);
  }

  public get currentLivery(): LiveryTheme {
    return PRESET_LIVERIES[this.currentLiveryIndex];
  }

  public get liveryIndex(): number {
    return this.currentLiveryIndex;
  }

  public get isLoaded(): boolean {
    return this.isModelLoaded;
  }

  public getPaintName(): string {
    const livery = PRESET_LIVERIES[this.currentLiveryIndex];
    return `${livery.name} #${livery.carNumber}`;
  }

  private setupCockpit(): void {
    const carClass = this.vehicle.profile.class || 'GTE';
    this.cockpit = CockpitFactory.createCockpit(carClass);
    this.chassisGroup.add(this.cockpit.group);
  }

  /**
   * Procedural proxy chassis body (displayed instantly on startup until 3D GLTF is ready).
   */
  private buildProxyChassis(): void {
    const bodyMat = this.paintMaterial;

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.4,
      metalness: 0.8,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      roughness: 0.1,
      transmission: 0.85,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    // Main lower chassis tub
    const tubGeo = new THREE.BoxGeometry(1.85, 0.35, 4.4);
    const tubMesh = new THREE.Mesh(tubGeo, bodyMat);
    tubMesh.position.set(0, 0.18, 0);
    tubMesh.castShadow = true;
    tubMesh.receiveShadow = true;
    this.proxyGroup.add(tubMesh);

    // Dipped center frunk hood
    const hoodGeo = new THREE.BoxGeometry(1.10, 0.10, 1.55);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(0, 0.35, 1.40);
    hoodMesh.rotation.x = -0.14;
    hoodMesh.castShadow = true;
    this.proxyGroup.add(hoodMesh);

    // Left front fender crest
    const leftFenderGeo = new THREE.BoxGeometry(0.38, 0.18, 1.65);
    const leftFender = new THREE.Mesh(leftFenderGeo, bodyMat);
    leftFender.position.set(0.72, 0.45, 1.40);
    leftFender.rotation.x = -0.12;
    leftFender.castShadow = true;
    this.proxyGroup.add(leftFender);

    // Right front fender crest
    const rightFenderGeo = new THREE.BoxGeometry(0.38, 0.18, 1.65);
    const rightFender = new THREE.Mesh(rightFenderGeo, bodyMat);
    rightFender.position.set(-0.72, 0.45, 1.40);
    rightFender.rotation.x = -0.12;
    rightFender.castShadow = true;
    this.proxyGroup.add(rightFender);

    // Front splitter (carbon)
    const splitterGeo = new THREE.BoxGeometry(1.95, 0.04, 0.6);
    const splitterMesh = new THREE.Mesh(splitterGeo, carbonMat);
    splitterMesh.position.set(0, 0.06, 2.2);
    splitterMesh.castShadow = true;
    this.proxyGroup.add(splitterMesh);

    // Roof panel
    const roofGeo = new THREE.BoxGeometry(1.35, 0.03, 1.3);
    const roofMesh = new THREE.Mesh(roofGeo, bodyMat);
    roofMesh.position.set(0, 1.18, -0.35);
    roofMesh.castShadow = true;
    this.proxyGroup.add(roofMesh);

    // Rear engine deck
    const rearDeckGeo = new THREE.BoxGeometry(1.5, 0.18, 1.4);
    const rearDeck = new THREE.Mesh(rearDeckGeo, bodyMat);
    rearDeck.position.set(0, 0.50, -1.3);
    rearDeck.rotation.x = 0.10;
    rearDeck.castShadow = true;
    this.proxyGroup.add(rearDeck);

    // Windshield frame & glass
    const windshieldGeo = new THREE.PlaneGeometry(1.30, 0.85);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 0.86, 0.45);
    windshield.rotation.x = -Math.PI / 4.2;
    this.proxyGroup.add(windshield);

    // Rear swan-neck wing (RSR signature) firmly rooted into the engine lid
    const wingGeo = new THREE.BoxGeometry(1.9, 0.04, 0.45);
    const wingMesh = new THREE.Mesh(wingGeo, carbonMat);
    wingMesh.position.set(0, 1.15, -2.05);
    wingMesh.castShadow = true;
    this.proxyGroup.add(wingMesh);

    // Wing endplates
    const endplateGeo = new THREE.BoxGeometry(0.03, 0.35, 0.5);
    const leftEndplate = new THREE.Mesh(endplateGeo, this.wingEndplateMaterial);
    leftEndplate.position.set(-0.95, 1.15, -2.05);
    this.proxyGroup.add(leftEndplate);

    const rightEndplate = new THREE.Mesh(endplateGeo, this.wingEndplateMaterial);
    rightEndplate.position.set(0.95, 1.15, -2.05);
    this.proxyGroup.add(rightEndplate);

    // Wing upright swan-neck pylons anchored into deck
    const pylonGeo = new THREE.BoxGeometry(0.04, 0.65, 0.15);
    const leftPylon = new THREE.Mesh(pylonGeo, carbonMat);
    leftPylon.position.set(-0.4, 0.82, -1.95);
    this.proxyGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(pylonGeo, carbonMat);
    rightPylon.position.set(0.4, 0.82, -1.95);
    this.proxyGroup.add(rightPylon);
  }

  /**
   * Initializes 4 wheel rigs with separate steering and spin hierarchies.
   */
  private buildWheels(): void {
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.9,
    });

    for (let i = 0; i < 4; i++) {
      const w = this.vehicle.wheels[i];
      const wheelGroup = new THREE.Group();
      const steerGroup = new THREE.Group();
      const spinGroup = new THREE.Group();

      steerGroup.add(spinGroup);
      wheelGroup.add(steerGroup);

      // Initial procedural tire cylinder
      const tireGeo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.name = 'proceduralTire';
      tireMesh.castShadow = true;
      spinGroup.add(tireMesh);

      this.wheelMeshes.push(wheelGroup);
      this.steerGroups.push(steerGroup);
      this.spinGroups.push(spinGroup);
      this.rootGroup.add(wheelGroup);
    }
  }

  /**
   * Asynchronously loads authentic Porsche 911 GT3 RS GLB model with Draco compression.
   */
  private loadGlbModel(): void {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      '/assets/cars/porsche_992_rsr/model.glb',
      (gltf: GLTF) => {
        this.onModelLoaded(gltf);
      },
      undefined,
      (err) => {
        console.warn('Porsche 911 GT3 RS GLB failed to load; continuing with procedural proxy:', err);
      }
    );
  }

  private onModelLoaded(gltf: GLTF): void {
    const carModel = gltf.scene;
    this.carModelRoot = carModel;

    // 1. Sanitize model: strip all civilian license plates, helper dummies, and cameras
    VehicleModelAdapter.sanitizeModel(carModel);

    // 2. Extract authentic 3D wheels from the model
    this.extractAndAttachWheels(carModel);

    // 3. Apply standardized competition livery with user car number
    VehicleModelAdapter.applyLivery(
      carModel,
      PRESET_LIVERIES[this.currentLiveryIndex],
      this.paintMaterial,
      this.caliperMaterial,
      this.rimMaterial,
      this.wingEndplateMaterial,
      this.activeCarNumber
    );

    // 4. Align chassis body with Rapier physics center of mass and wheelbase
    // Offset Y -0.305m aligns wheel hubs with Rapier physics contact line; Z +0.230m aligns wheel arches with frontZ (+1.399m) and rearZ (-1.056m)
    this.modelGroup.scale.set(1.0, 1.0, 1.0);
    this.modelGroup.position.set(0, -0.305, 0.230);
    this.modelGroup.add(carModel);

    // 5. Hide procedural proxy body
    this.proxyGroup.visible = false;
    this.isModelLoaded = true;
    console.log('✅ Porsche 911 RSR 3D model loaded and mapped into standardized livery system.');
  }

  /**
   * Extracts separated wheel assemblies (caliper, disc, hub, rim, tire) into 4 dynamic rigs.
   */
  private extractAndAttachWheels(carModel: THREE.Object3D): void {
    const wheelNodeFL = carModel.getObjectByName('Wheel_Node_FL');
    const wheelNodeFR = carModel.getObjectByName('Wheel_Node_FR');

    if (!wheelNodeFL || !wheelNodeFR) {
      console.warn('Could not locate Wheel_Node_FL / Wheel_Node_FR in model.');
      return;
    }

    // FL: Front Left (wheel 0)
    this.buildWheelFromNode(0, wheelNodeFL, false);
    // FR: Front Right (wheel 1)
    this.buildWheelFromNode(1, wheelNodeFR, true);
    // RL: Rear Left (wheel 2)
    this.buildWheelFromNode(2, wheelNodeFL, false);
    // RR: Rear Right (wheel 3)
    this.buildWheelFromNode(3, wheelNodeFR, true);

    // Hide static in-chassis wheel nodes from carModel
    const groupDynamics = carModel.getObjectByName('Group_Dynamics');
    if (groupDynamics) {
      groupDynamics.visible = false;
    }
  }

  private buildWheelFromNode(
    wheelIndex: number,
    sourceWheelNode: THREE.Object3D,
    isRight: boolean
  ): void {
    const steerGroup = this.steerGroups[wheelIndex];
    const spinGroup = this.spinGroups[wheelIndex];

    // Remove placeholder meshes
    const procTire = spinGroup.getObjectByName('proceduralTire');
    if (procTire) spinGroup.remove(procTire);

    // 1. Fixed Brake Caliper Container (steers, does not spin)
    const caliperContainer = new THREE.Group();
    sourceWheelNode.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.toLowerCase().includes('caliper')) {
        const cal = child.clone(true);
        cal.material = this.caliperMaterial;
        caliperContainer.add(cal);
      }
    });

    // 2. Spinning Wheel Assembly (rims, tires, ventilated disc, hub)
    const spinContainer = new THREE.Group();
    const spinNode = sourceWheelNode.getObjectByName(isRight ? 'Spin_Node_FR' : 'Spin_Node_FL');

    if (spinNode) {
      const clonedSpin = spinNode.clone(true);
      clonedSpin.position.set(0, 0, 0);
      clonedSpin.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const name = child.name.toLowerCase();
          if (name.includes('rim')) {
            child.material = this.rimMaterial;
          }
        }
      });
      spinContainer.add(clonedSpin);
    }

    steerGroup.add(caliperContainer);
    spinGroup.add(spinContainer);
  }

  /**
   * Sync visual meshes and modular cockpit with Rapier physics states every frame.
   */
  update(dt: number = 0.016): void {
    const chassisPos = this.vehicle.chassisBody.translation();
    const chassisRot = this.vehicle.chassisBody.rotation();

    // 1. Update chassis position and orientation
    this.chassisGroup.position.set(chassisPos.x, chassisPos.y, chassisPos.z);
    this.chassisGroup.quaternion.set(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);

    // 2. Update modular cockpit (steering wheel, gloved hands, LCD dash, shift LEDs)
    const telemetry = this.vehicle.getTelemetry();
    const steerDeg = this.vehicle.assists.getSteerAngleDeg();
    this.cockpit.update(telemetry, steerDeg, dt);

    // 3. Update 4 wheels with physical suspension, steering, and forward rolling spin
    for (let i = 0; i < 4; i++) {
      const w = this.vehicle.wheels[i];
      const wheelGroup = this.wheelMeshes[i];
      const steerGroup = this.steerGroups[i];
      const spinGroup = this.spinGroups[i];

      // Contact point positioning
      if (w.isInContact) {
        wheelGroup.position.set(
          w.contactPointWorld[0],
          w.contactPointWorld[1] + w.radius,
          w.contactPointWorld[2]
        );
      } else {
        const hp = w.hardpoint;
        const localPos = new THREE.Vector3(hp[0], hp[1] - 0.35, hp[2]);
        localPos.applyQuaternion(this.chassisGroup.quaternion);
        wheelGroup.position.set(
          chassisPos.x + localPos.x,
          chassisPos.y + localPos.y,
          chassisPos.z + localPos.z
        );
      }

      // Wheel base orientation tracks chassis
      wheelGroup.quaternion.copy(this.chassisGroup.quaternion);

      // Steering angle on front wheels
      if (w.isSteered) {
        steerGroup.quaternion.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          w.steerAngleRad
        );
      } else {
        steerGroup.quaternion.identity();
      }

      // Rolling spin angle around local axle
      this.wheelSpinAngles[i] += w.angularVelocity * dt;
      spinGroup.rotation.x = this.wheelSpinAngles[i];
    }
  }

  public dispose(): void {
    this.scene.remove(this.rootGroup);
  }
}
