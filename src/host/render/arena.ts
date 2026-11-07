import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class SkidpadArena {
  public scene: THREE.Scene;
  public world: RAPIER.World;
  public rapier: typeof RAPIER;
  public rootGroup = new THREE.Group();
  public colliders: RAPIER.Collider[] = [];

  constructor(scene: THREE.Scene, world: RAPIER.World, rapier: typeof RAPIER) {
    this.scene = scene;
    this.world = world;
    this.rapier = rapier;

    this.scene.add(this.rootGroup);

    this.buildGround();
    this.buildHighSpeedRunway();
    this.buildDistanceGantriesAndSigns();
    this.buildConcentricCircles();
    this.buildSlalomCones();
    this.buildPerimeterBarriers();
  }

  /**
   * Generates a high-resolution procedural asphalt texture with grid lines.
   */
  private createAsphaltGridTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Asphalt dark slate base
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle noise specks
    ctx.fillStyle = '#282b31';
    for (let i = 0; i < 40000; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 1024;
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }

    // Grid lines (represents 50m intervals when repeated)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 1024, 1024);

    // Center sub-grid (25m marks)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 2;
    ctx.strokeRect(256, 256, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // 1200m width / 50m = 24 repeats; 6000m length / 50m = 120 repeats
    texture.repeat.set(24, 120);
    return texture;
  }

  private buildGround(): void {
    const sizeX = 1200; // 1.2 km wide
    const sizeZ = 6000; // 6.0 km long
    const asphaltTex = this.createAsphaltGridTexture();

    const groundGeo = new THREE.PlaneGeometry(sizeX, sizeZ);
    const groundMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.85,
      metalness: 0.1,
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, 0, 2500); // Centers Z from -500 to +5500
    groundMesh.receiveShadow = true;
    this.rootGroup.add(groundMesh);

    // Rapier physics ground plane collider covering the 6km proving ground
    const groundColliderDesc = this.rapier.ColliderDesc.cuboid(sizeX / 2, 0.5, sizeZ / 2)
      .setTranslation(0, -0.5, 2500)
      .setFriction(0.9)
      .setRestitution(0.0);

    const groundCol = this.world.createCollider(groundColliderDesc);
    (groundCol as any).userData = { surface: 'asphalt' };
    this.colliders.push(groundCol);
  }

  private buildHighSpeedRunway(): void {
    const runwayWidth = 36;
    const runwayLength = 5600; // From z = -300 to z = +5300
    const runwayCenterZ = 2500;

    // Dark tarmac runway surface
    const runwayGeo = new THREE.PlaneGeometry(runwayWidth, runwayLength);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    const runwayMesh = new THREE.Mesh(runwayGeo, runwayMat);
    runwayMesh.rotation.x = -Math.PI / 2;
    runwayMesh.position.set(0, 0.008, runwayCenterZ);
    runwayMesh.receiveShadow = true;
    this.rootGroup.add(runwayMesh);

    // 1. Starting Box & Checkered Finish Line
    const startLineMat = new THREE.MeshBasicMaterial({ color: 0x22c55e }); // Neon green
    const finishLineMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Racing red

    const lineGeo = new THREE.PlaneGeometry(runwayWidth, 2.5);
    const startLine = new THREE.Mesh(lineGeo, startLineMat);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.015, 0); // Z = 0 is start line
    this.rootGroup.add(startLine);

    const finishLine = new THREE.Mesh(lineGeo, finishLineMat);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(0, 0.015, 5000); // Z = 5000m is 5km terminal line
    this.rootGroup.add(finishLine);

    // 2. Centerline 10m dashes (6m line, 4m gap) from Z = 0 to Z = 5000
    const dashCount = 500;
    const dashGeo = new THREE.PlaneGeometry(0.35, 6.0);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dashInstanced = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    dashInstanced.rotation.x = -Math.PI / 2;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      // In Three.js plane after -PI/2 rotation: plane local Y maps to world +Z
      dummy.position.set(0, i * 10 + 3, 0.014);
      dummy.updateMatrix();
      dashInstanced.setMatrixAt(i, dummy.matrix);
    }
    dashInstanced.instanceMatrix.needsUpdate = true;
    this.rootGroup.add(dashInstanced);

    // 3. Transverse Distance Hash Bars every 50m & 500m
    const hashMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hashMatYellow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const hash100Geo = new THREE.PlaneGeometry(runwayWidth * 0.95, 0.8);
    const hash500Geo = new THREE.PlaneGeometry(runwayWidth * 0.98, 2.2);

    for (let z = 50; z <= 5000; z += 50) {
      const is500m = z % 500 === 0;
      const is100m = z % 100 === 0;
      const geo = is500m ? hash500Geo : hash100Geo;
      const mat = is500m ? hashMatYellow : hashMatWhite;

      // Only draw 100m/500m bars to keep scene ultra-clean
      if (is100m || is500m) {
        const hashMesh = new THREE.Mesh(geo, mat);
        hashMesh.rotation.x = -Math.PI / 2;
        hashMesh.position.set(0, 0.012, z);
        this.rootGroup.add(hashMesh);
      }
    }

    // 4. Alternating Red & White Motorsport Kerbs along runway edges (X = -18 and X = +18)
    this.buildRunwayCurbs(runwayWidth / 2, -200, 5200);
  }

  private buildRunwayCurbs(halfWidth: number, startZ: number, endZ: number): void {
    const curbLength = 4.0; // 4m per block
    const curbWidth = 1.0;
    const count = Math.floor((endZ - startZ) / curbLength);

    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });

    const curbGeo = new THREE.BoxGeometry(curbWidth, 0.12, curbLength);
    const leftCurbsRed = new THREE.InstancedMesh(curbGeo, redMat, Math.ceil(count / 2));
    const leftCurbsWhite = new THREE.InstancedMesh(curbGeo, whiteMat, Math.ceil(count / 2));
    const rightCurbsRed = new THREE.InstancedMesh(curbGeo, redMat, Math.ceil(count / 2));
    const rightCurbsWhite = new THREE.InstancedMesh(curbGeo, whiteMat, Math.ceil(count / 2));

    const dummy = new THREE.Object3D();
    let redIdx = 0;
    let whiteIdx = 0;

    for (let i = 0; i < count; i++) {
      const z = startZ + i * curbLength + curbLength / 2;
      const isRed = i % 2 === 0;

      // Left curb
      dummy.position.set(-halfWidth - curbWidth / 2, 0.06, z);
      dummy.updateMatrix();
      if (isRed) {
        leftCurbsRed.setMatrixAt(redIdx, dummy.matrix);
      } else {
        leftCurbsWhite.setMatrixAt(whiteIdx, dummy.matrix);
      }

      // Right curb
      dummy.position.set(halfWidth + curbWidth / 2, 0.06, z);
      dummy.updateMatrix();
      if (isRed) {
        rightCurbsRed.setMatrixAt(redIdx, dummy.matrix);
        redIdx++;
      } else {
        rightCurbsWhite.setMatrixAt(whiteIdx, dummy.matrix);
        whiteIdx++;
      }
    }

    leftCurbsRed.instanceMatrix.needsUpdate = true;
    leftCurbsWhite.instanceMatrix.needsUpdate = true;
    rightCurbsRed.instanceMatrix.needsUpdate = true;
    rightCurbsWhite.instanceMatrix.needsUpdate = true;

    this.rootGroup.add(leftCurbsRed);
    this.rootGroup.add(leftCurbsWhite);
    this.rootGroup.add(rightCurbsRed);
    this.rootGroup.add(rightCurbsWhite);
  }

  /**
   * Builds overhead steel truss gantries every 500m and trackside boards every 100m.
   */
  private buildDistanceGantriesAndSigns(): void {
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

    // 1. Overhead Gantries at 500m, 1000m, 1500m, ... 5000m
    const gantryDistances = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];

    for (const dist of gantryDistances) {
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(0, 0, dist);

      // Left and right support columns (height 7.5m)
      const colGeo = new THREE.BoxGeometry(0.8, 7.5, 0.8);
      const colLeft = new THREE.Mesh(colGeo, trussMat);
      colLeft.position.set(-19.5, 3.75, 0);
      colLeft.castShadow = true;
      gantryGroup.add(colLeft);

      const colRight = new THREE.Mesh(colGeo, trussMat);
      colRight.position.set(19.5, 3.75, 0);
      colRight.castShadow = true;
      gantryGroup.add(colRight);

      // Overhead crossbeam spanning 40m
      const beamGeo = new THREE.BoxGeometry(40, 1.0, 1.2);
      const beam = new THREE.Mesh(beamGeo, trussMat);
      beam.position.set(0, 7.0, 0);
      beam.castShadow = true;
      gantryGroup.add(beam);

      // Large bold illuminated sign board
      const labelText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} KM` : `${dist} M`;
      const signTex = this.createSignboardTexture(labelText, '#0f172a', '#facc15', 'bold 88px');
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });

      // Front facing sign (seen when driving +Z)
      const signGeo = new THREE.PlaneGeometry(7.5, 2.2);
      const signFront = new THREE.Mesh(signGeo, signMat);
      signFront.position.set(0, 7.0, -0.65);
      gantryGroup.add(signFront);

      // Back facing sign (seen when driving -Z)
      const signBack = new THREE.Mesh(signGeo, signMat);
      signBack.position.set(0, 7.0, 0.65);
      signBack.rotation.y = Math.PI;
      gantryGroup.add(signBack);

      this.rootGroup.add(gantryGroup);
    }

    // 2. Trackside distance boards every 100m on left and right borders
    const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
    const postGeo = new THREE.BoxGeometry(0.18, 2.0, 0.18);
    const boardGeo = new THREE.PlaneGeometry(1.6, 1.0);

    for (let dist = 100; dist <= 5000; dist += 100) {
      if (dist % 500 === 0) continue; // Gantries already mark 500m intervals

      const label = dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${dist}m`;
      const tex = this.createSignboardTexture(label, '#1e293b', '#ffffff', 'bold 80px');
      const boardMat = new THREE.MeshBasicMaterial({ map: tex });

      // Left trackside sign
      const postL = new THREE.Mesh(postGeo, postMat);
      postL.position.set(-19.8, 1.0, dist);
      this.rootGroup.add(postL);

      const boardL = new THREE.Mesh(boardGeo, boardMat);
      boardL.position.set(-19.8, 1.6, dist);
      boardL.rotation.y = 0.25; // Slight angle toward driver
      this.rootGroup.add(boardL);

      // Right trackside sign
      const postR = new THREE.Mesh(postGeo, postMat);
      postR.position.set(19.8, 1.0, dist);
      this.rootGroup.add(postR);

      const boardR = new THREE.Mesh(boardGeo, boardMat);
      boardR.position.set(19.8, 1.6, dist);
      boardR.rotation.y = -0.25;
      this.rootGroup.add(boardR);
    }
  }

  private createSignboardTexture(text: string, bgColor: string, textColor: string, font: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 492, 236);

    ctx.fillStyle = textColor;
    ctx.font = `${font} system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  private buildConcentricCircles(): void {
    // Skidpad handling circles positioned beside the runway at (x = -160, z = 200)
    const center = new THREE.Vector3(-160, 0.015, 200);

    const radii = [40, 80, 160];
    for (const r of radii) {
      const ringGeo = new THREE.RingGeometry(r - 0.45, r + 0.45, 128);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.copy(center);
      this.rootGroup.add(ringMesh);
    }

    const centerMarker = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    centerMarker.rotation.x = -Math.PI / 2;
    centerMarker.position.copy(center);
    this.rootGroup.add(centerMarker);
  }

  private buildSlalomCones(): void {
    // Slalom cones along x = -70 from z = 60 to z = 460 spaced 40m apart
    const coneGeo = new THREE.ConeGeometry(0.35, 0.9, 16);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xff5500, // Safety orange
      roughness: 0.4,
    });

    const bandGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 16);
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let z = 60; z <= 460; z += 40) {
      const coneGroup = new THREE.Group();
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = 0.45;
      cone.castShadow = true;
      coneGroup.add(cone);

      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.45;
      coneGroup.add(band);

      coneGroup.position.set(-70, 0, z);
      this.rootGroup.add(coneGroup);
    }
  }

  private buildPerimeterBarriers(): void {
    const halfX = 595;
    const minZ = -495;
    const maxZ = 5495;
    const lengthZ = maxZ - minZ; // 5990m
    const height = 1.4;
    const thickness = 1.0;

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.8,
    });

    // 4 Armco guardrails enclosing the 1.2km x 6.0km proving ground
    const configs = [
      // Left wall
      { pos: [-halfX, height / 2, (minZ + maxZ) / 2], size: [thickness, height, lengthZ] },
      // Right wall
      { pos: [halfX, height / 2, (minZ + maxZ) / 2], size: [thickness, height, lengthZ] },
      // South wall (behind start)
      { pos: [0, height / 2, minZ], size: [halfX * 2, height, thickness] },
      // North wall (past 5.5km)
      { pos: [0, height / 2, maxZ], size: [halfX * 2, height, thickness] },
    ];

    for (const cfg of configs) {
      const geo = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
      const mesh = new THREE.Mesh(geo, barrierMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.rootGroup.add(mesh);

      // Rapier physics barrier collider
      const colDesc = this.rapier.ColliderDesc.cuboid(
        cfg.size[0] / 2,
        cfg.size[1] / 2,
        cfg.size[2] / 2
      ).setTranslation(cfg.pos[0], cfg.pos[1], cfg.pos[2]);

      const barrierCol = this.world.createCollider(colDesc);
      this.colliders.push(barrierCol);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.rootGroup.visible = enabled;
    for (const col of this.colliders) {
      col.setEnabled(enabled);
    }
  }
}
