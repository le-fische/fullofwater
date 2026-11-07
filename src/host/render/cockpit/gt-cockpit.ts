import * as THREE from 'three';
import { CockpitRig, CockpitType } from './types';
import { VehicleTelemetry } from '../../../common/types';
import { MicroRadarDisplay } from './micro-radar-display';
import { PorscheRsrSteeringWheel } from './rsr-steering-wheel';

export class GtCockpit implements CockpitRig {
  readonly type: CockpitType = 'gt';
  readonly group = new THREE.Group();
  readonly steeringWheelGroup = new THREE.Group();

  // Driver eye position in chassis space: seated in left racing bucket seat (authentic LHD for Porsche 911 RSR)
  readonly driverEyeOffset = new THREE.Vector3(0.35, 0.70, -0.26);

  // Expansive sim-racing sightlines showing full wheel, rotary dials, dash screen, mirror, and apexes
  readonly verticalFov = 78;

  private rearViewScreenMesh: THREE.Mesh | null = null;
  private microRadar: MicroRadarDisplay | null = null;
  private rsrWheel!: PorscheRsrSteeringWheel;

  constructor() {
    // Prototype roll cages and exterior banner removed; authentic 3D GLB car models now supply factory cabin geometry
    this.buildDashboardAndConsole();
    this.buildSteeringWheel();
    this.group.add(this.steeringWheelGroup);
  }

  getRearViewScreenMesh(): THREE.Mesh | null {
    return this.rearViewScreenMesh;
  }

  getMicroRadarDisplay(): MicroRadarDisplay | null {
    return this.microRadar;
  }

