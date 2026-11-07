import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function diag() {
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

  for (let step = 0; step < 240 * 2; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    if (step % 20 === 0) {
      const tel = vehicle.getTelemetry();
      const rw = vehicle['wheels'][2];
      const dtInfo = vehicle['lastDrivetrainInfo'];
      console.log(`step ${step} (t=${(step*dt).toFixed(2)}s): speed=${tel.speedKmh.toFixed(1)} km/h, gear=${tel.gear}, rpm=${Math.round(tel.rpm)}, rw.omega=${rw.angularVelocity.toFixed(1)}, slipRatio=${rw.slipRatio.toFixed(3)}, wheelTorque=${dtInfo.wheelTorqueNm.toFixed(0)}`);
    }
  }
}

diag().catch(console.error);
