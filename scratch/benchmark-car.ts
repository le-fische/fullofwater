import fs from 'fs';
import { PhysicsWorld } from '../src/host/physics/world';
import { RaycastVehicle } from '../src/host/physics/raycast-vehicle';

async function runBenchmark() {
  const profileRaw = fs.readFileSync('public/assets/cars/porsche_992_rsr/profile.json', 'utf8');
  const profile = JSON.parse(profileRaw);

  const dt = 1.0 / 240.0;

  console.log('=== PORSCHE 911 RSR-19 (GTE) PERFORMANCE BENCHMARK ===\n');

  // Test 1: Full Acceleration & Top Speed Run (35s)
  {
    const physicsWorld = new PhysicsWorld();
    await physicsWorld.init();

    const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 30000)
      .setTranslation(0, -0.5, 15000)
      .setFriction(1.0);
    physicsWorld.world.createCollider(groundCol);

    const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });

    // Settle suspension
    for (let i = 0; i < 240; i++) {
      vehicle.step(dt, 0, 0, 0);
      physicsWorld.step();
    }

    let t100: number | null = null;
    let t200: number | null = null;
    let maxSpeed = 0;
    let lastGear = 1;

    for (let step = 0; step < 240 * 35; step++) {
      vehicle.step(dt, 0, 1.0, 0);
      physicsWorld.step();
      const t = (step + 1) * dt;

      const tel = vehicle.getTelemetry();
      const speed = tel.speedKmh;
      if (speed > maxSpeed) maxSpeed = speed;

      if (tel.gear !== lastGear) {
        console.log(`[Shift] Gear ${lastGear} -> ${tel.gear} at t=${t.toFixed(2)}s | Speed: ${speed.toFixed(1)} km/h | RPM: ${Math.round(tel.rpm)}`);
        lastGear = tel.gear;
      }

      if (t100 === null && speed >= 100) {
        t100 = t;
        console.log(`>>> 0-100 km/h: ${t100.toFixed(2)}s (Target: 3.1 - 3.2s)`);
      }
      if (t200 === null && speed >= 200) {
        t200 = t;
        console.log(`>>> 0-200 km/h: ${t200.toFixed(2)}s (Target: 8.5 - 8.8s)`);
      }
      if (step % (240 * 5) === 0 && step > 0) {
        console.log(`[Cruise t=${t.toFixed(0)}s] Speed: ${speed.toFixed(1)} km/h | Gear: ${tel.gear} | RPM: ${Math.round(tel.rpm)}`);
      }
    }
    console.log(`\nFinal Top Speed: ${maxSpeed.toFixed(1)} km/h (Standard aero target: 296 - 298 km/h)\n`);
  }

  // Test 2: 100 -> 0 km/h Braking Test
  {
    const physicsWorld = new PhysicsWorld();
    await physicsWorld.init();
    const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 10000)
      .setTranslation(0, -0.5, 5000)
      .setFriction(1.0);
    physicsWorld.world.createCollider(groundCol);

    const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });
    for (let i = 0; i < 240; i++) { vehicle.step(dt, 0, 0, 0); physicsWorld.step(); }

    // Accelerate to 100 km/h
    while (vehicle.getTelemetry().speedKmh < 100) {
      vehicle.step(dt, 0, 1.0, 0);
      physicsWorld.step();
    }

    const startZ = vehicle.chassisBody.translation().z;
    let brakeTime = 0;
    while (vehicle.getTelemetry().speedKmh > 0.5 && brakeTime < 10.0) {
      vehicle.step(dt, 0, 0, 1.0);
      physicsWorld.step();
      brakeTime += dt;
    }
    const stopZ = vehicle.chassisBody.translation().z;
    const dist100 = stopZ - startZ;
    console.log(`=== 100 -> 0 km/h BRAKING ===`);
    console.log(`Time: ${brakeTime.toFixed(2)}s | Distance: ${dist100.toFixed(1)}m (Target: ~30 - 32m) | Avg G: ${(100/3.6 / brakeTime / 9.81).toFixed(2)} G\n`);
  }

  // Test 3: 200 -> 0 km/h Braking Test
  {
    const physicsWorld = new PhysicsWorld();
    await physicsWorld.init();
    const groundCol = physicsWorld.rapier.ColliderDesc.cuboid(500, 0.5, 10000)
      .setTranslation(0, -0.5, 5000)
      .setFriction(1.0);
    physicsWorld.world.createCollider(groundCol);

    const vehicle = new RaycastVehicle(physicsWorld.world, physicsWorld.rapier, profile, { x: 0, y: 0.5, z: 0 });
    for (let i = 0; i < 240; i++) { vehicle.step(dt, 0, 0, 0); physicsWorld.step(); }

    // Accelerate to 200 km/h
    while (vehicle.getTelemetry().speedKmh < 200) {
      vehicle.step(dt, 0, 1.0, 0);
      physicsWorld.step();
    }

    const startZ = vehicle.chassisBody.translation().z;
    let brakeTime = 0;
    while (vehicle.getTelemetry().speedKmh > 0.5 && brakeTime < 15.0) {
      vehicle.step(dt, 0, 0, 1.0);
      physicsWorld.step();
      brakeTime += dt;
    }
    const stopZ = vehicle.chassisBody.translation().z;
    const dist200 = stopZ - startZ;
    console.log(`=== 200 -> 0 km/h BRAKING ===`);
    console.log(`Time: ${brakeTime.toFixed(2)}s | Distance: ${dist200.toFixed(1)}m (Target: ~110 - 118m) | Avg G: ${(200/3.6 / brakeTime / 9.81).toFixed(2)} G\n`);
  }

  // Test 4: Downforce Verification
  {
    const rho = 1.225;
    const ClA = profile.aero.downforceClA;
    const CdA = profile.aero.dragCdA;
    console.log(`=== AERODYNAMIC DOWNFORCE & DRAG SPECIFICATION ===`);
    for (const vKmh of [100, 150, 200, 250, 298]) {
      const vMs = vKmh / 3.6;
      const downforceN = 0.5 * rho * vMs * vMs * ClA;
      const downforceKg = downforceN / 9.81;
      const dragN = 0.5 * rho * vMs * vMs * CdA;
      console.log(`@ ${vKmh} km/h: Downforce = ${Math.round(downforceN)} N (${Math.round(downforceKg)} kg) | Drag = ${Math.round(dragN)} N`);
    }
  }
}

runBenchmark().catch(console.error);
