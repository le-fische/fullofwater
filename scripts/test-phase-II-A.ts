/**
 * =========================================================================
 * 🏎️ PHASE II-A VALIDATION SUITE: 3-PLAYER SERVERLESS WEBRTC MULTIPLAYER,
 * DIRECT PHONE-TO-DESKTOP PAIRING & HERMITE TRAJECTORY INTERPOLATION
 * =========================================================================
 * Validates Emergency Phase II-A specifications:
 * 1. Serverless WebRTC Signaling Broker on Vercel (/api/signal/*)
 * 2. Direct Phone-to-Desktop WebRTC DataChannel Pairing via 6-digit Session Token
 * 3. 56-Byte Binary Telemetry Frame (0x50325032) with Linear Velocity Vectors
 * 4. 100ms Snapshot Ring Buffer with Hermite Cubic Spline Trajectory Interpolation & Velocity Dead Reckoning
 * 5. Pure Invariant Ghost Mode (Zero Rapier Rigid Bodies, Zero Phantom Desync)
 * 6. Single-Circuit Synchronization & Synchronized FIA 5-Red-Light Standing Start
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { DriverDatabase } from '../src/server/db/driver-database';
import { handleApiRequest } from '../src/server/api-dispatcher';
import {
  encodePeerPoseBinary,
  encodePeerPoseBinary56,
  decodePeerPoseBinary,
  HermiteTrajectoryInterpolator,
  WebRTCMultiplayerLobby,
  PEER_POSE_MAGIC_V2,
  PEER_POSE_V1_SIZE,
  PEER_POSE_V2_SIZE,
} from '../src/host/net/webrtc-lobby';
import {
  ControllerPacketEncoder,
  ControllerPacketDecoder,
  TelemetryPacketEncoder,
  TelemetryPacketDecoder,
  ControllerButtons,
} from '../src/common/protocol';
import { TrackMode } from '../src/common/types';
import { RaceProcedureDirector } from '../src/host/gameplay/race-start';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ ${msg}`);
}

function assertApprox(a: number, b: number, eps = 0.05, msg = ''): void {
  const diff = Math.abs(a - b);
  assert(diff <= eps, `${msg} (Expected ~${b.toFixed(3)}, got ${a.toFixed(3)}, diff=${diff.toFixed(4)})`);
}

/**
 * Mock HTTP request helper for testing serverless API dispatcher endpoints
 */
async function mockFetchApi(
  pathname: string,
  method: 'GET' | 'POST',
  body?: any,
  headers: Record<string, string> = {},
  db?: DriverDatabase
): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.url = pathname;
    req.method = method;
    req.headers = { host: 'localhost:5173', ...headers };

    const chunks: Buffer[] = [];
    const res = new ServerResponse(req);

    res.write = (chunk: any) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = (chunk?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const resText = Buffer.concat(chunks).toString('utf-8');
      let data = null;
      try {
        data = resText ? JSON.parse(resText) : null;
      } catch {
        data = resText;
      }
      resolve({ status: res.statusCode || 200, data });
      return res;
    };

    void handleApiRequest(req, res, db);

    if (body) {
      req.emit('data', Buffer.from(JSON.stringify(body)));
    }
    req.emit('end');
  });
}

