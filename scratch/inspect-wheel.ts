import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function inspectWheelForces() {
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

  for (let step = 0; step < 240 * 1.5; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    if (step % 40 === 0) {
      const w2 = (vehicle as any).wheels[2];
      const w3 = (vehicle as any).wheels[3];
      const totalTireFx = w2.normalForce * 1.65; // theoretical max
      console.log(`t=${t.toFixed(2)}s: Speed=${(vehicle.getTelemetry().speedKmh).toFixed(1)}, Fz_rear=${(w2.normalForce + w3.normalForce).toFixed(0)} N, MaxPossibleTractiveForce=${((w2.normalForce + w3.normalForce) * 1.65).toFixed(0)} N, CurrentMaxAccel=${(((w2.normalForce + w3.normalForce) * 1.65) / 1242 / 9.81).toFixed(2)} G`);
    }
  }
}

inspectWheelForces().catch(console.error);
