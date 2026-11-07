import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function testFreeRollingFront() {
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  const physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 10000)
    .setTranslation(0, -0.5, 5000)
    .setFriction(1.0);
  physicsWorld.world.createCollider(groundCol);

  // Patch RaycastVehicle to ensure free rolling front wheels produce 0 braking slip when no brake is applied
  const origStep = RaycastVehicle.prototype.step;
  RaycastVehicle.prototype.step = function(dt, rawSteer, rawThrottle, rawBrake) {
    // Before step, let's call original
    origStep.call(this, dt, rawSteer, rawThrottle, rawBrake);
  };

  const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });
  const dt = 1.0 / 240.0;
  for (let i = 0; i < 240; i++) {
    vehicle.step(dt, 0, 0, 0);
    physicsWorld.step();
  }

  // Let's test with front wheels set to targetRoadSpin before step
  let t100 = null, t200 = null;
  for (let step = 0; step < 240 * 12; step++) {
    // Synchronize front wheels to road speed if not braking
    const linvel = vehicle.chassisBody.linvel();
    const vx = linvel.z;
    const w0 = (vehicle as any).wheels[0];
    const w1 = (vehicle as any).wheels[1];
    w0.angularVelocity = vx / w0.radius;
    w1.angularVelocity = vx / w1.radius;

    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    const speed = vehicle.getTelemetry().speedKmh;
    if (t100 === null && speed >= 100) t100 = t;
    if (t200 === null && speed >= 200) { t200 = t; break; }
  }

  console.log(`With free rolling front wheels: 0-100: ${t100?.toFixed(2)}s, 0-200: ${t200?.toFixed(2)}s`);
}

testFreeRollingFront().catch(console.error);
