import * as THREE from 'three';
import { StandardWrapMapper } from './standard-wrap-mapper';

export interface LiveryTheme {
  id: string;
  name: string;
  team: string;
  carNumber: string;
  primaryColor: string;       // Body shell base (hex string)
  secondaryColor: string;     // Racing stripes / secondary panels (hex string)
  accentColor: string;        // Wing endplates / mirror caps (hex string)
  caliperColor: string;       // Brake calipers (hex string)
  rimColor: string;           // Centerlock rims (hex string)
  carbonFinish: 'matte' | 'gloss';
  decalType: 'rexy' | 'weissach' | 'manthey' | 'martini' | 'rothmans' | 'pinkpig' | 'grello' | 'stealth' | 'stripes';
}

export const PRESET_LIVERIES: LiveryTheme[] = [
  {
    id: 'rexy_ao_racing_77',
    name: 'Rexy Dinosaur (AO Racing)',
    team: 'AO Racing Motorsport',
    carNumber: '80', // Rexy is famously #80 in IMSA WeatherTech GTD Pro!
    primaryColor: '#12c949',    // Vibrant Rexy Dinosaur Green
    secondaryColor: '#14532d',  // Deep Forest Reptilian Scales
    accentColor: '#fef08a',     // Ivory/Cream Teeth & Belly Scutes
    caliperColor: '#18181b',    // Satin Black Competition Calipers
    rimColor: '#12c949',        // Iconic Matching Dinosaur Green Rims
    carbonFinish: 'gloss',
    decalType: 'rexy',
  },
  {
    id: 'manthey_grello_911',
    name: 'Manthey Racing Grello',
    team: 'Manthey EMA Motorsport',
    carNumber: '911',
    primaryColor: '#84cc16',    // Neon Acid Lime Green
    secondaryColor: '#facc15',  // Vibrant Racing Yellow
    accentColor: '#16a34a',     // Dark Racing Green
    caliperColor: '#facc15',    // Acid Yellow Calipers
    rimColor: '#18181b',        // Satin Black Centerlocks
    carbonFinish: 'gloss',
    decalType: 'grello',
  },
  {
    id: 'martini_racing_77',
    name: 'Martini Racing Tribute',
    team: 'Porsche Heritage Classic',
    carNumber: '77',
    primaryColor: '#f8fafc',    // Carrera Pure White
    secondaryColor: '#1e3a8a',  // Dark Navy Blue
    accentColor: '#dc2626',     // Red Accent
    caliperColor: '#dc2626',    // Guards Red Calipers
    rimColor: '#d4d4d8',        // Silver Alloy Rims
    carbonFinish: 'gloss',
    decalType: 'martini',
  },
  {
    id: 'rothmans_heritage_1',
    name: 'Rothmans 1982 Heritage',
    team: 'Porsche Werks Team',
    carNumber: '1',
    primaryColor: '#0f172a',    // Deep Midnight Blue
    secondaryColor: '#f8fafc',  // White Lower Shell
    accentColor: '#d97706',     // Gold & Red Boundary
    caliperColor: '#d97706',    // Gold Anodized Calipers
    rimColor: '#eab308',        // Gold BBS Centerlocks
    carbonFinish: 'gloss',
    decalType: 'rothmans',
  },
  {
    id: 'pink_pig_92',
    name: 'Pink Pig "Sau" Tribute',
    team: 'Porsche GT Team',
    carNumber: '92',
    primaryColor: '#fda4af',    // Truffle Pink
    secondaryColor: '#f43f5e',  // Butcher Cut Seam Lines
    accentColor: '#e11d48',     // Deep Rose Red Endplates
    caliperColor: '#e11d48',    // Red Calipers
    rimColor: '#e2e8f0',        // Brushed Titanium Rims
    carbonFinish: 'matte',
    decalType: 'pinkpig',
  },
  {
    id: 'gulf_racing_20',
    name: 'Gulf Racing Tribute',
    team: 'John Wyer Automotive',
    carNumber: '20',
    primaryColor: '#7dd3fc',    // Gulf Powder Blue
    secondaryColor: '#ea580c',  // Tangerine Orange Center Stripe
    accentColor: '#f97316',     // Orange Wing Endplates
    caliperColor: '#ea580c',    // Tangerine Calipers
    rimColor: '#18181b',        // Dark Satin Rims
    carbonFinish: 'gloss',
    decalType: 'stripes',
  },
  {
    id: 'factory_weissach_93',
    name: 'Weissach Guards Red',
    team: 'Porsche Motorsport',
    carNumber: '93',
    primaryColor: '#dc2626',    // Porsche Guards Red
    secondaryColor: '#18181b',  // Exposed Carbon Weave
    accentColor: '#dc2626',     // Red Endplates
    caliperColor: '#dc2626',    // Guards Red Calipers
    rimColor: '#a1a1aa',        // Satin Platinum Silver
    carbonFinish: 'matte',
    decalType: 'weissach',
  },
  {
    id: 'stealth_carbon_00',
    name: 'Triple Black Stealth',
    team: 'Skunkworks Aerodynamics',
    carNumber: '00',
    primaryColor: '#09090b',    // Ultra Matte Carbon Black
    secondaryColor: '#27272a',  // Dark Graphite
    accentColor: '#22c55e',     // Acid Green Aero Highlights
    caliperColor: '#22c55e',    // Acid Green Calipers
    rimColor: '#09090b',        // Deep Black Rims
    carbonFinish: 'matte',
    decalType: 'stealth',
  },
];

