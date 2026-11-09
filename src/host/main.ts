import * as THREE from 'three';
import { PhysicsWorld } from './physics/world';
import { RaycastVehicle } from './physics/raycast-vehicle';
import { RenderStage } from './render/stage';
import { SkidpadArena } from './render/arena';
import { CarMeshRig } from './render/car-mesh';
import { DynamicCameraController, CameraViewMode } from './render/cockpit-cam';
import { RearViewMirrorRenderer } from './render/cockpit/rear-view-mirror';
import { HostHud } from './render/hud';
import { EngineAudioSynth } from './audio/engine-synth';
import { HostNetworkBridge } from './net/host-server';
import { CarProfile, TrackMode, WeatherCondition } from '../common/types';
import { VehicleRegistry } from '../common/vehicle-registry';
import { ControllerButtons } from '../common/protocol';
import { lerp } from '../common/math';
import { NordschleifeCenterline } from './streaming/centerline';
import { NordschleifeChunkStreamer } from './streaming/chunk-streamer';
import { NordschleifeLapTimer, LapTelemetry } from './streaming/lap-timer';
import { FloatingOriginManager } from './streaming/floating-origin';
import { EifelTerrain } from './render/terrain';
import { ShowroomStage } from './render/showroom-stage';
import { MainMenu } from './ui/main-menu';
import { StadiumAssets } from './render/stadium-assets';
import { CompetitionField, RaceFlagStatus } from './gameplay/competition-field';
import { TrackDryingLine } from './physics/drying-line';
import { EnvironmentManager } from './render/environment-manager';
import { GhostCarManager } from './gameplay/ghost-car';
import { WebRTCMultiplayerLobby } from './net/webrtc-lobby';
import { RaceProcedureDirector } from './gameplay/race-start';

export enum AppState {
  SHOWROOM = 'SHOWROOM',
  RACING = 'RACING',
}

export { TrackMode, RaceFlagStatus };

class HostApplication {
  // Application State Machine (Showroom Turntable vs Racing Track)
  public appState: AppState = AppState.SHOWROOM;
  private showroomStage!: ShowroomStage;
  private mainMenu!: MainMenu;
  private selectedLiveryIndex = 0;
  private selectedCarNumber = '80';
  private carProfile!: CarProfile;

  // Racing physics & rendering components
  private physicsWorld = new PhysicsWorld();
  private vehicle?: RaycastVehicle;
  private stage!: RenderStage;
  public arena!: SkidpadArena;
  public carMesh?: CarMeshRig;
  private cameraCtrl?: DynamicCameraController;
  private hud!: HostHud;
  private audio = new EngineAudioSynth();
  private netBridge!: HostNetworkBridge;
  private rearViewMirror = new RearViewMirrorRenderer();

  // Track mode & Nordschleife streaming (Phase 2 default)
  public currentTrack: TrackMode = TrackMode.NORDSCHLEIFE;
  public centerline?: NordschleifeCenterline;
  public streamer?: NordschleifeChunkStreamer;
  public terrain?: EifelTerrain;
  public lapTimer?: NordschleifeLapTimer;
  public originManager?: FloatingOriginManager;
  private lastSampleIndex = 0;
  private currentLandmarkName = 'T13 / Antoniusbuche (Start/Finish)';
  private latestLapTelemetry?: LapTelemetry;
  public competitionField = new CompetitionField();
  private stadiumAssets?: StadiumAssets;

  // Phase 3 Advanced Motorsport Subsystems
  public dryingLine = new TrackDryingLine(20832.0, 256, 7);
  public environmentManager!: EnvironmentManager;
  public ghostCarManager!: GhostCarManager;
  public webrtcLobby!: WebRTCMultiplayerLobby;
  private lastLapCountForGhost = 0;

  // Phase 4 Race Procedures, Start Sequences & Track Recovery
  public raceDirector?: RaceProcedureDirector;
  private sessionLapCount = 3;
  private sessionMode = 'standard';
  private ghostInvulnerableTimer = 0;
  private rolloverTimer = 0;
  private offTrackStuckTimer = 0;

  // Keyboard fallback state
  private keyState = {
    up: false,
    down: false,
    left: false,
    right: false,
    rearView: false,
  };
  private keyboardSteer = 0;

  // Frame timing & FPS
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private lastFpsUpdateTime = performance.now();
  private currentFps = 60;

  // Physics fixed timestep accumulator (240 Hz)
  private physicsAccumulator = 0;
  private readonly fixedDt = 1.0 / 240.0;

  // Telemetry loop (60 Hz)
  private lastTelemetryTime = 0;

  // 0-100 & 0-200 km/h sprint & top speed tracking
  private sprintStartTime: number | null = null;
  private sprintResult: number | null = null;
  private sprint200Result: number | null = null;
  private isSprintTracking = false;
  private sessionMaxSpeed = 0;

