/**
 * Track Pipeline CLI: Generate Nürburgring Nordschleife Manifest & Assets
 */

import fs from 'fs';
import path from 'path';
import { NordschleifeCenterline } from '../../src/host/streaming/centerline';
import { TrackSweeper } from './sweep-track';
import { NORDSCHLEIFE_LANDMARKS } from '../../src/host/streaming/landmarks';

export async function generateNordschleifeData(): Promise<void> {
  console.log('🏁 Starting Nürburgring Nordschleife 20.8 km Track Asset Generation...');

  const outputDir = path.resolve(process.cwd(), 'tracks/nordschleife');
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Initialize mathematical centerline spline
  console.log('1. Building 20,832m centerline spline & parallel transport frames...');
  const centerline = new NordschleifeCenterline();
  console.log(`   Generated ${centerline.samples.length} equidistant samples at ${centerline.sampleSpacingM}m spacing.`);

  // 2. Generate Partition Manifest
  console.log('2. Partitioning into 11 chunks with 100m collision overlaps...');
  const manifest = TrackSweeper.generateChunkManifest();

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        trackName: 'Nürburgring Nordschleife',
        lengthMeters: centerline.totalLengthM,
        chunkCount: TrackSweeper.CHUNK_COUNT,
        landmarks: NORDSCHLEIFE_LANDMARKS,
        chunks: manifest.chunks,
      },
      null,
      2
    )
  );
  console.log(`   ✅ Manifest written -> ${manifestPath}`);

  // 3. Export binary centerline data for high-speed runtime loading
  console.log('3. Exporting binary centerline buffer (centerline.bin)...');
  const sampleCount = centerline.samples.length;
  // Format per sample (60 bytes):
  // float32 dist, pos.x, pos.y, pos.z, tan.x, tan.y, tan.z, norm.x, norm.y, norm.z, binorm.x, binorm.y, binorm.z, bankingRad, trackWidth
  const buffer = new Float32Array(sampleCount * 15);

  let offset = 0;
  for (const sp of centerline.samples) {
    buffer[offset++] = sp.distance;
    buffer[offset++] = sp.position.x;
    buffer[offset++] = sp.position.y;
    buffer[offset++] = sp.position.z;
    buffer[offset++] = sp.tangent.x;
    buffer[offset++] = sp.tangent.y;
    buffer[offset++] = sp.tangent.z;
    buffer[offset++] = sp.normal.x;
    buffer[offset++] = sp.normal.y;
    buffer[offset++] = sp.normal.z;
    buffer[offset++] = sp.binormal.x;
    buffer[offset++] = sp.binormal.y;
    buffer[offset++] = sp.binormal.z;
    buffer[offset++] = sp.bankingRad;
    buffer[offset++] = sp.trackWidth;
  }

  const binaryPath = path.join(outputDir, 'centerline.bin');
  fs.writeFileSync(binaryPath, Buffer.from(buffer.buffer));
  console.log(`   ✅ Binary centerline written -> ${binaryPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);

  console.log('🎉 Nordschleife Track Generation Completed Successfully!');
}

generateNordschleifeData().catch((err) => {
  console.error('Track generation failed:', err);
  process.exit(1);
});
