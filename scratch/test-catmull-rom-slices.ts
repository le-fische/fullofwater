import osmNordschleife from '../tracks/nordschleife/osm_nordschleife.json';
import * as THREE from 'three';

function testCatmullRom(pts: number[][]) {
  const N = pts.length;
  const pVecs = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));

  // Test along Wehrseifen hairpin (near index 1500)
  const hairPinIdx = 1520;
  const SUB_STEPS = 6; // ~0.8m per slice

  const whiteLineLeft: THREE.Vector3[] = [];
  const whiteLineRight: THREE.Vector3[] = [];

  for (let i = hairPinIdx - 10; i < hairPinIdx + 10; i++) {
    const p0 = pVecs[(i - 1 + N) % N];
    const p1 = pVecs[i % N];
    const p2 = pVecs[(i + 1) % N];
    const p3 = pVecs[(i + 2) % N];

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3], false, 'centripetal');

    for (let s = 0; s < SUB_STEPS; s++) {
      // t between p1 and p2: in 4-point Catmull-Rom, parameter 0.333 to 0.666
      // Or standard Hermite between p1 and p2
      const t = s / SUB_STEPS;
      // Hermite spline position
      const m0 = p2.clone().sub(p0).multiplyScalar(0.5);
      const m1 = p3.clone().sub(p1).multiplyScalar(0.5);

      const t2 = t * t;
      const t3 = t2 * t;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      const pos = new THREE.Vector3()
        .addScaledVector(p1, h00)
        .addScaledVector(m0, h10)
        .addScaledVector(p2, h01)
        .addScaledVector(m1, h11);

      // Derivative (tangent)
      const dh00 = 6 * t2 - 6 * t;
      const dh10 = 3 * t2 - 4 * t + 1;
      const dh01 = -6 * t2 + 6 * t;
      const dh11 = 3 * t2 - 2 * t;

      const tangent = new THREE.Vector3()
        .addScaledVector(p1, dh00)
        .addScaledVector(m0, dh10)
        .addScaledVector(p2, dh01)
        .addScaledVector(m1, dh11)
        .normalize();

      const hLen = Math.hypot(tangent.x, tangent.z) || 1e-5;
      const hRight = new THREE.Vector3(tangent.z / hLen, 0, -tangent.x / hLen);
      let normal = new THREE.Vector3().crossVectors(tangent, hRight).normalize();
      if (normal.y < 0) normal.negate();
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      const halfW = 5.0;
      whiteLineLeft.push(pos.clone().addScaledVector(binormal, -halfW));
      whiteLineRight.push(pos.clone().addScaledVector(binormal, halfW));
    }
  }

  // Measure angles between consecutive white line segments
  const kinks: number[] = [];
  for (let j = 1; j < whiteLineLeft.length - 1; j++) {
    const v1 = whiteLineLeft[j].clone().sub(whiteLineLeft[j - 1]).normalize();
    const v2 = whiteLineLeft[j + 1].clone().sub(whiteLineLeft[j]).normalize();
    const angle = Math.acos(Math.min(1.0, Math.max(-1.0, v1.dot(v2)))) * (180 / Math.PI);
    kinks.push(angle);
  }

  const maxKink = Math.max(...kinks);
  const avgKink = kinks.reduce((a, b) => a + b, 0) / kinks.length;

  console.log(`Catmull-Rom Hermite White Line Spline in Hairpin:`);
  console.log(`Max angle between adjacent 0.8m segments: ${maxKink.toFixed(2)} deg (was 16-25 deg!)`);
  console.log(`Avg angle between adjacent segments: ${avgKink.toFixed(2)} deg`);
}

testCatmullRom(osmNordschleife.points);