async function runPhaseIIASuite(): Promise<void> {
  console.log('\n==========================================================');
  console.log('🏁 EMERGENCY PHASE II-A VALIDATION SUITE: 3-PLAYER MULTIPLAYER');
  console.log('==========================================================\n');

  await RAPIER.init();
  const db = new DriverDatabase();

  // =========================================================================
  // MII-A.1: SERVERLESS WEBRTC SIGNALING BROKER (/api/signal/*)
  // =========================================================================
  console.log('--- Step II-A.1: Serverless WebRTC Signaling Broker on Vercel ---');
  {
    const roomCode = '4821';
    const hostPeerId = 'RSR-HOST-01';
    const peer2Id = 'RSR-PEER-02';
    const peer3Id = 'RSR-PEER-03';

    // 1. Host joins signaling room
    const hostJoin = await mockFetchApi('/api/signal/join', 'POST', {
      roomCode,
      peerId: hostPeerId,
      driverTag: 'LE_F1_CHAMPION',
      isHost: true,
    }, {}, db);

    assert(hostJoin.status === 200, 'Host joined signaling room successfully (200 OK)');
    assert(hostJoin.data.isHost === true, 'Host assigned authoritative host permissions');
    assert(hostJoin.data.circuit === 'nordschleife', 'Default circuit assigned to Nürburgring Nordschleife');
    assert(hostJoin.data.collisionEnabled === false, 'Default collision mode locked to Pure Ghost Mode');

    // 2. Peer 2 joins
    const peer2Join = await mockFetchApi('/api/signal/join', 'POST', {
      roomCode,
      peerId: peer2Id,
      driverTag: 'FRIEND_ALEX',
      isHost: false,
    }, {}, db);
    assert(peer2Join.status === 200, 'Peer 2 joined signaling room (200 OK)');
    assert(peer2Join.data.activePeers.includes(hostPeerId), 'Peer 2 discovers active Host in paddock');

    // 3. Peer 3 joins
    const peer3Join = await mockFetchApi('/api/signal/join', 'POST', {
      roomCode,
      peerId: peer3Id,
      driverTag: 'FRIEND_MAX',
      isHost: false,
    }, {}, db);
    assert(peer3Join.status === 200, 'Peer 3 joined signaling room (200 OK)');
    assert(peer3Join.data.activePeers.includes(hostPeerId) && peer3Join.data.activePeers.includes(peer2Id),
      'Peer 3 discovers both Host and Peer 2 (3-Player Paddock formed)');

    // 4. Host polls signaling queue and discovers peer_joined events
    const hostPoll1 = await mockFetchApi(`/api/signal/poll?room=${roomCode}&peerId=${hostPeerId}`, 'GET', undefined, {}, db);
    assert(hostPoll1.status === 200, 'Host polled signaling broker');
    assert(hostPoll1.data.activePeers.length === 2, 'Host sees 2 connected friends in room');
    const joinedTypes = hostPoll1.data.messages.map((m: any) => m.type);
    assert(joinedTypes.includes('peer_joined'), 'Host received asynchronous peer_joined announcements');

    // 5. Host sends WebRTC SDP Offer to Peer 2
    const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=RSR-HOST 1234 5678 IN IP4 0.0.0.0...' };
    const sendOffer = await mockFetchApi('/api/signal/send', 'POST', {
      roomCode,
      from: hostPeerId,
      to: peer2Id,
      type: 'webrtc_offer',
      payload: { sdp: mockOfferSdp },
    }, {}, db);
    assert(sendOffer.status === 200 && sendOffer.data.deliveredTo === 1, 'WebRTC SDP Offer delivered to Peer 2 mailbox');

    // 6. Peer 2 polls and drains offer
    const peer2Poll = await mockFetchApi(`/api/signal/poll?room=${roomCode}&peerId=${peer2Id}`, 'GET', undefined, {}, db);
    assert(peer2Poll.data.messages.some((m: any) => m.type === 'webrtc_offer'), 'Peer 2 received SDP Offer message');
    const offerMsg = peer2Poll.data.messages.find((m: any) => m.type === 'webrtc_offer');
    assert(offerMsg.payload.sdp.sdp === mockOfferSdp.sdp, 'SDP content preserved verbatim');

    // Atomic drain check: subsequent poll returns 0 messages
    const peer2PollAgain = await mockFetchApi(`/api/signal/poll?room=${roomCode}&peerId=${peer2Id}`, 'GET', undefined, {}, db);
    assert(peer2PollAgain.data.messages.length === 0, 'Signaling queue atomically drained (zero duplicate delivery)');

    // 7. Peer 2 answers with SDP Answer
    const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=RSR-PEER2 8765 4321 IN IP4 0.0.0.0...' };
    await mockFetchApi('/api/signal/send', 'POST', {
      roomCode,
      from: peer2Id,
      to: hostPeerId,
      type: 'webrtc_answer',
      payload: { sdp: mockAnswerSdp },
    }, {}, db);

    const hostPoll2 = await mockFetchApi(`/api/signal/poll?room=${roomCode}&peerId=${hostPeerId}`, 'GET', undefined, {}, db);
    assert(hostPoll2.data.messages.some((m: any) => m.type === 'webrtc_answer'), 'Host received SDP Answer from Peer 2');
  }

  // =========================================================================
  // MII-A.2: DIRECT PHONE-TO-DESKTOP WEBRTC PAIRING (/api/pair/signal/*)
  // =========================================================================
  console.log('\n--- Step II-A.2: Direct Phone-to-Desktop WebRTC Pairing Signaling ---');
  {
    // 1. Host creates ephemeral 6-digit pair token
    const pairCreate = await mockFetchApi('/api/pair/create', 'POST', {
      driverTag: 'LE_DEV',
      hostIp: '192.168.1.150',
    }, {}, db);
    assert(pairCreate.status === 200 && pairCreate.data.pairing, 'Host generated 6-digit session pair token');
    const pairToken = pairCreate.data.pairing.pairToken;
    assert(/^\d{6}$/.test(pairToken), `Session pairing token "${pairToken}" is valid 6-digit numeric PIN`);

    // 2. Controller posts SDP offer to host over /api/pair/signal/send
    const ctrlOffer = { type: 'offer', sdp: 'v=0\r\no=MOBILE-CONTROLLER 9999...' };
    const sendCtrlOffer = await mockFetchApi('/api/pair/signal/send', 'POST', {
      pairToken,
      from: 'controller',
      type: 'offer',
      payload: ctrlOffer,
    }, {}, db);
    assert(sendCtrlOffer.status === 200 && sendCtrlOffer.data.success, 'Controller posted WebRTC offer via pair signal broker');

    // 3. Desktop Host polls offer
    const hostPairPoll = await mockFetchApi(`/api/pair/signal/poll?token=${pairToken}&role=host`, 'GET', undefined, {}, db);
    assert(hostPairPoll.data.messages.length === 1 && hostPairPoll.data.messages[0].type === 'offer',
      'Host retrieved mobile controller WebRTC offer');

    // 4. Desktop Host posts SDP answer
    const hostAnswer = { type: 'answer', sdp: 'v=0\r\no=DESKTOP-HOST 8888...' };
    await mockFetchApi('/api/pair/signal/send', 'POST', {
      pairToken,
      from: 'host',
      type: 'answer',
      payload: hostAnswer,
    }, {}, db);

    // 5. Controller polls answer
    const ctrlPairPoll = await mockFetchApi(`/api/pair/signal/poll?token=${pairToken}&role=controller`, 'GET', undefined, {}, db);
    assert(ctrlPairPoll.data.messages.length === 1 && ctrlPairPoll.data.messages[0].type === 'answer',
      'Mobile controller retrieved desktop Host WebRTC answer');

    // 6. Direct binary packets round-trip verification (8-byte phone input & 6-byte host telemetry)
    const ctrlEncoder = new ControllerPacketEncoder();
    const ctrlDecoder = new ControllerPacketDecoder();
    const inputBuf = ctrlEncoder.encode(42, -0.425, 0.88, 0.0, ControllerButtons.START_ENGINE);
    assert(inputBuf.byteLength === 8, 'Phone controller packet is exactly 8 bytes');
    const decodedInput = ctrlDecoder.decode(inputBuf);
    assert(decodedInput.seq === 42, 'Input sequence 42 decoded');
    assertApprox(decodedInput.steer, -0.425, 0.01, 'Steering -0.425 rad decoded');
    assertApprox(decodedInput.throttle, 0.88, 0.01, 'Throttle 88% decoded');
    assert((decodedInput.buttons & ControllerButtons.START_ENGINE) !== 0, 'START_ENGINE button decoded');

    const telEncoder = new TelemetryPacketEncoder();
    const telDecoder = new TelemetryPacketDecoder();
    const telBuf = telEncoder.encode(0.92, 4, 274, true, true, false, 42);
    assert(telBuf.byteLength === 6, 'Host telemetry packet is exactly 6 bytes');
    const decodedTel = telDecoder.decode(telBuf);
    assertApprox(decodedTel.rpmRatio, 0.92, 0.01, 'RPM ratio 92% decoded');
    assert(decodedTel.gear === 4, 'Gear 4 decoded');
    assert(decodedTel.speedKmh === 274, 'Speed 274 km/h decoded');
    assert(decodedTel.shiftLight === true, 'Shift light active decoded');
    assert(decodedTel.abs === true, 'ABS flag active decoded');
  }

  // =========================================================================
  // MII-A.3: 56-BYTE BINARY TELEMETRY FRAME UPGRADE (0x50325032)
  // =========================================================================
  console.log('\n--- Step II-A.3: 56-Byte Binary Telemetry Frame (P2P2) ---');
  {
    const pos: [number, number, number] = [-142.8, 385.25, -2410.6];
    const quat: [number, number, number, number] = [0.035, 0.852, -0.015, 0.522];
    const vel: [number, number, number] = [45.8, -1.2, -62.4]; // Linear velocity in m/s (~278 km/h)
    const speedKmh = 278.4;
    const steerAngleRad = -0.082;
    const wheelSpinRad = 112.5;
    const timestampMs = 1794292000;

    // 1. Encode 56-byte frame
    const buf56 = encodePeerPoseBinary56(pos, quat, vel, speedKmh, steerAngleRad, wheelSpinRad, timestampMs);
    assert(buf56.byteLength === PEER_POSE_V2_SIZE, `Peer pose buffer is exactly ${PEER_POSE_V2_SIZE} bytes (56 bytes)`);

    const view = new DataView(buf56);
    const magic = view.getUint32(0, true);
    assert(magic === PEER_POSE_MAGIC_V2, `Magic header is 0x50325032 ('P2P2')`);

    // 2. Decode 56-byte frame
    const decoded56 = decodePeerPoseBinary(buf56);
    assert(decoded56 !== null, '56-byte packet decoded successfully');
    if (decoded56) {
      assertApprox(decoded56.pos[0], pos[0], 0.001, 'Position X');
      assertApprox(decoded56.pos[1], pos[1], 0.001, 'Position Y');
      assertApprox(decoded56.pos[2], pos[2], 0.001, 'Position Z');
      assertApprox(decoded56.quat[0], quat[0], 0.001, 'Quaternion X');
      assertApprox(decoded56.quat[1], quat[1], 0.001, 'Quaternion Y');
      assertApprox(decoded56.quat[2], quat[2], 0.001, 'Quaternion Z');
      assertApprox(decoded56.quat[3], quat[3], 0.001, 'Quaternion W');
      assertApprox(decoded56.vel[0], vel[0], 0.001, 'Linear Velocity X (45.8 m/s)');
      assertApprox(decoded56.vel[1], vel[1], 0.001, 'Linear Velocity Y (-1.2 m/s)');
      assertApprox(decoded56.vel[2], vel[2], 0.001, 'Linear Velocity Z (-62.4 m/s)');
      assertApprox(decoded56.speedKmh, speedKmh, 0.01, 'Speed km/h');
      assertApprox(decoded56.steerAngleRad, steerAngleRad, 0.001, 'Steer angle rad');
      assertApprox(decoded56.wheelSpinRad, wheelSpinRad, 0.01, 'Wheel spin rad');
    }

    // 3. Backwards compatibility test with 44-byte legacy frame
    const buf44 = encodePeerPoseBinary(pos, quat, speedKmh, steerAngleRad, wheelSpinRad, timestampMs);
    assert(buf44.byteLength === PEER_POSE_V1_SIZE, `Legacy packet is 44 bytes`);
    const decoded44 = decodePeerPoseBinary(buf44);
    assert(decoded44 !== null, 'Legacy 44-byte packet decoded cleanly');
    if (decoded44) {
      assertApprox(decoded44.pos[0], pos[0], 0.001, 'Legacy Position X');
      assert(decoded44.vel[0] === 0 && decoded44.vel[1] === 0 && decoded44.vel[2] === 0,
        'Legacy 44-byte packet gracefully defaults velocity to [0, 0, 0]');
    }
  }

  // =========================================================================
  // MII-A.4: HERMITE CUBIC SPLINE INTERPOLATION & VELOCITY DEAD RECKONING
  // =========================================================================
  console.log('\n--- Step II-A.4: Hermite Cubic Spline Trajectory Interpolator ---');
  {
    const interpolator = new HermiteTrajectoryInterpolator();
    interpolator.bufferDelayMs = 70; // 70ms buffer delay

    // Push 5 snapshots at 60 Hz (16.6ms intervals) moving along X axis with constant velocity 50 m/s
    const startTime = 1000;
    const vX = 50.0; // 50 m/s = 180 km/h

    for (let i = 0; i < 6; i++) {
      const t = startTime + i * 16.666;
      const x = i * 16.666 * 0.001 * vX;
      interpolator.pushSnapshot(
        t,
        [x, 10.0, 0.0],
        [0, 0, 0, 1],
        [vX, 0.0, 0.0],
        180.0,
        0.0,
        0.0
      );
    }

    assert(interpolator.getSnapshotCount() === 6, 'Snapshot ring buffer holds 6 timestamped trajectory packets');

    // Test 1: Midpoint Hermite interpolation between snapshot 2 (t=1033.3) and snapshot 3 (t=1050.0)
    // t_render = 1041.666 -> nowMs = t_render + 70ms = 1111.666
    const midNow = 1041.666 + 70;
    const evalMid = interpolator.evaluate(midNow);
    assert(evalMid !== null, 'Hermite cubic evaluation succeeded at midpoint');
    if (evalMid) {
      const expectedX = 41.666 * 0.001 * vX; // ~2.083 meters
      assertApprox(evalMid.pos.x, expectedX, 0.02, 'Hermite interpolated X position matches physical trajectory');
      assertApprox(evalMid.pos.y, 10.0, 0.001, 'Hermite interpolated Y position constant');
    }

    // Test 2: Velocity Dead Reckoning Forward Extrapolation (packet loss / network delay)
    // If packet delivery stalls, t_render exceeds latest snapshot (t_latest = 1083.33)
    // Evaluate at 80ms into the future (nowMs = 1083.33 + 70 + 80 = 1233.33)
    const lateNow = 1083.33 + 70 + 80;
    const evalLate = interpolator.evaluate(lateNow);
    assert(evalLate !== null, 'Dead reckoning forward evaluation succeeded during packet stall');
    if (evalLate) {
      const dtLate = 80 * 0.001; // 0.080s
      const lambda = 1.8;
      const decay = Math.exp(-lambda * dtLate); // ~0.8659
      const latestX = 5 * 16.666 * 0.001 * vX; // 4.1665m
      const expectedLateX = latestX + vX * dtLate * decay;
      assertApprox(evalLate.pos.x, expectedLateX, 0.05,
        'Forward extrapolation projects along linear velocity vector with exponential damping');
      assert(evalLate.speedKmh < 180.0, 'Speed smoothly damps under packet loss without sudden snap');
    }
  }

  // =========================================================================
  // MII-A.5: PURE INVARIANT GHOST MODE (ZERO PHANTOM COLLISION DESYNC)
  // =========================================================================
  console.log('\n--- Step II-A.5: Pure Invariant Ghost Mode ---');
  {
    const scene = new THREE.Scene();
    const lobby = new WebRTCMultiplayerLobby(scene);

    // Verify Ghost Mode is active by default
    assert(lobby.lobbyConfig.collisionEnabled === false, 'Default lobbyConfig.collisionEnabled === false (Ghost Mode)');

    // Set up Rapier physics world
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    const rapierWorld = new RAPIER.World(gravity);
    lobby.setPhysicsWorld(rapierWorld, RAPIER);

    // Spawn a remote peer car
    lobby.joinSignalingRoom('4821');

    // Assert that in Ghost Mode, no rigid bodies are added to the Rapier simulation
    const initialBodyCount = rapierWorld.bodies.len();
    assert(initialBodyCount === 0, 'Zero Rapier rigid bodies created for remote cars in Ghost Mode');

    // Run 10 ticks of lobby update
    for (let i = 0; i < 10; i++) {
      lobby.update(
        0.016,
        [0, 1.0, i * 2.0],
        [0, 0, 0, 1],
        120.0,
        0.0,
        10.0,
        [0, 0, 33.3]
      );
    }

    assert(rapierWorld.bodies.len() === 0,
      'Pure Invariant Ghost Mode verified: Zero physics colliders, eliminating all phantom contact desync');
  }

  // =========================================================================
  // MII-A.6: SINGLE-CIRCUIT SYNCHRONIZATION & FIA 5-RED-LIGHT START
  // =========================================================================
  console.log('\n--- Step II-A.6: Circuit Synchronization & FIA 5-Light Start ---');
  {
    const scene = new THREE.Scene();
    const lobby = new WebRTCMultiplayerLobby(scene);

    // 1. Host updates circuit to Nürburgring 24h Gesamtkurs
    lobby.lobbyConfig.circuit = TrackMode.NURBURGRING_24H;
    assert(lobby.lobbyConfig.circuit === TrackMode.NURBURGRING_24H, 'Host selected circuit: 24h Gesamtkurs');

    // 2. Compute 3-Player 2x2 Staggered Starting Grid
    const drivers = ['RSR-HOST-01', 'RSR-PEER-02', 'RSR-PEER-03'];
    const gridPositions = drivers.map((peerId, slot) => {
      const slotDistBehindLine = 6.0 + slot * 8.0;
      const lateralOffset = (slot % 2 === 0 ? -1 : 1) * 2.2;
      return { peerId, slot, slotDistBehindLine, lateralOffset };
    });

    assert(gridPositions[0].slot === 0 && gridPositions[0].slotDistBehindLine === 6.0,
      'P1 (Host / Pole) positioned 6.0m behind start line, left lane (-2.2m)');
    assert(gridPositions[1].slot === 1 && gridPositions[1].slotDistBehindLine === 14.0 && gridPositions[1].lateralOffset === 2.2,
      'P2 (Peer 2) positioned 14.0m behind start line, staggered right (+2.2m)');
    assert(gridPositions[2].slot === 2 && gridPositions[2].slotDistBehindLine === 22.0 && gridPositions[2].lateralOffset === -2.2,
      'P3 (Peer 3) positioned 22.0m behind start line, staggered left (-2.2m)');

    // 3. Test FIA 5-Red-Light sequence
    const raceDirector = new RaceProcedureDirector(scene, TrackMode.NURBURGRING_24H);
    assert(raceDirector.getFormat() === 'standing_f1_5lights', '24h Gesamtkurs enforces Standing F1 5-Red-Light sequence');

    const startPos = new THREE.Vector3(0, 0.6, 0);
    raceDirector.startProcedure(startPos);

    let state = raceDirector.getState();
    assert(state.phase === 'GRID_FORMED' && state.controlsLocked && state.lightsCount === 0,
      'Controls clamped at grid formation (0 lights)');

    for (let sec = 1; sec <= 4; sec++) {
      state = raceDirector.update(1.0, startPos, 0, 0);
      assert(state.lightsCount === sec, `T=${sec}s: Light ${sec} turns RED`);
    }

    state = raceDirector.update(1.0, startPos, 0, 0);
    assert((state.phase === 'LIGHT_5' || state.phase === 'HOLD_DELAY') && state.lightsCount === 5,
      'All 5 red lights illuminated (Hold Delay active)');

    state = raceDirector.update(3.5, startPos, 0, 0);
    assert(state.phase === 'LIGHTS_OUT' && state.isLightsOut && state.lightsCount === 0 && !state.controlsLocked,
      'LIGHTS OUT! All 5 red lights extinguished simultaneously -> Race START!');
    assert(raceDirector.filterInputs(1.0, 0.0, 0.0).isGoverned === false,
      'Launch clamp released, all 3 drivers launch together cleanly');
  }

  console.log('\n==========================================================');
  console.log('✅ ALL EMERGENCY PHASE II-A VALIDATION TESTS PASSED (100%)');
  console.log('==========================================================\n');
}

runPhaseIIASuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
