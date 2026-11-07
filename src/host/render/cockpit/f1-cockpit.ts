import * as THREE from 'three';
import { CockpitRig, CockpitType } from './types';
import { VehicleTelemetry } from '../../../common/types';

export class F1Cockpit implements CockpitRig {
  readonly type: CockpitType = 'f1';
  readonly group = new THREE.Group();
  readonly steeringWheelGroup = new THREE.Group();

  // F1 low, reclined driver eye position directly along centerline
  readonly driverEyeOffset = new THREE.Vector3(0, 0.65, -0.24);
  readonly verticalFov = 82;

  private wheelMesh!: THREE.Mesh;
  private dashCanvas!: HTMLCanvasElement;
  private dashCtx!: CanvasRenderingContext2D;
  private dashTexture!: THREE.CanvasTexture;
  private ledMaterials: THREE.MeshBasicMaterial[] = [];

  private lastRenderedGear = -99;
  private lastRenderedSpeed = -99;
  private lastRenderedRpm = -99;

  constructor() {
    this.buildMonocoqueAndHalo();
    this.buildF1SteeringWheelWithHands();
    this.group.add(this.steeringWheelGroup);
  }

  getRearViewScreenMesh(): THREE.Mesh | null {
    return null; // F1 uses aerodynamic wing mirrors
  }

