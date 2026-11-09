import * as THREE from 'three';
import { TrackMode } from '../../common/types';

export type StartFormat = 'standing_f1_5lights' | 'rolling_3lights';

export interface RaceStartState {
  format: StartFormat;
  phase: string;
  lightsCount: number; // 0..5 for standing, 0..3 for rolling
  isLightsOut: boolean;
  isGreenFlag: boolean;
  controlsLocked: boolean;
  speedGovernorActive: boolean;
  governorTargetKmh: number;
  jumpStartInfraction: boolean;
  bannerText: string;
  visible: boolean;
}

/**
 * RaceProcedureDirector (Phase 4):
 * Manages format-specific race start sequences:
 * 1. Grand Prix Standing Start (FIA F1 5-Red-Light sequence with random hold & jump-start detection)
 * 2. Nürburgring Nordschleife Rolling Start (Double-file formation rolling approach with 60-80 km/h speed governor & 3-light floating countdown)
 * 3. Overhead 3D World Space Gantry with dynamic light pods in Three.js
 */
export class RaceProcedureDirector {
  private format: StartFormat;
  private track: TrackMode;

  // Standing Start timing & state
  private standingPhase: 'GRID_FORMED' | 'LIGHT_1' | 'LIGHT_2' | 'LIGHT_3' | 'LIGHT_4' | 'LIGHT_5' | 'HOLD_DELAY' | 'LIGHTS_OUT' | 'RACING' = 'GRID_FORMED';
  private timer = 0;
  private randomHoldDuration = 1.2; // 0.4s to 2.4s
  private initialSpawnPosition: THREE.Vector3 = new THREE.Vector3();
  private maxAllowedCreepM = 0.25; // FIA Jump Start threshold (0.25m)
  private hasJumpStarted = false;

  // Rolling Start state
  private rollingPhase: 'FORMATION' | 'LIGHT_1' | 'LIGHT_2' | 'LIGHT_3' | 'GREEN_FLAG' | 'RACING' = 'FORMATION';
  private governorTargetKmh = 70.0; // 60-80 km/h pack governor
  private greenFlagTimer = 0;

  // 3D Gantry in Three.js Scene
  public gantryGroup: THREE.Group = new THREE.Group();
  private lightMaterials: THREE.MeshStandardMaterial[] = [];
  private gantryLightBeams: THREE.PointLight[] = [];

  private isStarted = false;
  private isFinished = false;

  constructor(scene: THREE.Scene, track: TrackMode, forcedFormat?: StartFormat) {
    this.track = track;

    // All circuits strictly enforce standing F1 5-red-light starts (rolling starts removed)
    this.format = forcedFormat === 'rolling_3lights' ? 'standing_f1_5lights' : (forcedFormat ?? 'standing_f1_5lights');

    this.initGantry();
    scene.add(this.gantryGroup);
  }

