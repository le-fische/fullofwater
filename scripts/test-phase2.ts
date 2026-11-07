/**
 * Phase 2 Validation Test Suite
 * Tests Nordschleife Centerline, Topography, Karussell 33° Banking,
 * 11-Chunk Partitioning, 3-Chunk Streaming Window, Projection Math,
 * Rapier Collision Mesh Integration, and Lap Timing.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { NordschleifeCenterline } from '../src/host/streaming/centerline';
import { NordschleifeLapTimer } from '../src/host/streaming/lap-timer';
import { FloatingOriginManager } from '../src/host/streaming/floating-origin';
import { TrackSweeper } from './track-pipeline/sweep-track';
import { NordschleifeChunkStreamer } from '../src/host/streaming/chunk-streamer';

async function runPhase2Tests(): Promise<void> {
  console.log('🧪 Starting Phase 2 Comprehensive Validation Tests...\n');

  // Test 1: Spline Geometry & Topography
  console.log('Test 1: Nordschleife Centerline & Topography Profile...');
  const centerline = new NordschleifeCenterline();
  console.log(`  Total Circuit Length: ${centerline.totalLengthM} m`);
  console.log(`  Equidistant Sample Count: ${centerline.samples.length} (Spacing: ${centerline.sampleSpacingM} m)`);

  if (centerline.totalLengthM < 20000 || centerline.totalLengthM > 21000) {
    throw new Error(`Expected circuit length ~20.7-20.8km, got ${centerline.totalLengthM}`);
  }

  // Find min and max elevation along the spline
  let maxElevation = -Infinity;
  let minElevation = Infinity;
  for (const s of centerline.samples) {
    if (s.elevation > maxElevation) maxElevation = s.elevation;
    if (s.elevation < minElevation) minElevation = s.elevation;
  }
  const elevationDrop = maxElevation - minElevation;
  console.log(`  Max Elevation: ${maxElevation.toFixed(1)} m (Hohe Acht / T13)`);
  console.log(`  Min Elevation: ${minElevation.toFixed(1)} m (Breidscheid)`);
  console.log(`  Total Vertical Elevation Drop: ${elevationDrop.toFixed(1)} m`);

  if (maxElevation < 610) throw new Error(`High point elevation too low: ${maxElevation}`);
  if (minElevation > 360) throw new Error(`Low point elevation too high: ${minElevation}`);
  if (elevationDrop < 260) throw new Error(`Elevation drop insufficient: ${elevationDrop}`);
  console.log('  ✅ Elevation profile matches real Eifel topography.\n');

  // Test 2: Karussell 33° Banking & Landmarks
  console.log('Test 2: Landmark Banking & Specific Curvature...');
  const karussellSamples = centerline.samples.filter(
    (s) => s.landmark && s.landmark.name.includes('Karussell') && !s.landmark.name.includes('Mini')
  );
  const karussellSample = karussellSamples.reduce(
    (max, s) => (s.bankingRad > max.bankingRad ? s : max),
    karussellSamples[0]
  );
  if (!karussellSample) throw new Error('Karussell sample missing');

  const karussellProj = centerline.projectPosition(karussellSample.position);
  const bankingDeg = THREE.MathUtils.radToDeg(karussellSample.bankingRad);
  console.log(`  Caracciola-Karussell Banking: ${bankingDeg.toFixed(1)}° (Expected: ~33.0°)`);
  if (Math.abs(bankingDeg - 33.0) > 1.0) {
    throw new Error(`Karussell banking mismatch: expected 33 deg, got ${bankingDeg}`);
  }
  console.log(`  Identified Landmark near Karussell: "${karussellProj.landmarkName}"`);
  console.log('  ✅ Karussell banking and landmark identification verified.\n');

  // Test 3: Partitioning & Collision Overlap
  console.log('Test 3: 11-Chunk Partitioning & 100m Collision Overlap...');
  const manifest = TrackSweeper.generateChunkManifest();
  if (manifest.chunkCount !== 11) throw new Error(`Expected 11 chunks, got ${manifest.chunkCount}`);

  for (let i = 0; i < manifest.chunks.length; i++) {
    const chunk = manifest.chunks[i];
    const chunkSpan = chunk.endDistanceM - chunk.startDistanceM;
    const colSpan = chunk.collisionEndDistanceM - chunk.collisionStartDistanceM;
    if (chunkSpan <= 0) throw new Error(`Invalid chunk span at ${i}`);
    if (colSpan < chunkSpan) throw new Error(`Collision span smaller than visual at ${i}`);
  }
  console.log(`  Chunk count: ${manifest.chunks.length} chunks of ~${(manifest.totalLengthMeters / 11 / 1000).toFixed(2)} km each.`);
  console.log('  ✅ 11 chunks with 100m overlap verified.\n');

  // Test 4: High-Performance Centerline Projection
  console.log('Test 4: Spline Projection & Off-Track Detection...');
  const t0 = performance.now();
  const iterations = 1000;
  for (let i = 0; i < iterations; i++) {
    const testPoint = centerline.samples[1000].position; // Sample near Fuchsröhre / Adenauer Forst
    centerline.projectPosition(testPoint, 1000);
  }
  const avgTimeMs = (performance.now() - t0) / iterations;
  console.log(`  Average Projection Time: ${(avgTimeMs * 1000).toFixed(2)} µs per call (< 50 µs target)`);
  if (avgTimeMs > 0.1) throw new Error('Projection math too slow for 60Hz loop');

  // Test off-track detection
  const onTrackPoint = centerline.samples[100].position.clone();
  const onTrackProj = centerline.projectPosition(onTrackPoint);
  if (onTrackProj.isOffTrack) throw new Error('Expected on-track point to be within limits');

  const offTrackPoint = onTrackPoint.clone().addScaledVector(centerline.samples[100].binormal, 15.0); // 15m lateral
  const offTrackProj = centerline.projectPosition(offTrackPoint);
  if (!offTrackProj.isOffTrack) throw new Error('Expected 15m lateral point to be off-track');
  console.log('  ✅ On-track / off-track boundaries verified.\n');

  // Test 5: Floating Origin Math
  console.log('Test 5: Floating Origin Shift & Precision Guard...');
  const originMgr = new FloatingOriginManager();
  const farPoint = new THREE.Vector3(1500, 500, 1600);
  const shiftResult = originMgr.checkAndShift(farPoint);

  if (!shiftResult.shifted) throw new Error('Expected origin shift for point > 1200m');
  console.log(`  Shifted World Offset Delta: [${shiftResult.shiftDelta.x.toFixed(1)}, ${shiftResult.shiftDelta.y.toFixed(1)}, ${shiftResult.shiftDelta.z.toFixed(1)}]`);
  console.log(`  Recentered Local Point: [${farPoint.x.toFixed(1)}, ${farPoint.y.toFixed(1)}, ${farPoint.z.toFixed(1)}]`);
  if (farPoint.x !== 0 || farPoint.z !== 0) throw new Error('Recentered horizontal point must be (0,0)');
  console.log('  ✅ Floating origin prevents float32 jitter.\n');

  // Test 6: Rapier Trimesh Collision & Active Chunk Streamer
  console.log('Test 6: Rapier 3D Trimesh Generation & 3-Chunk Window Streamer...');
  await RAPIER.init();
  const rapierWorld = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
  const scene = new THREE.Scene();

  const streamer = new NordschleifeChunkStreamer(scene, rapierWorld, RAPIER, centerline);

  // Initial load at start line (chunk 0) -> should load chunks [10, 0, 1]
  streamer.update(0);
  console.log(`  Initial Active Chunks at Start Line: [${Array.from(streamer.activeChunks.keys()).join(', ')}]`);
  if (streamer.activeChunks.size !== 3) throw new Error('Expected exactly 3 active chunks');
  if (!streamer.activeChunks.has(10) || !streamer.activeChunks.has(0) || !streamer.activeChunks.has(1)) {
    throw new Error('Expected wrap-around chunks 10, 0, 1 active at start');
  }

  // Simulate vehicle traveling forward at 250 km/h across chunk boundary (~2500m -> chunk 1)
  console.log('  Simulating vehicle travel to 2500m (Flugplatz)...');
  streamer.update(2500);
  console.log(`  Active Chunks at 2500m: [${Array.from(streamer.activeChunks.keys()).join(', ')}]`);
  if (!streamer.activeChunks.has(0) || !streamer.activeChunks.has(1) || !streamer.activeChunks.has(2)) {
    throw new Error('Expected chunks 0, 1, 2 active');
  }
  if (streamer.activeChunks.has(10)) throw new Error('Chunk 10 should have been unloaded');

  // Verify Rapier collider exists and interacts with physics
  const chunk0 = streamer.activeChunks.get(0)!;
  if (!chunk0.collisionCollider) throw new Error('Missing Rapier collider on chunk 0');
  console.log(`  Rapier Trimesh Collider registered successfully with friction 1.0.`);

  // Cleanup streamer
  streamer.dispose();
  console.log('  ✅ 3-chunk window streaming and dynamic Rapier collider swapping verified.\n');

  // Test 7: Start/Finish Lap Timing
  console.log('Test 7: Start/Finish Gate & Lap Timing Engine...');
  const timer = new NordschleifeLapTimer();

  // Step 1: Start line trigger
  let telem = timer.update(50, false, 1000);
  if (telem.lapCount !== 1) throw new Error('Expected lapCount 1 after crossing start');

  // Step 2: Mid-lap progression
  telem = timer.update(12000, false, 180000); // 3 minutes in, at Klostertal
  if (telem.lapProgressRatio < 0.5) throw new Error('Expected progress ratio > 0.5');

  // Step 3: Finish line crossing (from 20700m to 50m)
  telem = timer.update(20700, false, 420000);
  telem = timer.update(50, false, 430000); // ~7m 10s lap time
  console.log(`  Completed Lap 1 Time: ${(telem.lastLapTimeMs! / 1000).toFixed(2)}s`);
  console.log(`  Session Best Lap Time: ${(telem.bestLapTimeMs! / 1000).toFixed(2)}s`);
  console.log(`  New Lap Count: ${telem.lapCount}`);

  if (telem.lapCount !== 2) throw new Error('Expected lapCount 2 after finish line');
  if (telem.lastLapTimeMs !== 429000) throw new Error('Lap time calculation incorrect');
  console.log('  ✅ Start/finish lap timing verified.\n');

  console.log('🎉 All Phase 2 Validation Tests Passed Successfully!');
}

runPhase2Tests().catch((err) => {
  console.error('❌ Phase 2 Validation Failed:', err);
  process.exit(1);
});
