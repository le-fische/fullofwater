import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function inspectActualFx() {
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

  // Hook step to capture actual tireForces.fx
  const origStep = (vehicle as any).step.bind(vehicle);

  for (let step = 0; step < 240 * 1.5; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    if (step % 40 === 0) {
      const w2 = (vehicle as any).wheels[2];
      const w3 = (vehicle as any).wheels[3];
      const speed = vehicle.getTelemetry().speedKmh;
      // Let's compute what fx was
      console.log(`t=${t.toFixed(2)}s: Speed=${speed.toFixed(1)}, Slip2=${w2.slipRatio.toFixed(3)}, Omega2=${w2.angularVelocity.toFixed(1)}`);
    }
  }
}

inspectActualFx().catch(console.error);
