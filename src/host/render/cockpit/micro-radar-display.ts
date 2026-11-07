import * as THREE from 'three';
import { SplinePoint } from '../../streaming/centerline';

export interface NearbyCar {
  id: string;
  number: string;
  color: string;
  worldPos: THREE.Vector3;
  headingRad: number;
  speedKmh: number;
}

/**
 * In-Cockpit Micro Minimap & Proximity Radar Display.
 * Mounted directly below the digital rear-view mirror screen on the center dashboard:
 * - Zoomed-in lookahead curvature showing the next 1–2 corners ahead with radius & distance
 * - Locked orientation: player car always faces strictly UP (heading-up)
 * - Simplified Porsche 911 RSR car silhouette with flared hips, round headlights & rear wing
 * - Integrated Motorsport Spotter & Proximity Radar (Helicorsa / ACC style):
 *   Detects nearby cars and renders dynamic flashing yellow/amber contact hazard arcs
 *   at the exact overlap point (left door, right door, rear quarter) with audible/visual alerts!
 */
export class MicroRadarDisplay {
  public group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private screenMesh: THREE.Mesh;
  private materials: THREE.Material[] = [];

  private lastRenderTime = 0;
  private flashPhase = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'In_Cockpit_Micro_Radar';

    // 1. High-Resolution 2D Canvas Display (512x512)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // 2. Physical 3D Monitor Casing & Screen
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.45,
      metalness: 0.65,
      name: 'Micro_Radar_Casing',
    });
    this.materials.push(carbonMat);

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.35,
      metalness: 0.8,
      name: 'Micro_Radar_Bezel',
    });
    this.materials.push(bezelMat);

    // Beveled 4:3 monitor body (0.19m wide x 0.13m high x 0.02m deep)
    const bodyGeo = new THREE.BoxGeometry(0.19, 0.13, 0.02);
    const bodyMesh = new THREE.Mesh(bodyGeo, carbonMat);
    this.group.add(bodyMesh);

    // Outer bezel rim
    const bezelGeo = new THREE.BoxGeometry(0.194, 0.134, 0.005);
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 0, 0.009);
    this.group.add(bezelMesh);

    // Active LCD screen plane
    const screenGeo = new THREE.PlaneGeometry(0.176, 0.116);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.texture });
    this.materials.push(screenMat);

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 0, 0.012);
    this.group.add(this.screenMesh);

    // Initial clear
    this.drawBlankDisplay();
  }

  private drawBlankDisplay(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#09090d';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RADAR STANDBY', 256, 256);
    this.texture.needsUpdate = true;
  }

  /**
   * Main real-time update loop. Renders zoomed-in lookahead curvature,
   * simplified Porsche silhouette, and dynamic proximity contact warnings.
   */
  public update(
    carPos: THREE.Vector3,
    carOrientation: THREE.Quaternion | number,
    samples: SplinePoint[],
    currentSampleIndex: number,
    nearbyCars: NearbyCar[] = [],
    dt = 0.016
  ): void {
    const now = performance.now();
    // Throttle rendering to ~45-60 Hz for smooth animation with minimal CPU cost
    if (now - this.lastRenderTime < 16) return;
    this.lastRenderTime = now;
    this.flashPhase += dt * 8.0; // Flash cycle for contact hazards

    const ctx = this.ctx;
    const w = 512;
    const h = 512;

    // 1. Dark High-Tech Motorsport LCD Glass
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, w, h);

    // Subtle carbon grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 32; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 32; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Top Header Status Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 44);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(w, 44);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PORSCHE CORNER RADAR', 16, 28);

    // Spotter status badge
    let hasCriticalOverlap = false;
    let overlapSide: 'left' | 'right' | 'rear' | 'none' = 'none';

    // 2. Coordinate Transformation (Car-Centric Track-Up Heading Lock)
    // Car position on screen: (256, 380)
    const carScreenX = 256;
    const carScreenY = 380;
    const zoom = 2.4; // Pixels per meter (shows ~180-220m lookahead)

    let fwdX: number, fwdZ: number;
    let currentCarHeading = 0;
    if (typeof carOrientation === 'object' && carOrientation !== null && 'w' in carOrientation) {
      const q = carOrientation as THREE.Quaternion;
      fwdX = 2 * (q.x * q.z + q.w * q.y);
      fwdZ = 1 - 2 * (q.x * q.x + q.y * q.y);
      currentCarHeading = Math.atan2(fwdX, fwdZ);
    } else {
      const h = typeof carOrientation === 'number' ? carOrientation : 0;
      currentCarHeading = h;
      fwdX = Math.sin(h);
      fwdZ = Math.cos(h);
    }
    const len = Math.hypot(fwdX, fwdZ) || 1.0;
    fwdX /= len;
    fwdZ /= len;
    // Driver's true right vector: perpendicular to forward vector (Right = -fwdZ, +fwdX)
    const rightX = -fwdZ;
    const rightZ = fwdX;

    function worldToScreen(wx: number, wz: number): { x: number; y: number } {
      const dx = wx - carPos.x;
      const dz = wz - carPos.z;
      // Car-Centric Heading-Up: Forward moves strictly UP (-Y on canvas), Right moves (+X on canvas)
      const localForward = dx * fwdX + dz * fwdZ;
      const localRight = dx * rightX + dz * rightZ;
      return {
        x: carScreenX + localRight * zoom,
        y: carScreenY - localForward * zoom,
      };
    }

    // 3. Render Upcoming Track Ribbon & Curvature (Next 1–2 Corners)
    if (samples && samples.length > 0) {
      const total = samples.length;
      const lookaheadCount = Math.min(45, Math.floor(220 / 5)); // Next ~220 meters
      const lookbehindCount = 6; // ~30m behind

      // Draw asphalt track surface ribbon
      ctx.beginPath();
      const leftPoints: Array<{ x: number; y: number }> = [];
      const rightPoints: Array<{ x: number; y: number }> = [];

      for (let i = -lookbehindCount; i <= lookaheadCount; i++) {
        const idx = ((currentSampleIndex + i) % total + total) % total;
        const sp = samples[idx];
        const halfWidth = (sp.trackWidth || 12.0) / 2;

        const leftWorld = sp.position.clone().addScaledVector(sp.binormal, -halfWidth);
        const rightWorld = sp.position.clone().addScaledVector(sp.binormal, halfWidth);

        const lp = worldToScreen(leftWorld.x, leftWorld.z);
        const rp = worldToScreen(rightWorld.x, rightWorld.z);

        leftPoints.push(lp);
        rightPoints.push(rp);
      }

      // Fill dark asphalt ribbon
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      if (leftPoints.length > 0) {
        ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
        for (let i = 1; i < leftPoints.length; i++) {
          ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
        }
        for (let i = rightPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Track outer white boundary lines
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < leftPoints.length; i++) {
        if (i === 0) ctx.moveTo(leftPoints[i].x, leftPoints[i].y);
        else ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < rightPoints.length; i++) {
        if (i === 0) ctx.moveTo(rightPoints[i].x, rightPoints[i].y);
        else ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
      }
      ctx.stroke();

      // Red/White Kerbs on corner apexes
      for (let i = 0; i < lookaheadCount; i++) {
        const idx = ((currentSampleIndex + i) % total + total) % total;
        const sp = samples[idx];
        if (Math.abs(sp.turnRate) > 0.008) {
          const isLeftTurn = sp.turnRate > 0;
          const kPoints = isLeftTurn ? leftPoints : rightPoints;
          const ptIdx = i + lookbehindCount;
          if (ptIdx < kPoints.length - 1) {
            const p1 = kPoints[ptIdx];
            const p2 = kPoints[ptIdx + 1];
            ctx.strokeStyle = i % 2 === 0 ? '#dc2626' : '#ffffff';
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Corner Apex Detector Callout (Next 1 or 2 corners)
      let detectedTurns = 0;
      for (let i = 4; i < lookaheadCount; i++) {
        const idx = ((currentSampleIndex + i) % total + total) % total;
        const sp = samples[idx];
        if (Math.abs(sp.turnRate) > 0.012 && detectedTurns < 2) {
          const distM = i * 5;
          const isRight = sp.turnRate < 0;
          const turnRadius = Math.round(1 / Math.max(1e-4, Math.abs(sp.turnRate)));
          const badgeX = 496;
          const badgeY = 70 + detectedTurns * 46;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(badgeX - 190, badgeY - 18, 185, 36);
          ctx.strokeStyle = isRight ? '#f59e0b' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(badgeX - 190, badgeY - 18, 185, 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'right';
          const dirArrow = isRight ? '⮞' : '⮜';
          ctx.fillText(`${dirArrow} ${isRight ? 'RIGHT' : 'LEFT'} (R=${turnRadius}m)`, badgeX - 10, badgeY);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`DIST: ${distM}M`, badgeX - 10, badgeY + 14);

          detectedTurns++;
          i += 8; // Skip immediate next points of the same corner
        }
      }
    }

    // 4. Opponent Cars & Proximity Detection
    let minOpponentDist = 999.0;
    for (const opp of nearbyCars) {
      const dx = opp.worldPos.x - carPos.x;
      const dz = opp.worldPos.z - carPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minOpponentDist) minOpponentDist = dist;

      // Local position relative to car
      const oppLocalForward = dx * fwdX + dz * fwdZ;
      const oppLocalRight = dx * rightX + dz * rightZ;

      const oppScrX = carScreenX + oppLocalRight * zoom;
      const oppScrY = carScreenY - oppLocalForward * zoom;

      // Check for overlap / contact zone
      const latDist = Math.abs(oppLocalRight);
      const longDist = Math.abs(oppLocalForward);

      const isAlongside = longDist < 4.2 && latDist < 4.8;
      const isTailgating = oppLocalForward < -1.8 && oppLocalForward > -7.5 && latDist < 2.5;

      if (isAlongside || isTailgating) {
        hasCriticalOverlap = true;
        if (isAlongside) {
          overlapSide = oppLocalRight < 0 ? 'left' : 'right';
        } else {
          overlapSide = 'rear';
        }
      }

      // Draw Opponent Car Marker (Stylized Race Car Rectangle)
      const oppAngle = opp.headingRad - currentCarHeading;
      ctx.save();
      ctx.translate(oppScrX, oppScrY);
      ctx.rotate(-oppAngle);

      // Car body
      const oppW = 2.0 * zoom;
      const oppL = 4.6 * zoom;
      ctx.fillStyle = isAlongside ? '#facc15' : opp.color || '#38bdf8';
      ctx.fillRect(-oppW / 2, -oppL / 2, oppW, oppL);

      // Windshield & Roof
      ctx.fillStyle = '#09090b';
      ctx.fillRect(-oppW * 0.4, -oppL * 0.2, oppW * 0.8, oppL * 0.4);

      // Tail wing
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-oppW * 0.55, oppL * 0.35, oppW * 1.1, 3);

      ctx.restore();

      // Number tag & distance
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${opp.number} (${dist.toFixed(1)}m)`, oppScrX, oppScrY - 14);
    }

    // 5. Render Simplified Porsche 911 RSR Silhouette at (256, 380)
    ctx.save();
    ctx.translate(carScreenX, carScreenY);

    const carScale = zoom * 1.05; // 1:1 scale with zoom
    const isFlashing = Math.sin(this.flashPhase) > 0;

    // Contact Hazard Arcs (Flashing Yellow at Contact Point!)
    if (hasCriticalOverlap && isFlashing) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 10;
      ctx.beginPath();

      if (overlapSide === 'left') {
        // Flashing yellow arc along left door / fender
        ctx.arc(-14, 0, 18, Math.PI * 0.65, Math.PI * 1.35);
      } else if (overlapSide === 'right') {
        // Flashing yellow arc along right door / fender
        ctx.arc(14, 0, 18, -Math.PI * 0.35, Math.PI * 0.35);
      } else if (overlapSide === 'rear') {
        // Flashing yellow arc across rear bumper
        ctx.arc(0, 14, 16, Math.PI * 0.2, Math.PI * 0.8);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Porsche 911 Iconic Silhouette Path
    // Nose (-Y on canvas), Tail (+Y on canvas)
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e'; // Emerald green outline (Rexy theme)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 2.4;

    // Front Bumper / Splitter
    ctx.moveTo(-7 * carScale * 0.12, -22 * carScale * 0.12);
    ctx.lineTo(7 * carScale * 0.12, -22 * carScale * 0.12);
    // Right Front Fender & Headlight
    ctx.quadraticCurveTo(11 * carScale * 0.12, -18 * carScale * 0.12, 10 * carScale * 0.12, -10 * carScale * 0.12);
    // Right Door / Waistline
    ctx.lineTo(8.8 * carScale * 0.12, 2 * carScale * 0.12);
    // Right Rear Flared Arch (Wide 911 Hips)
    ctx.quadraticCurveTo(13.2 * carScale * 0.12, 10 * carScale * 0.12, 11 * carScale * 0.12, 19 * carScale * 0.12);
    // Rear Tail / Diffuser
    ctx.lineTo(-11 * carScale * 0.12, 19 * carScale * 0.12);
    // Left Rear Flared Arch
    ctx.quadraticCurveTo(-13.2 * carScale * 0.12, 10 * carScale * 0.12, -8.8 * carScale * 0.12, 2 * carScale * 0.12);
    // Left Door
    ctx.lineTo(-10 * carScale * 0.12, -10 * carScale * 0.12);
    // Left Front Fender & Headlight
    ctx.quadraticCurveTo(-11 * carScale * 0.12, -18 * carScale * 0.12, -7 * carScale * 0.12, -22 * carScale * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Oval Headlights on front
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(-7.5 * carScale * 0.12, -16 * carScale * 0.12, 2.2, 3.8, -0.15, 0, Math.PI * 2);
    ctx.ellipse(7.5 * carScale * 0.12, -16 * carScale * 0.12, 2.2, 3.8, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit Windshield & Roof Canopy
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-5.5 * carScale * 0.12, -9 * carScale * 0.12);
    ctx.lineTo(5.5 * carScale * 0.12, -9 * carScale * 0.12);
    ctx.lineTo(4.8 * carScale * 0.12, 8 * carScale * 0.12);
    ctx.lineTo(-4.8 * carScale * 0.12, 8 * carScale * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Aerodynamic Carbon Swan-Neck Rear Wing
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-14 * carScale * 0.12, 20 * carScale * 0.12, 28 * carScale * 0.12, 3);
    ctx.strokeRect(-14 * carScale * 0.12, 20 * carScale * 0.12, 28 * carScale * 0.12, 3);
    // Wing endplates (red)
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-14.5 * carScale * 0.12, 18.5 * carScale * 0.12, 2.5, 6);
    ctx.fillRect(12.5 * carScale * 0.12, 18.5 * carScale * 0.12, 2.5, 6);

    ctx.restore();

    // 6. Spotter Status Banner at Bottom
    const bannerY = 485;
    if (hasCriticalOverlap) {
      ctx.fillStyle = isFlashing ? '#eab308' : '#ca8a04';
      ctx.fillRect(16, bannerY - 20, 480, 36);
      ctx.fillStyle = '#09090b';
      ctx.font = '900 18px monospace';
      ctx.textAlign = 'center';
      const sideText = overlapSide === 'left' ? '⚠️ CAR LEFT' : overlapSide === 'right' ? '⚠️ CAR RIGHT' : '⚠️ CAR BEHIND';
      ctx.fillText(`SPOTTER: ${sideText}!`, 256, bannerY + 4);
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(16, bannerY - 20, 480, 36);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(16, bannerY - 20, 480, 36);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTER: ALL CLEAR', 256, bannerY + 4);
    }

    // Flag Texture Update for Three.js
    this.texture.needsUpdate = true;
  }

  public setEnabled(enabled: boolean): void {
    this.group.visible = enabled;
  }

  public dispose(): void {
    this.texture.dispose();
    for (const mat of this.materials) {
      mat.dispose();
    }
  }
}
