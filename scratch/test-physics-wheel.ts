import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function testWheelModel() {
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  const physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 30000)
    .setTranslation(0, -0.5, 15000)
    .setFriction(1.0);
  physicsWorld.world.createCollider(groundCol);

  const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });

  const dt = 1.0 / 240.0;
  for (let i = 0; i < 240; i++) {
    vehicle.step(dt, 0, 0, 0);
    physicsWorld.step();
  }

  let t100 = null, t200 = null, topSpeed = 0;
  for (let step = 0; step < 240 * 40; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    const speed = vehicle.getTelemetry().speedKmh;
    const gear = vehicle.getTelemetry().gear;
    const rpm = vehicle.getTelemetry().rpm;
    if (speed > topSpeed) topSpeed = speed;

    if (t100 === null && speed >= 100) {
      t100 = t;
      console.log(`>>> 0-100 km/h: ${t.toFixed(2)}s`);
    }
    if (t200 === null && speed >= 200) {
      t200 = t;
      console.log(`>>> 0-200 km/h: ${t.toFixed(2)}s`);
    }
    if (step % (240 * 5) === 0) {
      console.log(`t=${t.toFixed(0)}s: Speed=${speed.toFixed(1)} km/h, Gear=${gear}, RPM=${Math.round(rpm)}`);
    }
  }

  console.log(`\nFinal Top Speed: ${topSpeed.toFixed(1)} km/h`);
}

testWheelModel().catch(console.error);