/**
 * Procedural Standard Livery & Wrap Texture Generator.
 * Synthesizes a standardized 1:1 flat profile wrap file mapped directly to the
 * exterior mesh UV projection (Left Side, Right Side, Top Plan, Front Nose).
 */
export class LiveryGenerator {
  public static generateTexture(livery: LiveryTheme, customCarNumber?: string): THREE.Texture {
    const width = 2048;
    const height = 2048;

    const displayNum = (customCarNumber !== undefined && customCarNumber.trim().length > 0)
      ? customCarNumber.trim()
      : livery.carNumber;

    if (typeof document === 'undefined') {
      // Headless node fallback (DataTexture)
      const data = new Uint8Array(width * height * 4);
      const col = new THREE.Color(livery.primaryColor);
      const r = Math.round(col.r * 255);
      const g = Math.round(col.g * 255);
      const b = Math.round(col.b * 255);
      for (let i = 0; i < width * height * 4; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
      const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // 1. Base Primary Body Paint
    ctx.fillStyle = livery.primaryColor;
    ctx.fillRect(0, 0, width, height);

    // ==========================================
    // 2. Livery Graphic Decals & Theme Overlays
    // ==========================================
    switch (livery.decalType) {
      case 'rexy': {
        // =========================================================================
        // AO RACING "REXY" DINOSAUR LIVERY (AUTHENTIC IMSA GT3 R / RSR REPLICA)
        // 1:1 match to official AO Racing #80 Porsche 911 GT3 R "Rexy"
        // =========================================================================

        // Helper: Draw organic multi-lobed dinosaur spot
        const drawDinoSpot = (cx: number, cy: number, r: number, angle = 0) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.fillStyle = livery.secondaryColor; // #14532d
          ctx.beginPath();
          // Irregular natural reptilian blotch
          const lobes = 6;
          for (let a = 0; a < Math.PI * 2; a += 0.2) {
            const rad = r * (0.82 + 0.18 * Math.sin(lobes * a + Math.cos(2 * a)));
            const px = Math.cos(a) * rad * 1.35;
            const py = Math.sin(a) * rad;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();

          // Darker spot nucleus
          ctx.fillStyle = '#0f3d1e';
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.45, r * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };

        // -------------------------------------------------------------------------
        // 2A. ORGANIC REPTILIAN SPOTS ACROSS FLANKS & HOOD
        // -------------------------------------------------------------------------
        const flankSpots = [
          // Left side: Rear quarter panel & hind leg (Y in [0.60, 0.90])
          [0.16, 0.68, 36, 0.2], [0.22, 0.76, 46, -0.3], [0.18, 0.84, 30, 0.1],
          [0.28, 0.64, 40, 0.4], [0.34, 0.72, 34, -0.2], [0.38, 0.82, 38, 0.3],
          // Left side: Front fender (near wheel arch)
          [0.68, 0.68, 32, -0.1], [0.75, 0.74, 42, 0.3], [0.84, 0.67, 30, 0.2],
          [0.89, 0.75, 24, -0.2], [0.93, 0.70, 20, 0.1],

          // Right side: Front fender (near wheel arch, Nose on Left!)
          [0.08, 0.28, 22, -0.1], [0.14, 0.24, 32, 0.2], [0.22, 0.30, 40, -0.3],
          [0.28, 0.22, 30, 0.1],
          // Right side: Rear quarter panel & hind leg (Nose on Left!)
          [0.66, 0.22, 36, 0.3], [0.72, 0.32, 44, -0.2], [0.78, 0.20, 32, 0.1],
          [0.82, 0.34, 42, -0.3], [0.88, 0.26, 30, 0.2],

          // Hood & Nose spots (X in [0.15, 0.45], Y in [0.015, 0.055])
          [0.21, 0.038, 22, 0.1], [0.24, 0.048, 18, -0.2], [0.26, 0.030, 16, 0.3],
          [0.34, 0.030, 16, -0.3], [0.36, 0.048, 18, 0.2], [0.39, 0.038, 22, -0.1],
          [0.30, 0.020, 15, 0],
        ];

        for (const [sx, sy, sr, sa] of flankSpots) {
          drawDinoSpot(sx * width, sy * height, sr, sa);
        }

        // -------------------------------------------------------------------------
        // 2B. MASSIVE GRINNING T-REX JAW & INTERLOCKING FANGS (FRONT BUMPER ZONE)
        // Panoramic projection: X in [0.60, 0.95], Y in [0.01, 0.14]
        // -------------------------------------------------------------------------
        const bX = width * 0.60;
        const bW = width * 0.35;
        const bY = height * 0.01;
        const bH = height * 0.13;
        const bCx = bX + bW * 0.5;

        // 1. Lower Bumper Chin Under-lip (Dinosaur Green base beneath mouth)
        ctx.fillStyle = livery.primaryColor;
        ctx.fillRect(bX, bY + 185, bW, bH - 185 + 20);

        // 2. Black Open Mouth / Radiator Intake Cavity
        ctx.fillStyle = '#050507';
        ctx.beginPath();
        // Top lip curve: sweeping sinister sneer arcing up at cheek corners
        ctx.moveTo(bX, bY + 36);
        ctx.bezierCurveTo(
          bX + bW * 0.18, bY + 48,
          bCx - bW * 0.15, bY + 40,
          bCx, bY + 42
        );
        ctx.bezierCurveTo(
          bCx + bW * 0.15, bY + 40,
          bX + bW * 0.82, bY + 48,
          bX + bW, bY + 36
        );
        // Bottom lip curve across visible chin
        ctx.bezierCurveTo(
          bX + bW * 0.82, bY + 195,
          bCx + bW * 0.15, bY + 188,
          bCx, bY + 186
        );
        ctx.bezierCurveTo(
          bCx - bW * 0.15, bY + 188,
          bX + bW * 0.18, bY + 195,
          bX, bY + 192
        );
        ctx.closePath();
        ctx.fill();

        // 3. Thick Dark Green Gum & Lip Borders (Upper & Lower)
        ctx.strokeStyle = livery.secondaryColor; // #14532d
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';

        // Upper lip outline
        ctx.beginPath();
        ctx.moveTo(bX, bY + 36);
        ctx.bezierCurveTo(bX + bW * 0.18, bY + 48, bCx - bW * 0.15, bY + 40, bCx, bY + 42);
        ctx.bezierCurveTo(bCx + bW * 0.15, bY + 40, bX + bW * 0.82, bY + 48, bX + bW, bY + 36);
        ctx.stroke();

        // Lower lip outline
        ctx.beginPath();
        ctx.moveTo(bX, bY + 192);
        ctx.bezierCurveTo(bX + bW * 0.18, bY + 195, bCx - bW * 0.15, bY + 188, bCx, bY + 186);
        ctx.bezierCurveTo(bCx + bW * 0.15, bY + 188, bX + bW * 0.82, bY + 195, bX + bW, bY + 192);
        ctx.stroke();

        // Inner Maroon Gums (Upper & Lower)
        ctx.strokeStyle = '#4c0519';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bX, bY + 37);
        ctx.bezierCurveTo(bX + bW * 0.18, bY + 49, bCx - bW * 0.15, bY + 41, bCx, bY + 43);
        ctx.bezierCurveTo(bCx + bW * 0.15, bY + 41, bX + bW * 0.82, bY + 49, bX + bW, bY + 37);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bX, bY + 190);
        ctx.bezierCurveTo(bX + bW * 0.18, bY + 193, bCx - bW * 0.15, bY + 186, bCx, bY + 184);
        ctx.bezierCurveTo(bCx + bW * 0.15, bY + 186, bX + bW * 0.82, bY + 193, bX + bW, bY + 190);
        ctx.stroke();

        // 4. Razor-Sharp Curved Upper Fangs (24 Closely-Packed Teeth)
        const numUpperTeeth = 24;
        const toothStep = bW / numUpperTeeth;

        for (let i = 0; i < numUpperTeeth; i++) {
          const t = (i + 0.5) / numUpperTeeth; // 0.0 to 1.0 across mouth
          const tx = bX + t * bW;

          // Compute Y position along the sweeping upper gum line
          let gumY: number;
          if (t < 0.5) {
            const u = t * 2;
            gumY = bY + 36 + 6 * Math.sin(u * Math.PI * 0.5);
          } else {
            const u = (t - 0.5) * 2;
            gumY = bY + 42 - 6 * Math.sin(u * Math.PI * 0.5);
          }

          // Tooth dimensions: giant canine sabre-fangs at t ~ 0.25 (tooth 6) and t ~ 0.75 (tooth 17)
          let toothLen = 78;
          let toothHalfW = toothStep * 0.54; // Overlapping roots = zero black gaps at gums
          let curveX = 0;

          if (i === 5 || i === 6) {
            // Giant Left Canine Sabre-Tooth (under left headlight)
            toothLen = 112;
            toothHalfW = toothStep * 0.66;
            curveX = 9; // Hook inward
          } else if (i === 17 || i === 18) {
            // Giant Right Canine Sabre-Tooth (under right headlight)
            toothLen = 112;
            toothHalfW = toothStep * 0.66;
            curveX = -9; // Hook inward
          } else if (i === 4 || i === 7 || i === 16 || i === 19) {
            toothLen = 96;
            toothHalfW = toothStep * 0.58;
            curveX = i < 12 ? 6 : -6;
          } else if (i < 3 || i > 20) {
            // Outer cheek corner teeth
            toothLen = 52 + (i < 3 ? i * 7 : (23 - i) * 7);
            toothHalfW = toothStep * 0.50;
            curveX = i < 12 ? 4 : -4;
          } else {
            // Center incisors
            toothLen = 82 + (i % 2 === 0 ? 6 : -4);
            toothHalfW = toothStep * 0.55;
            curveX = (11.5 - i) * 0.8;
          }

          // Draw Upper Tooth Body with curved predator contour
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(tx - toothHalfW, gumY - 2);
          ctx.quadraticCurveTo(tx - toothHalfW * 0.35, gumY + toothLen * 0.45, tx + curveX, gumY + toothLen);
          ctx.quadraticCurveTo(tx + toothHalfW * 0.35, gumY + toothLen * 0.45, tx + toothHalfW, gumY - 2);
          ctx.closePath();

          // Ivory enamel gradient with warm cream base and golden tip
          const toothGrad = ctx.createLinearGradient(tx, gumY, tx, gumY + toothLen);
          toothGrad.addColorStop(0.0, '#fef9c3'); // Cream root
          toothGrad.addColorStop(0.20, '#ffffff'); // Pure white enamel
          toothGrad.addColorStop(0.85, '#f8fafc');
          toothGrad.addColorStop(1.0, '#fef08a'); // Sharp yellow-ivory tip
          ctx.fillStyle = toothGrad;
          ctx.fill();

          // Dark 3D separation outline
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.restore();
        }

        // 5. Interlocking Lower Jaw Fangs (18 Teeth Pointing UP from Lower Lip)
        const numLowerTeeth = 18;
        const lowerStep = bW / numLowerTeeth;

        for (let j = 0; j < numLowerTeeth; j++) {
          const lt = (j + 0.5) / numLowerTeeth;
          const lx = bX + lt * bW;

          // Compute Y along lower lip curve
          let lowGumY: number;
          if (lt < 0.5) {
            lowGumY = bY + 192 - 6 * Math.sin(lt * 2 * Math.PI * 0.5);
          } else {
            lowGumY = bY + 186 + 6 * Math.sin((lt - 0.5) * 2 * Math.PI * 0.5);
          }

          // Stagger lower teeth so they interlock in between upper teeth
          let lowLen = 66;
          let lowHalfW = lowerStep * 0.48;
          let lowCurveX = 0;

          if (j < 3 || j > 14) {
            // Prominent corner bottom canines
            lowLen = 80;
            lowHalfW = lowerStep * 0.54;
            lowCurveX = j < 9 ? 6 : -6;
          } else {
            lowLen = 58 + (j % 2 === 0 ? 6 : -4);
          }

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(lx - lowHalfW, lowGumY + 2);
          ctx.quadraticCurveTo(lx - lowHalfW * 0.3, lowGumY - lowLen * 0.45, lx + lowCurveX, lowGumY - lowLen);
          ctx.quadraticCurveTo(lx + lowHalfW * 0.3, lowGumY - lowLen * 0.45, lx + lowHalfW, lowGumY + 2);
          ctx.closePath();

          const lowGrad = ctx.createLinearGradient(lx, lowGumY, lx, lowGumY - lowLen);
          lowGrad.addColorStop(0.0, '#fef9c3');
          lowGrad.addColorStop(0.3, '#ffffff');
          lowGrad.addColorStop(1.0, '#fef08a');
          ctx.fillStyle = lowGrad;
          ctx.fill();

          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }

        // 6. Cheek Snarl Creases (Wrinkles at Mouth Corners)
        ctx.strokeStyle = '#0f3d1e';
        ctx.lineWidth = 6;
        // Left snarl folds
        ctx.beginPath();
        ctx.arc(bX + bW * 0.02, bY + 38, 28, Math.PI * 0.2, Math.PI * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bX + bW * 0.02, bY + 42, 38, Math.PI * 0.3, Math.PI * 0.85);
        ctx.stroke();

        // Right snarl folds
        ctx.beginPath();
        ctx.arc(bX + bW * 0.98, bY + 38, 28, Math.PI * 0.1, Math.PI * 0.8, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bX + bW * 0.98, bY + 42, 38, Math.PI * 0.15, Math.PI * 0.7, true);
        ctx.stroke();

        // 7. Front Bumper Sponsors (MOTUL on side corners)
        ctx.font = '900 24px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(bX + bW * 0.02, bY + 22, 75, 24);
        ctx.fillRect(bX + bW * 0.87, bY + 22, 75, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('MOTUL', bX + bW * 0.07, bY + 39);
        ctx.fillText('MOTUL', bX + bW * 0.92, bY + 39);

        // -------------------------------------------------------------------------
        // 2C. HOOD NOSTRILS & MENACING EYELIDS (TOP VIEW ZONE: [0.05, 0.55])
        // -------------------------------------------------------------------------
        const hCx = width * 0.30; // Centerline of Hood

        // 1. Angry Flared Reptilian Nostrils (situated right in front of hood extractor vents)
        const nostrils = [
          { x: hCx - 62, y: 68 }, // Left nostril
          { x: hCx + 62, y: 68 }, // Right nostril
        ];

        for (const n of nostrils) {
          // Dark cavity
          ctx.fillStyle = '#2b0707';
          ctx.beginPath();
          ctx.ellipse(n.x, n.y, 22, 12, n.x < hCx ? -0.22 : 0.22, 0, Math.PI * 2);
          ctx.fill();

          // Black inner shadow
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(n.x, n.y + 2, 16, 8, n.x < hCx ? -0.22 : 0.22, 0, Math.PI * 2);
          ctx.fill();

          // Arched dark green nostril wrinkle hood
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(n.x, n.y + 4, 26, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();

          // Maroon inner fold
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y + 6, 22, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }

        // Center Frown Wrinkles between Nostrils
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(hCx - 14, 58);
        ctx.lineTo(hCx - 10, 76);
        ctx.moveTo(hCx + 14, 58);
        ctx.lineTo(hCx + 10, 76);
        ctx.moveTo(hCx, 54);
        ctx.lineTo(hCx, 74);
        ctx.stroke();

        // 2. Headlight Eyelids / Scaly Eyebrow Ridges (Framing yellow headlights as glowing predator eyes)
        const eyelids = [
          { x: 375, y: 60, angle: 0.28 }, // Left Headlight Brow
          { x: 853, y: 60, angle: -0.28 }, // Right Headlight Brow
        ];

        for (const el of eyelids) {
          ctx.save();
          ctx.translate(el.x, el.y);
          ctx.rotate(el.angle);

          // Dark forest green eyelid crease
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.arc(0, 0, 52, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();

          // Maroon accent fold
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 4, 48, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          ctx.restore();
        }

        // -------------------------------------------------------------------------
        // 2D. LITTLE T-REX CLAW ARMS (WITH 3 SHARP WHITE TALONS) ON FLANKS
        // -------------------------------------------------------------------------
        // Helper: Draw 3-claw dinosaur hand
        const drawThreeClawHand = (hx: number, hy: number, flipX: boolean) => {
          ctx.save();
          ctx.translate(hx, hy);
          if (flipX) ctx.scale(-1, 1);

          const claws = [
            { angle: -0.32, len: 44 },
            { angle: 0.08, len: 52 },
            { angle: 0.48, len: 42 },
          ];

          for (const c of claws) {
            ctx.save();
            ctx.rotate(c.angle);
            ctx.fillStyle = '#fffdf0'; // Sharp ivory talon
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.quadraticCurveTo(18, 8, c.len, 30);
            ctx.quadraticCurveTo(14, 20, 8, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Knuckle scale spot with maroon center
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };

        // 1. Left Flank Little T-Rex Arm (Reaches forward from door handle towards IMSA plate)
        const armLeftX = width * 0.40;
        const armLeftY = height * 0.74;
        ctx.save();
        const armLeftGrad = ctx.createLinearGradient(armLeftX, armLeftY, armLeftX + 110, armLeftY);
        armLeftGrad.addColorStop(0.0, '#15803d');
        armLeftGrad.addColorStop(0.5, '#22c55e');
        armLeftGrad.addColorStop(1.0, '#16a34a');
        ctx.fillStyle = armLeftGrad;
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = 7;
        ctx.beginPath();
        // Bicep curve
        ctx.arc(armLeftX, armLeftY, 20, Math.PI * 0.6, Math.PI * 1.8);
        ctx.quadraticCurveTo(armLeftX + 50, armLeftY + 36, armLeftX + 105, armLeftY - 6);
        ctx.lineTo(armLeftX + 108, armLeftY - 26);
        ctx.quadraticCurveTo(armLeftX + 50, armLeftY + 10, armLeftX, armLeftY - 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Muscle crease
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(armLeftX + 25, armLeftY);
        ctx.quadraticCurveTo(armLeftX + 55, armLeftY + 16, armLeftX + 85, armLeftY - 8);
        ctx.stroke();

        drawThreeClawHand(armLeftX + 105, armLeftY - 14, false);
        ctx.restore();

        // 2. Right Flank Little T-Rex Arm (Nose on Left! Reaches forward towards IMSA plate)
        const armRightX = width * 0.60;
        const armRightY = height * 0.35;
        ctx.save();
        const armRightGrad = ctx.createLinearGradient(armRightX, armRightY, armRightX - 110, armRightY);
        armRightGrad.addColorStop(0.0, '#15803d');
        armRightGrad.addColorStop(0.5, '#22c55e');
        armRightGrad.addColorStop(1.0, '#16a34a');
        ctx.fillStyle = armRightGrad;
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(armRightX, armRightY, 20, -Math.PI * 0.8, Math.PI * 0.4);
        ctx.quadraticCurveTo(armRightX - 50, armRightY + 36, armRightX - 105, armRightY - 6);
        ctx.lineTo(armRightX - 108, armRightY - 26);
        ctx.quadraticCurveTo(armRightX - 50, armRightY + 10, armRightX, armRightY - 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Muscle crease
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(armRightX - 25, armRightY);
        ctx.quadraticCurveTo(armRightX - 55, armRightY + 16, armRightX - 85, armRightY - 8);
        ctx.stroke();

        drawThreeClawHand(armRightX - 105, armRightY - 14, true);
        ctx.restore();

        // 3. Ventral Reptilian Underbelly (Belly Scale Scutes along Rockers)
        const drawBellyScutes = (yPos: number) => {
          const scuteCount = 18;
          const startX = width * 0.12;
          const endX = width * 0.90;
          const stepX = (endX - startX) / scuteCount;

          ctx.fillStyle = '#fef9c3'; // Ivory/cream belly scales
          ctx.strokeStyle = '#166534';
          ctx.lineWidth = 4;

          for (let i = 0; i < scuteCount; i++) {
            const x = startX + i * stepX;
            ctx.beginPath();
            ctx.ellipse(x + stepX * 0.5, yPos, stepX * 0.48, 16, 0, 0, Math.PI);
            ctx.fill();
            ctx.stroke();
          }
        };

        // Left Side Rocker Sill (Y ~ 0.935)
        drawBellyScutes(height * 0.932);
        // Right Side Rocker Sill (Y ~ 0.490)
        drawBellyScutes(height * 0.492);

        // 4. "AO RACING" & "REXY" Typography on Rear Quarters
        ctx.font = '900 44px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        // Left flank
        ctx.fillText('REXY', width * 0.24, height * 0.88);
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('AO RACING  •  GT3 RAWR', width * 0.24, height * 0.91);

        // Right flank
        ctx.font = '900 44px sans-serif';
        ctx.fillText('REXY', width * 0.76, height * 0.44);
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('AO RACING  •  GT3 RAWR', width * 0.76, height * 0.47);
        break;
      }

      case 'grello': {
        // Manthey Racing chevron angles across sides and hood
        ctx.fillStyle = livery.secondaryColor;
        // Left side chevrons
        ctx.beginPath();
        ctx.moveTo(width * 0.60, height * 0.58);
        ctx.lineTo(width * 0.85, height * 0.58);
        ctx.lineTo(width * 0.75, height * 0.94);
        ctx.lineTo(width * 0.50, height * 0.94);
        ctx.closePath();
        ctx.fill();

        // Right side chevrons
        ctx.beginPath();
        ctx.moveTo(width * 0.60, height * 0.15);
        ctx.lineTo(width * 0.85, height * 0.15);
        ctx.lineTo(width * 0.75, height * 0.51);
        ctx.lineTo(width * 0.50, height * 0.51);
        ctx.closePath();
        ctx.fill();

        // Hood yellow chevron
        ctx.beginPath();
        ctx.moveTo(width * 0.15, height * 0.01);
        ctx.lineTo(width * 0.45, height * 0.01);
        ctx.lineTo(width * 0.30, height * 0.14);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'martini': {
        // Iconic triple center stripes on Top View (Dark Blue, Light Blue, Red)
        const topCx = width * 0.30;
        const stripeW = width * 0.035;

        // Dark Blue Outer
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(topCx - stripeW * 2.5, height * 0.01, stripeW * 5.0, height * 0.13);
        // Light Blue Mid
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(topCx - stripeW * 1.5, height * 0.01, stripeW * 3.0, height * 0.13);
        // Center Red
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(topCx - stripeW * 0.5, height * 0.01, stripeW, height * 0.13);

        // Lateral side stripes (Left & Right)
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(width * 0.05, height * 0.88, width * 0.90, 16);
        ctx.fillRect(width * 0.05, height * 0.46, width * 0.90, 16);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(width * 0.05, height * 0.895, width * 0.90, 8);
        ctx.fillRect(width * 0.05, height * 0.475, width * 0.90, 8);
        break;
      }

      case 'rothmans': {
        // Upper dark blue, lower pure white with gold separation pinstripes
        ctx.fillStyle = '#f8fafc';
        // Lower white half on left side
        ctx.fillRect(width * 0.03, height * 0.80, width * 0.94, height * 0.15);
        // Lower white half on right side
        ctx.fillRect(width * 0.03, height * 0.38, width * 0.94, height * 0.14);

        // Gold pinstripes
        ctx.fillStyle = '#d97706';
        ctx.fillRect(width * 0.03, height * 0.795, width * 0.94, 6);
        ctx.fillRect(width * 0.03, height * 0.375, width * 0.94, 6);

        // Red pinstripes
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(width * 0.03, height * 0.805, width * 0.94, 4);
        ctx.fillRect(width * 0.03, height * 0.385, width * 0.94, 4);
        break;
      }

      case 'pinkpig': {
        // Butcher dotted cut lines and German meat labels
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 12]);
        // Left side cuts
        ctx.strokeRect(width * 0.12, height * 0.62, width * 0.76, height * 0.30);
        // Right side cuts
        ctx.strokeRect(width * 0.12, height * 0.20, width * 0.76, height * 0.30);
        ctx.setLineDash([]);

        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#9f1239';
        ctx.textAlign = 'center';
        // Left cuts
        ctx.fillText('KOTELETT', width * 0.32, height * 0.70);
        ctx.fillText('SCHULTER', width * 0.76, height * 0.70);
        ctx.fillText('SCHINKEN', width * 0.32, height * 0.88);
        ctx.fillText('HAXE', width * 0.76, height * 0.88);
        // Right cuts
        ctx.fillText('KOTELETT', width * 0.32, height * 0.28);
        ctx.fillText('SCHULTER', width * 0.76, height * 0.28);
        ctx.fillText('SCHINKEN', width * 0.32, height * 0.46);
        ctx.fillText('HAXE', width * 0.76, height * 0.46);
        break;
      }

      case 'weissach':
      case 'stripes':
      default: {
        // Dual longitudinal GT racing stripes with pinstripe margins over Top View
        const topCx = width * 0.30;
        const stripeW = width * 0.055;
        const stripeGap = width * 0.015;

        ctx.fillStyle = livery.secondaryColor;
        ctx.fillRect(topCx - stripeGap / 2 - stripeW, height * 0.01, stripeW, height * 0.13);
        ctx.fillRect(topCx + stripeGap / 2, height * 0.01, stripeW, height * 0.13);

        // Thin accent pinstripes
        ctx.fillStyle = livery.accentColor;
        ctx.fillRect(topCx - stripeGap / 2 - stripeW - 6, height * 0.01, 5, height * 0.13);
        ctx.fillRect(topCx + stripeGap / 2 + stripeW + 1, height * 0.01, 5, height * 0.13);
        break;
      }
    }

    // ==========================================
    // 3. Side Rocker "PORSCHE 911 RSR" Scripts (Suppressed for Rexy, which has belly scales)
    // ==========================================
    if (livery.decalType !== 'rexy') {
      ctx.fillStyle = livery.secondaryColor;
      ctx.fillRect(width * 0.05, height * 0.93, width * 0.90, height * 0.025);
      ctx.fillRect(width * 0.05, height * 0.51, width * 0.90, height * 0.025);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PORSCHE 911 RSR', width * 0.55, height * 0.942);
      ctx.fillText('PORSCHE 911 RSR', width * 0.55, height * 0.522);
    }

    // ==========================================================
    // 4. Competition Race Number Door & Hood Plates (1:1 Placements)
    // ==========================================================
    if (livery.decalType === 'rexy') {
      // Official IMSA WeatherTech rectangular competition plates
      const imsaPlates = [
        { x: width * 0.54, y: height * 0.76, w: 185, h: 142 }, // Left Door (forward of door handle)
        { x: width * 0.46, y: height * 0.36, w: 185, h: 142 }, // Right Door (forward of door handle)
        { x: width * 0.30, y: height * 0.046, w: 140, h: 105 }, // Front Hood
      ];

      for (const plate of imsaPlates) {
        ctx.save();
        const px = plate.x - plate.w / 2;
        const py = plate.y - plate.h / 2;

        // White plate body
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, py, plate.w, plate.h);

        // Black outer frame
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 6;
        ctx.strokeRect(px, py, plate.w, plate.h);

        // Top WeatherTech IMSA Header Bar
        const barH = plate.h * 0.28;
        // Red IMSA segment
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(px, py, plate.w * 0.38, barH);
        // Blue WeatherTech segment
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(px + plate.w * 0.38, py, plate.w * 0.62, barH);

        // Header Text
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.round(barH * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('IMSA', px + plate.w * 0.19, py + barH * 0.5);
        ctx.fillText('WeatherTech', px + plate.w * 0.69, py + barH * 0.5);

        // Dynamic Competition Number (Default #80 for Rexy)
        ctx.fillStyle = '#09090b';
        const numSize = Math.round(plate.h * 0.58);
        ctx.font = `900 ${numSize}px monospace, -apple-system, sans-serif`;
        ctx.fillText(displayNum, plate.x, py + barH + (plate.h - barH) * 0.5);
        ctx.restore();
      }
    } else {
      // Traditional roundel circles for historic / GT endurance liveries
      const roundels = [
        { x: width * 0.52, y: height * 0.77, r: 85 }, // Left Door (Tail=Left, Nose=Right)
        { x: width * 0.48, y: height * 0.37, r: 85 }, // Right Door (Nose=Left, Tail=Right)
        { x: width * 0.30, y: height * 0.05, r: 65 }, // Front Frunk Hood
      ];

      for (const rnd of roundels) {
        // Pure white roundel circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rnd.x, rnd.y, rnd.r, 0, Math.PI * 2);
        ctx.fill();

        // Outer competition border
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 7;
        ctx.stroke();

        // Active Race Number (Dynamic, User-Selectable)
        ctx.fillStyle = '#09090b';
        const fontSize = Math.round(rnd.r * (displayNum.length > 2 ? 0.95 : 1.15));
        ctx.font = `900 ${fontSize}px monospace, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayNum, rnd.x, rnd.y + 3);
      }
    }

    // ==========================================
    // 5. Motorsport Sponsor Badges
    // ==========================================
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('MICHELIN', width * 0.30, height * 0.015);
    ctx.fillText('MOBIL 1  •  BILSTEIN  •  ADAC 24H  •  FIA WEC', width * 0.50, height * 0.985);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.anisotropy = 16;
    texture.needsUpdate = true;
    return texture;
  }
}

/**
 * Standardized Vehicle Model Sanitizer & Livery Adapter.
 * Applied uniformly across all 3D car models to:
 * 1. Completely strip and hide all civilian street license plates.
 * 2. Sanitize floor planes, cameras, and helper dummies.
 * 3. Generate 1:1 standardized flat profile wrap UVs via StandardWrapMapper.
 * 4. Apply high-fidelity dynamic livery skins across bodywork with player-selected car number.
 */
export class VehicleModelAdapter {
  /**
   * Sanitizes any loaded vehicle GLTF scene:
   * Removes all license plate meshes and unwanted camera/light dummies.
   */
  public static sanitizeModel(model: THREE.Object3D): void {
    const toRemove: THREE.Object3D[] = [];

    model.traverse((child) => {
      const name = child.name.toLowerCase();
      // Plate removal: strip any civilian license plate nodes or meshes
      // Also remove stock street-car steering wheel and column stalks (replaced by authentic RSR wheel)
      if (
        name.includes('licence') ||
        name.includes('license') ||
        name.includes('plate') ||
        name.includes('tag') ||
        name.startsWith('hemi') ||
        name.startsWith('light') ||
        name.startsWith('camera') ||
        name === 'plane' ||
        name.includes('steeringwheel') ||
        name.includes('steeringcolumn') ||
        name.includes('node_steering')
      ) {
        child.visible = false;
        toRemove.push(child);
      }

      // Check materials for license plate textures
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        const matName = (mat?.name || '').toLowerCase();
        if (matName.includes('licence') || matName.includes('license') || matName.includes('plate')) {
          child.visible = false;
          toRemove.push(child);
        }
      }
    });

    for (const obj of toRemove) {
      obj.parent?.remove(obj);
    }
  }

  /**
   * Applies a standardized livery theme across the vehicle's bodywork,
   * wing endplates, brake calipers, and centerlock wheels.
   */
  public static applyLivery(
    model: THREE.Object3D,
    livery: LiveryTheme,
    paintMaterial: THREE.MeshStandardMaterial,
    caliperMaterial: THREE.MeshStandardMaterial,
    rimMaterial: THREE.MeshStandardMaterial,
    wingEndplateMaterial?: THREE.MeshStandardMaterial,
    customCarNumber?: string
  ): void {
    // 1. Generate 1:1 analytical standard flat profile wrap UV coordinates across exterior body
    StandardWrapMapper.applyToModel(model);

    // 2. Synthesize dynamic wrap texture with user-chosen race number
    const liveryTexture = LiveryGenerator.generateTexture(livery, customCarNumber);
    paintMaterial.color.set(0xffffff); // Use pure white multiplier so texture colors render 1:1 true-to-life
    paintMaterial.map = liveryTexture;
    paintMaterial.roughness = livery.carbonFinish === 'matte' ? 0.35 : 0.18;
    paintMaterial.metalness = 0.25;
    paintMaterial.needsUpdate = true;

    // 3. Update brake caliper color
    caliperMaterial.color.set(livery.caliperColor);
    caliperMaterial.roughness = 0.35;
    caliperMaterial.metalness = 0.2;
    caliperMaterial.needsUpdate = true;

    // 4. Update centerlock rim color
    rimMaterial.color.set(livery.rimColor);
    rimMaterial.roughness = 0.30;
    rimMaterial.metalness = 0.85;
    rimMaterial.needsUpdate = true;

    // 5. Update aerodynamic wing endplates if present
    if (wingEndplateMaterial) {
      wingEndplateMaterial.color.set(livery.decalType === 'rexy' ? livery.primaryColor : livery.accentColor);
      wingEndplateMaterial.roughness = 0.3;
      wingEndplateMaterial.needsUpdate = true;
    }

    // 6. Traverse model to bind materials into standardized slots
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const name = child.name.toLowerCase();
        const matName = (child.material?.name || '').toLowerCase();

        // License plates: permanent visibility guard
        if (name.includes('licence') || name.includes('license') || name.includes('plate') || matName.includes('license')) {
          child.visible = false;
          return;
        }

        // Body Paint Slot
        if (
          matName.includes('paint') ||
          matName.includes('chassis_paint') ||
          matName.includes('body') ||
          name.includes('chassis_paint') ||
          name.includes('door_paint') ||
          name.includes('hood_paint')
        ) {
          child.material = paintMaterial;
        }

        // Brake Calipers Slot
        if (name.includes('caliper') || matName.includes('caliper')) {
          child.material = caliperMaterial;
        }

        // Wheel Rims Slot
        if (name.includes('rim') || matName.includes('rim')) {
          child.material = rimMaterial;
        }

        // Wing Endplates & Active Aero Flaps Slot
        if (wingEndplateMaterial && (name.includes('endplate') || matName.includes('weissach') || name.includes('wing_flap'))) {
          child.material = wingEndplateMaterial;
        }

        // Cockpit Transparent Glass Slot
        if (
          matName.includes('glass') ||
          matName.includes('window') ||
          name.includes('glass') ||
          name.includes('window')
        ) {
          if (!matName.includes('light') && !name.includes('light')) {
            child.material = new THREE.MeshPhysicalMaterial({
              color: 0x111111,
              roughness: 0.1,
              transmission: 0.90,
              transparent: true,
              opacity: 0.20,
              depthWrite: false,
            });
          }
        }

        // Headlights: Authentic Endurance Racing Yellow for Rexy / Crisp LED for standard
        if (name.includes('headlight') || matName.includes('headlight')) {
          if (name.includes('emissive') || matName.includes('emissive')) {
            const emMat = child.material as THREE.MeshStandardMaterial;
            if (emMat && emMat.isMeshStandardMaterial) {
              if (livery.decalType === 'rexy') {
                emMat.color.set(0xfbbf24);
                emMat.emissive.set(0xfbbf24);
                emMat.emissiveIntensity = 2.4;
              } else {
                emMat.color.set(0xf8fafc);
                emMat.emissive.set(0xf8fafc);
                emMat.emissiveIntensity = 1.0;
              }
              emMat.needsUpdate = true;
            }
          }
        }
      }
    });
  }
}
