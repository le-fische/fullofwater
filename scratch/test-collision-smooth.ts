import { NordschleifeCenterline } from '../src/host/streaming/centerline';
import { TrackMeshGenerator } from '../src/host/streaming/track-mesh-generator';
import * as THREE from 'three';

function testSmoothing() {
  const cl = new NordschleifeCenterline('nordschleife');
  const N = cl.samples.length;

  console.log(`Centerline samples: ${N}`);
  const data = TrackMeshGenerator.generateChunkMesh(cl.samples, 0, 100, 25);
  console.log(`Chunk 0 visual vertices: ${data.visualGeometry.attributes.position.count}`);
  console.log(`Chunk 0 collision vertices: ${data.collisionVertices.length / 3}`);
  console.log(`Chunk 0 collision triangles: ${data.collisionIndices.length / 3}`);
}

testSmoothing();
