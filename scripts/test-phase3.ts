import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { VehicleRegistry } from '../src/common/vehicle-registry';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';
import { BrakeSystem } from '../src/host/physics/brakes';
import { TrackDryingLine } from '../src/host/physics/drying-line';
import { EnvironmentManager } from '../src/host/render/environment-manager';
import { CarMeshRig } from '../src/host/render/car-mesh';
import {
  NordschleifeLapTimer,
  SECTOR_COUNT,
  NORDSCHLEIFE_9_SECTOR_NAMES,
} from '../src/host/streaming/lap-timer';
import { GhostCarManager } from '../src/host/gameplay/ghost-car';
import {
  encodePeerPoseBinary,
  decodePeerPoseBinary,
} from '../src/host/net/webrtc-lobby';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ ${message}`);
}

async function runPhase3Tests(): Promise<void> {
  console.log('==========================================================');
  console.log('🏁 PHASE 3: ADVANCED MOTORSPORT SYSTEMS VALIDATION SUITE');
  console.log('==========================================================\n');

  await RAPIER.init();
  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

  // Create flat test ground collider
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const groundCollider = RAPIER.ColliderDesc.cuboid(500.0, 0.5, 2000.0)
    .setTranslation(0, -0.5, 500.0)
    .setFriction(1.0);
  world.createCollider(groundCollider, groundBody);

  const profile = VehicleRegistry.getVehicle('porsche_911_rsr_19_992');
  const vehicle = new RaycastVehicle(world, RAPIER, profile, { x: 0, y: 0.55, z: 0 }, 0);

  // =========================================================================
  // 3.1: INFINITE TYRE & FUEL + THERMAL BRAKE FADE
  // =========================================================================
  console.log('--- 3.1: Infinite Tyre & Fuel + Thermal Brake Fade ---');
  {
    const initialTel = vehicle.getTelemetry();
    const initialFuelL = initialTel.fuelLiters!;

    // Run 4 seconds of full-throttle acceleration + steering slip
    const dt = 1.0 / 240.0;
    for (let i = 0; i < 240 * 4; i++) {
      vehicle.step(dt, 0.35, 1.0, 0.0);
      world.step();
    }

    const postTel = vehicle.getTelemetry();
    const maxTireWear = Math.max(...postTel.tireWear!);
    const minTireHealth = Math.min(...postTel.tireHealthPercent!);
    assert(
      maxTireWear === 0 && minTireHealth === 100 && postTel.fuelLiters === initialFuelL,
      `Infinite tyre & fuel active at all times (Tyre Health=${minTireHealth}%, Fuel=${postTel.fuelLiters?.toFixed(1)}L unchanged after driving)`
    );

    // Thermal Brake Fade above 750°C
    const brakeModel = new BrakeSystem({ maxTorqueNm: 5200, frontBias: 0.565 });
    const coldTorque = brakeModel.computeWheelBrakeTorque(0, 1.0);
    const coldMu = brakeModel.getPadFrictionCoeff(0);

    // Heat rotor 0 above 750°C (e.g., 950°C)
    brakeModel.tempsC[0] = 950.0;
    const fadedTorque = brakeModel.computeWheelBrakeTorque(0, 1.0);
    const fadedMu = brakeModel.getPadFrictionCoeff(0);

    assert(
      brakeModel.tempsC[0] > BrakeSystem.THERMAL_FADE_THRESHOLD_C &&
        fadedMu < coldMu &&
        fadedTorque < coldTorque * 0.75,
      `Thermal brake fade above ${BrakeSystem.THERMAL_FADE_THRESHOLD_C}°C reduces pad μ (${coldMu.toFixed(2)} -> ${fadedMu.toFixed(2)}) and brake torque (${coldTorque.toFixed(0)} Nm -> ${fadedTorque.toFixed(0)} Nm)`
    );
  }

  // =========================================================================
  // 3.2: RECESSED RACING HEADLIGHTS & BRAKE LIGHTS
  // =========================================================================
  console.log('\n--- 3.2: Recessed Racing Headlights & Brake Lights ---');
  {
    if (typeof (globalThis as any).document === 'undefined') {
      const noopCtx = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
              return () => ({ addColorStop: () => {} });
            }
            if (prop === 'measureText') {
              return () => ({ width: 20 });
            }
            return () => {};
          },
          set: () => true,
        }
      );
      (globalThis as any).document = {
        createElement: () => ({
          width: 256,
          height: 256,
          style: {},
          getContext: () => noopCtx,
        }),
      };
    }

    const carScene = new THREE.Scene();
    const carRig = new CarMeshRig(carScene, vehicle);
    carRig.setHeadlightsEnabled(true);
    carRig.update(0.016);

    const headlightsGroup = carRig.rootGroup.getObjectByName('Car_Headlights_Group');
    const floatingMeshes: THREE.Object3D[] = [];
    headlightsGroup?.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        floatingMeshes.push(child);
      }
    });

    const spotLights: THREE.SpotLight[] = [];
    const pointLights: THREE.PointLight[] = [];
    headlightsGroup?.traverse((child: THREE.Object3D) => {
      if ((child as THREE.SpotLight).isSpotLight) spotLights.push(child as THREE.SpotLight);
      if ((child as THREE.PointLight).isPointLight) pointLights.push(child as THREE.PointLight);
    });

    const rearwardBrakeSpots = spotLights.filter(
      (s) => s.target && s.target.position.z < s.position.z
    );

    assert(
      floatingMeshes.length === 0,
      'Zero floating cylinder/box meshes in Car_Headlights_Group (nothing blocking cockpit sightline)'
    );
    assert(
      spotLights.length === 5 &&
        spotLights[0].distance >= 250 &&
        spotLights[0].intensity >= 20 &&
        pointLights.length === 0 &&
        rearwardBrakeSpots.length === 2,
      `High-output recessed endurance SpotLights (${spotLights.length} beams: 3 front + 2 rearward brake spots) with 0 point lights (zero forward cockpit light spill)`
    );
  }

  // =========================================================================
  // 3.3: DYNAMIC ENVIRONMENT & EXTERIOR-ONLY RAIN WEATHER
  // =========================================================================
  console.log('\n--- 3.3: Dynamic Environment & Exterior-Only Weather ---');
  {
    const scene = new THREE.Scene();
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 0.8);
    scene.add(sunLight);
    scene.add(hemiLight);

    const env = new EnvironmentManager(scene, sunLight, hemiLight);
    env.setTimeOfDay(13.0);
    env.update(0.016, new THREE.Vector3(), new THREE.Vector3(), 100, true, 0);
    const noonElev = env.getSolarElevationFactor();
    const noonIntensity = sunLight.intensity;

    env.setTimeOfDay(0.5); // 00:30 Midnight
    const nightState = env.update(0.016, new THREE.Vector3(), new THREE.Vector3(), 100, true, 0);
    const nightElev = env.getSolarElevationFactor();
    const nightIntensity = sunLight.intensity;

    assert(
      noonElev > 0.8 && nightElev < -0.8 && nightIntensity < noonIntensity && nightState.headlightsOn,
      `Day/Night sun cycle modulates solar elevation (Noon=${noonElev.toFixed(2)}, Night=${nightElev.toFixed(2)}) and auto-enables headlights at night`
    );

    // Rain particle emitter & exterior-only cockpit exclusion zone verification
    env.setWeather('heavy_rain');
    const camPos = new THREE.Vector3(10, 1.2, -25);
    const rainState = env.update(
      0.016,
      camPos,
      new THREE.Vector3(0, 0, 50),
      180,
      true,
      0.85
    );
    const rainEmitter = scene.getObjectByName('Procedural_Rain_Emitter') as THREE.LineSegments;
    const posAttr = rainEmitter.geometry.getAttribute('position') as THREE.BufferAttribute;
    let minHorizontalDistM = Infinity;
    for (let i = 0; i < posAttr.count; i += 2) {
      const dx = posAttr.getX(i) - camPos.x;
      const dz = posAttr.getZ(i) - camPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minHorizontalDistM) minHorizontalDistM = dist;
    }

    assert(
      rainState.rainIntensity === 1.0 &&
        rainEmitter?.visible === true &&
        minHorizontalDistM >= 4.5,
      `Heavy rain spawns strictly outside cockpit cabin (min horizontal radius from camera = ${minHorizontalDistM.toFixed(2)}m >= 4.5m)`
    );

    // 40% surface friction reduction, slick hydroplaning & 2D dynamic drying line
    const dryingLine = new TrackDryingLine(1000.0, 50, 7);
    dryingLine.fillUniformWetness(1.0); // 100% standing water

    const fullWetEval = dryingLine.evaluateWetGrip(1.0, 100.0, 0.0, 80.0, 'slick_soft');
    assert(
      Math.abs(fullWetEval.effectiveFrictionMultiplier - 0.6) < 0.02,
      `100% wet surface reduces base surface friction by 40% (multiplier=${fullWetEval.effectiveFrictionMultiplier.toFixed(2)})`
    );

    const slickHydroEval = dryingLine.evaluateWetGrip(1.0, 100.0, 0.0, 210.0, 'slick_soft');
    const wetTireEval = dryingLine.evaluateWetGrip(1.0, 100.0, 0.0, 210.0, 'wet');
    assert(
      slickHydroEval.isHydroplaning &&
        slickHydroEval.effectiveFrictionMultiplier < wetTireEval.effectiveFrictionMultiplier,
      `Slick tires hydroplane at 210 km/h in standing water (grip=${slickHydroEval.effectiveFrictionMultiplier.toFixed(2)}) while Wet tires evacuate water (grip=${wetTireEval.effectiveFrictionMultiplier.toFixed(2)})`
    );

    // Clear water along the racing groove (lateral offset = 0m) while off-line (lateral offset = +5m) stays wet
    const initialGrooveWater = dryingLine.getWaterDepthAt(250.0, 0.0);
    for (let pass = 0; pass < 40; pass++) {
      dryingLine.clearWaterAlongGroove(250.0, 0.0, 180.0, 0.1);
    }
    const driedGrooveWater = dryingLine.getWaterDepthAt(250.0, 0.0);
    const offLineWater = dryingLine.getWaterDepthAt(250.0, 5.0);
    assert(
      driedGrooveWater < initialGrooveWater * 0.65 && driedGrooveWater < offLineWater,
      `2D Dynamic Drying Line clears water along racing groove (${initialGrooveWater.toFixed(2)} -> ${driedGrooveWater.toFixed(2)} vs off-line ${offLineWater.toFixed(2)})`
    );
  }

  // =========================================================================
  // 3.4: TIMING, GHOST CAR & MULTIPLAYER
  // =========================================================================
  console.log('\n--- 3.4: 9-Sector Timing, Ghost Car & WebRTC P2P Multiplayer ---');
  {
    // 1. 9-Sector Timing Breakdown & Live Delta Splits
    const timer = new NordschleifeLapTimer(9000.0);
    assert(
      SECTOR_COUNT === 9 && NORDSCHLEIFE_9_SECTOR_NAMES.length === 9,
      `NordschleifeLapTimer configured with ${SECTOR_COUNT} sectors (${NORDSCHLEIFE_9_SECTOR_NAMES[0]} .. ${NORDSCHLEIFE_9_SECTOR_NAMES[8]})`
    );

    // Seed a 90,000 ms (1:30.00) reference lap (10,000 ms per sector)
    timer.seedReferenceBestLap(90000);
    timer.update(20, false, 1000); // Arm lap at t=1000ms

    // Advance across Sector 1 boundary (1000m) in 9,200 ms (-800ms faster than reference!)
    const s1Tel = timer.update(1050, false, 10200);
    assert(
      s1Tel.currentSectorIndex === 1 &&
        s1Tel.sectorSplits[0].status === 'purple' &&
        s1Tel.sectorSplits[0].deltaMs !== null &&
        s1Tel.sectorSplits[0].deltaMs < 0 &&
        s1Tel.liveDeltaMs !== null &&
        s1Tel.liveDeltaMs < 0,
      `9-Sector timer records Sector 1 split (${s1Tel.sectorSplits[0].currentMs}ms, status=${s1Tel.sectorSplits[0].status}, liveDelta=${s1Tel.liveDeltaMs?.toFixed(0)}ms)`
    );

    // 2. Local Ghost Car Recording & Playback Interpolation
    const ghostScene = new THREE.Scene();
    const ghostMgr = new GhostCarManager(ghostScene, 'test_circuit');
    ghostMgr.startLapRecording();
    ghostMgr.recordSample(0, 0, [0, 0.5, 0], [0, 0, 0, 1], 0, 0);
    ghostMgr.recordSample(1000, 50, [0, 0.5, 50], [0, 0, 0, 1], 0.1, 12);
    ghostMgr.recordSample(2000, 100, [10, 0.5, 100], [0, 0.2, 0, 0.98], 0.2, 24);

    const promoted = ghostMgr.onLapCompleted(65000, true);
    const midPose = ghostMgr.samplePoseAtTime(500);
    assert(
      promoted &&
        ghostMgr.hasBestGhost() &&
        midPose !== null &&
        Math.abs(midPose.pos[2] - 25.0) < 0.5,
      `GhostCarManager records lap keyframes, promotes best lap, and interpolates pose at t=500ms (z=${midPose?.pos[2].toFixed(1)}m)`
    );

    // 3. WebRTC DataChannel Binary Pose Serialization
    const rawPacket = encodePeerPoseBinary(
      [124.5, 12.25, -840.75],
      [0.01, 0.707, 0.0, 0.707],
      248.5,
      -0.18,
      42.0,
      12345
    );
    const decodedPeer = decodePeerPoseBinary(rawPacket);
    assert(
      decodedPeer !== null &&
        Math.abs(decodedPeer.pos[0] - 124.5) < 0.01 &&
        Math.abs(decodedPeer.pos[2] - -840.75) < 0.01 &&
        Math.abs(decodedPeer.speedKmh - 248.5) < 0.05,
      `WebRTC DataChannel binary pose packet (44 bytes) encodes and decodes accurately (speed=${decodedPeer?.speedKmh} km/h)`
    );
  }

  console.log('\n==========================================================');
  console.log('✅ ALL PHASE 3 VALIDATION TESTS PASSED (100%)');
  console.log('==========================================================');
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 test suite failed:', err);
  process.exit(1);
});
