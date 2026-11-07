import { NordschleifeCenterline } from '../src/host/streaming/centerline';
import { TrackMeshGenerator } from '../src/host/streaming/track-mesh-generator';
import * as THREE from 'three';

function checkCollisions() {
  for (const trackName of ['nordschleife', 'gp_strecke']) {
    console.log(`\n=== CHECKING COLLISION MESH FOR: ${trackName} ===`);
    const cl = new NordschleifeCenterline(trackName);
    const N = cl.samples.length;

    let minBarrierDistToCenter = Infinity;
    let minRoadDistToCenter = Infinity;
    let penetratingPoints: number[] = [];

    // Test each chunk
    const totalChunks = 11;
    const samplesPerChunk = Math.floor(N / totalChunks);

    for (let c = 0; c < totalChunks; c++) {
      const startIdx = c * samplesPerChunk;
      const endIdx = (c === totalChunks - 1) ? N : (c + 1) * samplesPerChunk;
      const data = TrackMeshGenerator.generateChunkMesh(cl.samples, startIdx, endIdx, 25);

      const verts = data.collisionVertices;
      const indices = data.collisionIndices;

      // In colSection: verts are in groups of 9 (each cross section has 9 verts)
      // 0: BarrierLeftTop, 1: GrassLeft, 2: KerbLeft, 3: RoadLeft, 4: Center, 5: RoadRight, 6: KerbRight, 7: GrassRight, 8: BarrierRightTop
      const numSections = verts.length / (9 * 3);
      for (let s = 0; s < numSections; s++) {
        const base = s * 9 * 3;
        const pCenter = new THREE.Vector3(verts[base + 4*3], verts[base + 4*3 + 1], verts[base + 4*3 + 2]);
        const pRoadL = new THREE.Vector3(verts[base + 3*3], verts[base + 3*3 + 1], verts[base + 3*3 + 2]);
        const pBarrierL = new THREE.Vector3(verts[base + 0*3], verts[base + 0*3 + 1], verts[base + 0*3 + 2]);
        const pBarrierR = new THREE.Vector3(verts[base + 8*3], verts[base + 8*3 + 1], verts[base + 8*3 + 2]);

        const distL = pCenter.distanceTo(pBarrierL);
        const distR = pCenter.distanceTo(pBarrierR);
        const roadHalfW = pCenter.distanceTo(pRoadL);

        if (distL < minBarrierDistToCenter) minBarrierDistToCenter = distL;
        if (distR < minBarrierDistToCenter) minBarrierDistToCenter = distR;

        // Check if barrier is closer to center than road edge (i.e. inside the track!)
        if (distL <= roadHalfW || distR <= roadHalfW) {
          penetratingPoints.push(s);
        }
      }
    }

    console.log(`Min Barrier distance to centerline: ${minBarrierDistToCenter.toFixed(2)}m`);
    console.log(`Number of barrier vertices inside road: ${penetratingPoints.length}`);
  }
}

checkCollisions();