  /**
   * Builds the sculpted dashboard, center console, AC vent, and the digital rear-view monitor.
   */
  private buildDashboardAndConsole(): void {
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0x121216,
      roughness: 0.85,
      metalness: 0.1,
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.45,
      metalness: 0.6,
    });

    // Main dashboard cowl extending across width (lowered and recessed forward to prevent burying the steering wheel)
    const dashGeo = new THREE.BoxGeometry(1.42, 0.16, 0.38);
    const dashMesh = new THREE.Mesh(dashGeo, dashMat);
    dashMesh.position.set(0, 0.38, 0.48);
    dashMesh.rotation.x = -0.16;
    dashMesh.castShadow = true;
    this.group.add(dashMesh);

    // Driver-side binnacle hood behind steering wheel (LHD at X = +0.35)
    const binnacleGeo = new THREE.BoxGeometry(0.44, 0.08, 0.24);
    const binnacleMesh = new THREE.Mesh(binnacleGeo, dashMat);
    binnacleMesh.position.set(0.35, 0.47, 0.34);
    binnacleMesh.rotation.x = -0.22;
    this.group.add(binnacleMesh);

    // AC Ventilation Nozzle (cylindrical air duct visible on center dash)
    const ventGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.09, 16);
    ventGeo.rotateX(Math.PI / 2);
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.5 });
    const ventMesh = new THREE.Mesh(ventGeo, ventMat);
    ventMesh.position.set(0.08, 0.48, 0.38);
    ventMesh.rotation.y = 0.15;
    this.group.add(ventMesh);

    // Center Console on transmission tunnel angled toward driver with illuminated switch panel (lowered to tunnel height)
    const consoleGeo = new THREE.BoxGeometry(0.32, 0.48, 0.06);
    const consoleMesh = new THREE.Mesh(consoleGeo, carbonMat);
    consoleMesh.position.set(-0.06, 0.20, 0.24);
    consoleMesh.rotation.set(-0.70, 0.20, -0.05);
    this.group.add(consoleMesh);

    // Switch Panel texture (ignitions, toggles, bias dials, warning lamps)
    const panelCanvas = document.createElement('canvas');
    panelCanvas.width = 256;
    panelCanvas.height = 384;
    const pCtx = panelCanvas.getContext('2d')!;
    pCtx.fillStyle = '#09090b';
    pCtx.fillRect(0, 0, panelCanvas.width, panelCanvas.height);

    // Grid of buttons
    const btnLabels = ['IGN', 'STRT', 'RAIN', 'PIT', 'WIP', 'MAP', 'TC1', 'TC2', 'ABS', 'FAN', 'RAD', 'BOOST'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        const x = 20 + c * 75;
        const y = 30 + r * 70;
        // Button frame
        pCtx.fillStyle = '#18181b';
        pCtx.fillRect(x, y, 65, 48);
        pCtx.strokeStyle = '#3f3f46';
        pCtx.strokeRect(x, y, 65, 48);
        // Status light
        pCtx.fillStyle = idx === 0 ? '#22c55e' : idx === 3 ? '#eab308' : '#3b82f6';
        pCtx.beginPath();
        pCtx.arc(x + 12, y + 14, 4, 0, Math.PI * 2);
        pCtx.fill();
        // Label
        pCtx.fillStyle = '#e4e4e7';
        pCtx.font = 'bold 13px monospace';
        pCtx.fillText(btnLabels[idx], x + 22, y + 36);
      }
    }

    const panelTexture = new THREE.CanvasTexture(panelCanvas);
    const panelMat = new THREE.MeshBasicMaterial({ map: panelTexture });
    const panelFace = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.45), panelMat);
    panelFace.position.set(0, 0, 0.035);
    panelFace.rotation.y = Math.PI;
    consoleMesh.add(panelFace);

    // 5. In-Cockpit Digital Rear-View Mirror Display (Mounted low on dash center stack, angled toward driver at X = +0.35, keeping windshield 100% unobstructed)
    const mirrorBracket = new THREE.Group();
    mirrorBracket.position.set(-0.10, 0.51, 0.26);
    mirrorBracket.rotation.y = -0.38; // Angled directly toward driver eyes at X = +0.35
    mirrorBracket.rotation.x = -0.12; // Slightly tilted up toward driver eyes

    // Metal mounting stalk (compact low-profile pedestal)
    const stalkGeo = new THREE.CylinderGeometry(0.008, 0.010, 0.035, 8);
    const stalk = new THREE.Mesh(stalkGeo, new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.8 }));
    stalk.position.set(0, 0.005, 0);
    mirrorBracket.add(stalk);

    // Monitor casing (compact 2:1 widescreen monitor body, 0.16m x 0.08m)
    const monitorBodyGeo = new THREE.BoxGeometry(0.16, 0.08, 0.018);
    const monitorBody = new THREE.Mesh(monitorBodyGeo, carbonMat);
    monitorBody.position.set(0, 0.045, 0);
    mirrorBracket.add(monitorBody);

    // Active LCD Display screen (textured by live rear-view camera, 2:1 aspect ratio)
    const screenGeo = new THREE.PlaneGeometry(0.15, 0.07);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b, // placeholder slate until camera texture renders
    });
    this.rearViewScreenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.rearViewScreenMesh.position.set(0, 0, -0.010);
    this.rearViewScreenMesh.rotation.y = Math.PI;
    monitorBody.add(this.rearViewScreenMesh);

    // 6. In-Cockpit Micro Minimap & Proximity Radar (Mounted directly below the rear-view monitor on center stack)
    this.microRadar = new MicroRadarDisplay();
    // Compact scale and position directly below rearView monitor, clear of windshield sightlines
    this.microRadar.group.scale.set(0.68, 0.68, 0.68);
    this.microRadar.group.position.set(0, -0.055, -0.015);
    this.microRadar.group.rotation.y = Math.PI;
    mirrorBracket.add(this.microRadar.group);

    this.group.add(mirrorBracket);
  }

  /**
   * Builds the authentic Porsche 911 RSR GT/GTE steering wheel assembly.
   */
  private buildSteeringWheel(): void {
    // Wheel assembly located directly in front of the driver in left seat (LHD at X = +0.35), elevated in commanding view
    this.steeringWheelGroup.position.set(0.35, 0.58, 0.04);
    this.steeringWheelGroup.rotation.x = 0.36; // Tilts wheel face toward driver eyes and aims column forward/down into dash

    this.rsrWheel = new PorscheRsrSteeringWheel();
    this.steeringWheelGroup.add(this.rsrWheel.group);
  }

  /**
   * Updates shift lights, 1:1 LCD screen, and rotation with live vehicle telemetry.
   */
  update(telemetry: VehicleTelemetry, steerAngleDeg: number, dt: number): void {
    this.rsrWheel.update(telemetry, steerAngleDeg, dt);
  }

  dispose(): void {
    this.rsrWheel.dispose();
    this.microRadar?.dispose();
  }
}
