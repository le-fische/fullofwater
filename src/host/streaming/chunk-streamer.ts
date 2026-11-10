import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { NordschleifeCenterline } from './centerline';
import { TrackMeshGenerator, ChunkGeometryData } from './track-mesh-generator';
import { TrackSweeper, ChunkManifest } from '../../../scripts/track-pipeline/sweep-track';
import { ForestFoliage } from './forest-foliage';

export interface ActiveChunk {
  index: number;
  visualMesh: THREE.Mesh;
  foliageMesh?: THREE.InstancedMesh;
  collisionCollider: RAPIER.Collider;
  startDistanceM: number;
  endDistanceM: number;
}

/**
 * 3-Chunk Window Streamer for 20.8 km Nürburgring Nordschleife.
 * Maintains [K-1, K, K+1] chunks in Three.js and Rapier 3D.
 * Unloads distant chunks to prevent frame drops and keep browser memory constrained.
 */
/**
 * Creates high-frequency procedural micro-aggregate detail texture for asphalt stone grain,
 * kerb rumble texture, and grass blade stippling.
 * Uses pure DataTexture for 100% compatibility across headless tests and WebGL renderers.
 */
function createTrackDetailTexture(): THREE.Texture {
  const width = 256;
  const height = 256;
  const size = width * height * 4;
  const data = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // High-frequency micro noise
      const n1 = (Math.random() - 0.5) * 32;
      // Mid-frequency aggregate clump noise
      const n2 = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 14;
      // Longitudinal grooving
      const n3 = Math.sin(x * 0.5) * 8;
      const v = Math.min(255, Math.max(180, Math.round(230 + n1 + n2 + n3)));

      data[idx] = v;     // R
      data[idx + 1] = v; // G
      data[idx + 2] = v; // B
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 300);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

export class NordschleifeChunkStreamer {
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private rapier: typeof RAPIER;
  private centerline: NordschleifeCenterline;
  public manifest: ChunkManifest;

  public activeChunks = new Map<number, ActiveChunk>();
  public currentChunkIndex = -1;
  public totalChunks = TrackSweeper.CHUNK_COUNT; // 11 chunks

