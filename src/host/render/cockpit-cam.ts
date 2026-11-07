import * as THREE from 'three';
import { RaycastVehicle } from '../physics/raycast-vehicle';
import { CockpitRig } from './cockpit/types';

export enum CameraViewMode {
  COCKPIT = 'cockpit',
  CHASE = 'chase',
}

export class DynamicCameraController {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraViewMode = CameraViewMode.COCKPIT;
  private isRearViewActive = false;

  private vehicle: RaycastVehicle;
  private cockpit: CockpitRig | null = null;

  // Driver eye offset in chassis coordinate space (left-hand drive Porsche cockpit: +X is Left)
  // Positioned naturally at driver head position with commanding road sightlines
  private driverEyeOffset = new THREE.Vector3(0.35, 0.72, -0.28);

  // Chase camera parameters
  private chaseOffset = new THREE.Vector3(0, 1.8, -5.5);
  private chaseLookAhead = new THREE.Vector3(0, 0.8, 4.0);

  // Smoothing buffers
  private currentCameraPos = new THREE.Vector3();
  private currentCameraLookAt = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, vehicle: RaycastVehicle, cockpit?: CockpitRig) {
    this.camera = camera;
    this.vehicle = vehicle;
    if (cockpit) {
      this.setCockpit(cockpit);
    }
  }

  setCockpit(cockpit: CockpitRig): void {
    this.cockpit = cockpit;
    this.driverEyeOffset.copy(cockpit.driverEyeOffset);
    if (this.mode === CameraViewMode.COCKPIT) {
      this.camera.fov = cockpit.verticalFov;
      this.camera.updateProjectionMatrix();
    }
  }

  setRearView(active: boolean): void {
    this.isRearViewActive = active;
  }

  reset(): void {
    this.currentCameraPos.set(0, 0, 0);
    this.currentCameraLookAt.set(0, 0, 0);
  }

  cycleView(): void {
    this.mode =
      this.mode === CameraViewMode.COCKPIT
        ? CameraViewMode.CHASE
        : CameraViewMode.COCKPIT;

    // Adjust camera FOV for view mode: wide immersive FOV for cockpit, standard 60 for chase
    this.camera.fov =
      this.mode === CameraViewMode.COCKPIT ? (this.cockpit?.verticalFov ?? 82) : 60;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const chassisPos = this.vehicle.chassisBody.translation();
    const chassisRot = this.vehicle.chassisBody.rotation();
    const carPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);
    const carQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);

    const telemetry = this.vehicle.getTelemetry();
    const speedKmh = Math.abs(telemetry.speedKmh);

    if (this.mode === CameraViewMode.COCKPIT) {
      this.updateCockpitView(dt, carPos, carQuat, telemetry.longitudinalG, speedKmh);
    } else {
      this.updateChaseView(dt, carPos, carQuat);
    }
  }

  private updateCockpitView(
    _dt: number,
    carPos: THREE.Vector3,
    carQuat: THREE.Quaternion,
    _longG: number,
    _speedKmh: number
  ): void {
    // 1. World position of driver eye (strictly anchored inside cockpit, zero position lag)
    const eyeLocal = this.driverEyeOffset.clone().applyQuaternion(carQuat);
    const eyeWorld = carPos.clone().add(eyeLocal);
    this.camera.position.copy(eyeWorld);

    // 2. Rear-View Mirror Mode vs Forward View
    // Align camera's up vector with the car's local roof vector
    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuat);
    this.camera.up.copy(carUp);

    if (this.isRearViewActive) {
      // Mount camera at the rear exterior of the car (above rear bumper / swan-neck wing looking backward -Z)
      // Completely clear of interior cabin, bucket seats, and roll cage
      const rearMountOffset = new THREE.Vector3(0, 1.15, -2.35).applyQuaternion(carQuat);
      const rearCamPos = carPos.clone().add(rearMountOffset);
      this.camera.position.copy(rearCamPos);

      const rearLookVec = new THREE.Vector3(0, -0.05, -50).applyQuaternion(carQuat);
      const targetLookAt = rearCamPos.clone().add(rearLookVec);
      this.camera.lookAt(targetLookAt);
    } else {
      // 1. World position of driver eye (strictly anchored inside cockpit, zero position lag)
      const eyeLocal = this.driverEyeOffset.clone().applyQuaternion(carQuat);
      const eyeWorld = carPos.clone().add(eyeLocal);
      this.camera.position.copy(eyeWorld);

      // Orient camera facing forward (+Z in car space, fixed sightline onto apexes and full steering wheel assembly)
      const forwardVec = new THREE.Vector3(0, -3.4, 30).applyQuaternion(carQuat);
      const targetLookAt = eyeWorld.clone().add(forwardVec);
      this.camera.lookAt(targetLookAt);
    }
  }

  private updateChaseView(dt: number, carPos: THREE.Vector3, carQuat: THREE.Quaternion): void {
    const isRear = this.isRearViewActive;
    // In chase mode, if looking rear, place camera in front looking backward at vehicle
    const activeChaseOffset = isRear
      ? new THREE.Vector3(0, 1.8, 5.5)
      : this.chaseOffset;
    const activeChaseLook = isRear
      ? new THREE.Vector3(0, 0.8, -4.0)
      : this.chaseLookAhead;

    // Target position
    const offset = activeChaseOffset.clone().applyQuaternion(carQuat);
    const targetPos = carPos.clone().add(offset);

    // Target look-at
    const lookOffset = activeChaseLook.clone().applyQuaternion(carQuat);
    const targetLook = carPos.clone().add(lookOffset);

    // Snap immediately on first frame or after reset
    if (this.currentCameraPos.lengthSq() === 0) {
      this.currentCameraPos.copy(targetPos);
      this.currentCameraLookAt.copy(targetLook);
    } else {
      // Smooth camera damping
      this.currentCameraPos.lerp(targetPos, 1 - Math.exp(-10 * dt));
      this.currentCameraLookAt.lerp(targetLook, 1 - Math.exp(-12 * dt));
    }

    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuat);
    this.camera.up.copy(carUp);
    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentCameraLookAt);
  }
}
