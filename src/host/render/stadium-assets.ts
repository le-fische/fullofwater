import * as THREE from 'three';
import { SplinePoint } from '../streaming/centerline';

/**
 * Modern Grand Prix Stadium Architecture & Grandstand Generator.
 * Transforms the Nürburgring Grand Prix circuit from wild mountain plains into an
 * authentic FIA Grade 1 motorsport stadium arena:
 * - Start/Finish Haupttribüne (Covered multi-tier red/white stadium seating)
 * - Multi-bay Concrete Pit Building with team garages, VIP lounges & pit wall
 * - Overhead Start/Finish Steel Timing Gantry with F1 5-light cluster
 * - Mercedes-Benz Arena Amphitheater Grandstand wrapping around Turns 2 & 3
 * - Dunlop-Kehre Hairpin Viewing Grandstand & sponsor hoardings
 * - NGK-Schikane Stadium Complex
 */
export class StadiumAssets {
  public group: THREE.Group;
  private materials: THREE.Material[] = [];

  constructor(samples: SplinePoint[]) {
    this.group = new THREE.Group();
    this.group.name = 'GP_Stadium_Architecture';

    this.buildStadiumComplex(samples);
  }

  private buildStadiumComplex(samples: SplinePoint[]): void {
    if (!samples || samples.length === 0) return;

    // Common PBR Materials
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.85,
      metalness: 0.15,
      name: 'Stadium_Concrete',
    });
    this.materials.push(concreteMat);

    const seatRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.5,
      metalness: 0.1,
      name: 'Grandstand_Seat_Red',
    });
    this.materials.push(seatRedMat);

    const seatWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf4f4f5,
      roughness: 0.45,
      metalness: 0.1,
      name: 'Grandstand_Seat_White',
    });
    this.materials.push(seatWhiteMat);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.35,
      metalness: 0.8,
      name: 'Stadium_Steel_Truss',
    });
    this.materials.push(steelMat);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.65,
      name: 'Pit_VIP_Glass',
    });
    this.materials.push(glassMat);

    // 1. Start/Finish Haupttribüne (Main Grandstand along the Front Straight)
    // Left side of track opposite pit lane: sample indices 85 to 165
    this.buildGrandstandSection(
      samples,
      85,
      165,
      -28.0, // 28m offset to driver's left
      6,     // 6 tiers
      18.0,  // depth 18m
      11.0,  // height 11m
      'HAUPTTRIBÜNE • NÜRBURGRING',
      concreteMat,
      seatRedMat,
      seatWhiteMat,
      steelMat
    );

    // 2. Concrete Pit Building & Team Garages (Right side of Front Straight)
    this.buildPitComplex(samples, 88, 162, 26.0, concreteMat, glassMat, steelMat);

    // 3. Overhead Start/Finish Timing Gantry with FIA Start Lights
    this.buildStartFinishGantry(samples[0], steelMat);
    if (samples.length > 100) {
      // Also place timing gantry over the Start/Finish grid on Front Straight
      this.buildStartFinishGantry(samples[95], steelMat);
    }

    // 4. Mercedes-Benz Arena Grandstand (Wrapping around Turns 2 & 3)
    // Samples ~270 to ~330
    if (samples.length > 350) {
      this.buildGrandstandSection(
        samples,
        275,
        335,
        -24.0, // Outside of the loop
        6,
        20.0,
        11.0,
        'MERCEDES-BENZ ARENA',
        concreteMat,
        seatRedMat,
        seatWhiteMat,
        steelMat
      );
    }

    // 5. Dunlop-Kehre Hairpin Grandstand (Lowest point valley hairpin)
    // Samples ~540 to ~590
    if (samples.length > 600) {
      this.buildGrandstandSection(
        samples,
        545,
        585,
        24.0, // Outside of hairpin
        4,
        14.0,
        7.5,
        'DUNLOP-KEHRE • BILSTEIN',
        concreteMat,
        seatRedMat,
        seatWhiteMat,
        steelMat
      );
    }

    // 6. NGK-Schikane Stadium Seating (Chicane before final turn)
    // Samples ~950 to ~1000
    if (samples.length > 1000) {
      this.buildGrandstandSection(
        samples,
        960,
        1005,
        -20.0,
        4,
        14.0,
        7.0,
        'NGK-SCHIKANE',
        concreteMat,
        seatRedMat,
        seatWhiteMat,
        steelMat
      );
    }
  }

  /**
   * Builds a continuous curved stadium grandstand following the track spline.
   */
  private buildGrandstandSection(
    samples: SplinePoint[],
    startIdx: number,
    endIdx: number,
    offsetM: number,
    tiers: number,
    depthM: number,
    heightM: number,
    bannerText: string,
    concreteMat: THREE.Material,
    seatRedMat: THREE.Material,
    seatWhiteMat: THREE.Material,
    steelMat: THREE.Material
  ): void {
    const step = 4; // Sample every 20m along spline
    const points: Array<{ pos: THREE.Vector3; binorm: THREE.Vector3; norm: THREE.Vector3 }> = [];

    for (let i = startIdx; i <= endIdx; i += step) {
      const idx = Math.min(samples.length - 1, i);
      const sp = samples[idx];
      const basePos = sp.position.clone().addScaledVector(sp.binormal, offsetM);
      points.push({ pos: basePos, binorm: sp.binormal.clone(), norm: sp.normal.clone() });
    }

    if (points.length < 2) return;

    const sign = Math.sign(offsetM); // -1 for left side, +1 for right side
    const tierH = heightM / tiers;
    const tierD = depthM / tiers;

    // Build grandstand modules along the curve
    for (let p = 0; p < points.length - 1; p++) {
      const p1 = points[p];
      const p2 = points[p + 1];
      const midPos = p1.pos.clone().lerp(p2.pos, 0.5);
      const segLen = p1.pos.distanceTo(p2.pos);
      if (segLen < 0.5) continue;

      const fwd = new THREE.Vector3().subVectors(p2.pos, p1.pos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const lat = new THREE.Vector3().crossVectors(up, fwd).normalize();

      // Anti-encroachment safety filter:
      // Verify front edge of this grandstand module is at least 12.0m clear from any centerline sample
      const frontCenter = midPos.clone().addScaledVector(lat, -sign * (depthM / 2));
      let minTrackDist = 9999;
      for (let s = 0; s < samples.length; s += 4) {
        const d = frontCenter.distanceTo(samples[s].position);
        if (d < minTrackDist) minTrackDist = d;
      }
      if (minTrackDist < 12.0) {
        // Grandstand would encroach upon the track or run-off corridor; safely skip
        continue;
      }

      const modGroup = new THREE.Group();
      modGroup.position.copy(midPos);

      // Orthonormal basis: X = lat (perpendicular to track), Y = up, Z = fwd (along track)
      const rotMatrix = new THREE.Matrix4().makeBasis(lat, up, fwd);
      modGroup.quaternion.setFromRotationMatrix(rotMatrix);

      // 1. Concrete Tiered Foundation
      for (let t = 0; t < tiers; t++) {
        const tHeight = (t + 1) * tierH;
        // BoxGeometry: width along X = tierD, height along Y = tHeight, depth along Z = segLen * 1.02
        const boxGeo = new THREE.BoxGeometry(tierD, tHeight, segLen * 1.02);
        const box = new THREE.Mesh(boxGeo, concreteMat);

        // Tiers step up and away from track:
        // sign = -1 (left): track is at +X, back is at -X. t=0 at +X, t=tiers-1 at -X
        // sign = +1 (right): track is at -X, back is at +X. t=0 at -X, t=tiers-1 at +X
        const xOffset = sign * (t - (tiers - 1) / 2) * tierD;
        box.position.set(xOffset, tHeight / 2, 0);
        modGroup.add(box);

        // Colored seats on tier step
        const seatGeo = new THREE.BoxGeometry(tierD * 0.72, 0.22, segLen * 0.95);
        const seat = new THREE.Mesh(seatGeo, (t + p) % 2 === 0 ? seatRedMat : seatWhiteMat);
        seat.position.set(xOffset, tHeight + 0.11, 0);
        modGroup.add(seat);
      }

      // 2. Cantilever Steel Canopy Roof
      const roofGeo = new THREE.BoxGeometry(depthM * 1.2, 0.35, segLen * 1.02);
      const roof = new THREE.Mesh(roofGeo, steelMat);
      roof.position.set(0, heightM + 2.2, 0);
      roof.rotation.z = sign * 0.10; // Tilted slightly forward towards track
      modGroup.add(roof);

      // Support pillars at the back of grandstand
      const pillarGeo = new THREE.CylinderGeometry(0.20, 0.20, heightM + 2.0, 8);
      const backX = sign * (depthM * 0.45);
      const pillar1 = new THREE.Mesh(pillarGeo, steelMat);
      pillar1.position.set(backX, (heightM + 2.0) / 2, segLen * 0.42);
      const pillar2 = new THREE.Mesh(pillarGeo, steelMat);
      pillar2.position.set(backX, (heightM + 2.0) / 2, -segLen * 0.42);
      modGroup.add(pillar1);
      modGroup.add(pillar2);

      // 3. Sponsorship Banner along back wall facing track
      if (p % 2 === 0) {
        const bannerCanvas = document.createElement('canvas');
        bannerCanvas.width = 512;
        bannerCanvas.height = 128;
        const bCtx = bannerCanvas.getContext('2d')!;
        bCtx.fillStyle = '#dc2626';
        bCtx.fillRect(0, 0, 512, 128);
        bCtx.fillStyle = '#ffffff';
        bCtx.font = '900 42px sans-serif';
        bCtx.textAlign = 'center';
        bCtx.textBaseline = 'middle';
        bCtx.fillText(bannerText, 256, 64);

        const bannerTex = new THREE.CanvasTexture(bannerCanvas);
        const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
        this.materials.push(bannerMat);

        const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(segLen * 0.95, 2.8), bannerMat);
        bannerMesh.position.set(sign * (depthM * 0.48), heightM + 0.8, 0);
        bannerMesh.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
        modGroup.add(bannerMesh);
      }

      this.group.add(modGroup);
    }
  }

  /**
   * Builds the concrete pit building with garages and VIP lounge along the pit straight.
   */
  private buildPitComplex(
    samples: SplinePoint[],
    startIdx: number,
    endIdx: number,
    offsetM: number,
    concreteMat: THREE.Material,
    glassMat: THREE.Material,
    steelMat: THREE.Material
  ): void {
    const spStart = samples[startIdx];
    const spEnd = samples[endIdx];
    const buildingLen = spStart.position.distanceTo(spEnd.position);
    const midTrackPos = spStart.position.clone().lerp(spEnd.position, 0.5);
    const fwd = new THREE.Vector3().subVectors(spEnd.position, spStart.position).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const lat = new THREE.Vector3().crossVectors(up, fwd).normalize();

    const midPos = midTrackPos.clone().addScaledVector(lat, offsetM);

    const pitGroup = new THREE.Group();
    pitGroup.position.copy(midPos);

    // Orthonormal basis: X = lat (perpendicular to track), Y = up, Z = fwd (along track)
    const rotMatrix = new THREE.Matrix4().makeBasis(lat, up, fwd);
    pitGroup.quaternion.setFromRotationMatrix(rotMatrix);

    const buildingDepth = 18.0; // along X (perpendicular to track)
    const buildingH = 5.5;      // along Y

    // 1. Lower Pit Building Ground Floor (Garages)
    const lowerGeo = new THREE.BoxGeometry(buildingDepth, buildingH, buildingLen);
    const lowerMesh = new THREE.Mesh(lowerGeo, concreteMat);
    lowerMesh.position.set(0, buildingH / 2, 0);
    pitGroup.add(lowerMesh);

    // 2. Upper VIP Hospitality Lounge with Panoramic Glass Windows
    const upperH = 4.0;
    const upperGeo = new THREE.BoxGeometry(buildingDepth * 0.92, upperH, buildingLen * 0.96);
    const upperMesh = new THREE.Mesh(upperGeo, glassMat);
    upperMesh.position.set(0, buildingH + upperH / 2, 0);
    pitGroup.add(upperMesh);

    // Roof deck with safety railing
    const roofGeo = new THREE.BoxGeometry(buildingDepth, 0.4, buildingLen);
    const roofMesh = new THREE.Mesh(roofGeo, steelMat);
    roofMesh.position.set(0, buildingH + upperH + 0.2, 0);
    pitGroup.add(roofMesh);

    // 3. Pit Wall along the track separating pit lane from main straight
    // Pit building is at offsetM = +26.0m. Centerline is at x = -26.0m in pitGroup frame.
    // Pit wall sits at 11.0m from centerline -> local x = -(offsetM - 11.0) = -15.0m
    const pitWallGeo = new THREE.BoxGeometry(0.6, 1.2, buildingLen * 0.98);
    const pitWall = new THREE.Mesh(pitWallGeo, concreteMat);
    pitWall.position.set(-(offsetM - 11.0), 0.6, 0);
    pitGroup.add(pitWall);

    this.group.add(pitGroup);
  }

  /**
   * Builds an overhead start/finish gantry with F1 5-light cluster and digital timing displays.
   */
  private buildStartFinishGantry(sp0: SplinePoint, steelMat: THREE.Material): void {
    if (!sp0) return;
    const gantryGroup = new THREE.Group();
    gantryGroup.position.copy(sp0.position);

    const fwd = sp0.tangent.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const lat = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const rotMatrix = new THREE.Matrix4().makeBasis(lat, up, fwd);
    gantryGroup.quaternion.setFromRotationMatrix(rotMatrix);

    const spanW = 24.0; // Spans across full track width and runoff
    const gantryH = 8.5; // High clearance overhead

    // Vertical steel truss uprights
    const uprightGeo = new THREE.BoxGeometry(0.8, gantryH, 0.8);
    const leftPillar = new THREE.Mesh(uprightGeo, steelMat);
    leftPillar.position.set(-spanW / 2, gantryH / 2, 0);
    const rightPillar = new THREE.Mesh(uprightGeo, steelMat);
    rightPillar.position.set(spanW / 2, gantryH / 2, 0);
    gantryGroup.add(leftPillar);
    gantryGroup.add(rightPillar);

    // Horizontal truss bridge
    const bridgeGeo = new THREE.BoxGeometry(spanW + 1.2, 1.2, 1.2);
    const bridge = new THREE.Mesh(bridgeGeo, steelMat);
    bridge.position.set(0, gantryH, 0);
    gantryGroup.add(bridge);

    // F1 5-Light Starting Gantry Cluster
    const lightsGroup = new THREE.Group();
    lightsGroup.position.set(0, gantryH - 0.7, -0.65);
    const lightFrameGeo = new THREE.BoxGeometry(3.6, 1.1, 0.25);
    const lightFrame = new THREE.Mesh(lightFrameGeo, new THREE.MeshBasicMaterial({ color: 0x09090b }));
    lightsGroup.add(lightFrame);

    // 5 Red FIA Starting Bulbs
    for (let i = 0; i < 5; i++) {
      const bulbGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
      bulbGeo.rotateX(Math.PI / 2);
      const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e })); // Green start lights
      bulb.position.set(-1.4 + i * 0.7, 0, -0.14);
      lightsGroup.add(bulb);
    }
    gantryGroup.add(lightsGroup);

    this.group.add(gantryGroup);
  }

  public setEnabled(enabled: boolean): void {
    this.group.visible = enabled;
  }

  public dispose(): void {
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
}
