import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function calibrate() {
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  const physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 15000)
    .setTranslation(0, -0.5, 7500)
    .setFriction(1.0);
  physicsWorld.world.createCollider(groundCol);

  // In RaycastVehicle:
  // For free-rolling undriven wheels (!w.isDriven):
  // If not braking, omega tracks vx / w.radius with fast relaxation (e.g. 1 - exp(-120*dt))
  // so tire slip ratio is near zero (~0.005 rolling resistance slip)
  const dt = 1.0 / 240.0;

  // Let's test a realistic relaxation rate for undriven wheels
  for (const frontRelax of [80, 100, 120]) {
    const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });
    for (let i = 0; i < 240; i++) { vehicle.step(dt, 0, 0, 0); physicsWorld.step(); }

    // Let's measure 0-100 and 0-200
    let t100 = null, t200 = null, topSpeed = 0;
    for (let step = 0; step < 240 * 25; step++) {
      // simulate with custom front relaxation
      vehicle.step(dt, 0, 1.0, 0);
      physicsWorld.step();
      const t = (step + 1) * dt;
      const speed = vehicle.getTelemetry().speedKmh;
      if (speed > topSpeed) topSpeed = speed;
      if (t100 === null && speed >= 100) t100 = t;
      if (t200 === null && speed >= 200) t200 = t;
    }
    console.log(`Baseline with frontRelax: 0-100=${t100?.toFixed(2)}s, 0-200=${t200?.toFixed(2)}s, topSpeed=${topSpeed.toFixed(1)} km/h`);
    break;
  }
}

calibrate().catch(console.error);
