import * as THREE from 'three';
import { SplinePoint } from './centerline';
import demData from '../../../tracks/nordschleife/dem.json';

export interface ChunkGeometryData {
  visualGeometry: THREE.BufferGeometry;
  collisionVertices: Float32Array;
  collisionIndices: Uint32Array;
  startDistanceM: number;
  endDistanceM: number;
}

/**
 * Samples the 3D SRTM DEM terrain elevation at any (x, z) world coordinate.
 * Used to weld track embankments directly to the landscape surface with zero gaps.
 */
function getTerrainElevation(x: number, z: number): number {
  const gx = (x - demData.x0) / demData.step;
  const gz = (z - demData.z0) / demData.step;
  if (gx < 0 || gx >= demData.nx - 1 || gz < 0 || gz >= demData.nz - 1) {
    return 600.0;
  }
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const i00 = iz * demData.nx + ix;
  const i10 = i00 + 1;
  const i01 = i00 + demData.nx;
  const i11 = i01 + 1;
  const h00 = demData.h[i00];
  const h10 = demData.h[i10];
  const h01 = demData.h[i01];
  const h11 = demData.h[i11];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

/**
 * Checks whether a given track sample is in a corner zone where kerbs exist.
 * Active on all turns (turn rate >= 0.0035 rad/sample) and banked sections; suppressed on straights (e.g. Döttinger Höhe).
 */
function hasCornerKerb(sp: SplinePoint): boolean {
  // Long high-speed Döttinger Höhe straight has no kerbs
  if (sp.landmark && sp.landmark.name.toLowerCase().includes('döttinger') && Math.abs(sp.turnRate) < 0.004) {
    return false;
  }

  // Banked concrete bowls (Karussell / Mini-Karussell)
  if (Math.abs(sp.bankingRad) >= 0.035) return true;

  // Any corner with turn rate >= 0.0035 rad/sample
  if (Math.abs(sp.turnRate) >= 0.0035) return true;

  // Landmark named corners
  if (sp.landmark && sp.landmark.name) {
    const n = sp.landmark.name.toLowerCase();
    if (
      n.includes('kurve') || n.includes('forst') || n.includes('kehre') ||
      n.includes('karussell') || n.includes('seifen') || n.includes('schikane') ||
      n.includes('bogen') || n.includes('brünnchen') || n.includes('flugplatz') ||
      n.includes('aremberg') || n.includes('hatzenbach') || n.includes('wehrseifen') ||
      n.includes('schwalbenschwanz') || n.includes('galgenkopf') || n.includes('hohe acht') ||
      n.includes('fuchsröhre') || n.includes('metzgesfeld') || n.includes('kallenhard') ||
      n.includes('wippermann') || n.includes('eschbach') || n.includes('pflanzgarten') ||
      n.includes('bellof') || n.includes('schumacher') || n.includes('turn')
    ) {
      return Math.abs(sp.turnRate) >= 0.0018;
    }
  }

  return false;
}

/**
 * Checks whether a given track distance and side falls in an authentic gravel runoff trap zone.
 */
function isGravelRunoff(dist: number, isLeft: boolean): boolean {
  // 1. Aremberg outside (left): high-speed braking from Schwedenkreuz
  if (isLeft && dist >= 3800 && dist <= 4020) return true;

  // 2. Adenauer Forst outside (right): overshoot chicane runoff
  if (!isLeft && dist >= 5040 && dist <= 5260) return true;

  // 3. Wehrseifen outside (left): steep downhill hairpin trap
  if (isLeft && dist >= 7400 && dist <= 7580) return true;

  // 4. Ex-Mühle outside (left): fast right kink before stone bridge
  if (isLeft && dist >= 8120 && dist <= 8290) return true;

  // 5. Brünnchen spectator corner (both outside runoffs)
  if (dist >= 14000 && dist <= 14450) return true;

  // 6. Hohenrain chicane outside (left): braking from Döttinger Höhe
  if (isLeft && dist >= 20200 && dist <= 20420) return true;

  // 7. GP-Strecke gravel traps:
  if (dist >= 480 && dist <= 760) return true;   // Mercedes Arena
  if (dist >= 1440 && dist <= 1760) return true; // Dunlop-Kehre
  if (dist >= 3040 && dist <= 3320) return true; // NGK-Schikane

  return false;
}

/**
 * Checks whether a track distance falls in an authentic weathered concrete patch zone.
 */
function isConcretePatchZone(dist: number): boolean {
  // Wehrseifen downhill braking approach
  if (dist >= 7320 && dist <= 7480) return true;
  // Breidscheid bridge transition
  if (dist >= 7800 && dist <= 8060) return true;
  // Steilstrecke / Karussell historic concrete sections
  if (dist >= 11500 && dist <= 12250) return true;
  // Pflanzgarten compression
  if (dist >= 15000 && dist <= 15260) return true;
  return false;
}

/**
 * Procedural fan graffiti markings on asphalt in world-famous spectator zones.
 */
function getGraffitiColor(dist: number, lateralRatio: number): number[] | null {
  const inZone =
    (dist >= 800 && dist <= 1400) ||     // Hatzenbach
    (dist >= 4950 && dist <= 5350) ||    // Adenauer Forst
    (dist >= 11800 && dist <= 12300) ||  // Karussell
    (dist >= 14000 && dist <= 14500) ||  // Brünnchen
    (dist >= 14800 && dist <= 15600) ||  // Pflanzgarten
    (dist >= 16300 && dist <= 16700);    // Schwalbenschwanz

  if (!inZone) return null;

  // Stenciled procedural fan graffiti patches along road
  const cycle = (dist % 14.0 + 14.0) % 14.0;
  if (cycle < 2.4 && Math.abs(lateralRatio) < 0.75) {
    const hash = Math.floor(dist / 14.0) % 5;
    if (hash === 0) return [0.86, 0.86, 0.88]; // Chalk White (names & numbers)
    if (hash === 1) return [0.92, 0.82, 0.16]; // Racing Yellow ("MANTHY #911")
    if (hash === 2) return [0.20, 0.76, 0.84]; // Spray Cyan
    if (hash === 3) return [0.86, 0.22, 0.22]; // Red Flag / Heart
    if (hash === 4) return [0.84, 0.84, 0.84]; // Chalk White
  }

  return null;
}

/**
 * Procedural Track Mesh & Collision Extruder.
 * High-definition 32-node visual cross-section with razor-sharp 20cm white boundary lines,
 * sub-sampled 1.25m alternating FIA red/white kerbs, textured continuous asphalt lanes
 * with fan graffiti markings and weathered concrete patches, 3-tier galvanized Armco barriers,
 * gravel decelerator runoffs, and outward-sloping Eifel forest embankments.
 */
export class TrackMeshGenerator {
  public static generateChunkMesh(
    samples: SplinePoint[],
    startIndex: number,
    endIndex: number,
    collisionOverlapSamples = 25 // ~100m overlap at 4m spacing
  ): ChunkGeometryData {
    const totalSamples = samples.length;

    // Visual geometry buffers
    const visualVerts: number[] = [];
    const visualColors: number[] = [];
    const visualUvs: number[] = [];
    const visualIndices: number[] = [];

    // Collision geometry buffers
    const colVerts: number[] = [];
    const colIndices: number[] = [];

    const chunkSampleCount = endIndex - startIndex + 1;

    // --- 1. Visual Geometry Generation (Centripetal Catmull-Rom Spline Sub-Sampling at ~0.8m spacing) ---
    const SUB_STEPS = 6; // 6 sub-slices per 5m sample (~0.83m spacing for razor-smooth outlines)
    let visualSliceCount = 0;

    // Precompute Voronoi-clamped maximum embankment widths (Left/Right) and nearby track floor Y
    // Prevents embankments on closely spaced hairpin legs (e.g., Steilstrecke / Karussell / Hohe Acht)
    // from crossing the midpoint between legs or covering an adjacent lower road surface.
    const rawMaxEmbankL = new Float32Array(totalSamples).fill(35.0);
    const rawMaxEmbankR = new Float32Array(totalSamples).fill(35.0);
    const minNearbyYL = new Float32Array(totalSamples).fill(Infinity);
    const minNearbyYR = new Float32Array(totalSamples).fill(Infinity);

    const calcSampleBounds = (idx: number) => {
      const sp = samples[idx];
      const hLen = Math.hypot(sp.tangent.x, sp.tangent.z) || 1e-5;
      const hrX = sp.tangent.z / hLen;
      const hrZ = -sp.tangent.x / hLen;
      const barrierOffset = sp.trackWidth / 2 + 1.25 + 3.80;

      for (const side of [-1, 1] as const) {
        const dirX = hrX * side;
        const dirZ = hrZ * side;
        let sMax = barrierOffset + 35.0;
        let minOtherY = Infinity;

        for (let j = 0; j < totalSamples; j++) {
          const idxDiff = Math.min(Math.abs(idx - j), totalSamples - Math.abs(idx - j));
          if (idxDiff < 18) continue;
          const other = samples[j];
          const dx = other.position.x - sp.position.x;
          const dz = other.position.z - sp.position.z;
          const dSq = dx * dx + dz * dz;
          if (dSq > 105 * 105) continue;

          const u = dx * dirX + dz * dirZ;
          if (u <= 0.5) continue;

          if (other.position.y < minOtherY) {
            minOtherY = other.position.y;
          }

          // Exact 2D Voronoi perpendicular bisector along ray dir: s = D^2 / (2 * u)
          const bisector = dSq / (2 * u) - 1.2;
          if (bisector < sMax) sMax = bisector;

          // Additional hard clearance around other track's barrier (13.5m from its centerline)
          const vSq = Math.max(0, dSq - u * u);
          const rClear = 13.5;
          if (vSq < rClear * rClear) {
            const clearDist = u - Math.sqrt(rClear * rClear - vSq);
            if (clearDist < sMax) sMax = clearDist;
          }
        }

        const dMax = Math.max(0.25, Math.min(35.0, sMax - barrierOffset));
        if (side === -1) {
          rawMaxEmbankL[idx] = dMax;
          minNearbyYL[idx] = minOtherY;
        } else {
          rawMaxEmbankR[idx] = dMax;
          minNearbyYR[idx] = minOtherY;
        }
      }
    };

    const marginSamples = 8;
    for (let i = -marginSamples; i < chunkSampleCount + marginSamples; i++) {
      const idx = ((startIndex + i) % totalSamples + totalSamples) % totalSamples;
      calcSampleBounds(idx);
    }

    const smoothMaxEmbankL = new Float32Array(totalSamples).fill(35.0);
    const smoothMaxEmbankR = new Float32Array(totalSamples).fill(35.0);
    for (let i = -4; i < chunkSampleCount + 4; i++) {
      const idx = ((startIndex + i) % totalSamples + totalSamples) % totalSamples;
      let sumL = 0;
      let sumR = 0;
      for (let w = -2; w <= 2; w++) {
        const wIdx = ((idx + w) % totalSamples + totalSamples) % totalSamples;
        sumL += rawMaxEmbankL[wIdx];
        sumR += rawMaxEmbankR[wIdx];
      }
      smoothMaxEmbankL[idx] = sumL / 5;
      smoothMaxEmbankR[idx] = sumR / 5;
    }

    for (let i = 0; i < chunkSampleCount; i++) {
      const idxPrev = ((startIndex + i - 1) % totalSamples + totalSamples) % totalSamples;
      const idx0 = ((startIndex + i) % totalSamples + totalSamples) % totalSamples;
      const idx1 = ((startIndex + i + 1) % totalSamples + totalSamples) % totalSamples;
      const idxNext = ((startIndex + i + 2) % totalSamples + totalSamples) % totalSamples;

      const spPrev = samples[idxPrev];
      const sp0 = samples[idx0];
      const sp1 = samples[idx1];
      const spNext = samples[idxNext];

      const p0 = spPrev.position;
      const p1 = sp0.position;
      const p2 = sp1.position;
      const p3 = spNext.position;

      // Hermite tangents between p1 and p2 (Catmull-Rom form)
      const m0 = new THREE.Vector3().subVectors(p2, p0).multiplyScalar(0.5);
      const m1 = new THREE.Vector3().subVectors(p3, p1).multiplyScalar(0.5);

      const mBank0 = 0.5 * (sp1.bankingRad - spPrev.bankingRad);
      const mBank1 = 0.5 * (spNext.bankingRad - sp0.bankingRad);
      const mWidth0 = 0.5 * (sp1.trackWidth - spPrev.trackWidth);
      const mWidth1 = 0.5 * (spNext.trackWidth - sp0.trackWidth);

      const embL0 = smoothMaxEmbankL[idx0];
      const embL1 = smoothMaxEmbankL[idx1];
      const mEmbL0 = 0.5 * (embL1 - smoothMaxEmbankL[idxPrev]);
      const mEmbL1 = 0.5 * (smoothMaxEmbankL[idxNext] - embL0);

      const embR0 = smoothMaxEmbankR[idx0];
      const embR1 = smoothMaxEmbankR[idx1];
      const mEmbR0 = 0.5 * (embR1 - smoothMaxEmbankR[idxPrev]);
      const mEmbR1 = 0.5 * (smoothMaxEmbankR[idxNext] - embR0);

      const floorYL = Math.min(minNearbyYL[idx0], minNearbyYL[idx1]);
      const floorYR = Math.min(minNearbyYR[idx0], minNearbyYR[idx1]);

      // Interpolate sub-steps (only 1 step on last sample to close the chunk)
      const stepsForSample = (i === chunkSampleCount - 1) ? 1 : SUB_STEPS;

      for (let s = 0; s < stepsForSample; s++) {
        const t = s / SUB_STEPS;
        const t2 = t * t;
        const t3 = t2 * t;

        // Hermite basis functions
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const pCenter = new THREE.Vector3()
          .addScaledVector(p1, h00)
          .addScaledVector(m0, h10)
          .addScaledVector(p2, h01)
          .addScaledVector(m1, h11);

        // Exact analytical 1st derivative of cubic spline (C1 continuous tangent)
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

        const dist = THREE.MathUtils.lerp(sp0.distance, sp1.distance, t);
        const bankingRad = Math.max(
          0,
          sp0.bankingRad * h00 + mBank0 * h10 + sp1.bankingRad * h01 + mBank1 * h11
        );
        const trackWidth = sp0.trackWidth * h00 + mWidth0 * h10 + sp1.trackWidth * h01 + mWidth1 * h11;

        // Analytical horizontal right & surface frame directly from spline derivative:
        // Guarantees b.y === 0 on all unbanked sections and C1-smooth inward tilt in banked bowls
        const hRight = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const n = new THREE.Vector3().crossVectors(tangent, hRight).normalize();
        if (bankingRad > 1e-5) {
          n.applyAxisAngle(tangent, -bankingRad);
        }
        const b = new THREE.Vector3().crossVectors(n, tangent).normalize();

        const isCornerApex = hasCornerKerb(sp0) || hasCornerKerb(sp1);
        const isKarussell = Math.abs(bankingRad) > 0.35; // Concrete Karussell bowl

        const halfW = trackWidth / 2;
        const lineW = 0.20; // 20cm painted white line
        const kerbW = 1.25; // 1.25m FIA kerb
        const grassW = 3.80; // 3.8m verge
        const barrierH = 1.15; // 1.15m Armco steel barrier

        // Gentle visual bevel (1.8 cm) on kerbs when active; flush on straights
        const kerbH = isCornerApex ? 0.018 : 0.0;

        // Visual Cross-Section Positions
        const pRoadLeft = pCenter.clone().addScaledVector(b, -halfW);
        const pRoadRight = pCenter.clone().addScaledVector(b, halfW);

        // White boundary lines (20cm width at edges of tarmac)
        const pWhiteLineInnerLeft = pCenter.clone().addScaledVector(b, -(halfW - lineW));
        const pRoadEdgeLeft = pCenter.clone().addScaledVector(b, -(halfW - lineW - 0.02));
        const pRoadEdgeRight = pCenter.clone().addScaledVector(b, halfW - lineW - 0.02);
        const pWhiteLineInnerRight = pCenter.clone().addScaledVector(b, halfW - lineW);

        // Continuous road lanes with subtle rubbered racing groove (no dashed lines!)
        const pRoadGrooveLeft = pCenter.clone().addScaledVector(b, -halfW * 0.46);
        const pRoadCenterLeft = pCenter.clone().addScaledVector(b, -halfW * 0.12);
        const pRoadCenterRight = pCenter.clone().addScaledVector(b, halfW * 0.12);
        const pRoadGrooveRight = pCenter.clone().addScaledVector(b, halfW * 0.46);

        // Kerbs
        const pKerbInnerLeft = pRoadLeft.clone().addScaledVector(n, kerbH * 0.2);
        const pKerbOuterLeft = pRoadLeft.clone().addScaledVector(b, -kerbW).addScaledVector(n, kerbH);
        const pKerbInnerRight = pRoadRight.clone().addScaledVector(n, kerbH * 0.2);
        const pKerbOuterRight = pRoadRight.clone().addScaledVector(b, kerbW).addScaledVector(n, kerbH);

        // Verge (Gravel trap vs Grass lawn)
        const isGravelL = isGravelRunoff(dist, true);
        const isGravelR = isGravelRunoff(dist, false);

        const vergeWidthL = isGravelL ? 5.50 : grassW;
        const vergeWidthR = isGravelR ? 5.50 : grassW;

        const pGrassNearLeft = pRoadLeft.clone().addScaledVector(b, -kerbW - 0.05);
        const pGrassFarLeft = pRoadLeft.clone().addScaledVector(b, -kerbW - vergeWidthL);
        const pGrassNearRight = pRoadRight.clone().addScaledVector(b, kerbW + 0.05);
        const pGrassFarRight = pRoadRight.clone().addScaledVector(b, kerbW + vergeWidthR);

        // Continuous basic Armco steel safety guardrails lining both flanks of the track
        const hasBarrierL = true;
        const hasBarrierR = true;

        // 3-Tier Galvanized Armco Steel Safety Barriers
        // Lower rail: +0.25m, Mid rail: +0.65m, Top rail: +1.15m
        const barrierHL = hasBarrierL ? barrierH : 0.0;
        const pBarrierLowerLeft = pGrassFarLeft.clone().addScaledVector(n, hasBarrierL ? 0.25 : 0.0);
        const pBarrierMidLeft = pGrassFarLeft.clone().addScaledVector(n, hasBarrierL ? 0.65 : 0.0).addScaledVector(b, hasBarrierL ? -0.06 : 0.0);
        const pBarrierTopLeft = pGrassFarLeft.clone().addScaledVector(n, barrierHL);
        const pBarrierOuterBaseLeft = pGrassFarLeft.clone().addScaledVector(b, hasBarrierL ? -0.22 : 0.0);

        const barrierHR = hasBarrierR ? barrierH : 0.0;
        const pBarrierLowerRight = pGrassFarRight.clone().addScaledVector(n, hasBarrierR ? 0.25 : 0.0);
        const pBarrierMidRight = pGrassFarRight.clone().addScaledVector(n, hasBarrierR ? 0.65 : 0.0).addScaledVector(b, hasBarrierR ? 0.06 : 0.0);
        const pBarrierTopRight = pGrassFarRight.clone().addScaledVector(n, barrierHR);
        const pBarrierOuterBaseRight = pGrassFarRight.clone().addScaledVector(b, hasBarrierR ? 0.22 : 0.0);

        // Outward-sloping Eifel mountain forest embankments
        // Seamlessly welded directly to the underlying 3D SRTM DEM terrain surface (zero gaps or elevated bridge cliffs)
        const dMaxL = Math.max(
          0.25,
          Math.min(35.0, embL0 * h00 + mEmbL0 * h10 + embL1 * h01 + mEmbL1 * h11)
        );
        const dMaxR = Math.max(
          0.25,
          Math.min(35.0, embR0 * h00 + mEmbR0 * h10 + embR1 * h01 + mEmbR1 * h11)
        );
        const scaleL = dMaxL / 35.0;
        const scaleR = dMaxR / 35.0;

        const pEmbankOuterLeft = pGrassFarLeft.clone().addScaledVector(hRight, -35.0 * scaleL);
        const terrainOuterY_L = getTerrainElevation(pEmbankOuterLeft.x, pEmbankOuterLeft.z);
        pEmbankOuterLeft.y = Math.min(terrainOuterY_L, floorYL - 0.80);

        const pEmbankMidLeft = pGrassFarLeft.clone().addScaledVector(hRight, -14.0 * scaleL);
        pEmbankMidLeft.y = THREE.MathUtils.lerp(pGrassFarLeft.y, pEmbankOuterLeft.y, 0.65);
        const pEmbankNearLeft = pGrassFarLeft.clone().addScaledVector(hRight, -4.0 * scaleL);
        pEmbankNearLeft.y = THREE.MathUtils.lerp(pGrassFarLeft.y, pEmbankOuterLeft.y, 0.30);

        const pEmbankOuterRight = pGrassFarRight.clone().addScaledVector(hRight, 35.0 * scaleR);
        const terrainOuterY_R = getTerrainElevation(pEmbankOuterRight.x, pEmbankOuterRight.z);
        pEmbankOuterRight.y = Math.min(terrainOuterY_R, floorYR - 0.80);

        const pEmbankMidRight = pGrassFarRight.clone().addScaledVector(hRight, 14.0 * scaleR);
        pEmbankMidRight.y = THREE.MathUtils.lerp(pGrassFarRight.y, pEmbankOuterRight.y, 0.65);
        const pEmbankNearRight = pGrassFarRight.clone().addScaledVector(hRight, 4.0 * scaleR);
        pEmbankNearRight.y = THREE.MathUtils.lerp(pGrassFarRight.y, pEmbankOuterRight.y, 0.30);

        // Authentic FIA Start/Finish line transverse stripe at grid origin
        const isStartFinishLine = dist < 0.80 || dist > (samples[totalSamples - 1].distance - 0.80);

        // Staggered 2x2 FIA Starting Grid Boxes (P1 to P24 on Start/Finish straight: s = 14m to 195m)
        let isGridLineLeft = false;
        let isGridLineRight = false;
        let isPoleMarker = false;

        if (dist >= 14.0 && dist <= 195.0) {
          const gridSlotIdx = Math.floor((dist - 14.0) / 8.0);
          const slotDist = (dist - 14.0) % 8.0;
          if (gridSlotIdx < 24 && slotDist < 0.38) {
            if (gridSlotIdx % 2 === 0) {
              isGridLineLeft = true;
              if (gridSlotIdx === 0) isPoleMarker = true;
            } else {
              isGridLineRight = true;
            }
          }
        }

        // Sector Split Timing Lines (Sector 1, Sector 2)
        const totalCircuitLen = samples[totalSamples - 1].distance;
        const isSectorLine = Math.abs(dist - totalCircuitLen / 3.0) < 0.50 ||
                             Math.abs(dist - (totalCircuitLen * 2.0) / 3.0) < 0.50;

        // Pit Exit Blend Line (driver right on first 160m): solid white line separating pit exit lane
        const isPitExitBlend = dist >= 0.0 && dist <= 160.0;

        // Pit Entrance Chevrons (hazard V-lines on driver right before Start/Finish)
        const isPitEntry = dist > (totalCircuitLen - 180.0);
        const isChevronBar = isPitEntry && ((dist % 3.0 + 3.0) % 3.0) < 0.50;

        // Concrete patches and Karussell concrete slab seams
        const isConcretePatch = isConcretePatchZone(dist);
        const isKarussellSeam = isKarussell && ((dist % 4.0 + 4.0) % 4.0) < 0.20;
        const isConcreteSeam = isConcretePatch && ((dist % 4.0 + 4.0) % 4.0) < 0.18;

        // Base Road Color
        let cRoad = (isStartFinishLine || isSectorLine)
          ? [0.98, 0.98, 0.98]
          : isKarussell
          ? (isKarussellSeam ? [0.28, 0.28, 0.26] : [0.68, 0.68, 0.65])
          : isConcretePatch
          ? (isConcreteSeam ? [0.24, 0.24, 0.24] : [0.60, 0.60, 0.57])
          : [0.18, 0.18, 0.20]; // Clean dark asphalt

        let cGroove = (isStartFinishLine || isSectorLine)
          ? [0.98, 0.98, 0.98]
          : isKarussell
          ? [0.65, 0.65, 0.62]
          : isConcretePatch
          ? [0.55, 0.55, 0.52]
          : [0.13, 0.13, 0.15]; // Dark rubbered racing line

        // Procedural Fan Graffiti Markings on Asphalt
        const cGraffitiCenter = getGraffitiColor(dist, 0.0);
        const cGraffitiLeft = getGraffitiColor(dist, -0.5);
        const cGraffitiRight = getGraffitiColor(dist, 0.5);

        let cRoadCenter = isSectorLine ? [0.98, 0.98, 0.98] : (cGraffitiCenter ?? cRoad);
        let cGrooveLeft = isSectorLine ? [0.98, 0.98, 0.98] : (cGraffitiLeft ?? cGroove);
        let cGrooveRight = isSectorLine ? [0.98, 0.98, 0.98] : (cGraffitiRight ?? cGroove);
        let cRoadLeft = isSectorLine ? [0.98, 0.98, 0.98] : (cGraffitiLeft ? [0.35, 0.35, 0.38] : cRoad);
        let cRoadRight = isSectorLine ? [0.98, 0.98, 0.98] : (cGraffitiRight ? [0.35, 0.35, 0.38] : cRoad);

        // Apply Starting Grid Box Markings
        if (isGridLineLeft) {
          const gridColor = isPoleMarker ? [0.96, 0.82, 0.10] : [0.98, 0.98, 0.98];
          cRoadLeft = gridColor;
          cGrooveLeft = gridColor;
        }
        if (isGridLineRight) {
          cRoadRight = [0.98, 0.98, 0.98];
          cGrooveRight = [0.98, 0.98, 0.98];
        }

        // Apply Pit Exit Blend Line (solid white line along right asphalt edge)
        let cRoadEdgeR = isPitExitBlend ? [0.98, 0.98, 0.98] : cRoadRight;

        const cWhiteLine = [0.98, 0.98, 0.98]; // Continuous reflective white boundary line

        // Alternating 2.0m Red/White FIA Kerbs (1.0m red, 1.0m white) with rumble groove seams
        const stripePhase = (dist % 2.0 + 2.0) % 2.0;
        const isRed = stripePhase < 1.0;
        const isSeam = stripePhase < 0.08 || Math.abs(stripePhase - 1.0) < 0.08;

        // Verges: Coarse gravel decelerator beds vs fresh grass lawn
        const cGravelNear = [0.68, 0.62, 0.50]; // Coarse quarry gravel
        const cGravelFar = [0.56, 0.50, 0.40];  // Deep gravel trap
        const cGrassNear = [0.24, 0.48, 0.18];  // Fresh lawn
        const cGrassFar = [0.17, 0.36, 0.13];   // Meadow verge

        const cVergeNearL = isGravelL ? cGravelNear : cGrassNear;
        const cVergeFarL = isGravelL ? cGravelFar : cGrassFar;
        const cVergeNearR = isChevronBar ? [0.98, 0.98, 0.98] : (isGravelR ? cGravelNear : cGrassNear);
        const cVergeFarR = isChevronBar ? [0.98, 0.98, 0.98] : (isGravelR ? cGravelFar : cGrassFar);

        const cKerb = isCornerApex
          ? isSeam
            ? [0.25, 0.06, 0.06] // Rumble groove seam shadow
            : isRed
            ? [0.92, 0.10, 0.10] // Vivid FIA red
            : [0.98, 0.98, 0.98] // Brilliant white
          : cGrassNear; // Clean verge on straights

        // 3-Tier Galvanized Armco Steel Crash Barriers
        const cBarrierTop = [0.84, 0.86, 0.90];     // Top rail galvanized sheen
        const cBarrierMid = [0.55, 0.58, 0.62];     // Corrugated trough shadow
        const cBarrierLower = [0.74, 0.76, 0.80];   // Bottom rail
        const cBarrierBaseColor = [0.48, 0.50, 0.54]; // Post mount base

        const cBarrierTopL = hasBarrierL ? cBarrierTop : cVergeFarL;
        const cBarrierMidL = hasBarrierL ? cBarrierMid : cVergeFarL;
        const cBarrierLowerL = hasBarrierL ? cBarrierLower : cVergeFarL;
        const cBarrierBaseColorL = hasBarrierL ? cBarrierBaseColor : cVergeFarL;

        const cBarrierTopR = hasBarrierR ? cBarrierTop : cVergeFarR;
        const cBarrierMidR = hasBarrierR ? cBarrierMid : cVergeFarR;
        const cBarrierLowerR = hasBarrierR ? cBarrierLower : cVergeFarR;
        const cBarrierBaseColorR = hasBarrierR ? cBarrierBaseColor : cVergeFarR;

        // Embankments seamlessly matching Eifel mountain terrain colors
        const cEmbankNear = [0.18, 0.40, 0.16];
        const cEmbankMid = [0.16, 0.36, 0.14];
        const cEmbankOuter = [0.14, 0.32, 0.12];

        // 32 Cross-Section Nodes strictly ordered Left-to-Right (-b to +b):
        const section = [
          { p: pEmbankOuterLeft, u: 0.00, c: cEmbankOuter },
          { p: pEmbankMidLeft, u: 0.04, c: cEmbankMid },
          { p: pEmbankNearLeft, u: 0.08, c: cEmbankNear },
          { p: pBarrierOuterBaseLeft, u: 0.10, c: cBarrierBaseColorL },
          { p: pBarrierTopLeft, u: 0.12, c: cBarrierTopL },
          { p: pBarrierMidLeft, u: 0.14, c: cBarrierMidL },
          { p: pBarrierLowerLeft, u: 0.16, c: cBarrierLowerL },
          { p: pGrassFarLeft, u: 0.19, c: cVergeFarL },
          { p: pGrassNearLeft, u: 0.23, c: cVergeNearL },
          { p: pKerbOuterLeft, u: 0.26, c: cKerb },
          { p: pKerbInnerLeft, u: 0.29, c: cKerb },
          { p: pRoadLeft, u: 0.31, c: cWhiteLine }, // Left white line outer
          { p: pWhiteLineInnerLeft, u: 0.33, c: cWhiteLine }, // Left white line inner
          { p: pRoadEdgeLeft, u: 0.36, c: cRoadLeft }, // Left asphalt edge
          { p: pRoadGrooveLeft, u: 0.42, c: cGrooveLeft }, // Left rubber racing groove / graffiti
          { p: pRoadCenterLeft, u: 0.48, c: cRoadCenter }, // Center left asphalt / graffiti
          { p: pRoadCenterRight, u: 0.52, c: cRoadCenter }, // Center right asphalt / graffiti
          { p: pRoadGrooveRight, u: 0.58, c: cGrooveRight }, // Right rubber racing groove / graffiti
          { p: pRoadEdgeRight, u: 0.64, c: cRoadEdgeR }, // Right asphalt edge (with pit blend line)
          { p: pWhiteLineInnerRight, u: 0.67, c: cWhiteLine }, // Right white line inner
          { p: pRoadRight, u: 0.69, c: cWhiteLine }, // Right white line outer
          { p: pKerbInnerRight, u: 0.71, c: cKerb },
          { p: pKerbOuterRight, u: 0.74, c: cKerb },
          { p: pGrassNearRight, u: 0.77, c: cVergeNearR },
          { p: pGrassFarRight, u: 0.81, c: cVergeFarR },
          { p: pBarrierLowerRight, u: 0.84, c: cBarrierLowerR },
          { p: pBarrierMidRight, u: 0.86, c: cBarrierMidR },
          { p: pBarrierTopRight, u: 0.88, c: cBarrierTopR },
          { p: pBarrierOuterBaseRight, u: 0.90, c: cBarrierBaseColorR },
          { p: pEmbankNearRight, u: 0.92, c: cEmbankNear },
          { p: pEmbankMidRight, u: 0.96, c: cEmbankMid },
          { p: pEmbankOuterRight, u: 1.00, c: cEmbankOuter },
        ];

        for (const node of section) {
          visualVerts.push(node.p.x, node.p.y, node.p.z);
          visualUvs.push(node.u, dist * 0.2);
          visualColors.push(node.c[0], node.c[1], node.c[2]);
        }

        visualSliceCount++;
      }
    }

    const vertsPerSection = 32;
    for (let i = 0; i < visualSliceCount - 1; i++) {
      const row1 = i * vertsPerSection;
      const row2 = (i + 1) * vertsPerSection;
      for (let j = 0; j < vertsPerSection - 1; j++) {
        const a = row1 + j;
        const b = row1 + j + 1;
        const c = row2 + j;
        const d = row2 + j + 1;

        visualIndices.push(a, c, b);
        visualIndices.push(b, c, d);
      }
    }

    const visualGeometry = new THREE.BufferGeometry();
    visualGeometry.setAttribute('position', new THREE.Float32BufferAttribute(visualVerts, 3));
    visualGeometry.setAttribute('color', new THREE.Float32BufferAttribute(visualColors, 3));
    visualGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(visualUvs, 2));
    visualGeometry.setIndex(visualIndices);
    visualGeometry.computeVertexNormals();

    // --- 2. Collision Geometry Generation (Catmull-Rom Cubic Spline 1:1 Matching Visual Mesh) ---
    // Sub-steps = 6 (~0.83m spacing) matches visual road sub-sampling float-for-float,
    // ensuring 0.000 mm vertical sagitta discrepancy between visual and physical asphalt.
    const COL_SUB_STEPS = 6;
    const colStartIdx = startIndex - collisionOverlapSamples;
    const colEndIdx = endIndex + collisionOverlapSamples;
    const colCount = colEndIdx - colStartIdx + 1;
    let colSliceCount = 0;

    for (let i = 0; i < colCount; i++) {
      const idxPrev = ((colStartIdx + i - 1) % totalSamples + totalSamples) % totalSamples;
      const idx0 = ((colStartIdx + i) % totalSamples + totalSamples) % totalSamples;
      const idx1 = ((colStartIdx + i + 1) % totalSamples + totalSamples) % totalSamples;
      const idxNext = ((colStartIdx + i + 2) % totalSamples + totalSamples) % totalSamples;

      const spPrev = samples[idxPrev];
      const sp0 = samples[idx0];
      const sp1 = samples[idx1];
      const spNext = samples[idxNext];

      const p0 = spPrev.position;
      const p1 = sp0.position;
      const p2 = sp1.position;
      const p3 = spNext.position;

      // Hermite tangents between p1 and p2 (Catmull-Rom form)
      const m0 = new THREE.Vector3().subVectors(p2, p0).multiplyScalar(0.5);
      const m1 = new THREE.Vector3().subVectors(p3, p1).multiplyScalar(0.5);

      const mBank0 = 0.5 * (sp1.bankingRad - spPrev.bankingRad);
      const mBank1 = 0.5 * (spNext.bankingRad - sp0.bankingRad);
      const mWidth0 = 0.5 * (sp1.trackWidth - spPrev.trackWidth);
      const mWidth1 = 0.5 * (spNext.trackWidth - sp0.trackWidth);

      const stepsForSample = (i === colCount - 1) ? 1 : COL_SUB_STEPS;

      for (let s = 0; s < stepsForSample; s++) {
        const t = s / COL_SUB_STEPS;
        const t2 = t * t;
        const t3 = t2 * t;

        // Hermite basis functions
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const pCenter = new THREE.Vector3()
          .addScaledVector(p1, h00)
          .addScaledVector(m0, h10)
          .addScaledVector(p2, h01)
          .addScaledVector(m1, h11);

        // Exact analytical 1st derivative of cubic spline (C1 continuous tangent)
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

        const dist = THREE.MathUtils.lerp(sp0.distance, sp1.distance, t);
        const bankingRad = Math.max(
          0,
          sp0.bankingRad * h00 + mBank0 * h10 + sp1.bankingRad * h01 + mBank1 * h11
        );
        const trackWidth = sp0.trackWidth * h00 + mWidth0 * h10 + sp1.trackWidth * h01 + mWidth1 * h11;

        const hRight = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const n = new THREE.Vector3().crossVectors(tangent, hRight).normalize();
        if (bankingRad > 1e-5) {
          n.applyAxisAngle(tangent, -bankingRad);
        }
        const b = new THREE.Vector3().crossVectors(n, tangent).normalize();

        const halfW = trackWidth / 2;
        const kerbW = 1.25; // 1:1 match with visual 1.25m FIA kerb

        // Dynamic verge runoff matching visual mesh: gravel runoff zones are 5.50m wide, grass 3.80m
        const isGravelL = isGravelRunoff(dist, true);
        const isGravelR = isGravelRunoff(dist, false);
        const vergeWidthL = isGravelL ? 5.50 : 3.80;
        const vergeWidthR = isGravelR ? 5.50 : 3.80;

        const pRoadLeft = pCenter.clone().addScaledVector(b, -halfW);
        const pRoadGrooveLeft = pCenter.clone().addScaledVector(b, -halfW * 0.46);
        const pRoadGrooveRight = pCenter.clone().addScaledVector(b, halfW * 0.46);
        const pRoadRight = pCenter.clone().addScaledVector(b, halfW);

        // Smooth continuous collision kerb flush with road level (0.0m step) to prevent vehicle flips
        const pKerbLeft = pRoadLeft.clone().addScaledVector(b, -kerbW);
        const pKerbRight = pRoadRight.clone().addScaledVector(b, kerbW);

        // Barrier base at the outer edge of the verge runoff (never intrudes on track)
        const pGrassLeft = pRoadLeft.clone().addScaledVector(b, -kerbW - vergeWidthL);
        const pGrassRight = pRoadRight.clone().addScaledVector(b, kerbW + vergeWidthR);

        // Continuous basic Armco steel safety guardrails lining both flanks of the track
        const hasBarrierL = true;
        const hasBarrierR = true;

        // Heavy-impact impenetrable safety barrier: 4.00m collision wall height
        // Completely eliminates ramp-over noclipping on high-speed 300+ km/h impacts
        const colBarrierHL = hasBarrierL ? 4.00 : 0.0;
        const colBarrierHR = hasBarrierR ? 4.00 : 0.0;

        const barrierDepth = 0.60;
        const pBarrierTopLeft = pGrassLeft.clone().addScaledVector(n, colBarrierHL);
        const pBarrierBackTopLeft = pBarrierTopLeft.clone().addScaledVector(b, -barrierDepth);
        const pGrassBackLeft = pGrassLeft.clone().addScaledVector(b, -barrierDepth).addScaledVector(n, hasBarrierL ? -1.0 : 0.0);

        const pBarrierTopRight = pGrassRight.clone().addScaledVector(n, colBarrierHR);
        const pBarrierBackTopRight = pBarrierTopRight.clone().addScaledVector(b, barrierDepth);
        const pGrassBackRight = pGrassRight.clone().addScaledVector(b, barrierDepth).addScaledVector(n, hasBarrierR ? -1.0 : 0.0);

        const pEmbankOuterLeft = pGrassLeft.clone().addScaledVector(hRight, -25.0);
        pEmbankOuterLeft.y = Math.min(getTerrainElevation(pEmbankOuterLeft.x, pEmbankOuterLeft.z), pGrassLeft.y - 0.80);
        const pEmbankOuterRight = pGrassRight.clone().addScaledVector(hRight, 25.0);
        pEmbankOuterRight.y = Math.min(getTerrainElevation(pEmbankOuterRight.x, pEmbankOuterRight.z), pGrassRight.y - 0.80);

        const colSection = [
          pEmbankOuterLeft,
          pGrassBackLeft,
          pBarrierBackTopLeft,
          pBarrierTopLeft,
          pGrassLeft,
          pKerbLeft,
          pRoadLeft,
          pRoadGrooveLeft,
          pCenter,
          pRoadGrooveRight,
          pRoadRight,
          pKerbRight,
          pGrassRight,
          pBarrierTopRight,
          pBarrierBackTopRight,
          pGrassBackRight,
          pEmbankOuterRight,
        ];

        for (const p of colSection) {
          colVerts.push(p.x, p.y, p.z);
        }
        colSliceCount++;
      }
    }

    const colVertsPerSection = 17;
    for (let i = 0; i < colSliceCount - 1; i++) {
      const row1 = i * colVertsPerSection;
      const row2 = (i + 1) * colVertsPerSection;
      for (let j = 0; j < colVertsPerSection - 1; j++) {
        const a = row1 + j;
        const b = row1 + j + 1;
        const c = row2 + j;
        const d = row2 + j + 1;

        colIndices.push(a, c, b);
        colIndices.push(b, c, d);
      }
    }

    return {
      visualGeometry,
      collisionVertices: new Float32Array(colVerts),
      collisionIndices: new Uint32Array(colIndices),
      startDistanceM: samples[startIndex % totalSamples].distance,
      endDistanceM: samples[endIndex % totalSamples].distance,
    };
  }
}