  private buildMonocoqueAndHalo(): void {
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.35,
      metalness: 0.5,
    });

    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x27272a, // Titanium matte
      roughness: 0.3,
      metalness: 0.8,
    });

    // 1. Cockpit Tub & Side Headrests
    const tubGeo = new THREE.BoxGeometry(0.68, 0.36, 1.2);
    const tubMesh = new THREE.Mesh(tubGeo, carbonMat);
    tubMesh.position.set(0, 0.42, 0.15);
    this.group.add(tubMesh);

    // Left and Right Head Protection Bolsters
    const bolsterGeo = new THREE.BoxGeometry(0.12, 0.18, 0.65);
    const bolsterL = new THREE.Mesh(bolsterGeo, carbonMat);
    bolsterL.position.set(-0.28, 0.62, -0.05);
    this.group.add(bolsterL);

    const bolsterR = new THREE.Mesh(bolsterGeo, carbonMat);
    bolsterR.position.set(0.28, 0.62, -0.05);
    this.group.add(bolsterR);

    // 2. F1 Titanium Halo Structure
    // Center vertical strut right in front of driver's nose
    const centerStrutGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.48, 12);
    const centerStrut = new THREE.Mesh(centerStrutGeo, haloMat);
    centerStrut.position.set(0, 0.72, 0.32);
    centerStrut.rotation.x = -0.32;
    this.group.add(centerStrut);

    // Curved upper halo hoop
    const haloHoopGeo = new THREE.TorusGeometry(0.32, 0.022, 8, 24, Math.PI);
    const haloHoop = new THREE.Mesh(haloHoopGeo, haloMat);
    haloHoop.position.set(0, 0.88, 0.16);
    haloHoop.rotation.x = Math.PI / 2 + 0.15;
    haloHoop.rotation.z = Math.PI;
    this.group.add(haloHoop);

    // 3. Exposed Front Suspension Wishbones (visible stretching forward)
    const wishboneMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 });
    const wishboneGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.75, 8);
    wishboneGeo.rotateZ(Math.PI / 2);

    const wishboneL = new THREE.Mesh(wishboneGeo, wishboneMat);
    wishboneL.position.set(-0.48, 0.42, 1.25);
    wishboneL.rotation.y = 0.25;
    this.group.add(wishboneL);

    const wishboneR = new THREE.Mesh(wishboneGeo, wishboneMat);
    wishboneR.position.set(0.48, 0.42, 1.25);
    wishboneR.rotation.y = -0.25;
    this.group.add(wishboneR);
  }

  private buildF1SteeringWheelWithHands(): void {
    this.steeringWheelGroup.position.set(0, 0.50, 0.04);
    this.steeringWheelGroup.rotation.x = 0.38;

    this.wheelMesh = new THREE.Mesh();
    this.steeringWheelGroup.add(this.wheelMesh);

    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.4 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.02), carbonMat);
    this.wheelMesh.add(plate);

    // Side ergonomic grips
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
    const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.18, 16);

    const leftGrip = new THREE.Mesh(gripGeo, gripMat);
    leftGrip.position.set(-0.125, 0, 0); // Driver left hand grip (-X)
    this.wheelMesh.add(leftGrip);

    const rightGrip = new THREE.Mesh(gripGeo, gripMat);
    rightGrip.position.set(0.125, 0, 0); // Driver right hand grip (+X)
    this.wheelMesh.add(rightGrip);

    // 15 Circular Shift LEDs (light up left to right)
    const ledGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 16);
    ledGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 15; i++) {
      const frac = (7 - i) / 7; // Screen Left (+X) to Screen Right (-X)
      const x = frac * 0.054;
      const y = 0.068;
      const mat = new THREE.MeshBasicMaterial({ color: 0x18181b });
      const led = new THREE.Mesh(ledGeo, mat);
      led.position.set(x, y, -0.014); // Proud of faceplate to avoid clipping
      this.wheelMesh.add(led);
      this.ledMaterials.push(mat);
    }

    // LCD Screen
    this.dashCanvas = document.createElement('canvas');
    this.dashCanvas.width = 512;
    this.dashCanvas.height = 340;
    this.dashCtx = this.dashCanvas.getContext('2d')!;
    this.dashTexture = new THREE.CanvasTexture(this.dashCanvas);

    const screenMat = new THREE.MeshBasicMaterial({ map: this.dashTexture });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), screenMat);
    screenMesh.position.set(0, 0.005, -0.012);
    screenMesh.rotation.y = Math.PI;
    this.wheelMesh.add(screenMesh);
  }

  private renderF1Canvas(speed: number, gear: number, rpm: number): void {
    const ctx = this.dashCtx;
    const w = this.dashCanvas.width;
    const h = this.dashCanvas.height;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    // Big Center Gear
    ctx.fillStyle = '#18181b';
    ctx.fillRect(w / 2 - 55, 60, 110, 180);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(w / 2 - 55, 60, 110, 180);

    const gText = gear === 0 ? 'N' : gear === -1 ? 'R' : gear.toString();
    ctx.fillStyle = gear === 0 ? '#22c55e' : gear === -1 ? '#ef4444' : '#ffffff';
    ctx.font = 'bold 130px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gText, w / 2, 150);

    // Speed Left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 70px monospace';
    ctx.fillText(Math.round(speed).toString(), 30, 160);

    // RPM Right
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 60px monospace';
    ctx.fillText(Math.round(rpm).toString(), 340, 160);

    this.dashTexture.needsUpdate = true;
  }

  update(telemetry: VehicleTelemetry, steerAngleDeg: number, _dt: number): void {
    const steerRad = steerAngleDeg * (Math.PI / 180);
    this.wheelMesh.rotation.z = -steerRad * 3.4;

    const rpm = telemetry.rpm;
    for (let i = 0; i < 15; i++) {
      const col = i < 5 ? 0x22c55e : i < 10 ? 0xef4444 : 0x3b82f6;
      const th = 6600 + i * ((8800 - 6600) / 15);
      this.ledMaterials[i].color.setHex(rpm >= th ? col : 0x18181b);
    }

    const speedInt = Math.round(Math.abs(telemetry.speedKmh));
    const rpmInt = Math.round(telemetry.rpm / 50) * 50;

    if (
      telemetry.gear !== this.lastRenderedGear ||
      speedInt !== this.lastRenderedSpeed ||
      rpmInt !== this.lastRenderedRpm
    ) {
      this.lastRenderedGear = telemetry.gear;
      this.lastRenderedSpeed = speedInt;
      this.lastRenderedRpm = rpmInt;
      this.renderF1Canvas(telemetry.speedKmh, telemetry.gear, telemetry.rpm);
    }
  }

  dispose(): void {
    this.dashTexture.dispose();
  }
}