  /**
   * Initializes overhead 3D world gantry spanning above the track tarmac.
   */
  private initGantry(): void {
    this.gantryGroup.name = 'Race_Start_Gantry';
    const is5Light = this.format === 'standing_f1_5lights';
    const numLights = is5Light ? 5 : 3;

    // Gantry framework frame (Black anodized aluminum truss)
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.85,
      roughness: 0.35,
    });
    const podHousingMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.9,
      roughness: 0.2,
    });

    const gantryWidth = is5Light ? 14.0 : 9.0;
    const trussCrossbar = new THREE.Mesh(
      new THREE.BoxGeometry(gantryWidth, 0.45, 0.6),
      trussMat
    );
    trussCrossbar.position.set(0, 6.2, 0);
    this.gantryGroup.add(trussCrossbar);

    // Left and Right support pylons
    const leftPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6.4, 12), trussMat);
    leftPylon.position.set(-gantryWidth / 2, 3.2, 0);
    this.gantryGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6.4, 12), trussMat);
    rightPylon.position.set(gantryWidth / 2, 3.2, 0);
    this.gantryGroup.add(rightPylon);

    // Create Light Pods
    const podSpacing = is5Light ? 1.8 : 2.2;
    const startX = -((numLights - 1) * podSpacing) / 2;

    this.lightMaterials = [];
    this.gantryLightBeams = [];

    for (let i = 0; i < numLights; i++) {
      const podGroup = new THREE.Group();
      podGroup.position.set(startX + i * podSpacing, 5.8, 0);

      // Black rectangular beacon box
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.4), podHousingMat);
      podGroup.add(box);

      // Circular LED lens
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x27272a,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        roughness: 0.2,
        metalness: 0.1,
      });
      const lensGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 24);
      lensGeo.rotateX(Math.PI / 2);
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.position.set(0, 0, 0.18);
      podGroup.add(lensMesh);

      // Focused glow point light
      const pLight = new THREE.PointLight(0xff0000, 0, 15, 1.2);
      pLight.position.set(0, 0, 0.4);
      podGroup.add(pLight);

      this.lightMaterials.push(lensMat);
      this.gantryLightBeams.push(pLight);
      this.gantryGroup.add(podGroup);
    }
  }

  /**
   * Positions the 3D gantry at a specific track coordinate and orientation.
   */
  public setGantryTransform(position: THREE.Vector3, tangent: THREE.Vector3): void {
    this.gantryGroup.position.copy(position);
    const yaw = Math.atan2(tangent.x, tangent.z);
    this.gantryGroup.rotation.set(0, yaw, 0);
  }

  /**
   * Begins the race start procedure at car's current position.
   */
  public startProcedure(carSpawnPosition: THREE.Vector3): void {
    this.isStarted = true;
    this.isFinished = false;
    this.timer = 0;
    this.hasJumpStarted = false;
    this.initialSpawnPosition.copy(carSpawnPosition);

    if (this.format === 'standing_f1_5lights') {
      this.standingPhase = 'GRID_FORMED';
      this.randomHoldDuration = 0.4 + Math.random() * 2.0; // FIA variable pause 0.4s - 2.4s
      this.setAllLights(0, 0x000000, 0);
    } else {
      this.rollingPhase = 'FORMATION';
      this.greenFlagTimer = 0;
      this.setAllLights(0, 0x000000, 0);
    }
  }

  /**
   * Steps the race start sequence.
   * @param dt Frame delta time in seconds
   * @param currentCarPos Current car 3D position
   * @param speedKmh Current car speed in km/h
   * @param distToStartFinish Distance in meters to start/finish line (negative before line, positive after)
   */
  public update(
    dt: number,
    currentCarPos: THREE.Vector3,
    speedKmh: number,
    distToStartFinish: number = 0.0
  ): RaceStartState {
    if (!this.isStarted) {
      return this.getState();
    }

    if (this.format === 'standing_f1_5lights') {
      this.updateStandingStart(dt, currentCarPos);
    } else {
      this.updateRollingStart(dt, currentCarPos, speedKmh, distToStartFinish);
    }

    return this.getState();
  }

  /**
   * Grand Prix 5-Red-Light Standing Start State Machine
   */
  private updateStandingStart(dt: number, currentCarPos: THREE.Vector3): void {
    if (this.isFinished) return;

    this.timer += dt;

    // Jump-start detection: Forward movement > 0.25m before lights out
    if (this.standingPhase !== 'LIGHTS_OUT' && this.standingPhase !== 'RACING') {
      const forwardDisplacement = currentCarPos.distanceTo(this.initialSpawnPosition);
      if (forwardDisplacement > this.maxAllowedCreepM) {
        this.hasJumpStarted = true;
      }
    }

    // State Transitions
    if (this.timer < 1.0) {
      this.standingPhase = 'GRID_FORMED';
      this.setLightsCount(0, 0xef4444, 0);
    } else if (this.timer < 2.0) {
      this.standingPhase = 'LIGHT_1';
      this.setLightsCount(1, 0xef4444, 7.0);
    } else if (this.timer < 3.0) {
      this.standingPhase = 'LIGHT_2';
      this.setLightsCount(2, 0xef4444, 7.0);
    } else if (this.timer < 4.0) {
      this.standingPhase = 'LIGHT_3';
      this.setLightsCount(3, 0xef4444, 7.0);
    } else if (this.timer < 5.0) {
      this.standingPhase = 'LIGHT_4';
      this.setLightsCount(4, 0xef4444, 7.0);
    } else if (this.timer < 5.0 + this.randomHoldDuration) {
      this.standingPhase = 'HOLD_DELAY';
      this.setLightsCount(5, 0xef4444, 8.5);
    } else if (this.timer < 5.0 + this.randomHoldDuration + 3.0) {
      // LIGHTS OUT! Simultaneous extinction of all 5 red lights -> GREEN FLAG CONDITION
      this.standingPhase = 'LIGHTS_OUT';
      this.setAllLights(0, 0x000000, 0);
    } else {
      this.standingPhase = 'RACING';
      this.isFinished = true;
    }
  }

  /**
   * Nürburgring Nordschleife Rolling Start 3-Light Sequence
   */
  private updateRollingStart(
    dt: number,
    _currentCarPos: THREE.Vector3,
    _speedKmh: number,
    distToStartFinish: number = 0.0
  ): void {
    if (this.isFinished) return;

    // Rolling formation distance triggers approaching Start/Finish line
    // distToStartFinish is negative as car approaches start line (e.g. -350m -> 0m)
    const distBeforeLine = -distToStartFinish;

    if (distBeforeLine > 300.0) {
      this.rollingPhase = 'FORMATION';
      this.setAllLights(0, 0x000000, 0);
    } else if (distBeforeLine > 200.0) {
      this.rollingPhase = 'LIGHT_1';
      // Light 1: Amber/Red '3'
      this.setLightsCount(1, 0xf97316, 7.0);
    } else if (distBeforeLine > 100.0) {
      this.rollingPhase = 'LIGHT_2';
      // Light 2: Amber/Red '2'
      this.setLightsCount(2, 0xf97316, 7.0);
    } else if (distBeforeLine > 0.0) {
      this.rollingPhase = 'LIGHT_3';
      // Light 3: Amber/Red '1'
      this.setLightsCount(3, 0xf97316, 8.0);
    } else {
      // Crossed Start/Finish Line -> Flashing Green Flag!
      this.rollingPhase = 'GREEN_FLAG';
      this.greenFlagTimer += dt;

      // Pulse flashing green for 4 seconds
      const isGreenBlink = Math.floor(this.greenFlagTimer * 4) % 2 === 0;
      this.setAllLights(3, 0x22c55e, isGreenBlink ? 9.0 : 3.0);

      if (this.greenFlagTimer >= 4.5) {
        this.rollingPhase = 'RACING';
        this.setAllLights(0, 0x000000, 0);
        this.isFinished = true;
      }
    }
  }

  /**
   * Sets count of illuminated lights from left to right.
   */
  private setLightsCount(count: number, colorHex: number, intensity: number): void {
    for (let i = 0; i < this.lightMaterials.length; i++) {
      const mat = this.lightMaterials[i];
      const light = this.gantryLightBeams[i];
      if (i < count) {
        mat.color.setHex(colorHex);
        mat.emissive.setHex(colorHex);
        mat.emissiveIntensity = intensity;
        if (light) {
          light.color.setHex(colorHex);
          light.intensity = intensity * 1.5;
        }
      } else {
        mat.color.setHex(0x27272a);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
        if (light) light.intensity = 0;
      }
    }
  }

  private setAllLights(count: number, colorHex: number, intensity: number): void {
    this.setLightsCount(count, colorHex, intensity);
  }

  /**
   * Applies automated speed governor and launch lock to user inputs.
   */
  public filterInputs(
    throttle: number,
    brake: number,
    speedKmh: number
  ): { throttle: number; brake: number; isGoverned: boolean } {
    if (!this.isStarted || this.isFinished) {
      return { throttle, brake, isGoverned: false };
    }

    if (this.format === 'standing_f1_5lights') {
      // Locked brakes and throttle limiter before lights out
      if (this.standingPhase !== 'LIGHTS_OUT' && this.standingPhase !== 'RACING') {
        return {
          throttle: Math.min(throttle, 0.15), // allow revving up for launch control
          brake: 1.0,                         // launch clamp brakes locked
          isGoverned: true,
        };
      }
    } else {
      // Formation lap speed governor on Nordschleife / 24h
      if (this.rollingPhase !== 'GREEN_FLAG' && this.rollingPhase !== 'RACING') {
        if (speedKmh > this.governorTargetKmh + 2.0) {
          return { throttle: 0.0, brake: 0.35, isGoverned: true };
        } else if (speedKmh > this.governorTargetKmh - 1.0) {
          return { throttle: 0.15, brake: 0.0, isGoverned: true };
        } else {
          return { throttle: Math.max(throttle, 0.45), brake: 0.0, isGoverned: true };
        }
      }
    }

    return { throttle, brake, isGoverned: false };
  }

  /**
   * Returns current start sequence state for HUD rendering.
   */
  public getState(): RaceStartState {
    let phase = '';
    let lightsCount = 0;
    let isLightsOut = false;
    let isGreenFlag = false;
    let controlsLocked = false;
    let speedGovernorActive = false;
    let bannerText = '';

    if (this.format === 'standing_f1_5lights') {
      phase = this.standingPhase;
      switch (this.standingPhase) {
        case 'GRID_FORMED':
          lightsCount = 0;
          controlsLocked = true;
          bannerText = 'GRID FORMED • LAUNCH CLAMP ACTIVE';
          break;
        case 'LIGHT_1':
          lightsCount = 1;
          controlsLocked = true;
          bannerText = '1 RED LIGHT';
          break;
        case 'LIGHT_2':
          lightsCount = 2;
          controlsLocked = true;
          bannerText = '2 RED LIGHTS';
          break;
        case 'LIGHT_3':
          lightsCount = 3;
          controlsLocked = true;
          bannerText = '3 RED LIGHTS';
          break;
        case 'LIGHT_4':
          lightsCount = 4;
          controlsLocked = true;
          bannerText = '4 RED LIGHTS';
          break;
        case 'LIGHT_5':
        case 'HOLD_DELAY':
          lightsCount = 5;
          controlsLocked = true;
          bannerText = 'STANDBY FOR LIGHTS OUT';
          break;
        case 'LIGHTS_OUT':
          lightsCount = 0;
          isLightsOut = true;
          isGreenFlag = true;
          controlsLocked = false;
          bannerText = 'LIGHTS OUT • GREEN FLAG!';
          break;
        case 'RACING':
          isGreenFlag = true;
          bannerText = 'RACE ACTIVE';
          break;
      }
    } else {
      phase = this.rollingPhase;
      speedGovernorActive = this.rollingPhase !== 'GREEN_FLAG' && this.rollingPhase !== 'RACING';
      switch (this.rollingPhase) {
        case 'FORMATION':
          lightsCount = 0;
          bannerText = `FORMATION LAP • SPEED GOVERNOR ${Math.round(this.governorTargetKmh)} KM/H`;
          break;
        case 'LIGHT_1':
          lightsCount = 1;
          bannerText = '300M TO START • COUNTDOWN 3';
          break;
        case 'LIGHT_2':
          lightsCount = 2;
          bannerText = '200M TO START • COUNTDOWN 2';
          break;
        case 'LIGHT_3':
          lightsCount = 3;
          bannerText = '100M TO START • COUNTDOWN 1';
          break;
        case 'GREEN_FLAG':
          lightsCount = 3;
          isGreenFlag = true;
          bannerText = 'GREEN FLAG • GO GO GO!';
          break;
        case 'RACING':
          isGreenFlag = true;
          bannerText = 'RACE ACTIVE';
          break;
      }
    }

    if (this.hasJumpStarted) {
      bannerText = '⚠️ JUMP START PENALTY (+10.0s)';
    }

    return {
      format: this.format,
      phase,
      lightsCount,
      isLightsOut,
      isGreenFlag,
      controlsLocked,
      speedGovernorActive,
      governorTargetKmh: this.governorTargetKmh,
      jumpStartInfraction: this.hasJumpStarted,
      bannerText,
      visible: this.isStarted && !this.isFinished,
    };
  }

  public getFormat(): StartFormat {
    return this.format;
  }

  public getTrack(): TrackMode {
    return this.track;
  }

  public getHasJumpStarted(): boolean {
    return this.hasJumpStarted;
  }

  public isProcedureActive(): boolean {
    if (!this.isStarted || this.isFinished) return false;
    if (this.format === 'standing_f1_5lights') {
      return this.standingPhase !== 'LIGHTS_OUT' && this.standingPhase !== 'RACING';
    } else {
      return this.rollingPhase !== 'GREEN_FLAG' && this.rollingPhase !== 'RACING';
    }
  }

  public dispose(): void {
    if (this.gantryGroup.parent) {
      this.gantryGroup.parent.remove(this.gantryGroup);
    }
  }
}
