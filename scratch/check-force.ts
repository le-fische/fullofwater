import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function checkTireForceZ() {
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  const physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 10000)
    .setTranslation(0, -0.5, 5000)
    .setFriction(1.0);
  physicsWorld.world.createCollider(groundCol);

  const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });
  const dt = 1.0 / 240.0;
  for (let i = 0; i < 240; i++) {
    vehicle.step(dt, 0, 0, 0);
    physicsWorld.step();
  }

  for (let step = 0; step < 240 * 1; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    if (step % 20 === 0) {
      const linvel = vehicle.chassisBody.linvel();
      const accel = (linvel.z - (vehicle as any).prevZ || 0) / dt;
      (vehicle as any).prevZ = linvel.z;
      console.log(`t=${t.toFixed(2)}s: Speed=${(linvel.z * 3.6).toFixed(1)} km/h, Accel=${(linvel.z / t).toFixed(2)} m/s^2 (${(linvel.z / t / 9.81).toFixed(2)} G)`);
    }
  }
}

checkTireForceZ().catch(console.error);
