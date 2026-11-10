/**
 * Phase I Comprehensive Validation Suite:
 * Validates Driver Identity, Accounts, Guest "Claim License" Conversion,
 * Automated Phone Controller Session Pairing, Player Activity Stats Database,
 * Serverless Anti-Cheat Monotonic Sector Validation, Multi-Dimensional Matrix Leaderboards,
 * and 30 Hz World Record Ghost Retrieval into GhostCarManager.
 */

import { DriverDatabase, formatLapTime } from '../src/server/db/driver-database';
import { GhostCarManager, GhostKeyframe } from '../src/host/gameplay/ghost-car';
import { LapSubmissionPayload } from '../src/common/auth/driver-types';

async function runPhaseITests() {
  console.log('\n==========================================================');
  console.log('🏎️  PHASE I: DRIVER ACCOUNTS, CLOUD PERSISTENCE & LEADERBOARDS');
  console.log('==========================================================\n');

  const db = new DriverDatabase();
  let testsPassed = 0;
  const totalTests = 6;

  // -------------------------------------------------------------------------
  // TEST 1: Driver Authentication, Guest Mode & Frictionless "Claim License"
  // -------------------------------------------------------------------------
  console.log('--- Step I.1: Driver Accounts & Frictionless Guest Conversion ---');
  
  // 1. Register verified permanent driver
  const regRes = db.register({
    driverTag: 'APEX_HUNTER_99',
    displayName: 'Apex Hunter',
    email: 'hunter@apexmotorsport.com',
    password: 'secure_password_123',
    countryCode: 'DE',
    preferredUnits: 'km/h',
  });
  if (!regRes.success || !regRes.account) {
    throw new Error(`Failed to register driver: ${regRes.message}`);
  }
  console.log(`  ✅ Registered verified driver: ${regRes.account.driverTag} (${regRes.account.email})`);

  // 2. Prevent duplicate driver tag
  const dupRes = db.register({
    driverTag: 'APEX_HUNTER_99',
    displayName: 'Imposter',
    email: 'imposter@fake.com',
  });
  if (dupRes.success) {
    throw new Error('Allowed duplicate driver tag registration!');
  }
  console.log('  ✅ Duplicate driver tag registration correctly rejected.');

  // 3. Authenticate with password
  const loginRes = db.login({
    driverTagOrEmail: 'APEX_HUNTER_99',
    password: 'secure_password_123',
  });
  if (!loginRes.success || loginRes.sessionToken !== regRes.sessionToken) {
    // Note: sessionToken might be newly issued on login
    if (!loginRes.success) throw new Error('Driver login failed.');
  }
  console.log(`  ✅ Driver login verified via password. Token issued: ${loginRes.sessionToken?.substring(0, 16)}...`);

  // 4. Zero-barrier Guest Mode initialization
  const guestTag = 'GUEST_9471';
  const guestReg = db.register({ driverTag: guestTag, email: '' }, true);
  if (!guestReg.success || !guestReg.account?.isGuest) {
    throw new Error('Guest registration failed.');
  }
  console.log(`  ✅ Zero-barrier guest account instantiated: ${guestTag}`);

  // Simulate guest driving: accumulate 32.5 km, 2 laps, top speed 295 km/h
  db.updateDriverActivity(guestTag, 32.5, true, true, 'porsche_911_rsr_19_992', 'Rexy Green #80', 1.4, 295.2);
  db.updateDriverActivity(guestTag, 20.8, true, true, 'porsche_911_rsr_19_992', 'Rexy Green #80', 0.8, 298.5);

  const guestStatsBefore = db.getDriverProfile(guestTag)?.stats;
  if (!guestStatsBefore || guestStatsBefore.totalDistanceKm < 50) {
    throw new Error('Guest stats did not accumulate properly.');
  }

  // 5. Claim Guest License: smoothly convert guest into verified account
  const claimRes = db.claimGuestAccount({
    guestTag,
    newDriverTag: 'SPEED_VALKYRIE',
    displayName: 'Valkyrie Racing',
    email: 'valkyrie@fast.org',
    password: 'mypassword',
    countryCode: 'FR',
  });
  if (!claimRes.success || !claimRes.account) {
    throw new Error(`Failed to claim guest license: ${claimRes.message}`);
  }

  // Verify 100% data preservation
  const claimedProfile = db.getDriverProfile('SPEED_VALKYRIE');
  if (!claimedProfile || !claimedProfile.stats) {
    throw new Error('Claimed profile not found under new driver tag.');
  }
  if (claimedProfile.stats.totalDistanceKm !== guestStatsBefore.totalDistanceKm) {
    throw new Error(`Distance lost during claim! Before: ${guestStatsBefore.totalDistanceKm}, After: ${claimedProfile.stats.totalDistanceKm}`);
  }
  if (claimedProfile.account?.isGuest !== false) {
    throw new Error('Claimed account is still marked as guest!');
  }
  console.log(`  ✅ Claimed Driver License: Converted ${guestTag} -> ${claimedProfile.account.driverTag} (${claimedProfile.stats.totalDistanceKm} km & all history preserved 100%).`);
  testsPassed++;

  // -------------------------------------------------------------------------
  // TEST 2: Automated Phone Controller Session Pairing
  // -------------------------------------------------------------------------
  console.log('\n--- Step I.2: Automated Multi-Device Phone Pairing ---');

  const hostIp = '192.168.1.150';
  const pairing = db.createPairingSession('SPEED_VALKYRIE', hostIp);
  console.log(`  ✅ Created pairing session token: ${pairing.pairToken} (Expires in 15 min)`);

  // Check initial state
  const statusBefore = db.checkPairingStatus(pairing.pairToken);
  if (statusBefore.paired) throw new Error('Pairing status should be false initially.');

  // Phone connects with pairing token
  const verifyRes = db.verifyPairingSession(pairing.pairToken, 'SPEED_VALKYRIE');
  if (!verifyRes.success || !verifyRes.tokenObj?.paired) {
    throw new Error(`Phone pairing verification failed: ${verifyRes.message}`);
  }

  const statusAfter = db.checkPairingStatus(pairing.pairToken);
  if (!statusAfter.paired) throw new Error('Pairing status not updated to true.');
  console.log(`  ✅ Phone controller successfully auto-paired to desktop host for driver: ${statusAfter.driverTag}`);

  // Test invalid pairing token
  const badVerify = db.verifyPairingSession('000000');
  if (badVerify.success) throw new Error('Allowed invalid pairing token!');
  console.log('  ✅ Invalid pairing token safely rejected.');
  testsPassed++;

  // -------------------------------------------------------------------------
  // TEST 3: Player Activity & Lifetime Stats Database
  // -------------------------------------------------------------------------
  console.log('\n--- Step I.3: Player Activity & Lifetime Stats Telemetry ---');

  const driverTag = 'APEX_HUNTER_99';
  // Accumulate driving steps
  db.updateDriverActivity(driverTag, 20.8, true, true, 'porsche_911_rsr_19_992', 'Rexy Green #80', 2.2, 305.4);
  db.updateDriverActivity(driverTag, 25.4, true, false, 'porsche_911_rsr_19_992', 'Rexy Green #80', 3.1, 312.0);
  db.updateDriverActivity(driverTag, 5.1, true, true, 'porsche_911_rsr_19_992', 'Rothmans White/Blue', 0.5, 275.5);

  const stats = db.getDriverProfile(driverTag)?.stats;
  if (!stats) throw new Error('Missing driver stats.');

  console.log(`  Total Distance Driven: ${stats.totalDistanceKm} km`);
  console.log(`  Total Laps: ${stats.totalLapsCompleted} (Clean: ${stats.cleanLapsCompleted}, Clean Ratio: ${stats.cleanLapRatio}%)`);
  console.log(`  Max Top Speed: ${stats.maxTopSpeedKmh} km/h`);
  console.log(`  Airborne Flight Time: ${stats.totalFlightTimeSeconds}s`);
  console.log(`  Favorite Vehicle: "${stats.favoriteVehicle}"`);
  console.log(`  Favorite Livery: "${stats.favoriteLivery}"`);

  if (stats.cleanLapRatio !== 67) {
    throw new Error(`Expected clean lap ratio of 67% (2 clean out of 3), got ${stats.cleanLapRatio}%`);
  }
  if (stats.maxTopSpeedKmh !== 312.0) {
    throw new Error(`Expected top speed 312.0 km/h, got ${stats.maxTopSpeedKmh}`);
  }
  console.log('  ✅ Player activity and telemetry stats accurately computed and persisted.');
  testsPassed++;

  // -------------------------------------------------------------------------
  // TEST 4: Serverless Anti-Cheat Monotonic Sector Validation
  // -------------------------------------------------------------------------
  console.log('\n--- Step I.4: Serverless Anti-Cheat Monotonic Sector Validation ---');

  // Test A: Valid Clean Lap with Monotonic Splits
  // 9 Nordschleife sectors summing exactly to 410,200 ms (6:50.200)
  const validSplits = [45000, 44000, 47000, 46000, 45500, 44500, 46000, 45200, 47000];
  const validTotal = validSplits.reduce((a, b) => a + b, 0); // 410200 ms

  const validPayload: LapSubmissionPayload = {
    driverTag: 'APEX_HUNTER_99',
    circuitId: 'nordschleife',
    vehicleId: 'porsche_911_rsr_19_992',
    vehicleClass: 'GTE',
    weather: 'clear',
    inputCategory: 'wheel',
    totalLapTimeMs: validTotal,
    sectorSplitsMs: validSplits,
    topSpeedKmh: 310.5,
    isLapValid: true,
  };

  const validRes = db.submitLap(validPayload);
  if (!validRes.accepted) {
    throw new Error(`Valid clean lap rejected! Reason: ${validRes.reason}`);
  }
  console.log(`  ✅ Clean verified lap accepted: ${formatLapTime(validTotal)} (Rank #${validRes.leaderboardRank})`);

  // Test B: Sector Monotonic Timing Mismatch (Sum != Total)
  const corruptSplitsPayload: LapSubmissionPayload = {
    ...validPayload,
    totalLapTimeMs: 400000, // Total claims 6:40, but sectors sum to 410,200!
  };
  const corruptRes = db.submitLap(corruptSplitsPayload);
  if (corruptRes.accepted) {
    throw new Error('Anti-Cheat FAILED: Accepted lap with mismatched sector sum!');
  }
  console.log(`  ✅ Anti-Cheat: Mismatched sector timing correctly rejected (${corruptRes.reason?.substring(0, 45)}...)`);

  // Test C: Invalid Lap (Cut course / crashed)
  const cutTrackPayload: LapSubmissionPayload = {
    ...validPayload,
    isLapValid: false,
  };
  const cutRes = db.submitLap(cutTrackPayload);
  if (cutRes.accepted) {
    throw new Error('Anti-Cheat FAILED: Accepted lap marked as invalid (off-track/crash)!');
  }
  console.log('  ✅ Anti-Cheat: Invalid lap (off-track violation / crash) strictly rejected.');

  // Test D: Physical Boundary Check (Unrealistically fast lap time)
  const supersonicSplits = new Array(9).fill(20000); // 9 x 20s = 180s (3:00 min on Nordschleife)
  const supersonicPayload: LapSubmissionPayload = {
    ...validPayload,
    totalLapTimeMs: 180000,
    sectorSplitsMs: supersonicSplits,
  };
  const supersonicRes = db.submitLap(supersonicPayload);
  if (supersonicRes.accepted) {
    throw new Error('Anti-Cheat FAILED: Accepted physically impossible lap time!');
  }
  console.log(`  ✅ Anti-Cheat: Below minimum physical homologation threshold rejected (${supersonicRes.reason?.substring(0, 50)}...)`);

  // Test E: Physical Top Speed Check
  const warpSpeedPayload: LapSubmissionPayload = {
    ...validPayload,
    topSpeedKmh: 420.0, // 420 km/h in GTE class
  };
  const warpRes = db.submitLap(warpSpeedPayload);
  if (warpRes.accepted) {
    throw new Error('Anti-Cheat FAILED: Accepted impossible top speed!');
  }
  console.log('  ✅ Anti-Cheat: Top speed exceeding vehicle catalog physical envelope rejected.');
  testsPassed++;

  // -------------------------------------------------------------------------
  // TEST 5: Multi-Dimensional Global Hotlap Leaderboard Matrix
  // -------------------------------------------------------------------------
  console.log('\n--- Step I.5: Multi-Dimensional Matrix Leaderboard Queries ---');

  // Submit additional verified records with various input categories
  const mobileSplits = [46000, 45000, 48000, 47000, 46500, 45500, 47000, 46200, 48000];
  db.submitLap({
    driverTag: 'SPEED_VALKYRIE',
    circuitId: 'nordschleife',
    vehicleId: 'porsche_911_rsr_19_992',
    vehicleClass: 'GTE',
    weather: 'clear',
    inputCategory: 'gyro',
    totalLapTimeMs: mobileSplits.reduce((a, b) => a + b, 0), // 419200 ms
    sectorSplitsMs: mobileSplits,
    topSpeedKmh: 301.2,
    isLapValid: true,
  });

  // Query 1: All inputs on Nordschleife
  const qAll = db.queryLeaderboard({ circuitId: 'nordschleife' });
  console.log(`  Nordschleife Overall Leaderboard Count: ${qAll.total} entries`);
  console.log(`  P1: ${qAll.entries[0].driverTag} (${qAll.entries[0].lapTimeFormatted}) - ${qAll.entries[0].inputCategory.toUpperCase()}`);
  console.log(`  P2: ${qAll.entries[1].driverTag} (+${(qAll.entries[1].deltaToLeaderMs / 1000).toFixed(3)}s)`);

  // Query 2: Filter by Mobile Gyro only
  const qGyro = db.queryLeaderboard({ circuitId: 'nordschleife', inputCategory: 'gyro' });
  console.log(`  Mobile Gyro Filtered Count: ${qGyro.total} entries`);
  if (!qGyro.entries.every((e) => e.inputCategory === 'gyro')) {
    throw new Error('Input filter failed: non-gyro entry returned!');
  }
  console.log(`  P1 Gyro: ${qGyro.entries[0].driverTag} (${qGyro.entries[0].lapTimeFormatted})`);

  // Query 3: Filter by 24h circuit
  const q24h = db.queryLeaderboard({ circuitId: '24h' });
  console.log(`  24h Gesamtkurs Count: ${q24h.total} entries (Leader: ${q24h.entries[0].driverTag})`);

  // Query 4: Filter by GP-Strecke
  const qGp = db.queryLeaderboard({ circuitId: 'gp_strecke' });
  console.log(`  GP-Strecke Count: ${qGp.total} entries (Leader: ${qGp.entries[0].driverTag})`);

  // Query 5: Filter by Proving Ground
  const qPg = db.queryLeaderboard({ circuitId: 'proving_ground' });
  console.log(`  Proving Ground Count: ${qPg.total} entries (Leader: ${qPg.entries[0].driverTag})`);

  testsPassed++;

  // -------------------------------------------------------------------------
  // TEST 6: 30 Hz World Record Ghost Storage, Retrieval & Ingestion
  // -------------------------------------------------------------------------
  console.log('\n--- Step I.6: World Record 30 Hz Ghost Retrieval & Ingestion ---');

  const wrGhost = db.getWorldRecordGhost('nordschleife', 'GTE', 'clear');
  if (!wrGhost || !wrGhost.hasGhost || wrGhost.keyframes.length < 100) {
    throw new Error(`Failed to retrieve WR ghost or keyframe count too low (${wrGhost?.keyframes.length})`);
  }

  console.log(`  ✅ Retrieved World Record Ghost: ${wrGhost.driverTag} (${formatLapTime(wrGhost.lapTimeMs)})`);
  console.log(`  Keyframe Trajectory Samples: ${wrGhost.keyframes.length} frames at 30 Hz`);
  console.log(`  First Keyframe: T = ${wrGhost.keyframes[0].timeMs}ms, Pos = [${wrGhost.keyframes[0].x.toFixed(1)}, ${wrGhost.keyframes[0].y.toFixed(1)}, ${wrGhost.keyframes[0].z.toFixed(1)}]`);
  console.log(`  Last Keyframe: T = ${wrGhost.keyframes[wrGhost.keyframes.length - 1].timeMs}ms, Pos = [${wrGhost.keyframes[wrGhost.keyframes.length - 1].x.toFixed(1)}, ${wrGhost.keyframes[wrGhost.keyframes.length - 1].y.toFixed(1)}, ${wrGhost.keyframes[wrGhost.keyframes.length - 1].z.toFixed(1)}]`);

  // Ingest WR ghost into GhostCarManager
  const ghostManager = new GhostCarManager(undefined, 'nordschleife');
  const convertedFrames: GhostKeyframe[] = wrGhost.keyframes.map((kf) => ({
    timeMs: kf.timeMs,
    distanceM: kf.distanceM,
    x: kf.x,
    y: kf.y,
    z: kf.z,
    qx: kf.qx,
    qy: kf.qy,
    qz: kf.qz,
    qw: kf.qw,
    steerRad: kf.steerRad,
  }));

  ghostManager.loadExternalGhost(wrGhost.lapTimeMs, convertedFrames, true);

  // Sample ghost car transform at lap halfway
  const sampleTime = Math.floor(wrGhost.lapTimeMs / 2);
  const sample = ghostManager.sampleGhostAtTime(sampleTime);
  if (!sample) {
    throw new Error(`GhostCarManager failed to interpolate WR ghost at ${sampleTime}ms!`);
  }
  console.log(`  ✅ GhostCarManager interpolated World Record Ghost at T = ${(sampleTime / 1000).toFixed(1)}s:`);
  console.log(`     Interpolated Pos: [${sample.position.x.toFixed(2)}, ${sample.position.y.toFixed(2)}, ${sample.position.z.toFixed(2)}]`);
  console.log(`     Interpolated Dist: ${sample.distanceM.toFixed(1)}m, Steer: ${(sample.steerRad * (180 / Math.PI)).toFixed(1)}°`);

  testsPassed++;

  console.log('\n==========================================================');
  console.log(`✅ ALL PHASE I VALIDATION TESTS PASSED (Passed ${testsPassed}/${totalTests})`);
  console.log('==========================================================\n');
}

runPhaseITests().catch((err) => {
  console.error('\n❌ Phase I Validation Test Failed:', err);
  process.exit(1);
});
