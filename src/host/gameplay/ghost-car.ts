import * as THREE from 'three';
import { lerp } from '../../common/math';

export interface GhostKeyframe {
  timeMs: number;
  distanceM: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  steerRad: number;
}

/**
 * Local Ghost Car Recording & Playback System.
 * Captures 30 Hz vehicle trajectory keyframes during each timed lap, promotes the fastest
 * valid lap to the active Ghost Car, persists to localStorage per circuit, and interpolates
 * a translucent holographic 3D ghost car in real time.
 */
export class GhostCarManager {
  public readonly meshGroup = new THREE.Group();
  private wheelGroups: THREE.Group[] = [];
  private currentRecording: GhostKeyframe[] = [];
  private bestLapRecording: GhostKeyframe[] = [];
  private bestLapDurationMs: number | null = null;
  private lastRecordTimeMs = -1000;
  private isEnabled = true;
  private currentTrackId = 'nordschleife';

  private ghostMaterials: THREE.Material[] = [];
  private tempPos0 = new THREE.Vector3();
  private tempPos1 = new THREE.Vector3();
  private tempQuat0 = new THREE.Quaternion();
  private tempQuat1 = new THREE.Quaternion();
  private interpolatedPos = new THREE.Vector3();
  private interpolatedQuat = new THREE.Quaternion();

  constructor(scene?: THREE.Scene, trackId = 'nordschleife') {
    this.currentTrackId = trackId;
    this.meshGroup.name = 'Local_Ghost_Car_Rig';
    this.meshGroup.visible = false;
    this.buildGhostCarMesh();
    if (scene) {
      scene.add(this.meshGroup);
    }
    this.loadFromStorage(trackId);
  }

