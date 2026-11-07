import * as THREE from 'three';
import { VehicleTelemetry } from '../../../common/types';

/**
 * Official Porsche 911 RSR GT/GTE Steering Wheel.
 * Replicated 1:1 from the official GRID Engineering / Sim-Lab Porsche 911 RSR wheel:
 * - Contoured carbon fiber faceplate with upper angled shoulders & lower chin
 * - Molded ergonomic polyurethane/Alcantara side grips with thumb rests & finger waves
 * - Top arched 15-LED Cosworth/MoTeC powerband shift light cluster
 * - Laser-etched "PORSCHE" wordmark across top faceplate
 * - Anodized CNC aluminum rotary thumb encoders:
 *   - Red knurled dial on top-left shoulder marked "TCI"
 *   - Purple/violet knurled dial on top-right shoulder marked "TCO"
 *   - Gold knurled dial on inner left grip
 *   - Blue knurled dial on inner right grip
 * - 10 tactile motorsport pushbuttons (2 white, 1 red, 3 white on each side)
 * - 4 lower rotary switches with index pointers: TC/CON, TC/R, MAP, WIPER
 * - Golden Porsche shield crest emblem centered on lower chin
 * - Rear carbon fiber magnetic shift paddles
 * - 1:1 replica of official Porsche 911 RSR color telemetry LCD dashboard:
 *   - Top bar: TC C (amber), TC R (red), 000 SPEED (white), AC (cyan), Map (green)
 *   - Left cluster: Water Temp, Oil Temp, Water Press, Oil Press
 *   - Center: Giant high-visibility Gear indicator (N in neon green, R in red, 1-6 in yellow) + Porsche crest
 *   - Right cluster: Avg Diff, Predicted Lap Time, Best Lap Time, Laps2go / Lap, Last Lap Time
 */
export class PorscheRsrSteeringWheel {
  public group: THREE.Group;
  public rotatingMesh: THREE.Group;

  // Integrated 1:1 RSR Color LCD Dashboard Screen
  private dashCanvas: HTMLCanvasElement;
  private dashCtx: CanvasRenderingContext2D;
  private dashTexture: THREE.CanvasTexture;
  private dashScreenMesh: THREE.Mesh;

  // 15 Curved Shift LEDs
  private ledMeshes: THREE.Mesh[] = [];
  private ledMaterials: THREE.MeshBasicMaterial[] = [];

  // PBR Materials for proper disposal
  private materials: THREE.Material[] = [];

  // Telemetry render caching
  private lastRenderedGear = -99;
  private lastRenderedSpeed = -99;
  private lastRenderedRpm = -99;
  private lastRenderedLapTime = -99;
  private lastShiftFlash = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Porsche_911_RSR_Steering_Wheel_Assembly';

    this.rotatingMesh = new THREE.Group();
    this.rotatingMesh.name = 'Porsche_911_RSR_Rotating_Wheel';
    this.group.add(this.rotatingMesh);

    // 1. Steering column & quick-release hub
    this.buildSteeringColumn();

    // 2. Custom contoured carbon fiber faceplate
    this.buildCarbonFaceplate();

    // 3. Ergonomic molded side grips
    this.buildErgonomicGrips();

    // 4. Top arched 15-LED shift rev counter
    this.buildShiftRevLights();

    // 5. "PORSCHE" laser-etched wordmark
    this.buildPorscheWordmark();

    // 6. Anodized CNC aluminum rotary thumb encoders
    this.buildThumbEncoders();

    // 7. 10 Motorsport tactile pushbuttons
    this.buildPushbuttons();

    // 8. 4 Lower rotary selector switches & labels
    this.buildLowerRotarySwitches();

    // 9. Porsche Golden Shield Crest
    this.buildPorscheCrest();

    // 10. Rear magnetic carbon shifter paddles
    this.buildShifterPaddles();

    // 11. Integrated 1:1 RSR Color LCD Dashboard Screen
    this.dashCanvas = document.createElement('canvas');
    this.dashCanvas.width = 1024;
    this.dashCanvas.height = 600;
    this.dashCtx = this.dashCanvas.getContext('2d')!;

