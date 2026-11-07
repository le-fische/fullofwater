import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function testTurnIn() {
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  profile.steering.maxWheelAngleDeg = 34.0;
  profile.steering.speedSensitivityStartKmh = 65.0;
  profile.tires.front.pacejkaLat.D = 1.68;

  const physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 500)
    .setTranslation(0, -0.5, 0)
    .setFriction(1.0);
  physicsWorld.world.createCollider(groundCol);

  const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });

  const dt = 1.0 / 240.0;
  for (let i = 0; i < 240; i++) { vehicle.step(dt, 0, 0, 0); physicsWorld.step(); }

  // Accelerate to 50 km/h (low speed hairpin approach)
  while (vehicle.getTelemetry().speedKmh < 50) {
    vehicle.step(dt, 0, 0.6, 0);
    physicsWorld.step();
  }

  // Turn hard right (steer = 1.0) at 50 km/h
  let maxYawRate = 0;
  let minTurningRadius = Infinity;
  const startPos = vehicle.chassisBody.translation();

  for (let i = 0; i < 240 * 2; i++) {
    vehicle.step(dt, 1.0, 0.2, 0);
    physicsWorld.step();
    const angvel = vehicle.chassisBody.angvel();
    const linvel = vehicle.chassisBody.linvel();
    const yawRate = Math.abs(angvel.y);
    if (yawRate > maxYawRate) maxYawRate = yawRate;

    const speed = Math.hypot(linvel.x, linvel.z);
    if (yawRate > 0.1) {
      const radius = speed / yawRate;
      if (radius < minTurningRadius) minTurningRadius = radius;
    }
  }

  console.log(`=== LOW SPEED CORNERING TEST (50 km/h) ===`);
  console.log(`Peak Yaw Rate: ${(maxYawRate * 180 / Math.PI).toFixed(1)} deg/s`);
  console.log(`Minimum Turning Radius: ${minTurningRadius.toFixed(1)} m`);
}

testTurnIn().catch(console.error);
