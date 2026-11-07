import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function checkFrontWheels() {
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

  for (let step = 0; step < 60; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    if (step % 10 === 0) {
      const w0 = (vehicle as any).wheels[0];
      const w2 = (vehicle as any).wheels[2];
      const linvel = vehicle.chassisBody.linvel();
      console.log(`step ${step}: speed=${(linvel.z*3.6).toFixed(1)}, w0.omega=${w0.angularVelocity.toFixed(2)}, w0.slip=${w0.slipRatio.toFixed(3)}, w0.Fz=${w0.normalForce.toFixed(0)}, w2.omega=${w2.angularVelocity.toFixed(2)}, w2.slip=${w2.slipRatio.toFixed(3)}`);
    }
  }
}

checkFrontWheels().catch(console.error);