    this.dashTexture = new THREE.CanvasTexture(this.dashCanvas);
    this.dashTexture.generateMipmaps = false;
    this.dashTexture.minFilter = THREE.LinearFilter;
    this.dashTexture.magFilter = THREE.LinearFilter;

    const screenMat = new THREE.MeshBasicMaterial({
      map: this.dashTexture,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.materials.push(screenMat);

    // 122mm x 74mm screen geometry centered on the plate (elevated safely in front of bezel to prevent Z-fighting)
    const screenGeo = new THREE.PlaneGeometry(0.122, 0.074);
    this.dashScreenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.dashScreenMesh.position.set(0, 0.010, -0.0118);
    this.dashScreenMesh.rotation.y = Math.PI; // Face driver eyes
    this.rotatingMesh.add(this.dashScreenMesh);

    // Render baseline standby display
    this.renderDashCanvas(0, 0, 0, false, false, false, 0, null);
  }

  /**
   * Steering Column pointing down and forward into dashboard with quick-release collar.
   */
  private buildSteeringColumn(): void {
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.5,
      name: 'RSR_Steering_Column',
    });
    this.materials.push(colMat);

    const colGeo = new THREE.CylinderGeometry(0.026, 0.030, 0.40, 16);
    colGeo.rotateX(Math.PI / 2);
    const colMesh = new THREE.Mesh(colGeo, colMat);
    colMesh.position.set(0, 0, 0.20);
    this.group.add(colMesh);

