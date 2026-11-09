import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SplinePoint } from '../streaming/centerline';

export interface SponsorBridgeDef {
  name: string;
  distanceM: number;
  sponsorText: string;
  brandColor: number;
  textColor: string;
  widthM?: number;
  heightClearanceM?: number;
}

export interface PitBox {
  id: number;
  name: string;
  centerPos: THREE.Vector3;
  widthM: number;
  lengthM: number;
  stallNumber: number;
}

/**
 * Phase 5 Trackside Assets & Infrastructure:
 * - Authentic Overhead Sponsor Truss Bridges (Bilstein, Audi Sport, Yokohama, Dunlop)
 * - FIA Debris Catch Fencing with Steel Stanchions & Wire Mesh Netting along spectator zones
 * - Red-and-White Safety Tire Barriers & Tecpro energy absorption blocks at acute runoffs
 * - Dedicated Drivable Pit Lane Geometry, Concrete Dividing Pit Wall, and 10+ Team Pit Stalls
 *   with Overhead Lollipop Gantries & 60 km/h Speed Limiter Trigger Envelope.
 */
export class TracksideAssetsManager {
  public group: THREE.Group;
  private scene: THREE.Scene;
  private rapierWorld: RAPIER.World;
  private materials: THREE.Material[] = [];
  private colliders: RAPIER.Collider[] = [];

  // Dedicated Pit Lane State
  public pitBoxes: PitBox[] = [];
  public pitEntryDistanceM = 20420;
  public pitExitDistanceM = 250;
  public activePitBoxIndex = 0; // Driver's designated pit stall (Box 1)
  public isPitLimiterActive = false;
  public pitServiceTimer = 0;
  public isServicingInPit = false;
  public pitServiceComplete = false;

  // Sponsor Bridges Catalog
  private static readonly SPONSOR_BRIDGES: SponsorBridgeDef[] = [
    {
      name: 'Audi Sport Gantry',
      distanceM: 20680,
      sponsorText: 'AUDI SPORT  •  START-ZIEL',
      brandColor: 0xdc2626, // Audi Red
      textColor: '#ffffff',
      widthM: 24.0,
      heightClearanceM: 6.8,
    },
    {
      name: 'Yokohama Bridge',
      distanceM: 3450,
      sponsorText: 'YOKOHAMA  •  ADVAN',
      brandColor: 0x18181b, // Yokohama Black/Red
      textColor: '#ef4444',
      widthM: 22.0,
      heightClearanceM: 6.5,
    },
    {
      name: 'Dunlop Bridge',
      distanceM: 7850,
      sponsorText: 'DUNLOP  •  BREIDSCHEID',
      brandColor: 0xeab308, // Dunlop Yellow
      textColor: '#000000',
      widthM: 20.0,
      heightClearanceM: 6.2,
    },
    {
      name: 'Bilstein Bridge',
      distanceM: 19150,
      sponsorText: 'BILSTEIN  •  DÖTTINGER HÖHE',
      brandColor: 0x0284c7, // Bilstein Blue
      textColor: '#facc15',
      widthM: 26.0,
      heightClearanceM: 7.2,
    },
  ];

  constructor(scene: THREE.Scene, rapierWorld: RAPIER.World, samples: SplinePoint[]) {
    this.scene = scene;
    this.rapierWorld = rapierWorld;
    this.group = new THREE.Group();
    this.group.name = 'Trackside_Realism_Infrastructure';

    this.scene.add(this.group);

    if (samples && samples.length > 0) {
      this.buildSponsorBridges(samples);
      this.buildCatchFences(samples);
      this.buildTireBarriers(samples);
      this.buildDedicatedPitLane(samples);
    }
  }

