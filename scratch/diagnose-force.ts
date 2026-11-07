import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function diagnoseForce() {
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

  for (let step = 0; step < 240 * 2; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;

    if (step % 40 === 0) {
      const wRear = (vehicle as any).wheels[2];
      const dtInfo = (vehicle as any).lastDrivetrainInfo;
      const linvel = vehicle.chassisBody.linvel();
      console.log(`t=${t.toFixed(2)}s: Speed=${(linvel.z * 3.6).toFixed(1)} km/h, WheelTorque=${dtInfo.wheelTorqueNm.toFixed(0)} Nm, RearOmega=${wRear.angularVelocity.toFixed(1)} rad/s, Slip=${wRear.slipRatio.toFixed(3)}, Fz=${wRear.normalForce.toFixed(0)} N`);
    }
  }
}

diagnoseForce().catch(console.error);