    // Quick release red anodized collar
    const qrMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.8,
      name: 'RSR_QuickRelease_Collar',
    });
    this.materials.push(qrMat);

    const qrGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.028, 16);
    qrGeo.rotateX(Math.PI / 2);
    const qrMesh = new THREE.Mesh(qrGeo, qrMat);
    qrMesh.position.set(0, 0, 0.025);
    this.rotatingMesh.add(qrMesh);
  }

  /**
   * Builds the authentic contoured Porsche 911 RSR carbon fiber faceplate.
   */
  private buildCarbonFaceplate(): void {
    const shape = new THREE.Shape();

    // Dimensions in meters (matching real 285mm wide GT wheel)
    const bHalf = 0.054;  // bottom chin half-width
    const bY = -0.086;     // bottom chin Y

    shape.moveTo(-bHalf, bY);
    shape.lineTo(bHalf, bY);

    // Lower right corner angled up to right waist
    shape.lineTo(0.096, -0.052);

    // Right waist flanking screen and lower grip
    shape.lineTo(0.122, -0.010);
    shape.lineTo(0.122, 0.046);

    // Upper right shoulder angled chamfer (holding TCO purple encoder)
    shape.lineTo(0.072, 0.086);

    // Top arch curving up to apex (holding shift LEDs)
    shape.quadraticCurveTo(0, 0.096, -0.072, 0.086);

    // Upper left shoulder angled chamfer (holding TCI red encoder)
    shape.lineTo(-0.122, 0.046);

    // Left waist flanking screen and left grip
    shape.lineTo(-0.122, -0.010);
    shape.lineTo(-0.096, -0.052);
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.014,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.0025,
      bevelThickness: 0.0025,
    };

    const plateGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center along Z so front face is at Z = -0.009
    plateGeo.translate(0, 0, -0.007);

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      roughness: 0.32,
      metalness: 0.35,
      name: 'RSR_Carbon_Faceplate',
    });
    this.materials.push(carbonMat);

    const plateMesh = new THREE.Mesh(plateGeo, carbonMat);
    this.rotatingMesh.add(plateMesh);

    // Screen Bezel Inner Recess (matte black inner frame)
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.8,
      metalness: 0.1,
      name: 'RSR_Screen_Bezel',
    });
    this.materials.push(bezelMat);

    const bezelGeo = new THREE.BoxGeometry(0.128, 0.080, 0.003);
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 0.010, -0.009);
    this.rotatingMesh.add(bezelMesh);
  }

  /**
   * Builds the ergonomic molded polyurethane/Alcantara side grips with thumb rests.
   */
  private buildErgonomicGrips(): void {
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x1f2024,
      roughness: 0.94,
      metalness: 0.05,
      name: 'RSR_Ergonomic_Grip_Polyurethane',
    });
    this.materials.push(gripMat);

    // Build left and right grip profiles using smooth 3D Catmull-Rom tubular paths
    const buildGrip = (sign: number) => {
      const gripGroup = new THREE.Group();

      const curvePoints = [
        new THREE.Vector3(sign * 0.114, 0.076, -0.002), // Upper horn
        new THREE.Vector3(sign * 0.138, 0.042, -0.004), // Upper thumb rest
        new THREE.Vector3(sign * 0.142, 0.000, -0.002), // Palm swell
        new THREE.Vector3(sign * 0.136, -0.044, 0.000), // Lower finger rest
        new THREE.Vector3(sign * 0.096, -0.078, 0.002), // Lower horn
      ];

      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.0145, 12, false);
      const tubeMesh = new THREE.Mesh(tubeGeo, gripMat);
      gripGroup.add(tubeMesh);

      // Ergonomic thumb shelf / thumb rest cap
      const thumbRestGeo = new THREE.SphereGeometry(0.015, 12, 12);
      thumbRestGeo.scale(1.2, 0.7, 0.9);
      const thumbRest = new THREE.Mesh(thumbRestGeo, gripMat);
      thumbRest.position.set(sign * 0.132, 0.044, -0.005);
      gripGroup.add(thumbRest);

      // Palm swell contouring block
      const palmGeo = new THREE.SphereGeometry(0.016, 12, 12);
      palmGeo.scale(1.1, 1.6, 0.9);
      const palm = new THREE.Mesh(palmGeo, gripMat);
      palm.position.set(sign * 0.140, 0.002, -0.001);
      gripGroup.add(palm);

      return gripGroup;
    };

    // Driver left grip (+X in chassis space, Screen Left)
    this.rotatingMesh.add(buildGrip(1));
    // Driver right grip (-X in chassis space, Screen Right)
    this.rotatingMesh.add(buildGrip(-1));
  }

  /**
   * Top arched 15-LED shift rev counter (Cosworth/MoTeC powerband).
   * 5 Green -> 5 Red -> 5 Blue, all flash at >= 8800 RPM.
   */
  private buildShiftRevLights(): void {
    const ledBezelMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.5,
      metalness: 0.6,
    });
    this.materials.push(ledBezelMat);

    const ledGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.004, 16);
    ledGeo.rotateX(Math.PI / 2);

    const bezelGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 16);
    bezelGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 15; i++) {
      // Index 0 on Screen Left (+X) to index 14 on Screen Right (-X)
      const t = (7 - i) / 7; // +1.0 to -1.0
      const x = t * 0.054;
      const y = 0.082 + (1.0 - t * t) * 0.007;

      // Bezel ring
      const bezel = new THREE.Mesh(bezelGeo, ledBezelMat);
      bezel.position.set(x, y, -0.0095);
      this.rotatingMesh.add(bezel);

      // Glowing LED lens
      const mat = new THREE.MeshBasicMaterial({ color: 0x18181b });
      this.ledMaterials.push(mat);

      const led = new THREE.Mesh(ledGeo, mat);
      led.position.set(x, y, -0.0115);
      this.rotatingMesh.add(led);
      this.ledMeshes.push(led);
    }
  }

  /**
   * "PORSCHE" laser-etched wordmark across the top faceplate above the display.
   */
  private buildPorscheWordmark(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '14px';
    ctx.fillText('P O R S C H E', 256, 48);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(mat);

    const geo = new THREE.PlaneGeometry(0.088, 0.016);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.058, -0.0102);
    mesh.rotation.y = Math.PI;
    this.rotatingMesh.add(mesh);
  }

  /**
   * Anodized CNC aluminum rotary thumb encoders:
   * - Red TCI on upper-left shoulder
   * - Purple TCO on upper-right shoulder
   * - Gold dial on inner-left grip
   * - Blue dial on inner-right grip
   */
  private buildThumbEncoders(): void {
    const buildDial = (colorHex: number, name: string) => {
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.28,
        metalness: 0.85,
        name: `RSR_ThumbEncoder_${name}`,
      });
      this.materials.push(mat);

      // Knurled thumb wheel cylinder
      const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.011, 20);
      geo.rotateZ(Math.PI / 2);
      return new THREE.Mesh(geo, mat);
    };

    // Label maker helper
    const buildLabel = (text: string) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);

      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      this.materials.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.008), mat);
      m.rotation.y = Math.PI;
      return m;
    };

    // 1. TCI (Top Left Shoulder - RED)
    const tciDial = buildDial(0xdc2626, 'TCI_Red');
    tciDial.position.set(0.104, 0.068, -0.007);
    tciDial.rotation.z = -Math.PI / 4;
    this.rotatingMesh.add(tciDial);

    const tciLabel = buildLabel('TCI');
    tciLabel.position.set(0.088, 0.076, -0.0102);
    this.rotatingMesh.add(tciLabel);

    // 2. TCO (Top Right Shoulder - PURPLE)
    const tcoDial = buildDial(0x9333ea, 'TCO_Purple');
    tcoDial.position.set(-0.104, 0.068, -0.007);
    tcoDial.rotation.z = Math.PI / 4;
    this.rotatingMesh.add(tcoDial);

    const tcoLabel = buildLabel('TCO');
    tcoLabel.position.set(-0.088, 0.076, -0.0102);
    this.rotatingMesh.add(tcoLabel);

    // 3. Inner Left Grip Dial (GOLD)
    const goldDial = buildDial(0xeab308, 'Inner_Gold');
    goldDial.position.set(0.098, 0.008, -0.007);
    this.rotatingMesh.add(goldDial);

    // 4. Inner Right Grip Dial (BLUE)
    const blueDial = buildDial(0x2563eb, 'Inner_Blue');
    blueDial.position.set(-0.098, 0.008, -0.007);
    this.rotatingMesh.add(blueDial);
  }

  /**
   * 10 Tactile Motorsport Pushbuttons flanking the display.
   * Left: 2 white on top, 1 red in middle, 3 white below.
   * Right: 2 white on top, 1 red in middle, 3 white below.
   */
  private buildPushbuttons(): void {
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.6,
      metalness: 0.5,
    });
    this.materials.push(collarMat);

    const whiteCapMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
      metalness: 0.1,
    });
    this.materials.push(whiteCapMat);

    const redCapMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.4,
      metalness: 0.2,
    });
    this.materials.push(redCapMat);

    const btnCollarGeo = new THREE.CylinderGeometry(0.0050, 0.0050, 0.004, 16);
    btnCollarGeo.rotateX(Math.PI / 2);

    const btnCapGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.006, 16);
    btnCapGeo.rotateX(Math.PI / 2);

    const placeButton = (x: number, y: number, isRed: boolean) => {
      const collar = new THREE.Mesh(btnCollarGeo, collarMat);
      collar.position.set(x, y, -0.009);
      this.rotatingMesh.add(collar);

      const cap = new THREE.Mesh(btnCapGeo, isRed ? redCapMat : whiteCapMat);
      cap.position.set(x, y, -0.0115);
      this.rotatingMesh.add(cap);
    };

    // Driver Left Button Cluster (+X in chassis space, Screen Left)
    placeButton(0.088, 0.050, false);  // Top outer white
    placeButton(0.072, 0.050, false);  // Top inner white
    placeButton(0.085, 0.026, true);   // Middle red (e.g. Pit Limiter)
    placeButton(0.085, 0.000, false);  // Lower 1 white
    placeButton(0.085, -0.026, false); // Lower 2 white
    placeButton(0.085, -0.052, false); // Lower 3 white

    // Driver Right Button Cluster (-X in chassis space, Screen Right)
    placeButton(-0.088, 0.050, false);  // Top outer white
    placeButton(-0.072, 0.050, false);  // Top inner white
    placeButton(-0.085, 0.026, true);   // Middle red (e.g. Radio)
    placeButton(-0.085, 0.000, false);  // Lower 1 white
    placeButton(-0.085, -0.026, false); // Lower 2 white
    placeButton(-0.085, -0.052, false); // Lower 3 white
  }

  /**
   * 4 Lower Rotary Selector Switches & Labels on the lower chin:
   * - Upper Left: TC/CON
   * - Upper Right: TC/R
   * - Lower Left: MAP
   * - Lower Right: WIPER
   */
  private buildLowerRotarySwitches(): void {
    const knobMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
      metalness: 0.3,
    });
    this.materials.push(knobMat);

    const pointerMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    this.materials.push(pointerMat);

    const knobGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.008, 16);
    knobGeo.rotateX(Math.PI / 2);

    const pointerGeo = new THREE.BoxGeometry(0.002, 0.007, 0.009);

    const buildKnob = (x: number, y: number, angleRad: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, -0.010);

      const base = new THREE.Mesh(knobGeo, knobMat);
      g.add(base);

      const pointer = new THREE.Mesh(pointerGeo, pointerMat);
      pointer.position.set(0, 0.004, -0.001);
      g.add(pointer);

      g.rotation.z = angleRad;
      this.rotatingMesh.add(g);
    };

    // Label maker helper
    const buildLabel = (text: string, x: number, y: number) => {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 48;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 80, 24);

      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      this.materials.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.007), mat);
      m.position.set(x, y, -0.0102);
      m.rotation.y = Math.PI;
      this.rotatingMesh.add(m);
    };

    // 1. Upper Left: TC/CON
    buildKnob(0.038, -0.040, -Math.PI / 6);
    buildLabel('TC/CON', 0.038, -0.026);

    // 2. Upper Right: TC/R
    buildKnob(-0.038, -0.040, Math.PI / 6);
    buildLabel('TC/R', -0.038, -0.026);

    // 3. Lower Left: MAP
    buildKnob(0.022, -0.068, 0);
    buildLabel('MAP', 0.022, -0.079);

    // 4. Lower Right: WIPER
    buildKnob(-0.022, -0.068, 0);
    buildLabel('WIPER', -0.022, -0.079);
  }

  /**
   * Authentic Porsche Golden Shield Crest placed on lower chin between the rotary switches.
   */
  private buildPorscheCrest(): void {
    const crestCanvas = document.createElement('canvas');
    crestCanvas.width = 128;
    crestCanvas.height = 160;
    const ctx = crestCanvas.getContext('2d')!;

    // Golden shield outline
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(64, 10);
    ctx.lineTo(118, 20);
    ctx.lineTo(110, 105);
    ctx.lineTo(64, 150);
    ctx.lineTo(18, 105);
    ctx.lineTo(10, 20);
    ctx.closePath();
    ctx.fill();

    // Red and black quarters
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(30, 45, 34, 45);
    ctx.fillRect(64, 90, 34, 40);

    ctx.fillStyle = '#09090b';
    ctx.fillRect(64, 45, 34, 45);
    ctx.fillRect(30, 90, 34, 40);

    // PORSCHE header arch
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PORSCHE', 64, 34);

    const crestTex = new THREE.CanvasTexture(crestCanvas);
    const crestMat = new THREE.MeshBasicMaterial({ map: crestTex, transparent: true, depthWrite: false });
    this.materials.push(crestMat);

    const crestMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.020), crestMat);
    crestMesh.position.set(0, -0.040, -0.0102);
    crestMesh.rotation.y = Math.PI;
    this.rotatingMesh.add(crestMesh);
  }

  /**
   * Rear Magnetic Carbon Fiber Shifter Paddles (Downshift left, Upshift right).
   */
  private buildShifterPaddles(): void {
    const paddleMat = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      roughness: 0.35,
      metalness: 0.4,
      name: 'RSR_Paddle_Carbon',
    });
    this.materials.push(paddleMat);

    const paddleGeo = new THREE.BoxGeometry(0.020, 0.065, 0.003);

    // Left downshift paddle
    const leftPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    leftPaddle.position.set(0.128, 0.012, 0.024);
    leftPaddle.rotation.y = 0.22;
    this.rotatingMesh.add(leftPaddle);

    // Right upshift paddle
    const rightPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    rightPaddle.position.set(-0.128, 0.012, 0.024);
    rightPaddle.rotation.y = -0.22;
    this.rotatingMesh.add(rightPaddle);
  }

  /**
   * Renders the 1-to-1 official Porsche 911 RSR telemetry LCD dashboard:
   * - Top Bar: TC C, TC R, SPEED (000), AC, Map
   * - Left Cluster: Water Temp, Oil Temp, Water Press, Oil Press
   * - Center: Huge Gear Indicator (N green, R red, 1-6 yellow) + Porsche Crest
   * - Right Cluster: Avg Diff, Predicted Lap Time, Best Lap Time, Lap count, Last Lap Time
   * - Placeholders kept as clean dark boxes for future systems.
   */
  private renderDashCanvas(
    speedKmh: number,
    gear: number,
    rpm: number,
    isShiftLight: boolean,
    isAbsActive: boolean,
    isTcActive: boolean,
    lapTimeSeconds = 0,
    bestLapSeconds: number | null = null
  ): void {
    const ctx = this.dashCtx;
    const w = 1024;
    const h = 600;

    // Deep matte carbon OLED display background
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, w, h);

    // Shift alarm border flash if at redline limiter
    if (isShiftLight) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
    }

    // =========================================================================
    // 1. TOP STATUS HEADER (TC C, TC R, SPEED 000, AC, Map)
    // =========================================================================

    // Helper: Header Status Pill Box
    const drawPill = (
      x: number,
      y: number,
      pillW: number,
      pillH: number,
      label: string,
      value: string,
      borderColor: string,
      bgColor: string,
      textColor: string
    ) => {
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(x, y, pillW, pillH, 8);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Top label
      ctx.fillStyle = textColor;
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, x + pillW / 2, y + 8);

      // Value numeral
      ctx.font = '900 28px monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillText(value, x + pillW / 2, y + pillH - 6);
    };

    // Box 1: TC C (amber)
    const tcCVal = isTcActive ? '1' : '0';
    drawPill(20, 14, 95, 62, 'TC C', tcCVal, '#d97706', '#451a03', '#fbbf24');

    // Box 2: TC R (red)
    const tcRVal = isTcActive ? '1' : '0';
    drawPill(124, 14, 95, 62, 'TC R', tcRVal, '#dc2626', '#450a0a', '#fca5a5');

    // Box 3: SPEED (Center giant digital readout)
    const speedInt = Math.round(Math.abs(speedKmh));
    const speedStr = speedInt < 10 ? `00${speedInt}` : speedInt < 100 ? `0${speedInt}` : `${speedInt}`;

    ctx.fillStyle = '#0f1117';
    ctx.beginPath();
    ctx.roundRect(380, 12, 264, 66, 8);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(speedStr, 512, 45);

    // Box 4: AC / ABS (cyan)
    const acVal = isAbsActive ? '11' : '11';
    drawPill(805, 14, 95, 62, 'AC', acVal, '#06b6d4', '#083344', '#67e8f9');

    // Box 5: Map (green)
    drawPill(909, 14, 95, 62, 'Map', '1', '#16a34a', '#052e16', '#86efac');

    // =========================================================================
    // 2. CENTER COLUMN: GIANT GEAR INDICATOR & EMBLEM
    // =========================================================================
    const gearX = 380;
    const gearW = 264;
    const gearY = 90;
    const gearH = 490;

    // Flanking vertical separator lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gearX, gearY);
    ctx.lineTo(gearX, gearY + gearH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gearX + gearW, gearY);
    ctx.lineTo(gearX + gearW, gearY + gearH);
    ctx.stroke();

    // Prominent motorsport gear numeral
    let gearText = gear.toString();
    let gearColor = '#facc15'; // Race Yellow
    if (gear === 0) {
      gearText = 'N';
      gearColor = '#22c55e'; // Green Neutral
    } else if (gear === -1) {
      gearText = 'R';
      gearColor = '#ef4444'; // Red Reverse
    }

    ctx.fillStyle = gearColor;
    ctx.font = '900 240px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gearText, 512, gearY + gearH / 2 - 20);

    // Small golden Porsche crest below gear numeral
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    const cX = 512, cY = gearY + gearH - 55;
    ctx.moveTo(cX, cY - 18);
    ctx.lineTo(cX + 16, cY - 14);
    ctx.lineTo(cX + 12, cY + 12);
    ctx.lineTo(cX, cY + 22);
    ctx.lineTo(cX - 12, cY + 12);
    ctx.lineTo(cX - 16, cY - 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cX - 8, cY - 8, 8, 10);
    ctx.fillRect(cX, cY + 2, 8, 10);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(cX, cY - 8, 8, 10);
    ctx.fillRect(cX - 8, cY + 2, 8, 10);

    // =========================================================================
    // 3. LEFT TELEMETRY CLUSTER (Water Temp, Oil Temp, Water Press, Oil Press)
    // =========================================================================
    const lBoxW = 160;
    const lBoxH = 175;
    const lRow1Y = 110;
    const lRow2Y = 300;

    // Helper: Telemetry Metric Box
    const drawMetricBox = (x: number, y: number, label: string, valStr: string, unit: string) => {
      ctx.fillStyle = '#0b0d14';
      ctx.beginPath();
      ctx.roundRect(x, y, lBoxW, lBoxH, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label header
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, x + lBoxW / 2, y + 14);

      // Value
      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 62px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(valStr, x + lBoxW / 2, y + lBoxH / 2 + 8);

      // Unit
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillText(unit, x + lBoxW / 2, y + lBoxH - 12);
    };

    // Calculate realistic dynamic temperature & pressure based on RPM & pace
    const rpmRatio = Math.max(0, Math.min(1.0, rpm / 9000.0));
    const dynamicWaterTemp = Math.round(82 + rpmRatio * 14);
    const dynamicOilTemp = Math.round(88 + rpmRatio * 18);
    const dynamicWaterPress = (1.80 + rpmRatio * 0.45).toFixed(2);
    const dynamicOilPress = (3.20 + rpmRatio * 2.40).toFixed(2);

    // Box 1: Water Temp
    drawMetricBox(20, lRow1Y, 'Water Temp', dynamicWaterTemp.toString(), '°C');

    // Box 2: Oil Temp
    drawMetricBox(190, lRow1Y, 'Oil Temp', dynamicOilTemp.toString(), '°C');

    // Box 3: Water Press
    drawMetricBox(20, lRow2Y, 'Water Press', dynamicWaterPress, 'bar');

    // Box 4: Oil Press
    drawMetricBox(190, lRow2Y, 'Oil Press', dynamicOilPress, 'bar');

    // Bottom Placeholder bar for future pit/fuel data
    ctx.fillStyle = '#08090d';
    ctx.beginPath();
    ctx.roundRect(20, 490, 330, 85, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PIT STRATEGY & TYRE TELEMETRY', 185, 532);

    // =========================================================================
    // 4. RIGHT LAP TIMING & TELEMETRY CLUSTER
    // =========================================================================
    const rightX = 664;
    const rightW = 340;

    // Helper: Format seconds to MM:SS:cc
    const formatTime = (secs: number | null | undefined): string => {
      if (secs === null || secs === undefined || isNaN(secs) || secs <= 0) {
        return '00:00:00';
      }
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      const ms = Math.floor((secs % 1) * 100);
      const mm = m < 10 ? `0${m}` : `${m}`;
      const ss = s < 10 ? `0${s}` : `${s}`;
      const cc = ms < 10 ? `0${ms}` : `${ms}`;
      return `${mm}:${ss}:${cc}`;
    };

    // Row 1: Avg Diff (Delta time)
    ctx.fillStyle = '#0b0d14';
    ctx.beginPath();
    ctx.roundRect(rightX, 110, rightW, 75, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Avg Diff', rightX + 16, 147);

    // Delta calculation
    let deltaStr = '+0.00';
    let deltaColor = '#f8fafc';
    if (bestLapSeconds && lapTimeSeconds > 0) {
      const diff = lapTimeSeconds - bestLapSeconds;
      deltaStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      deltaColor = diff <= 0 ? '#22c55e' : '#ef4444';
    }
    ctx.fillStyle = deltaColor;
    ctx.font = '900 36px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(deltaStr, rightX + rightW - 16, 147);

    // Row 2: Predicted Lap Time (Live running timer)
    ctx.fillStyle = '#0b0d14';
    ctx.beginPath();
    ctx.roundRect(rightX, 198, rightW, 115, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Predicted Lap Time', rightX + rightW / 2, 210);

    const runLapStr = formatTime(lapTimeSeconds);
    ctx.fillStyle = '#facc15';
    ctx.font = '900 48px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(runLapStr, rightX + rightW / 2, 268);

    // Row 3: Best Lap Time
    ctx.fillStyle = '#0b0d14';
    ctx.beginPath();
    ctx.roundRect(rightX, 325, rightW, 115, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Best Lap Time', rightX + rightW / 2, 337);

    const bestLapStr = formatTime(bestLapSeconds);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 48px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(bestLapStr, rightX + rightW / 2, 395);

    // Row 4: Laps2go / Lap & Last Lap Time
    const rSplitW = (rightW - 12) / 2;
    // Left: Laps2go
    ctx.fillStyle = '#0b0d14';
    ctx.beginPath();
    ctx.roundRect(rightX, 452, rSplitW, 125, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Laps2go', rightX + rSplitW / 2, 464);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 52px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('10', rightX + rSplitW / 2, 524);

    // Right: Last Lap Time
    ctx.fillStyle = '#0b0d14';
    ctx.beginPath();
    ctx.roundRect(rightX + rSplitW + 12, 452, rSplitW, 125, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Lap Time', rightX + rSplitW + 12 + rSplitW / 2, 464);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '900 24px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(runLapStr, rightX + rSplitW + 12 + rSplitW / 2, 524);

    this.dashTexture.needsUpdate = true;
  }

  /**
   * Main real-time update loop: rotates the wheel along local Z and updates
   * the 15 shift rev LEDs and 1:1 LCD screen.
   */
  public update(telemetry: VehicleTelemetry, steerAngleDeg: number, _dt = 0.016): void {
    // 1. Rotate Steering Wheel around local Z axis
    const steerRad = steerAngleDeg * (Math.PI / 180);
    this.rotatingMesh.rotation.z = -steerRad * 3.4;

    // 2. Update 15 Shift LEDs
    // 5 Green (6600-7400), 5 Red (7400-8200), 5 Blue (8200-8800), Flash >= 8800
    const rpm = telemetry.rpm;
    const isFlash = rpm >= 8800 && Math.floor(performance.now() / 60) % 2 === 0;

    for (let i = 0; i < 15; i++) {
      let active = false;
      let col = 0x18181b;

      if (i < 5) {
        const threshold = 6600 + i * ((7400 - 6600) / 5);
        active = rpm >= threshold;
        col = 0x22c55e;
      } else if (i < 10) {
        const threshold = 7400 + (i - 5) * ((8200 - 7400) / 5);
        active = rpm >= threshold;
        col = 0xef4444;
      } else {
        const threshold = 8200 + (i - 10) * ((8800 - 8200) / 5);
        active = rpm >= threshold;
        col = 0x3b82f6;
      }

      if (isFlash) {
        this.ledMaterials[i].color.setHex(col);
      } else if (active) {
        this.ledMaterials[i].color.setHex(col);
      } else {
        this.ledMaterials[i].color.setHex(0x18181b);
      }
    }

    // 3. Update LCD Screen if values changed
    const speedInt = Math.round(Math.abs(telemetry.speedKmh));
    const rpmInt = Math.round(telemetry.rpm / 40) * 40;
    const lapTimeInt = Math.round((telemetry.lapTimeSeconds || 0) * 10);
    const shiftFlash = telemetry.isShiftLightActive ?? false;

    if (
      telemetry.gear !== this.lastRenderedGear ||
      speedInt !== this.lastRenderedSpeed ||
      rpmInt !== this.lastRenderedRpm ||
      lapTimeInt !== this.lastRenderedLapTime ||
      shiftFlash !== this.lastShiftFlash
    ) {
      this.lastRenderedGear = telemetry.gear;
      this.lastRenderedSpeed = speedInt;
      this.lastRenderedRpm = rpmInt;
      this.lastRenderedLapTime = lapTimeInt;
      this.lastShiftFlash = shiftFlash;

      this.renderDashCanvas(
        telemetry.speedKmh,
        telemetry.gear,
        telemetry.rpm,
        shiftFlash,
        telemetry.isAbsActive,
        telemetry.isTcActive,
        telemetry.lapTimeSeconds,
        telemetry.bestLapSeconds
      );
    }
  }

  public dispose(): void {
    this.dashTexture.dispose();
    for (const mat of this.materials) {
      mat.dispose();
    }
    for (const mat of this.ledMaterials) {
      mat.dispose();
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
}