  async start(): Promise<void> {
    console.log('Initializing Dual-Screen Web Racer Host...');

    // 1. Initialize Rapier 3D physics
    await this.physicsWorld.init();

    // 2. Fetch or load vehicle profile
    this.carProfile = await this.loadCarProfile();

    // 3. Setup Three.js rendering stage
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) throw new Error('Missing #canvas-container');
    this.stage = new RenderStage(canvasContainer);

    // 4. Create Skidpad Arena (mesh & physics colliders) and Eifel Mountain Landscape Terrain
    this.arena = new SkidpadArena(this.stage.scene, this.physicsWorld.world, this.physicsWorld.rapier);
    this.arena.setEnabled(false);

    this.terrain = new EifelTerrain();
    this.stage.scene.add(this.terrain.mesh);
    this.terrain.setEnabled(false);

    // 5. Initialize Interactive 3D Swivel Showroom Turntable Stage
    this.showroomStage = new ShowroomStage(canvasContainer);
    this.showroomStage.setEnabled(true);

    // 6. Initialize Dedicated Sim-Racing Main Menu UI
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) throw new Error('Missing #menu-container');

    this.mainMenu = new MainMenu(menuContainer, {
      onStartRace: (trackId, liveryIdx, carNumber, weather, timeOfDay, lapCount, mode) =>
        this.startRace(trackId, liveryIdx, carNumber, weather, timeOfDay, lapCount, mode),
      onLiveryChanged: (idx, carNumber) => {
        this.selectedLiveryIndex = idx;
        this.selectedCarNumber = carNumber;
        this.showroomStage.setLivery(idx);
        this.showroomStage.setCarNumber(carNumber);
      },
      onCarNumberChanged: (carNumber) => {
        this.selectedCarNumber = carNumber;
        this.showroomStage.setCarNumber(carNumber);
      },
      onOpenMultiplayer: () => {
        this.webrtcLobby.openModal();
      },
    });

    // 7. HUD with Minimap Radar (Hidden during Showroom mode)
    const hudContainer = document.getElementById('hud-root');
    if (!hudContainer) throw new Error('Missing #hud-root');
    this.hud = new HostHud(hudContainer);
    this.hud.onExitToMenu = () => this.leaveRaceToMenu();
    this.hud.onPaintCycle = () => {
      if (this.carMesh) {
        const name = this.carMesh.cyclePaintColor();
        this.selectedLiveryIndex = this.carMesh.liveryIndex;
        return name;
      }
      return '';
    };
    this.hud.onCycleWeather = () => {
      const env = this.environmentManager.cycleWeather();
      this.dryingLine.setRainIntensity(env.rainIntensity);
    };
    this.hud.onCycleTimeOfDay = () => {
      this.environmentManager.cycleTimePreset();
    };
    this.hud.onToggleHeadlights = () => {
      if (this.carMesh) {
        const on = this.carMesh.toggleHeadlights();
        this.environmentManager.setManualHeadlights(on);
      }
    };
    this.hud.onToggleGhost = () => {
      const next = !this.ghostCarManager.isPlaybackEnabled();
      this.ghostCarManager.setPlaybackEnabled(next);
    };
    this.hud.onOpenMultiplayerLobby = () => {
      this.webrtcLobby.toggleModal();
    };
    this.hud.hide();

    // 7b. Initialize Phase 3 Subsystems (Environment, Ghost Car, WebRTC P2P)
    this.environmentManager = new EnvironmentManager(
      this.stage.scene,
      this.stage.sunLight,
      this.stage.hemiLight
    );
    this.ghostCarManager = new GhostCarManager(this.stage.scene, this.currentTrack);
    this.webrtcLobby = new WebRTCMultiplayerLobby(this.stage.scene);
    this.webrtcLobby.setPhysicsWorld(this.physicsWorld.world, this.physicsWorld.rapier);
    this.webrtcLobby.onStartQualifying = (cfg) => {
      this.startRace(cfg.circuit, this.selectedLiveryIndex, this.selectedCarNumber, undefined, undefined, 1, 'qualifying');
    };
    this.webrtcLobby.onStartRace = (cfg, gridOrder) => {
      this.startRace(cfg.circuit, this.selectedLiveryIndex, this.selectedCarNumber, undefined, undefined, cfg.lapCount, 'race', gridOrder);
    };

    // 8. Host Network Bridge (WebSocket)
    this.netBridge = new HostNetworkBridge({
      onControllerStatusChange: (connected) => {
        console.log(`Phone controller connected status: ${connected}`);
        this.mainMenu.setPhoneConnected(connected);
      },
      onButtonPress: (buttons) => {
        if (this.appState !== AppState.RACING) return;
        if ((buttons & ControllerButtons.RESET) !== 0) {
          this.respawnCarNearCrash(true);
        }
        if ((buttons & ControllerButtons.CYCLE_CAMERA) !== 0 && this.cameraCtrl) {
          this.cameraCtrl.cycleView();
        }
        if ((buttons & ControllerButtons.START_ENGINE) !== 0) {
          this.audio.startIgnition();
        }
      },
    });
    this.mainMenu.setPhoneConnected(this.netBridge.isPhoneConnected());

    // 9. Bind Keyboard & Gesture Events
    this.bindKeyboardEvents();
    this.setupAudioTrigger();

    (window as any).__racingHost = this;
    (window as any).THREE = THREE;

    // 10. Start RAF main loop
    requestAnimationFrame(this.mainLoop.bind(this));
  }

  public getSessionLapCount(): number {
    return this.sessionLapCount;
  }

  public getSessionMode(): string {
    return this.sessionMode;
  }

  /**
   * Starts a racing session with the chosen track and car livery locked.
   */
  public startRace(
    targetTrack: TrackMode,
    liveryIndex: number,
    carNumber?: string,
    weather?: WeatherCondition,
    timeOfDayHours?: number,
    lapCount?: number,
    mode?: string,
    gridOrder?: string[]
  ): void {
    console.log(`🏁 Launching race session on ${targetTrack} (Livery #${liveryIndex}, #${carNumber || this.selectedCarNumber}, Mode: ${mode || 'standard'})...`);
    this.currentTrack = targetTrack;
    this.selectedLiveryIndex = liveryIndex;
    if (carNumber) {
      this.selectedCarNumber = carNumber;
    }

    // 1. Transition UI and Showroom stage
    this.showroomStage.setEnabled(false);
    this.mainMenu.hide();
    this.hud.show();

    // Apply pre-configured conditions from wizard
    if (weather) {
      this.environmentManager.setWeather(weather);
    }
    if (timeOfDayHours !== undefined) {
      this.environmentManager.setTimeOfDay(timeOfDayHours);
    }
    if (lapCount !== undefined) {
      this.sessionLapCount = lapCount;
    }
    if (mode !== undefined) {
      this.sessionMode = mode;
    }

    // 2. Setup Track environment & Spawn Vehicle
    this.raceDirector = new RaceProcedureDirector(this.stage.scene, this.currentTrack);

    if (this.currentTrack !== TrackMode.PROVING_GROUND) {
      this.terrain?.setEnabled(true);
      this.arena.setEnabled(false);
      this.centerline = new NordschleifeCenterline(this.currentTrack);
      this.streamer = new NordschleifeChunkStreamer(
        this.stage.scene,
        this.physicsWorld.world,
        this.physicsWorld.rapier,
        this.centerline
      );
      this.lapTimer = new NordschleifeLapTimer(this.centerline.totalLengthM);
      this.originManager = new FloatingOriginManager();

      // Position Start Gantry at Start Line (sample 0)
      const sp0 = this.centerline.samples[0];
      this.raceDirector.setGantryTransform(sp0.position, sp0.tangent);

      // Initialize AI Competition Field on Track Spline
      this.competitionField.setCenterline(this.centerline);

      // Initialize authentic 3D GP Stadium Grandstand Architecture if on GP-Strecke
      if (this.currentTrack === TrackMode.GP_STRECKE) {
        this.stadiumAssets = new StadiumAssets(this.centerline.samples);
        this.stage.scene.add(this.stadiumAssets.group);
      }

      // Standing start: spawn in authentic 2x2 grid box behind Start/Finish line (sample 0)
      const spawnYaw = Math.atan2(sp0.tangent.x, sp0.tangent.z);
      this.streamer.update(0);
      this.lastSampleIndex = 0;

      let gridSlot = 0;
      if (gridOrder && gridOrder.length > 0) {
        const idx = gridOrder.indexOf(this.webrtcLobby.getLocalPeerId());
        if (idx !== -1) gridSlot = idx;
      }

      // Staggered 2x2 grid slots behind Start/Finish line
      const slotDistanceBehindLine = 6.0 + gridSlot * 8.0;
      const fwdOffset = sp0.tangent.clone().multiplyScalar(-slotDistanceBehindLine);
      const latSign = gridSlot % 2 === 0 ? -1 : 1;
      const latOffset = new THREE.Vector3(-sp0.tangent.z, 0, sp0.tangent.x).normalize().multiplyScalar(latSign * 1.8);
      const spawnPos = sp0.position.clone().add(fwdOffset).add(latOffset);

      this.vehicle = new RaycastVehicle(
        this.physicsWorld.world,
        this.physicsWorld.rapier,
        this.carProfile,
        { x: spawnPos.x, y: spawnPos.y + 0.6, z: spawnPos.z },
        spawnYaw
      );
      this.vehicle.setReverseLock(true);
      this.raceDirector.startProcedure(new THREE.Vector3(spawnPos.x, spawnPos.y + 0.6, spawnPos.z));
    } else {
      this.terrain?.setEnabled(false);
      this.arena.setEnabled(true);
      this.vehicle = new RaycastVehicle(
        this.physicsWorld.world,
        this.physicsWorld.rapier,
        this.carProfile,
        { x: 0, y: 0.6, z: 0 },
        0
      );
      this.vehicle.setReverseLock(true);
      this.raceDirector.setGantryTransform(new THREE.Vector3(0, 0, 15), new THREE.Vector3(0, 0, 1));
      this.raceDirector.startProcedure(new THREE.Vector3(0, 0.6, 0));
    }

    // 2b. Attach Phase 3 Drying Line & Ghost Car to active track
    const trackLen = this.centerline?.totalLengthM ?? 6000.0;
    this.dryingLine = new TrackDryingLine(trackLen, 256, 7);
    this.dryingLine.setRainIntensity(this.environmentManager.getState().rainIntensity);
    this.vehicle.dryingLine = this.dryingLine;
    this.ghostCarManager.setTrackKey(this.currentTrack);
    this.ghostCarManager.startLapRecording();
    this.lastLapCountForGhost = 0;

    // 3. Visual Car Mesh Rig with selected competition livery
    this.carMesh = new CarMeshRig(this.stage.scene, this.vehicle);
    this.carMesh.setLivery(liveryIndex, this.selectedCarNumber);

    // 4. Dynamic Cockpit Camera
    this.cameraCtrl = new DynamicCameraController(this.stage.camera, this.vehicle, this.carMesh.cockpit);
    this.rearViewMirror.bindScreen(this.carMesh.cockpit.getRearViewScreenMesh?.() ?? null);

    // 5. Configure HUD for active circuit
    if (this.centerline) {
      this.hud.setCenterlineSamples(this.centerline.samples.map((s) => ({ x: s.position.x, z: s.position.z })));
    }
    this.hud.setCurrentTrack(this.currentTrack);
    this.hud.setPaintName(this.carMesh.getPaintName());

    // 6. Ignite audio engine
    this.audio.startIgnition();

    // 7. Lock state to RACING
    this.appState = AppState.RACING;
  }

  /**
   * Leaves active race session, unlocks car/track, and returns to 3D Swivel Showroom.
   */
  public leaveRaceToMenu(): void {
    if (this.appState !== AppState.RACING) return;
    console.log('Returning from race to Showroom Main Menu...');

    // 1. Mute and stop audio synthesis
    this.audio.update(0, 0, 0, 0, 0, false, false, false);

    // 2. Dispose track streamer and colliders
    this.streamer?.dispose();
    this.streamer = undefined;
    this.centerline = undefined;
    this.lapTimer = undefined;
    this.originManager = undefined;
    this.terrain?.setEnabled(false);
    this.arena?.setEnabled(false);

    // Dispose 3D Stadium Architecture
    if (this.stadiumAssets) {
      this.stage.scene.remove(this.stadiumAssets.group);
      this.stadiumAssets.dispose();
      this.stadiumAssets = undefined;
    }

    // Dispose Phase 4 Race Director & Start Sequences
    if (this.raceDirector) {
      this.raceDirector.dispose();
      this.raceDirector = undefined;
    }
    this.ghostInvulnerableTimer = 0;
    this.rolloverTimer = 0;
    this.offTrackStuckTimer = 0;

    // 3. Dispose vehicle & visual mesh
    if (this.carMesh) {
      this.carMesh.dispose();
      this.carMesh = undefined;
    }
    if (this.vehicle) {
      this.vehicle.dispose();
      this.vehicle = undefined;
    }
    this.cameraCtrl = undefined;

    // 4. Hide Racing HUD
    this.hud.hide();

    // 5. Enable Showroom stage & Main Menu
    this.showroomStage.setEnabled(true);
    this.showroomStage.setCarNumber(this.selectedCarNumber);
    this.showroomStage.setLivery(this.selectedLiveryIndex);
    this.mainMenu.setLiveryIndex(this.selectedLiveryIndex);
    this.mainMenu.setPhoneConnected(this.netBridge.isPhoneConnected());
    this.mainMenu.show();

    // 6. Set State to SHOWROOM
    this.appState = AppState.SHOWROOM;
  }

  private async loadCarProfile(): Promise<CarProfile> {
    try {
      const resp = await fetch('/assets/cars/porsche_992_rsr/profile.json');
      if (resp.ok) {
        return (await resp.json()) as CarProfile;
      }
    } catch (e) {
      console.warn('Failed to fetch profile.json, using VehicleRegistry baseline', e);
    }

    return VehicleRegistry.getVehicle('porsche_911_rsr_19_992');
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keydown', (e) => {
      // In Showroom mode: Enter launches race
      if (this.appState === AppState.SHOWROOM) {
        if (e.code === 'Enter') {
          this.startRace(this.mainMenu.getSelectedTrack(), this.mainMenu.getSelectedLiveryIndex());
        }
        return;
      }

      // In Racing mode:
      this.audio.startIgnition();

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keyState.up = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keyState.down = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keyState.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keyState.right = true;
          break;
        case 'KeyC':
          this.cameraCtrl?.cycleView();
          break;
        case 'KeyP': {
          if (this.carMesh) {
            const name = this.carMesh.cyclePaintColor();
            this.selectedLiveryIndex = this.carMesh.liveryIndex;
            this.hud.setPaintName(name);
          }
          break;
        }
        case 'KeyB':
        case 'KeyV':
          this.keyState.rearView = true;
          break;
        case 'KeyF':
          this.competitionField.cycleFlag();
          break;
        case 'KeyU': {
          const env = this.environmentManager.cycleWeather();
          this.dryingLine.setRainIntensity(env.rainIntensity);
          break;
        }
        case 'KeyT':
          this.environmentManager.cycleTimePreset();
          break;
        case 'KeyL':
        case 'KeyH':
          if (this.carMesh) {
            const on = this.carMesh.toggleHeadlights();
            this.environmentManager.setManualHeadlights(on);
          }
          break;
        case 'KeyK':
          this.ghostCarManager.setPlaybackEnabled(!this.ghostCarManager.isPlaybackEnabled());
          break;
        case 'KeyO':
          this.webrtcLobby.toggleModal();
          break;
        case 'KeyG':
          this.webrtcLobby.openGridStagingModal();
          break;
        case 'Escape':
        case 'KeyM':
          // Locked in-race: Must leave to main menu to change track or car!
          this.leaveRaceToMenu();
          break;
        case 'KeyR':
          this.respawnCarNearCrash(true);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.appState !== AppState.RACING) return;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keyState.up = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keyState.down = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keyState.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keyState.right = false;
          break;
        case 'KeyB':
        case 'KeyV':
          this.keyState.rearView = false;
          break;
      }
    });
  }

  private setupAudioTrigger(): void {
    const trigger = () => {
      if (this.appState === AppState.RACING) {
        this.audio.startIgnition();
      }
      window.removeEventListener('click', trigger);
      window.removeEventListener('touchstart', trigger);
    };
    window.addEventListener('click', trigger);
    window.addEventListener('touchstart', trigger);
  }

  private getTrackDisplayName(): string {
    switch (this.currentTrack) {
      case TrackMode.NURBURGRING_24H: return '24h Layout (25.4 km)';
      case TrackMode.NORDSCHLEIFE: return 'Nordschleife (20.8 km)';
      case TrackMode.GP_STRECKE: return 'GP-Strecke (5.1 km)';
      case TrackMode.PROVING_GROUND: return 'Proving Ground Runway';
      default: return 'Track';
    }
  }

  /**
   * Phase 4.5: Smart Near-Crash Track Recovery Respawn.
   * - Projects crash location p_crash onto track centerline spline to find s_crash.
   * - Invariant anti-exploit offset: s_respawn = max(0, s_crash - 8.0m).
   * - Queries centerline at s_respawn for road center p_track, tangent t, and normal n.
   * - Translates vehicle to p_car = p_track + 0.35m * n, facing along tangent t.
   * - Dynamics reset: v = 0, omega = 0, wheel spin = 0, gear = 1.
   * - 3.0s translucent non-colliding ghost invulnerability state with cyan shield aura.
   * - Latches lap timing to invalid (isLapValid = false).
   */
  public respawnCarNearCrash(isManual = true): void {
    if (!this.vehicle) return;

    const chassisPos = this.vehicle.chassisBody.translation();
    const currentPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);

    if (this.currentTrack !== TrackMode.PROVING_GROUND && this.centerline) {
      const proj = this.centerline.projectPosition(currentPos, this.lastSampleIndex);
      const s_crash = proj.distanceMeters;
      const s_respawn = Math.max(0, s_crash - 8.0);

      const sampleIdx = Math.floor(s_respawn / this.centerline.sampleSpacingM);
      const sample = this.centerline.getSample(sampleIdx);

      const normal = sample.normal.clone().normalize();
      const spawnPos = sample.position.clone().addScaledVector(normal, 0.35);
      const tangent = sample.tangent.clone().normalize();
      const spawnYaw = Math.atan2(tangent.x, tangent.z);

      this.vehicle.respawn(spawnPos.x, spawnPos.y, spawnPos.z, spawnYaw);
      this.streamer?.update(s_respawn);
      this.lastSampleIndex = sampleIdx;
    } else {
      const s_crash = Math.max(0, chassisPos.z);
      const s_respawn = Math.max(0, s_crash - 8.0);
      this.vehicle.respawn(0, 0.55, s_respawn, 0);
    }

    // Invalidate current lap on recovery respawn
    this.lapTimer?.invalidateCurrentLap();

    // 3.0s Translucent Ghost Invulnerability with cyan shield aura
    this.ghostInvulnerableTimer = 3.0;
    this.carMesh?.setGhostMode(true);
    this.webrtcLobby.setLocalGhostInvulnerable(true);

    this.cameraCtrl?.reset();
    const triggerLabel = isManual ? 'RESPAWNED NEAR TRACK (-8M)' : 'ROLLOVER RECOVERY (-8M)';
    this.hud.showNotification(`${triggerLabel} • GHOST INVULNERABLE`);
  }

  private getCompositeInputs(dt: number): { steer: number; throttle: number; brake: number } {
    const phoneConnected = this.netBridge.isPhoneConnected();
    const phoneInput = this.netBridge.getLatestInput();

    // Keyboard steering smoothing
    let targetKeySteer = 0;
    if (this.keyState.left) targetKeySteer -= 1.0;
    if (this.keyState.right) targetKeySteer += 1.0;
    this.keyboardSteer = lerp(this.keyboardSteer, targetKeySteer, 1 - Math.exp(-15 * dt));

    const keyThrottle = this.keyState.up ? 1.0 : 0.0;
    const keyBrake = this.keyState.down ? 1.0 : 0.0;

    if (phoneConnected) {
      return {
        steer: Math.abs(phoneInput.steer) > 0.01 ? phoneInput.steer : this.keyboardSteer,
        throttle: Math.max(phoneInput.throttle, keyThrottle),
        brake: Math.max(phoneInput.brake, keyBrake),
      };
    } else {
      return {
        steer: this.keyboardSteer,
        throttle: keyThrottle,
        brake: keyBrake,
      };
    }
  }

  private mainLoop(now: number): void {
    requestAnimationFrame(this.mainLoop.bind(this));

    const frameDelta = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // Calculate FPS
    this.frameCount++;
    if (now - this.lastFpsUpdateTime > 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdateTime));
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
    }

    // 1. STATE: SHOWROOM TURNTABLE STAGE
    if (this.appState === AppState.SHOWROOM) {
      this.showroomStage.updateAndRender(this.stage.renderer, frameDelta);
      return;
    }

    // 2. STATE: ACTIVE RACING ON TRACK
    if (!this.vehicle || !this.carMesh || !this.cameraCtrl) return;

    // Fixed timestep accumulator for 240 Hz Rapier physics
    this.physicsAccumulator += frameDelta;
    const rawInputs = this.getCompositeInputs(frameDelta);
    const speedNow = Math.abs(this.vehicle.getTelemetry().speedKmh);
    const governed = this.raceDirector
      ? this.raceDirector.filterInputs(rawInputs.throttle, rawInputs.brake, speedNow)
      : { throttle: rawInputs.throttle, brake: rawInputs.brake, isGoverned: false };

    // Prevent vehicle from shifting into reverse during race start procedures (standing clamp / formation)
    const isProcedureActive = Boolean(this.raceDirector?.isProcedureActive());
    this.vehicle.setReverseLock(isProcedureActive);

    const inputs = {
      steer: rawInputs.steer,
      throttle: governed.throttle,
      brake: governed.brake,
    };

    // Step 2D dynamic drying line moisture & evaporation
    this.dryingLine.step(frameDelta);

    while (this.physicsAccumulator >= this.fixedDt) {
      this.vehicle.step(this.fixedDt, inputs.steer, inputs.throttle, inputs.brake);
      this.physicsWorld.step();
      this.physicsAccumulator -= this.fixedDt;
    }

    // Telemetry & Physical Metrics
    const telemetry = this.vehicle.getTelemetry();
    const speed = Math.abs(telemetry.speedKmh);
    const chassisPos = this.vehicle.chassisBody.translation();
    const chassisRot = this.vehicle.chassisBody.rotation();

    // Max session speed
    if (speed > this.sessionMaxSpeed) {
      this.sessionMaxSpeed = speed;
    }

    if (this.currentTrack !== TrackMode.PROVING_GROUND && this.centerline && this.streamer && this.lapTimer) {
      const carPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);
      const proj = this.centerline.projectPosition(carPos, this.lastSampleIndex);
      this.lastSampleIndex = Math.floor(proj.distanceMeters / this.centerline.sampleSpacingM);
      const latSign =
        proj.tangent.z * (carPos.x - proj.projectedPosition.x) -
          proj.tangent.x * (carPos.z - proj.projectedPosition.z) >=
        0
          ? 1
          : -1;
      this.vehicle.currentTrackDistanceM = proj.distanceMeters;
      this.vehicle.currentLateralOffsetM = proj.distanceFromCenterlineMeters * latSign;

      // Dynamic 3-chunk window streaming
      this.streamer.update(proj.distanceMeters);

      // Start/finish & 9-Sector lap timing with live delta splits
      this.latestLapTelemetry = this.lapTimer.update(proj.distanceMeters, proj.isOffTrack, now);
      this.currentLandmarkName = proj.landmarkName;

      // Ghost car recording & playback
      if (this.latestLapTelemetry.lapCount > this.lastLapCountForGhost) {
        this.lastLapCountForGhost = this.latestLapTelemetry.lapCount;
        if (this.latestLapTelemetry.lastLapTimeMs) {
          this.ghostCarManager.onLapCompleted(
            this.latestLapTelemetry.lastLapTimeMs,
            this.latestLapTelemetry.isLapValid
          );
          if (this.sessionMode === 'qualifying' && this.latestLapTelemetry.isLapValid) {
            this.webrtcLobby.broadcastQualiResult(
              this.latestLapTelemetry.lastLapTimeMs,
              this.selectedCarNumber
            );
            setTimeout(() => {
              this.webrtcLobby.openGridStagingModal();
            }, 1200);
          }
        }
      }
      this.ghostCarManager.recordSample(
        this.latestLapTelemetry.currentLapTimeMs,
        proj.distanceMeters,
        [chassisPos.x, chassisPos.y, chassisPos.z],
        [chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w],
        this.vehicle.wheels[0].steerAngleRad,
        this.vehicle.wheels[0].angularVelocity * (now * 0.001)
      );
      this.ghostCarManager.updatePlayback(this.latestLapTelemetry.currentLapTimeMs);

      // Update AI Competitor Field Simulation along circuit spline
      this.competitionField.update(proj.distanceMeters, speed, frameDelta);

      telemetry.distanceM = proj.distanceMeters;
      telemetry.lapTimeSeconds = this.latestLapTelemetry.currentLapTimeMs / 1000;
      telemetry.bestLapSeconds = this.latestLapTelemetry.bestLapTimeMs ? this.latestLapTelemetry.bestLapTimeMs / 1000 : null;
      telemetry.liveDeltaMs = this.latestLapTelemetry.liveDeltaMs;
      telemetry.currentSectorIndex = this.latestLapTelemetry.currentSectorIndex;
      telemetry.sectorSplits = this.latestLapTelemetry.sectorSplits;
      telemetry.maxSpeedKmh = this.sessionMaxSpeed;
    } else {
      this.vehicle.currentTrackDistanceM = Math.max(0, chassisPos.z);
      this.vehicle.currentLateralOffsetM = chassisPos.x;
      // Sprint 0-100 & 0-200 km/h tracking
      if (speed < 1.0 && inputs.throttle > 0.8) {
        this.isSprintTracking = true;
        this.sprintStartTime = now;
        this.sprintResult = null;
        this.sprint200Result = null;
      } else if (this.isSprintTracking && this.sprintStartTime !== null) {
        if (speed >= 100.0 && this.sprintResult === null) {
          this.sprintResult = (now - this.sprintStartTime) / 1000;
          console.log(`0-100 km/h Sprint: ${this.sprintResult.toFixed(2)}s`);
        }
        if (speed >= 200.0 && this.sprint200Result === null) {
          this.sprint200Result = (now - this.sprintStartTime) / 1000;
          console.log(`0-200 km/h Sprint: ${this.sprint200Result.toFixed(2)}s`);
        }
      }

      telemetry.sprint0to100Time = this.sprintResult;
      telemetry.sprint0to200Time = this.sprint200Result;
      telemetry.maxSpeedKmh = this.sessionMaxSpeed;
      telemetry.distanceM = Math.max(0, chassisPos.z);
    }

    // Send 60 Hz telemetry packet to phone
    if (now - this.lastTelemetryTime >= 1000 / 60) {
      this.lastTelemetryTime = now;
      this.netBridge.sendTelemetry(
        telemetry.rpmRatio,
        telemetry.gear,
        telemetry.speedKmh,
        telemetry.isShiftLightActive,
        telemetry.isAbsActive,
        telemetry.isTcActive
      );
    }

    // Update 3D car mesh
    this.carMesh.update(frameDelta);

    // Update Rear-View mirror look-behind state from phone controller or keyboard
    const phoneInput = this.netBridge.getLatestInput();
    const phoneRearView = (phoneInput.buttons & ControllerButtons.REAR_VIEW) !== 0;
    this.cameraCtrl.setRearView(phoneRearView || this.keyState.rearView);

    // Update dynamic camera rig
    this.cameraCtrl.update(frameDelta);

    // Step Phase 3.3 Dynamic Environment (Day/Night sun cycle, exterior-only rain particles)
    const linVel = this.vehicle.chassisBody.linvel();
    const envState = this.environmentManager.update(
      frameDelta,
      this.stage.camera.position,
      new THREE.Vector3(linVel.x, linVel.y, linVel.z),
      speed,
      this.cameraCtrl.mode === CameraViewMode.COCKPIT,
      this.dryingLine.getAmbientWetness()
    );
    this.carMesh.setHeadlightsEnabled(envState.headlightsOn);

    // Step Phase 3.4C WebRTC DataChannel P2P Multiplayer
    this.webrtcLobby.update(
      frameDelta,
      [chassisPos.x, chassisPos.y, chassisPos.z],
      [chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w],
      speed,
      this.vehicle.wheels[0].steerAngleRad,
      this.vehicle.wheels[0].angularVelocity * (now * 0.001)
    );

    // Step Phase 4 Race Start Sequence & 3D World Gantry
    if (this.raceDirector) {
      const carPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);
      let distToLine = 0;
      if (this.centerline) {
        const total = this.centerline.totalLengthM;
        distToLine =
          this.vehicle.currentTrackDistanceM > total * 0.5
            ? this.vehicle.currentTrackDistanceM - total
            : this.vehicle.currentTrackDistanceM;
      } else {
        distToLine = chassisPos.z;
      }

      const raceStartState = this.raceDirector.update(frameDelta, carPos, speed, distToLine);
      this.hud.updateRaceStart(raceStartState);
    }

    // Step Phase 4.5 Ghost Invulnerability State
    if (this.ghostInvulnerableTimer > 0) {
      this.ghostInvulnerableTimer -= frameDelta;
      if (this.ghostInvulnerableTimer <= 0) {
        this.ghostInvulnerableTimer = 0;
        this.carMesh.setGhostMode(false);
        this.webrtcLobby.setLocalGhostInvulnerable(false);
      }
    }

    // Step Phase 4.5 Rollover Detection (>78° tilt for >2.5s)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
      new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w)
    );
    if (up.y < 0.20) {
      this.rolloverTimer += frameDelta;
      if (this.rolloverTimer >= 2.5) {
        this.rolloverTimer = 0;
        this.respawnCarNearCrash(false);
      }
    } else {
      this.rolloverTimer = 0;
    }

    // Step Phase 4.5 Barrier stuck detection (off-track stationary for >4.0s)
    if (
      this.currentTrack !== TrackMode.PROVING_GROUND &&
      this.latestLapTelemetry &&
      !this.latestLapTelemetry.isLapValid &&
      speed < 2.0 &&
      this.ghostInvulnerableTimer <= 0
    ) {
      this.offTrackStuckTimer += frameDelta;
      if (this.offTrackStuckTimer >= 4.0) {
        this.offTrackStuckTimer = 0;
        this.respawnCarNearCrash(false);
      }
    } else {
      this.offTrackStuckTimer = 0;
    }

    // Render live in-cockpit digital rear-view mirror & micro radar if in cockpit view
    if (this.cameraCtrl.mode === CameraViewMode.COCKPIT) {
      const carPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);
      const carQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);
      this.rearViewMirror.render(
        this.stage.renderer,
        this.stage.scene,
        carPos,
        carQuat,
        this.carMesh.rootGroup
      );

      const microRadar = this.carMesh.cockpit?.getMicroRadarDisplay?.();
      if (microRadar && this.centerline) {
        const nearbyCars = this.competitionField.getNearbyCars(carPos, 35.0);
        microRadar.update(
          carPos,
          carQuat,
          this.centerline.samples,
          this.lastSampleIndex,
          nearbyCars,
          frameDelta
        );
      }
    }

    // Update motorsport Web Audio synthesis
    const maxSlipAngle = Math.max(...telemetry.wheelSlipAngle.map(Math.abs));
    this.audio.update(
      telemetry.rpm,
      inputs.throttle,
      telemetry.speedKmh,
      telemetry.gear,
      maxSlipAngle,
      telemetry.isShifting ?? false,
      telemetry.isDownshiftBlip ?? false,
      this.cameraCtrl.mode === CameraViewMode.COCKPIT
    );

    // Update HUD overlay
    this.hud.update({
      telemetry,
      fps: this.currentFps,
      phoneConnected: this.netBridge.isPhoneConnected(),
      cameraMode: this.cameraCtrl.mode,
      trackName: this.getTrackDisplayName(),
      landmarkName: this.currentLandmarkName,
      lapTimeMs: this.latestLapTelemetry?.currentLapTimeMs,
      bestLapTimeMs: this.latestLapTelemetry?.bestLapTimeMs,
      lastLapTimeMs: this.latestLapTelemetry?.lastLapTimeMs,
      lapCount: this.latestLapTelemetry?.lapCount,
      isLapValid: this.latestLapTelemetry?.isLapValid,
      sectorSplits: this.latestLapTelemetry?.sectorSplits,
      currentSectorIndex: this.latestLapTelemetry?.currentSectorIndex,
      liveDeltaMs: this.latestLapTelemetry?.liveDeltaMs,
      weatherLabel: envState.weather.replace('_', ' ').toUpperCase(),
      timeOfDayLabel: this.environmentManager.formatTimeOfDay(),
      ghostActive: this.ghostCarManager.hasBestGhost(),
      p2pPeerCount: this.webrtcLobby.getConnectedPeerCount(),
    });

    // Update Live Circuit Radar Minimap with dynamic flags, AI cars, and WebRTC P2P peers
    const opponentDots = this.competitionField.cars.map((c) => ({
      x: c.worldPos.x,
      z: c.worldPos.z,
      color: c.color,
      number: c.number,
    }));
    for (const peer of this.webrtcLobby.getRemotePeers()) {
      opponentDots.push({
        x: peer.pos[0],
        z: peer.pos[2],
        color: '#e11d48',
        number: peer.peerId,
      });
    }
    this.hud.updateMinimap(
      chassisPos.x,
      chassisPos.z,
      chassisRot,
      this.currentTrack,
      this.competitionField.flagStatus,
      opponentDots
    );

    // Render Three.js frame
    this.stage.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new HostApplication();
  app.start().catch((err) => console.error('Host startup error:', err));
});
