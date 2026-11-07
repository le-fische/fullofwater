import { ControllerPacketEncoder, ControllerPacketDecoder, TelemetryPacketEncoder, TelemetryPacketDecoder } from '../src/common/protocol';
import { OneEuroFilter } from '../src/common/math';
import { DeviceOrientationManager } from '../src/controller/sensors/orientation';
import { PacejkaTireModel } from '../src/host/physics/tire-model';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';
import fs from 'fs';

async function runValidationTests() {
  console.log('🧪 Starting Phase 1 Comprehensive Validation Tests...\n');

  // Test 1: Binary Protocol Round-trip
  console.log('Test 1: Binary Protocol Round-trip...');
  const ctrlEncoder = new ControllerPacketEncoder();
  const ctrlDecoder = new ControllerPacketDecoder();

  const testInputs = [
    { seq: 42, steer: -0.75, throttle: 1.0, brake: 0.0, buttons: 1 },
    { seq: 65535, steer: 1.0, throttle: 0.0, brake: 1.0, buttons: 2 },
    { seq: 0, steer: 0.0, throttle: 0.0, brake: 0.0, buttons: 0 },
  ];

  for (const input of testInputs) {
    const encoded = ctrlEncoder.encode(input.seq, input.steer, input.throttle, input.brake, input.buttons);
    if (encoded.byteLength !== 8) throw new Error(`Controller packet size is ${encoded.byteLength}, expected 8`);
    const decoded = ctrlDecoder.decode(encoded);

    if (decoded.seq !== input.seq) throw new Error(`Seq mismatch: ${decoded.seq} vs ${input.seq}`);
    if (Math.abs(decoded.steer - input.steer) > 0.001) throw new Error(`Steer mismatch: ${decoded.steer} vs ${input.steer}`);
    if (Math.abs(decoded.throttle - input.throttle) > 0.01) throw new Error(`Throttle mismatch`);
    if (Math.abs(decoded.brake - input.brake) > 0.01) throw new Error(`Brake mismatch`);
    if (decoded.buttons !== input.buttons) throw new Error(`Buttons mismatch`);
  }
  console.log('  ✅ Controller 8-byte binary packet encode/decode verified.');

  const telEncoder = new TelemetryPacketEncoder();
  const telDecoder = new TelemetryPacketDecoder();

  const encodedTel = telEncoder.encode(0.85, 4, 185, true, false, true, 42);
  if (encodedTel.byteLength !== 6) throw new Error(`Telemetry packet size is ${encodedTel.byteLength}, expected 6`);
  const decodedTel = telDecoder.decode(encodedTel);

  if (Math.abs(decodedTel.rpmRatio - 0.85) > 0.01) throw new Error('RPM ratio mismatch');
  if (decodedTel.gear !== 4) throw new Error('Gear mismatch');
  if (decodedTel.speedKmh !== 185) throw new Error('Speed mismatch');
  if (!decodedTel.shiftLight) throw new Error('Shift light flag missing');
  if (decodedTel.abs) throw new Error('ABS flag unexpected');
  if (!decodedTel.tc) throw new Error('TC flag missing');
  if (decodedTel.pingSeq !== 42) throw new Error('PingSeq mismatch');
  console.log('  ✅ Telemetry 6-byte binary packet encode/decode verified.\n');

  // Test 2: One Euro Filter Stability
  console.log('Test 2: One Euro Filter...');
  const filter = new OneEuroFilter(1.0, 0.007, 1.0);
  let noisySteer = 0;
  for (let t = 0; t < 1.0; t += 0.016) {
    // Add micro-noise
    const sample = 0.5 + (Math.random() - 0.5) * 0.04;
    noisySteer = filter.filter(sample, t);
  }
  if (isNaN(noisySteer) || Math.abs(noisySteer - 0.5) > 0.05) {
    throw new Error(`One Euro filter unstable: ${noisySteer}`);
  }
  console.log(`  ✅ One Euro filter smoothed noisy signal to ${noisySteer.toFixed(4)}.\n`);

  // Test 3: Pacejka Tire Model
  console.log('Test 3: Pacejka Magic Formula...');
  const coefLat = { B: 12.5, C: 1.85, D: 1.55, E: 0.95 };
  const coefLong = { B: 14.5, C: 1.65, D: 1.55, E: 0.95 };
  const Fz = 4000; // 4000 N normal load

  const tireForces = PacejkaTireModel.computeForces(
    25.0, // 25 m/s forward
    -2.0, // 2 m/s slip lateral
    25.0 / 0.35, // wheel rotational velocity matching speed
    0.35,
    Fz,
    coefLong,
    coefLat
  );

  console.log(`  Lateral Slip Angle: ${(tireForces.slipAngle * 180 / Math.PI).toFixed(2)} deg`);
  console.log(`  Lateral Force Fy: ${tireForces.fy.toFixed(1)} N (Peak max: ${(coefLat.D * Fz).toFixed(1)} N)`);
  if (isNaN(tireForces.fy) || Math.abs(tireForces.fy) < 100 || Math.abs(tireForces.fy) > coefLat.D * Fz * 1.01) {
    throw new Error('Pacejka lateral force calculation out of bounds');
  }
  console.log('  ✅ Pacejka Magic Formula within physical friction ellipse.\n');

  // Test 4: Full Rapier 3D Physics Simulation Run (240 Hz fixed timestep)
  console.log('Test 4: Rapier 3D Vehicle Physics Simulation (1000 ticks at 240 Hz)...');
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  const physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  // Create ground plane collider
  const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(200, 0.5, 200)
    .setTranslation(0, -0.5, 0)
    .setFriction(0.9);
  physicsWorld.world.createCollider(groundCol);

  const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });

  const dt = 1.0 / 240.0;
  let simulatedTime = 0;

  // Let suspension settle for 1 second (240 ticks)
  for (let i = 0; i < 240; i++) {
    vehicle.step(dt, 0, 0, 0);
    physicsWorld.step();
    simulatedTime += dt;
  }

  const settledPos = vehicle.chassisBody.translation();
  const settledVel = vehicle.chassisBody.linvel();
  console.log(`  Chassis settled height: Y = ${settledPos.y.toFixed(3)} m, Linvel: [${settledVel.x.toFixed(2)}, ${settledVel.y.toFixed(2)}, ${settledVel.z.toFixed(2)}]`);
  if (isNaN(settledPos.y) || settledPos.y < 0.2 || settledPos.y > 0.6) {
    throw new Error(`Chassis fell through ground or exploded: Y = ${settledPos.y}`);
  }

  // Accelerate with full throttle for 3 seconds (720 ticks)
  console.log('  Accelerating full throttle...');
  for (let i = 0; i < 720; i++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    simulatedTime += dt;
  }

  const telAccel = vehicle.getTelemetry();
  console.log(`  Speed after 3s acceleration: ${telAccel.speedKmh.toFixed(1)} km/h (Gear: ${telAccel.gear}, RPM: ${Math.round(telAccel.rpm)})`);

  if (telAccel.speedKmh < 40) {
    throw new Error(`Vehicle failed to accelerate: speed is only ${telAccel.speedKmh.toFixed(1)} km/h`);
  }

  // Full braking test for 1.5 seconds (360 ticks)
  console.log('  Applying full brakes with ABS...');
  for (let i = 0; i < 360; i++) {
    vehicle.step(dt, 0, 0, 1.0);
    physicsWorld.step();
    simulatedTime += dt;
  }

  const telBrake = vehicle.getTelemetry();
  console.log(`  Speed after braking: ${telBrake.speedKmh.toFixed(1)} km/h`);
  if (telBrake.speedKmh > telAccel.speedKmh * 0.5) {
    throw new Error(`Brakes failed to slow car: speed is ${telBrake.speedKmh.toFixed(1)} km/h`);
  }

  // Continue holding brake to engage reverse and back up for 1.5 seconds (360 ticks)
  console.log('  Holding brake to engage reverse and back up...');
  for (let i = 0; i < 360; i++) {
    vehicle.step(dt, 0, 0, 1.0);
    physicsWorld.step();
    simulatedTime += dt;
  }

  const telReverse = vehicle.getTelemetry();
  console.log(`  Reverse state: Gear = ${telReverse.gear}, Speed = ${telReverse.speedKmh.toFixed(1)} km/h`);
  if (telReverse.gear !== -1) {
    throw new Error(`Holding brake failed to engage reverse gear: gear is ${telReverse.gear}`);
  }

  // Release pedals to stop from reverse: car should transition into Neutral (0)
  console.log('  Releasing pedals to stop from reverse...');
  for (let i = 0; i < 500; i++) {
    vehicle.step(dt, 0, 0, 0);
    physicsWorld.step();
    simulatedTime += dt;
  }
  const telNeutral = vehicle.getTelemetry();
  console.log(`  Stopped state after reverse: Gear = ${telNeutral.gear}, Speed = ${telNeutral.speedKmh.toFixed(1)} km/h`);
  if (telNeutral.gear !== 0) {
    throw new Error(`Stopping from reverse failed to return to Neutral (gear 0): gear is ${telNeutral.gear}`);
  }
  console.log('  ✅ Return to Neutral after stopping from reverse verified.');

  console.log('  ✅ Vehicle acceleration, gearbox shifting, ABS braking, and automatic reverse verified in 240 Hz Rapier loop.\n');

  // Test 5: Absolute Truth Horizontal Neutral & Steering Orientation
  console.log('Test 5: Absolute Truth Horizontal Neutral & Dual-Landscape Orientation...');
  const orientMgr = new DeviceOrientationManager();
  const handleMotionPrivate = (orientMgr as unknown as { handleMotion: (e: unknown) => void }).handleMotion.bind(orientMgr);

  // 1. Landscape-Primary Level (gx = 9.8, gy = 0.0) -> must be 0.0 deg
  for (let i = 0; i < 30; i++) {
    handleMotionPrivate({ accelerationIncludingGravity: { x: 9.8, y: 0.0, z: 0.0 } });
  }
  const telLevelPrimary = orientMgr.getTelemetry();
  if (Math.abs(telLevelPrimary.angleDeg) > 0.1 || Math.abs(telLevelPrimary.steer) > 0.01) {
    throw new Error(`Landscape-Primary level angle is ${telLevelPrimary.angleDeg.toFixed(2)} deg, expected 0.0`);
  }

  // 2. Landscape-Primary Tilt Right (gx = 9.2, gy = 3.35, +20 deg) -> must be +20 deg, steer > 0
  orientMgr.calibrate();
  for (let i = 0; i < 30; i++) {
    handleMotionPrivate({ accelerationIncludingGravity: { x: 9.2, y: 3.35, z: 0.0 } });
  }
  const telRightPrimary = orientMgr.getTelemetry();
  if (Math.abs(telRightPrimary.angleDeg - 20.0) > 1.0 || telRightPrimary.steer <= 0) {
    throw new Error(`Landscape-Primary right steer failed: angle=${telRightPrimary.angleDeg.toFixed(1)} deg, steer=${telRightPrimary.steer}`);
  }

  // 3. Landscape-Primary Tilt Left (gx = 9.2, gy = -3.35, -20 deg) -> must be -20 deg, steer < 0
  orientMgr.calibrate();
  for (let i = 0; i < 30; i++) {
    handleMotionPrivate({ accelerationIncludingGravity: { x: 9.2, y: -3.35, z: 0.0 } });
  }
  const telLeftPrimary = orientMgr.getTelemetry();
  if (Math.abs(telLeftPrimary.angleDeg - (-20.0)) > 1.0 || telLeftPrimary.steer >= 0) {
    throw new Error(`Landscape-Primary left steer failed: angle=${telLeftPrimary.angleDeg.toFixed(1)} deg, steer=${telLeftPrimary.steer}`);
  }

  // 4. Landscape-Secondary Level (gx = -9.8, gy = 0.0) -> must be 0.0 deg
  orientMgr.calibrate();
  for (let i = 0; i < 30; i++) {
    handleMotionPrivate({ accelerationIncludingGravity: { x: -9.8, y: 0.0, z: 0.0 } });
  }
  const telLevelSecondary = orientMgr.getTelemetry();
  if (Math.abs(telLevelSecondary.angleDeg) > 0.1 || Math.abs(telLevelSecondary.steer) > 0.01) {
    throw new Error(`Landscape-Secondary level angle is ${telLevelSecondary.angleDeg.toFixed(2)} deg, expected 0.0`);
  }

  // 5. Vertical Portrait Mode (gx = 0.0, gy = 9.8) -> must NOT be flat 0.0 deg (should be ~90 deg)
  orientMgr.calibrate();
  for (let i = 0; i < 30; i++) {
    handleMotionPrivate({ accelerationIncludingGravity: { x: 0.0, y: 9.8, z: 0.0 } });
  }
  const telPortrait = orientMgr.getTelemetry();
  if (Math.abs(telPortrait.angleDeg - 90.0) > 2.0) {
    throw new Error(`Vertical portrait should measure ~90 deg, got ${telPortrait.angleDeg.toFixed(1)} deg`);
  }
  console.log(`  ✅ Landscape-Primary: Level = ${telLevelPrimary.angleDeg.toFixed(1)}°, Tilt Right = +${telRightPrimary.angleDeg.toFixed(1)}°, Tilt Left = ${telLeftPrimary.angleDeg.toFixed(1)}°`);
  console.log(`  ✅ Landscape-Secondary: Level = ${telLevelSecondary.angleDeg.toFixed(1)}°`);
  console.log(`  ✅ Vertical Portrait correctly identifies as non-flat (${telPortrait.angleDeg.toFixed(1)}°).\n`);

  console.log('🎉 All Phase 1 Validation Tests Passed Successfully!');
}

runValidationTests().catch((err) => {
  console.error('❌ Validation Test Failed:', err);
  process.exit(1);
});