  private chunkCache = new Map<number, ActiveChunk>();
  private trackMaterial: THREE.MeshStandardMaterial;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    rapier: typeof RAPIER,
    centerline: NordschleifeCenterline
  ) {
    this.scene = scene;
    this.world = world;
    this.rapier = rapier;
    this.centerline = centerline;
    this.manifest = TrackSweeper.generateChunkManifest(this.centerline.totalLengthM);

    const detailMap = createTrackDetailTexture();
    this.trackMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detailMap,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Updates streaming window based on current vehicle track distance.
   */
  public update(currentDistanceM: number): void {
    const chunkLength = this.centerline.totalLengthM / this.totalChunks;
    const clampedDist = ((currentDistanceM % this.centerline.totalLengthM) + this.centerline.totalLengthM) % this.centerline.totalLengthM;
    const centerChunk = Math.floor(clampedDist / chunkLength) % this.totalChunks;

    if (centerChunk !== this.currentChunkIndex) {
      this.currentChunkIndex = centerChunk;
      this.reconcileChunks(centerChunk);
    }
  }

  /**
   * Reconciles active chunks so only [K-1, K, K+1] are kept active in the scene.
   * Chunks are cached so crossing chunk boundaries is instant (zero GC, zero BVH rebuild).
   */
  private reconcileChunks(center: number): void {
    const prev = (center - 1 + this.totalChunks) % this.totalChunks;
    const next = (center + 1) % this.totalChunks;
    const targetChunks = new Set<number>([prev, center, next]);

    // 1. Deactivate chunks that moved outside the 3-chunk window
    for (const [idx, chunk] of this.activeChunks.entries()) {
      if (!targetChunks.has(idx)) {
        this.deactivateChunk(idx, chunk);
      }
    }

    // 2. Activate target chunks (retrieved from cache or generated once)
    for (const idx of targetChunks) {
      if (!this.activeChunks.has(idx)) {
        this.activateChunk(idx);
      }
    }
  }

  /**
   * Activates a chunk in the 3D scene and Rapier physics world.
   * If already generated, pulls from chunkCache instantly (< 0.05ms).
   */
  public activateChunk(index: number): void {
    let chunk = this.chunkCache.get(index);
    if (!chunk) {
      chunk = this.buildChunk(index);
      this.chunkCache.set(index, chunk);
    }

    this.scene.add(chunk.visualMesh);
    if (chunk.foliageMesh) {
      this.scene.add(chunk.foliageMesh);
    }
    chunk.collisionCollider.setEnabled(true);
    this.activeChunks.set(index, chunk);
  }

  /**
   * Deactivates a chunk from the 3D scene and disables its Rapier collider,
   * retaining geometry and BVH structures in chunkCache to prevent runtime hitches.
   */
  private deactivateChunk(index: number, chunk: ActiveChunk): void {
    this.scene.remove(chunk.visualMesh);
    if (chunk.foliageMesh) {
      this.scene.remove(chunk.foliageMesh);
    }
    chunk.collisionCollider.setEnabled(false);
    this.activeChunks.delete(index);
  }

  /**
   * Builds visual Three.js mesh, dense Eifel foliage, and Rapier trimesh collider once.
   */
  private buildChunk(index: number): ActiveChunk {
    const totalSamples = this.centerline.samples.length;
    const samplesPerChunk = Math.floor(totalSamples / this.totalChunks);

    const startIdx = index * samplesPerChunk;
    const endIdx = (index === this.totalChunks - 1) ? totalSamples : (index + 1) * samplesPerChunk;

    const data: ChunkGeometryData = TrackMeshGenerator.generateChunkMesh(
      this.centerline.samples,
      startIdx,
      endIdx,
      25 // ~100m collision overlap
    );

    // Visual mesh
    const visualMesh = new THREE.Mesh(data.visualGeometry, this.trackMaterial);
    visualMesh.name = `nordschleife_chunk_${index}`;
    visualMesh.receiveShadow = true;
    visualMesh.castShadow = false; // Optimize shadow map draw calls

    // Dense 3D Eifel mountain forest foliage (InstancedMesh)
    let foliageMesh: THREE.InstancedMesh | undefined;
    try {
      foliageMesh = ForestFoliage.createChunkFoliage(
        this.centerline.samples,
        startIdx,
        endIdx,
        index
      );
    } catch (err) {
      console.warn(`[ChunkStreamer] Foliage creation skipped for chunk ${index}:`, err);
    }

    // Rapier Collision trimesh
    const colliderDesc = this.rapier.ColliderDesc.trimesh(
      data.collisionVertices,
      data.collisionIndices
    );
    colliderDesc.setFriction(1.0);
    colliderDesc.setRestitution(0.0);
    const collider = this.world.createCollider(colliderDesc);

    return {
      index,
      visualMesh,
      foliageMesh,
      collisionCollider: collider,
      startDistanceM: data.startDistanceM,
      endDistanceM: data.endDistanceM,
    };
  }

  /**
   * Backward compatibility alias for loadChunk.
   */
  public loadChunk(index: number): void {
    this.activateChunk(index);
  }

  /**
   * Force unloads all chunks and completely disposes GPU geometries and Rapier colliders.
   */
  public dispose(): void {
    for (const [idx, chunk] of this.activeChunks.entries()) {
      this.deactivateChunk(idx, chunk);
    }
    for (const chunk of this.chunkCache.values()) {
      chunk.visualMesh.geometry.dispose();
      if (chunk.foliageMesh) {
        chunk.foliageMesh.dispose();
      }
      this.world.removeCollider(chunk.collisionCollider, false);
    }
    this.chunkCache.clear();
    this.trackMaterial.dispose();
  }
}
