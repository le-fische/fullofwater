import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function inspectForces() {
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
  for (let i = 0; i < 240; i++) { vehicle.step(dt, 0, 0, 0); physicsWorld.step(); }

  for (let step = 0; step < 240 * 35; step++) {
    vehicle.step(dt, 0, 1.0, 0);
    physicsWorld.step();
  }

  // Now inspect
  const rw2 = vehicle['wheels'][2];
  const rw3 = vehicle['wheels'][3];
  const fw0 = vehicle['wheels'][0];
  const dtInfo = vehicle['lastDrivetrainInfo'];
  const linvel = vehicle.chassisBody.linvel();
  const aero = vehicle.aero.computeForces(linvel.z);
  console.log(`Speed: ${(linvel.z * 3.6).toFixed(1)} km/h | Gear: ${dtInfo.gear} | RPM: ${Math.round(dtInfo.rpm)}`);
  console.log(`WheelTorque: ${dtInfo.wheelTorqueNm.toFixed(0)} Nm | DriveTorqueOnWheel: ${(dtInfo.wheelTorqueNm*0.5).toFixed(0)} Nm`);
  console.log(`RW2 slip: ${rw2.slipRatio.toFixed(3)}, omega: ${rw2.angularVelocity.toFixed(1)}, roadSpin: ${(linvel.z / rw2.radius).toFixed(1)}`);
  console.log(`FW0 slip: ${fw0.slipRatio.toFixed(3)}, omega: ${fw0.angularVelocity.toFixed(1)}`);
  console.log(`Aero Drag: ${aero.dragForceN.toFixed(0)} N | Aero Downforce: ${aero.totalDownforceN.toFixed(0)} N`);
}

inspectForces().catch(console.error);