  private buildGhostCarMesh(): void {
    const holoBodyMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const holoAccentMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.50,
      wireframe: false,
      depthWrite: false,
    });
    const holoWheelMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    this.ghostMaterials.push(holoBodyMat, holoAccentMat, holoWheelMat);

    // Lower chassis tub
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.36, 4.46), holoBodyMat);
    tub.position.set(0, 0.22, 0);
    this.meshGroup.add(tub);

    // Sculpted GT cabin greenhouse
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.44, 1.95), holoBodyMat);
    cabin.position.set(0, 0.62, -0.18);
    this.meshGroup.add(cabin);

    // Front splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.04, 0.45), holoAccentMat);
    splitter.position.set(0, 0.06, 2.15);
    this.meshGroup.add(splitter);

    // Iconic RSR Swan-Neck Rear Wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.90, 0.04, 0.38), holoAccentMat);
    wing.position.set(0, 1.12, -2.05);
    this.meshGroup.add(wing);

    const endplateGeo = new THREE.BoxGeometry(0.03, 0.32, 0.46);
    const leftPlate = new THREE.Mesh(endplateGeo, holoAccentMat);
    leftPlate.position.set(-0.95, 1.08, -2.05);
    const rightPlate = new THREE.Mesh(endplateGeo, holoAccentMat);
    rightPlate.position.set(0.95, 1.08, -2.05);
    this.meshGroup.add(leftPlate, rightPlate);

    // 4 Ghost Wheels
    const wheelOffsets: [number, number, number][] = [
      [-0.85, 0.0, 1.40],
      [0.85, 0.0, 1.40],
      [-0.84, 0.0, -1.08],
      [0.84, 0.0, -1.08],
    ];
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.30, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    for (const [wx, wy, wz] of wheelOffsets) {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      const wm = new THREE.Mesh(wheelGeo, holoWheelMat);
      wg.add(wm);
      this.wheelGroups.push(wg);
      this.meshGroup.add(wg);
    }
  }

  public setTrackId(trackId: string): void {
    this.currentTrackId = trackId;
    this.currentRecording = [];
    this.bestLapRecording = [];
    this.bestLapDurationMs = null;
    this.lastRecordTimeMs = -1000;
    this.meshGroup.visible = false;
    this.loadFromStorage(trackId);
  }

  public setTrackKey(trackKey: string): void {
    this.setTrackId(trackKey);
  }

  public startLapRecording(): void {
    this.resetCurrentLap();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.meshGroup.visible = false;
    }
  }

  public setPlaybackEnabled(enabled: boolean): void {
    this.setEnabled(enabled);
  }

  public isGhostEnabled(): boolean {
    return this.isEnabled;
  }

  public isPlaybackEnabled(): boolean {
    return this.isEnabled;
  }

  public toggleEnabled(): boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public hasBestGhost(): boolean {
    return this.bestLapRecording.length >= 2;
  }

  public getBestLapDurationMs(): number | null {
    return this.bestLapDurationMs;
  }

  public getBestLapFrameCount(): number {
    return this.bestLapRecording.length;
  }

  public getCurrentRecordingCount(): number {
    return this.currentRecording.length;
  }

  /**
   * Records a vehicle state sample at ~30 Hz during an active timed lap.
   */
  public recordSample(
    lapTimeMs: number,
    distanceM: number,
    position: { x: number; y: number; z: number } | [number, number, number],
    rotation: { x: number; y: number; z: number; w: number } | [number, number, number, number],
    steerRad = 0,
    _wheelSpinRad = 0
  ): void {
    if (lapTimeMs < 0) return;

    // Detect lap reset / new lap start
    if (lapTimeMs < this.lastRecordTimeMs - 500) {
      this.currentRecording = [];
      this.lastRecordTimeMs = -1000;
    }

    // Sample at 30 Hz (every 33 ms)
    if (lapTimeMs - this.lastRecordTimeMs < 32 && this.currentRecording.length > 0) {
      return;
    }

    const px = Array.isArray(position) ? position[0] : position.x;
    const py = Array.isArray(position) ? position[1] : position.y;
    const pz = Array.isArray(position) ? position[2] : position.z;

    const rx = Array.isArray(rotation) ? rotation[0] : rotation.x;
    const ry = Array.isArray(rotation) ? rotation[1] : rotation.y;
    const rz = Array.isArray(rotation) ? rotation[2] : rotation.z;
    const rw = Array.isArray(rotation) ? rotation[3] : rotation.w;

    this.lastRecordTimeMs = lapTimeMs;
    this.currentRecording.push({
      timeMs: Math.round(lapTimeMs),
      distanceM: Number(distanceM.toFixed(2)),
      x: Number(px.toFixed(3)),
      y: Number(py.toFixed(3)),
      z: Number(pz.toFixed(3)),
      qx: Number(rx.toFixed(4)),
      qy: Number(ry.toFixed(4)),
      qz: Number(rz.toFixed(4)),
      qw: Number(rw.toFixed(4)),
      steerRad: Number(steerRad.toFixed(3)),
    });
  }

  /**
   * Called when a lap completes. If valid and faster than previous best, promotes recording to Ghost Car.
   */
  public commitLap(lapDurationMs: number, isValid: boolean): boolean {
    const recorded = this.currentRecording;
    this.currentRecording = [];
    this.lastRecordTimeMs = -1000;

    if (!isValid || recorded.length < 2) {
      return false;
    }

    if (this.bestLapDurationMs === null || lapDurationMs < this.bestLapDurationMs) {
      this.bestLapDurationMs = lapDurationMs;
      this.bestLapRecording = recorded;
      this.saveToStorage();
      return true;
    }

    return false;
  }

  public onLapCompleted(lapDurationMs: number, isValid: boolean): boolean {
    return this.commitLap(lapDurationMs, isValid);
  }

  public updatePlayback(lapTimeMs: number): void {
    this.sampleGhostAtTime(lapTimeMs);
  }

  public samplePoseAtTime(lapTimeMs: number): {
    pos: [number, number, number];
    quat: [number, number, number, number];
    distanceM: number;
    steerRad: number;
  } | null {
    const res = this.sampleGhostAtTime(lapTimeMs);
    if (!res) return null;
    return {
      pos: [res.position.x, res.position.y, res.position.z],
      quat: [res.quaternion.x, res.quaternion.y, res.quaternion.z, res.quaternion.w],
      distanceM: res.distanceM,
      steerRad: res.steerRad,
    };
  }

  /**
   * Interpolates the Ghost Car pose at `lapTimeMs` and updates its 3D mesh transform.
   */
  public sampleGhostAtTime(lapTimeMs: number): {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    distanceM: number;
    steerRad: number;
  } | null {
    if (!this.isEnabled || this.bestLapRecording.length < 2 || lapTimeMs <= 0) {
      this.meshGroup.visible = false;
      return null;
    }

    const frames = this.bestLapRecording;
    const totalFrames = frames.length;
    const maxTime = frames[totalFrames - 1].timeMs;

    if (lapTimeMs > maxTime + 1500) {
      this.meshGroup.visible = false;
      return null;
    }

    // Binary search for surrounding keyframes [i0, i1]
    let low = 0;
    let high = totalFrames - 1;
    while (low < high - 1) {
      const mid = (low + high) >> 1;
      if (frames[mid].timeMs <= lapTimeMs) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const f0 = frames[low];
    const f1 = frames[high];
    const span = Math.max(1, f1.timeMs - f0.timeMs);
    const alpha = Math.max(0, Math.min(1, (lapTimeMs - f0.timeMs) / span));

    this.tempPos0.set(f0.x, f0.y, f0.z);
    this.tempPos1.set(f1.x, f1.y, f1.z);
    this.interpolatedPos.lerpVectors(this.tempPos0, this.tempPos1, alpha);

    this.tempQuat0.set(f0.qx, f0.qy, f0.qz, f0.qw);
    this.tempQuat1.set(f1.qx, f1.qy, f1.qz, f1.qw);
    this.interpolatedQuat.slerpQuaternions(this.tempQuat0, this.tempQuat1, alpha);

    const distanceM = lerp(f0.distanceM, f1.distanceM, alpha);
    const steerRad = lerp(f0.steerRad, f1.steerRad, alpha);

    this.meshGroup.visible = true;
    this.meshGroup.position.copy(this.interpolatedPos);
    this.meshGroup.quaternion.copy(this.interpolatedQuat);

    // Rotate front ghost wheels with steer angle
    if (this.wheelGroups.length >= 2) {
      this.wheelGroups[0].rotation.y = steerRad;
      this.wheelGroups[1].rotation.y = steerRad;
    }

    return {
      position: this.interpolatedPos,
      quaternion: this.interpolatedQuat,
      distanceM,
      steerRad,
    };
  }

  /**
   * Phase 5 Step 5.6: Returns current world position of active personal best ghost car
   * for radar minimap and cockpit micro-radar rendering.
   */
  public getCurrentPosition(): THREE.Vector3 | null {
    if (!this.isEnabled || !this.meshGroup.visible || !this.hasBestGhost()) {
      return null;
    }
    return this.interpolatedPos.clone();
  }

  public resetCurrentLap(): void {
    this.currentRecording = [];
    this.lastRecordTimeMs = -1000;
    this.meshGroup.visible = false;
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      // Sub-sample if huge to stay well under localStorage quota
      const step = Math.max(1, Math.ceil(this.bestLapRecording.length / 1800));
      const compact = this.bestLapRecording.filter((_, idx) => idx % step === 0 || idx === this.bestLapRecording.length - 1);
      const payload = JSON.stringify({
        durationMs: this.bestLapDurationMs,
        frames: compact,
      });
      localStorage.setItem(`ghost_best_${this.currentTrackId}`, payload);
    } catch {
      // Ignore storage quota errors in headless or private browsing
    }
  }

  private loadFromStorage(trackId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(`ghost_best_${trackId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.frames) && parsed.frames.length >= 2) {
        this.bestLapDurationMs = parsed.durationMs;
        this.bestLapRecording = parsed.frames;
      }
    } catch {
      // Ignore parse errors
    }
  }

  public dispose(): void {
    if (this.meshGroup.parent) {
      this.meshGroup.parent.remove(this.meshGroup);
    }
    for (const mat of this.ghostMaterials) {
      mat.dispose();
    }
  }
}
