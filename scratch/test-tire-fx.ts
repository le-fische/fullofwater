import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';
import { PacejkaTireModel } from '../src/host/physics/tire-model';

async function testTireFx() {
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

  for (let step = 0; step < 120; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
    const t = (step + 1) * dt;
    if (step % 10 === 0) {
      const w2 = (vehicle as any).wheels[2];
      const coefLong = profile.tires.rear.pacejkaLong;
      const Fz = w2.normalForce;
      const fx = (PacejkaTireModel as any).evaluatePacejka(w2.slipRatio, Fz, coefLong, 1.0);
      const totalRearFx = fx * 2;
      const linvel = vehicle.chassisBody.linvel();
      console.log(`t=${t.toFixed(2)}s: Speed=${(linvel.z * 3.6).toFixed(1)} km/h, Slip=${w2.slipRatio.toFixed(3)}, Fz_wheel=${Fz.toFixed(0)}, Fx_wheel=${fx.toFixed(0)} N, TotalFx=${totalRearFx.toFixed(0)} N, Accel=${(totalRearFx / 1242 / 9.81).toFixed(2)} G`);
    }
  }
}

testTireFx().catch(console.error);