  /**
   * Builds overhead steel truss sponsor bridges spanning the full track width.
   */
  private buildSponsorBridges(samples: SplinePoint[]): void {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      metalness: 0.85,
      roughness: 0.35,
      name: 'Bridge_Truss_Steel',
    });
    this.materials.push(steelMat);

    for (const def of TracksideAssetsManager.SPONSOR_BRIDGES) {
      const sp = this.sampleSplineAtDistance(samples, def.distanceM);
      if (!sp) continue;

      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.copy(sp.position);

      const fwd = sp.tangent.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const lat = new THREE.Vector3().crossVectors(up, fwd).normalize();
      const rotMatrix = new THREE.Matrix4().makeBasis(lat, up, fwd);
      bridgeGroup.quaternion.setFromRotationMatrix(rotMatrix);

      const spanW = def.widthM ?? 24.0;
      const hClear = def.heightClearanceM ?? 6.5;
      const trussH = 1.8;

      // 1. Steel Support Columns (Pillars left & right outside Armco barriers)
      const pillarGeo = new THREE.BoxGeometry(0.9, hClear + trussH, 0.9);
      const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
      leftPillar.position.set(-spanW * 0.5, (hClear + trussH) * 0.5, 0);
      const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
      rightPillar.position.set(spanW * 0.5, (hClear + trussH) * 0.5, 0);
      bridgeGroup.add(leftPillar);
      bridgeGroup.add(rightPillar);

      // 2. Horizontal Overhead Truss Beam
      const beamGeo = new THREE.BoxGeometry(spanW + 1.6, trussH, 1.4);
      const beamMesh = new THREE.Mesh(beamGeo, steelMat);
      beamMesh.position.set(0, hClear + trussH * 0.5, 0);
      bridgeGroup.add(beamMesh);

      // 3. Branded Sponsor Fascia Board
      let bannerMat: THREE.Material;
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        // Background banner color
        ctx.fillStyle = '#' + def.brandColor.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 1024, 128);

        // Border accents
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, 1016, 120);

        // Sponsor Text
        ctx.fillStyle = def.textColor;
        ctx.font = '900 52px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.sponsorText, 512, 64);

        const bannerTex = new THREE.CanvasTexture(canvas);
        bannerTex.anisotropy = 4;
        bannerMat = new THREE.MeshStandardMaterial({
          map: bannerTex,
          roughness: 0.3,
          metalness: 0.2,
        });
      } else {
        bannerMat = new THREE.MeshStandardMaterial({
          color: def.brandColor,
          roughness: 0.3,
          metalness: 0.2,
        });
      }
      this.materials.push(bannerMat);

      // Front fascia (facing oncoming cars)
      const fasciaGeo = new THREE.PlaneGeometry(spanW * 0.92, trussH * 0.88);
      const frontFascia = new THREE.Mesh(fasciaGeo, bannerMat);
      frontFascia.position.set(0, hClear + trussH * 0.5, -0.72);
      frontFascia.rotation.y = Math.PI; // Face oncoming -Z
      bridgeGroup.add(frontFascia);

      // Rear fascia (facing trailing traffic)
      const rearFascia = new THREE.Mesh(fasciaGeo, bannerMat);
      rearFascia.position.set(0, hClear + trussH * 0.5, 0.72);
      bridgeGroup.add(rearFascia);

      this.group.add(bridgeGroup);
    }
  }

  /**
   * Builds FIA debris catch fences with galvanized steel vertical posts and wire mesh netting
   * mounted directly along high-speed spectator zones.
   */
  private buildCatchFences(samples: SplinePoint[]): void {
    const totalSamples = samples.length;

    // High-tensile steel wire mesh material
    const wireMeshMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.75,
      metalness: 0.65,
      wireframe: true,
      transparent: true,
      opacity: 0.70,
      name: 'FIA_Catch_Fence_Netting',
    });
    this.materials.push(wireMeshMat);

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.45,
      metalness: 0.8,
      name: 'FIA_Catch_Fence_Post',
    });
    this.materials.push(postMat);

    // Spectator zones (distance ranges along Nordschleife)
    const spectatorRanges: [number, number][] = [
      [750, 1450],     // Hatzenbach
      [2750, 3550],    // Flugplatz / Schwedenkreuz
      [5000, 5400],    // Adenauer Forst
      [13950, 14550],  // Brünnchen
      [14950, 15550],  // Pflanzgarten
      [16250, 16800],  // Schwalbenschwanz
      [20150, 20832],  // Antoniusbuche / T13
    ];

    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.7, 6);

    for (let i = 0; i < totalSamples; i += 4) {
      const sp = samples[i];
      const inZone = spectatorRanges.some(([start, end]) => sp.distance >= start && sp.distance <= end);
      if (!inZone) continue;

      const fwd = sp.tangent.clone().normalize();
      const hRight = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();

      const halfW = sp.trackWidth * 0.5 + 5.0; // Anchored just behind Armco barrier face

      for (const side of [-1, 1] as const) {
        // Post
        const postMesh = new THREE.Mesh(postGeo, postMat);
        postMesh.position.copy(sp.position)
          .addScaledVector(hRight, side * halfW);
        postMesh.position.y += 1.35;
        this.group.add(postMesh);

        // Netting panel between consecutive posts
        if (i + 4 < totalSamples) {
          const nextSp = samples[i + 4];
          const nextPos = nextSp.position.clone()
            .addScaledVector(new THREE.Vector3(nextSp.tangent.z, 0, -nextSp.tangent.x).normalize(), side * (nextSp.trackWidth * 0.5 + 5.0));
          nextPos.y += 1.35;

          const panelMid = new THREE.Vector3().addVectors(postMesh.position, nextPos).multiplyScalar(0.5);
          const panelLen = postMesh.position.distanceTo(nextPos);
          const panelGeo = new THREE.PlaneGeometry(panelLen, 2.2);

          const panelMesh = new THREE.Mesh(panelGeo, wireMeshMat);
          panelMesh.position.copy(panelMid);
          panelMesh.lookAt(panelMid.clone().add(hRight.clone().multiplyScalar(side)));
          this.group.add(panelMesh);
        }
      }
    }
  }

  /**
   * Places high-impact red-and-white tire barrier stacks and Tecpro blocks at acute runoffs.
   */
  private buildTireBarriers(samples: SplinePoint[]): void {
    const runoffDistances: { distM: number; side: -1 | 1 }[] = [
      { distM: 3950, side: -1 },  // Aremberg outside left
      { distM: 5180, side: 1 },   // Adenauer Forst outside right
      { distM: 7480, side: -1 },  // Wehrseifen downhill trap
      { distM: 14200, side: -1 }, // Brünnchen runoff
      { distM: 20380, side: -1 }, // Hohenrain chicane outside left
    ];

    const tireRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.85,
      metalness: 0.1,
      name: 'Tire_Barrier_Red',
    });
    const tireWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf4f4f5,
      roughness: 0.85,
      metalness: 0.1,
      name: 'Tire_Barrier_White',
    });
    this.materials.push(tireRedMat, tireWhiteMat);

    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);

    for (const r of runoffDistances) {
      const sp = this.sampleSplineAtDistance(samples, r.distM);
      if (!sp) continue;

      const fwd = sp.tangent.clone().normalize();
      const hRight = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();
      const basePos = sp.position.clone().addScaledVector(hRight, r.side * (sp.trackWidth * 0.5 + 5.5));

      // Construct a 3-layer x 4-column stack of tires
      for (let row = 0; row < 4; row++) {
        for (let tier = 0; tier < 3; tier++) {
          const isRed = (row + tier) % 2 === 0;
          const tireMesh = new THREE.Mesh(tireGeo, isRed ? tireRedMat : tireWhiteMat);
          tireMesh.position.copy(basePos)
            .addScaledVector(fwd, (row - 1.5) * 0.8)
            .addScaledVector(hRight, r.side * (tier * 0.25));
          tireMesh.position.y += 0.14 + tier * 0.28;
          tireMesh.rotation.z = Math.PI * 0.5;
          this.group.add(tireMesh);
        }
      }
    }
  }

  /**
   * Constructs the physically dedicated drivable pit lane running parallel to Start-Ziel straight,
   * partitioned by continuous concrete pit wall divider, 10+ marked team pit stalls with
   * overhead lollipop rigs, deceleration entry taper, and acceleration exit blend lane.
   */
  private buildDedicatedPitLane(samples: SplinePoint[]): void {
    const totalSamples = samples.length;
    const pitStartSample = Math.floor((this.pitEntryDistanceM / (samples[totalSamples - 1].distance || 20832)) * totalSamples);
    const pitSpanSamples = 60; // Spans ~300m parallel to straight

    const pitApronMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.75,
      metalness: 0.15,
      name: 'Pit_Apron_Asphalt',
    });
    const pitWallMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.8,
      metalness: 0.2,
      name: 'Pit_Wall_Concrete',
    });
    const lollipopMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.35,
      metalness: 0.8,
      name: 'Pit_Lollipop_Steel',
    });
    this.materials.push(pitApronMat, pitWallMat, lollipopMat);

    const pitWidthM = 7.5;
    const pitOffsetM = 11.5; // Offset to driver's right of track centerline
    const wallHeightM = 1.05;
    const wallThicknessM = 0.45;

    // Build 10 Marked Team Pit Boxes along the apron
    const pitBoxLengthM = 6.5;
    const pitBoxWidthM = 3.2;
    this.pitBoxes = [];

    const stallBaseSample = (pitStartSample + 12) % totalSamples;
    for (let b = 0; b < 10; b++) {
      const spIdx = (stallBaseSample + b * 4) % totalSamples;
      const sp = samples[spIdx];
      const fwd = sp.tangent.clone().normalize();
      const hRight = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();

      const boxCenter = sp.position.clone()
        .addScaledVector(hRight, pitOffsetM + pitWidthM * 0.35);

      this.pitBoxes.push({
        id: b,
        name: `Pit Box ${b + 1}`,
        centerPos: boxCenter,
        widthM: pitBoxWidthM,
        lengthM: pitBoxLengthM,
        stallNumber: b + 1,
      });

      // Visual Pit Box Ground Markings
      const markGeo = new THREE.PlaneGeometry(pitBoxWidthM, pitBoxLengthM);
      const markMat = new THREE.MeshBasicMaterial({
        color: b === this.activePitBoxIndex ? 0x22c55e : 0xfacc15, // Green for player stall, yellow for others
        transparent: true,
        opacity: 0.75,
      });
      const markMesh = new THREE.Mesh(markGeo, markMat);
      markMesh.position.copy(boxCenter);
      markMesh.position.y += 0.02; // Sits flush on apron
      markMesh.rotation.x = -Math.PI * 0.5;
      markMesh.rotation.z = Math.atan2(fwd.x, fwd.z);
      this.group.add(markMesh);

      // Overhead Team Lollipop Gantry Rig
      const gantryGroup = new THREE.Group();
      gantryGroup.position.copy(boxCenter).addScaledVector(hRight, pitWidthM * 0.35);
      const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.8, 8);
      const post = new THREE.Mesh(postGeo, lollipopMat);
      post.position.y = 1.9;
      gantryGroup.add(post);

      // Overhead boom arm swinging over pit box
      const boomGeo = new THREE.BoxGeometry(2.4, 0.08, 0.08);
      const boom = new THREE.Mesh(boomGeo, lollipopMat);
      boom.position.set(-1.2, 3.7, 0);
      gantryGroup.add(boom);

      // Hanging digital stop sign / lollipop
      const lollipopSignGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16);
      const lollipopSignMat = new THREE.MeshBasicMaterial({
        color: b === this.activePitBoxIndex ? 0xef4444 : 0x71717a, // Red STOP indicator
      });
      const lollipopSign = new THREE.Mesh(lollipopSignGeo, lollipopSignMat);
      lollipopSign.position.set(-2.0, 2.5, 0);
      lollipopSign.rotation.x = Math.PI * 0.5;
      gantryGroup.add(lollipopSign);

      this.group.add(gantryGroup);
    }

    // Extrude Concrete Dividing Pit Wall along the length
    const wallVerts: THREE.Vector3[] = [];
    for (let s = 0; s < pitSpanSamples; s++) {
      const idx = (pitStartSample + s) % totalSamples;
      const sp = samples[idx];
      const hRight = new THREE.Vector3(sp.tangent.z, 0, -sp.tangent.x).normalize();
      const wallCenter = sp.position.clone().addScaledVector(hRight, pitOffsetM - wallThicknessM * 0.5);
      wallVerts.push(wallCenter);
    }

    if (wallVerts.length >= 2) {
      // Create Three.js Pit Wall Geometry
      const wallGeo = new THREE.BufferGeometry();
      const positions: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i < wallVerts.length; i++) {
        const p = wallVerts[i];
        positions.push(p.x, p.y, p.z);
        positions.push(p.x, p.y + wallHeightM, p.z);
      }
      for (let i = 0; i < wallVerts.length - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      wallGeo.setIndex(indices);
      wallGeo.computeVertexNormals();

      const wallMesh = new THREE.Mesh(wallGeo, pitWallMat);
      this.group.add(wallMesh);

      // Register Rapier Cuboid Colliders for the dividing pit wall segments to prevent cutting
      for (let i = 0; i < wallVerts.length - 1; i += 3) {
        const p0 = wallVerts[i];
        const p1 = wallVerts[Math.min(wallVerts.length - 1, i + 3)];
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        const segLen = p0.distanceTo(p1);
        const fwd = new THREE.Vector3().subVectors(p1, p0).normalize();
        const yaw = Math.atan2(fwd.x, fwd.z);

        const qy = Math.sin(yaw * 0.5);
        const qw = Math.cos(yaw * 0.5);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
          .setTranslation(mid.x, mid.y + wallHeightM * 0.5, mid.z)
          .setRotation({ x: 0, y: qy, z: 0, w: qw });
        const rb = this.rapierWorld.createRigidBody(bodyDesc);

        const colDesc = RAPIER.ColliderDesc.cuboid(wallThicknessM * 0.5, wallHeightM * 0.5, segLen * 0.5)
          .setFriction(0.6);
        const col = this.rapierWorld.createCollider(colDesc, rb);
        this.colliders.push(col);
      }
    }
  }

  /**
   * Checks whether a 3D vehicle position falls inside the dedicated pit lane boundary.
   */
  public isInPitLane(carPos: THREE.Vector3, currentTrackDistM: number): boolean {
    // Pit lane corridor runs along distance range [pitEntryDistanceM .. 20832] and [0 .. pitExitDistanceM]
    const inDistRange =
      currentTrackDistM >= this.pitEntryDistanceM || currentTrackDistM <= this.pitExitDistanceM;
    if (!inDistRange) return false;

    // Check lateral distance to any pit stall center
    for (const box of this.pitBoxes) {
      const d = carPos.distanceTo(box.centerPos);
      if (d <= 14.0) return true;
    }

    return false;
  }

  /**
   * Checks whether the vehicle is stopped inside its designated pit stall (Box 1).
   */
  public isInsideAssignedPitBox(carPos: THREE.Vector3): boolean {
    const box = this.pitBoxes[this.activePitBoxIndex];
    if (!box) return false;
    const d = carPos.distanceTo(box.centerPos);
    return d <= 3.2; // Inside the 6.5m x 3.2m stall envelope
  }

  /**
   * Updates pit limiter logic and stationary pit service sequence.
   * Returns current pit status summary for HUD and controller telemetry.
   */
  public update(dt: number, carPos: THREE.Vector3, speedKmh: number, currentTrackDistM: number): {
    inPitLane: boolean;
    speedLimiterActive: boolean;
    pitStatusLabel?: string;
    triggerServiceComplete: boolean;
  } {
    const inPit = this.isInPitLane(carPos, currentTrackDistM);

    // Auto-engage speed limiter when entering pit lane corridor
    if (inPit) {
      this.isPitLimiterActive = true;
    } else {
      this.isPitLimiterActive = false;
      this.isServicingInPit = false;
      this.pitServiceTimer = 0;
      this.pitServiceComplete = false;
    }

    let triggerServiceComplete = false;
    let label: string | undefined;

    if (inPit) {
      if (this.isInsideAssignedPitBox(carPos)) {
        if (speedKmh < 2.0) {
          // Stationary in assigned pit box: initiate 4-second service sequence
          this.isServicingInPit = true;
          this.pitServiceTimer += dt;
          const remainingSec = Math.max(0, 4.0 - this.pitServiceTimer).toFixed(1);
          label = `PIT SERVICE: ${remainingSec}s (REFUEL & TIRES)`;

          if (this.pitServiceTimer >= 4.0 && !this.pitServiceComplete) {
            this.pitServiceComplete = true;
            triggerServiceComplete = true;
            label = 'PIT SERVICE COMPLETE • GO GO GO!';
          }
        } else {
          label = 'ASSIGNED PIT BOX AHEAD • HALT VEHICLE';
        }
      } else {
        label = speedKmh > 60.5
          ? '⚠️ PIT SPEED LIMIT EXCEEDED (60 KM/H)'
          : 'PIT LANE: LIMITER ACTIVE (60 KM/H)';
      }
    }

    return {
      inPitLane: inPit,
      speedLimiterActive: this.isPitLimiterActive,
      pitStatusLabel: label,
      triggerServiceComplete,
    };
  }

  private sampleSplineAtDistance(samples: SplinePoint[], targetDist: number): SplinePoint | null {
    if (!samples || samples.length === 0) return null;
    let closest = samples[0];
    let minDiff = Infinity;
    for (const sp of samples) {
      const diff = Math.abs(sp.distance - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = sp;
      }
    }
    return closest;
  }

  public dispose(): void {
    for (const mat of this.materials) {
      mat.dispose();
    }
    for (const col of this.colliders) {
      try {
        this.rapierWorld.removeCollider(col, true);
      } catch {
        // ignore
      }
    }
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    this.scene.remove(this.group);
  }
}
