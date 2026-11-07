import osmNordschleife from '../tracks/nordschleife/osm_nordschleife.json';
import osmGp from '../tracks/gp/osm_gp.json';
import * as THREE from 'three';

function testSmoothing(name: string, pts: number[][]) {
  console.log(`=== TESTING SMOOTHING ON ${name} ===`);
  const N = pts.length;

  // 1. Compute tangents using a 5-tap Gaussian window
  const tangents: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];

  // Multi-pass smoothing of raw points first to eliminate high-frequency digitizer noise
  const smoothedPts: THREE.Vector3[] = [];
  const W = 5; // 5-sample window
  const weights = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136]; // Gaussian sigma = 1.0

  for (let i = 0; i < N; i++) {
    const sp = new THREE.Vector3(0, 0, 0);
    for (let k = -2; k <= 2; k++) {
      const idx = (i + k + N) % N;
      const w = weights[k + 2];
      sp.x += pts[idx][0] * w;
      sp.y += pts[idx][1] * w;
      sp.z += pts[idx][2] * w;
    }
    smoothedPts.push(sp);
  }

  // Compute smooth tangents from smoothed points using central differences with 7-sample lookahead/behind
  for (let i = 0; i < N; i++) {
    const t = new THREE.Vector3();
    // 5-point central stencil for 1st derivative: (-p_{i+2} + 8 p_{i+1} - 8 p_{i-1} + p_{i-2}) / 12
    const p_m2 = smoothedPts[(i - 2 + N) % N];
    const p_m1 = smoothedPts[(i - 1 + N) % N];
    const p_p1 = smoothedPts[(i + 1) % N];
    const p_p2 = smoothedPts[(i + 2) % N];

    t.x = (-p_p2.x + 8 * p_p1.x - 8 * p_m1.x + p_m2.x) / 12;
    t.y = (-p_p2.y + 8 * p_p1.y - 8 * p_m1.y + p_m2.y) / 12;
    t.z = (-p_p2.z + 8 * p_p1.z - 8 * p_m1.z + p_p2.z) / 12;
    t.normalize();
    tangents.push(t);

    const hLen = Math.hypot(t.x, t.z) || 1e-5;
    const hRight = new THREE.Vector3(t.z / hLen, 0, -t.x / hLen);
    let normal = new THREE.Vector3().crossVectors(t, hRight).normalize();
    if (normal.y < 0) normal.negate();
    let binormal = new THREE.Vector3().crossVectors(normal, t).normalize();
    binormals.push(binormal);
  }

  // Smooth binormals with Gaussian filter to ensure continuous curvature
  const smoothBinormals: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const sb = new THREE.Vector3(0, 0, 0);
    for (let k = -3; k <= 3; k++) {
      const idx = (i + k + N) % N;
      // Gaussian weights for 7-tap
      const dist = Math.abs(k);
      const w = Math.exp(-0.5 * (dist * dist) / (1.5 * 1.5));
      sb.addScaledVector(binormals[idx], w);
    }
    sb.normalize();
    smoothBinormals.push(sb);
  }

  // Measure angles and kinks
  const angles: number[] = [];
  const edgeDistDeltas: number[] = [];

  for (let i = 0; i < N; i++) {
    const b1 = smoothBinormals[i];
    const b2 = smoothBinormals[(i + 1) % N];
    const dot = Math.min(1.0, Math.max(-1.0, b1.dot(b2)));
    const angleDeg = Math.acos(dot) * (180 / Math.PI);
    angles.push(angleDeg);
    edgeDistDeltas.push(6.0 * Math.sin(angleDeg * (Math.PI / 180)));
  }

  const maxAngle = Math.max(...angles);
  const avgAngle = angles.reduce((a, b) => a + b, 0) / N;
  const maxKink = Math.max(...edgeDistDeltas);
  const avgKink = edgeDistDeltas.reduce((a, b) => a + b, 0) / N;

  console.log(`NEW Max binormal turn between consecutive 5m points: ${maxAngle.toFixed(2)} deg (was 16-25 deg)`);
  console.log(`NEW Average binormal turn: ${avgAngle.toFixed(2)} deg`);
  console.log(`NEW Max edge kink on white line outline: ${(maxKink * 100).toFixed(1)} cm (was 166-253 cm!)`);
  console.log(`NEW Average edge kink: ${(avgKink * 100).toFixed(1)} cm`);
}

testSmoothing('Nordschleife', osmNordschleife.points);
testSmoothing('GP Strecke', osmGp.points);
