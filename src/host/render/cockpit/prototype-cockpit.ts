import * as THREE from 'three';
import { CockpitRig, CockpitType } from './types';
import { VehicleTelemetry } from '../../../common/types';

export class PrototypeCockpit implements CockpitRig {
  readonly type: CockpitType = 'prototype';
  readonly group = new THREE.Group();
  readonly steeringWheelGroup = new THREE.Group();

  // Le Mans Hypercar cockpit eye offset (seated centered behind steering column, commanding canopy sightline)
  readonly driverEyeOffset = new THREE.Vector3(0, 0.72, -0.28);
  readonly verticalFov = 82;

  private rearViewScreenMesh: THREE.Mesh | null = null;
  private wheelMesh!: THREE.Mesh;
  private dashCanvas!: HTMLCanvasElement;
  private dashCtx!: CanvasRenderingContext2D;
  private dashTexture!: THREE.CanvasTexture;
  private ledMaterials: THREE.MeshBasicMaterial[] = [];

  private lastRenderedGear = -99;
  private lastRenderedSpeed = -99;
  private lastRenderedRpm = -99;

  constructor() {
    this.buildCanopyAndDash();
    this.buildPrototypeSteeringWheelWithHands();
    this.group.add(this.steeringWheelGroup);
  }

  getRearViewScreenMesh(): THREE.Mesh | null {
    return this.rearViewScreenMesh;
  }

  private buildCanopyAndDash(): void {
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.8 });

    // Prototype roll cage pillars and wiper decommissioned; models provide cabin frame

    // Dashboard (lowered and recessed forward to prevent burying steering wheel)
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.16, 0.38), darkMat);
    dash.position.set(0, 0.44, 0.44);
    dash.rotation.x = -0.15;
    this.group.add(dash);

    // Digital Rear-View Mirror Screen (roof mounted / center console in hypercars)
    const mirrorBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.02), carbonMat);
    mirrorBody.position.set(-0.22, 0.58, 0.30);
    mirrorBody.rotation.set(-0.10, -0.22, 0);

    const screenGeo = new THREE.PlaneGeometry(0.22, 0.12);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    this.rearViewScreenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.rearViewScreenMesh.position.set(0, 0, 0.012);
    this.rearViewScreenMesh.rotation.y = Math.PI;
    mirrorBody.add(this.rearViewScreenMesh);

    this.group.add(mirrorBody);
  }

  private buildPrototypeSteeringWheelWithHands(): void {
    this.steeringWheelGroup.position.set(0, 0.56, 0.06);
    this.steeringWheelGroup.rotation.x = 0.38;

    this.wheelMesh = new THREE.Mesh();
    this.steeringWheelGroup.add(this.wheelMesh);

    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3, metalness: 0.4 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.17, 0.02), carbonMat);
    this.wheelMesh.add(plate);

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
      const y = 0.072;
      const mat = new THREE.MeshBasicMaterial({ color: 0x18181b });
      const led = new THREE.Mesh(ledGeo, mat);
      led.position.set(x, y, -0.014); // Proud of faceplate to avoid clipping
      this.wheelMesh.add(led);
      this.ledMaterials.push(mat);
    }

    // LCD
    this.dashCanvas = document.createElement('canvas');
    this.dashCanvas.width = 512;
    this.dashCanvas.height = 340;
    this.dashCtx = this.dashCanvas.getContext('2d')!;
    this.dashTexture = new THREE.CanvasTexture(this.dashCanvas);

    const screenMat = new THREE.MeshBasicMaterial({ map: this.dashTexture });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), screenMat);
    screenMesh.position.set(0, 0.008, -0.012);
    screenMesh.rotation.y = Math.PI;
    this.wheelMesh.add(screenMesh);
  }

  private renderPrototypeCanvas(speed: number, gear: number, rpm: number): void {
    const ctx = this.dashCtx;
    const w = this.dashCanvas.width;
    const h = this.dashCanvas.height;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    // Center Gear
    ctx.fillStyle = '#18181b';
    ctx.fillRect(w / 2 - 55, 60, 110, 180);
    ctx.strokeStyle = '#06b6d4';
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
    ctx.fillStyle = '#06b6d4';
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
      this.renderPrototypeCanvas(telemetry.speedKmh, telemetry.gear, telemetry.rpm);
    }
  }

  dispose(): void {
    this.dashTexture.dispose();
  }
}
