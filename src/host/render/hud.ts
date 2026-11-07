import { VehicleTelemetry } from '../../common/types';
import QRCode from 'qrcode';

export interface HudData {
  telemetry: VehicleTelemetry;
  fps: number;
  phoneConnected: boolean;
  cameraMode: string;
  trackName: string;
  landmarkName?: string;
  lapTimeMs?: number;
  bestLapTimeMs?: number | null;
  lastLapTimeMs?: number | null;
  lapCount?: number;
  isLapValid?: boolean;
  flagStatus?: string;
  opponentCars?: Array<{ x: number; z: number; color: string; number: string }>;
}

export interface TrackChoice {
  id: string;
  title: string;
  badge: string;
  badgeClass: string;
  subtitle: string;
  length: string;
  corners: string;
  elevation: string;
}

export const TRACK_CATALOG: TrackChoice[] = [
  {
    id: 'nordschleife',
    title: 'Nürburgring Nordschleife',
    badge: 'TIME ATTACK',
    badgeClass: 'badge-nord',
    subtitle: 'The Green Hell (Grüne Hölle) 20.8 km Eifel loop',
    length: '20.83 km',
    corners: '73 Turns',
    elevation: '301.5 m drop',
  },
  {
    id: '24h',
    title: 'Nürburgring 24h Gesamtkurs',
    badge: 'ENDURANCE',
    badgeClass: 'badge-24h',
    subtitle: 'Combined Nordschleife + Grand Prix circuit',
    length: '25.38 km',
    corners: '170+ Turns',
    elevation: '301.5 m drop',
  },
  {
    id: 'gp_strecke',
    title: 'Nürburgring GP-Strecke',
    badge: 'SPRINT',
    badgeClass: 'badge-gp',
    subtitle: 'Modern F1 / GT3 circuit with Mercedes Arena & chicane',
    length: '5.15 km',
    corners: '16 Turns',
    elevation: '56.0 m',
  },
  {
    id: 'proving_ground',
    title: 'High-Speed Proving Ground',
    badge: 'TEST BENCH',
    badgeClass: 'badge-test',
    subtitle: '4-lane sprint runway & skidpad for 0–300 km/h calibration',
    length: '6.00 km',
    corners: 'Skidpad & Slalom',
    elevation: '0.0 m flat',
  },
];

function formatLapTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '--:--.--';
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export class HostHud {
  private container: HTMLElement;
  private speedDigits!: HTMLElement;
  private speedMsDigits!: HTMLElement;
  private gearNumeral!: HTMLElement;
  private rpmBar!: HTMLElement;
  private fpsDisplay!: HTMLElement;
  public rttDisplay!: HTMLElement;
  private phoneStatusBadge!: HTMLElement;
  private exitMenuButton!: HTMLButtonElement;
  public onExitToMenu?: () => void;
  private distLabel!: HTMLElement;
  private distanceDisplay!: HTMLElement;
  private landmarkRow!: HTMLElement;
  private landmarkDisplay!: HTMLElement;
  private lapRow!: HTMLElement;
  private lapTimeDisplay!: HTMLElement;
  private lapStatusBadge!: HTMLElement;
  private bestRow!: HTMLElement;
  private bestTimeDisplay!: HTMLElement;
  private lastTimeDisplay!: HTMLElement;
  private sprintRow!: HTMLElement;
  private sprintTimeDisplay!: HTMLElement;
  private sprint200TimeDisplay!: HTMLElement;
  private maxSpeedDisplay: HTMLElement | null = null;
  private camModeDisplay!: HTMLElement;
  private qrContainer!: HTMLElement;
  private paintButton: HTMLButtonElement | null = null;
  public onPaintCycle?: () => string;

  // Minimap
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private minimapTag!: HTMLElement;
  private minimapTitleText!: HTMLElement;
  private minimapMode: 'gps_heading' | 'full_track' = 'gps_heading';
  private cachedCenterlinePoints: { x: number; z: number }[] = [];

  // Track Menu Modal
  private trackModalBackdrop!: HTMLElement;
  private isTrackModalOpen = false;
  private qrDismissed = false;
  private currentTrackId = 'nordschleife';
  private onSelectTrackCallback?: (trackId: string) => void;

  constructor(container: HTMLElement, onSelectTrack?: (trackId: string) => void) {
    this.container = container;
    this.onSelectTrackCallback = onSelectTrack;
    this.buildDOM();
    this.generateQRCode();
    this.bindEvents();
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="hud-overlay">
        <!-- Top Left Cluster: System Diagnostics, Distance & Performance -->
        <div class="hud-panel hud-top-left">
          <div class="hud-badge-row">
            <span class="status-indicator" id="hud-phone-status">PHONE: WAITING</span>
            <span class="hud-tag" id="hud-cam-mode">CAM: COCKPIT</span>
            <button class="hud-tag" id="hud-exit-menu-btn" style="cursor: pointer; pointer-events: auto; border: 1px solid rgba(239, 68, 68, 0.6); background: rgba(220, 38, 38, 0.25); color: #fca5a5; font-weight: 700; padding: 2px 10px; border-radius: 4px;">EXIT TO MENU [ESC]</button>
          </div>
          <div class="hud-meta-row">
            <span class="meta-label">FPS:</span>
            <span class="meta-val" id="hud-fps">--</span>
            <span class="meta-label">RTT:</span>
            <span class="meta-val" id="hud-rtt">-- ms</span>
          </div>
          <div class="hud-meta-row">
            <span class="meta-label" id="hud-dist-label">TRACK DIST:</span>
            <span class="meta-val" id="hud-distance" style="color: #38bdf8;">0 m</span>
          </div>
          <div class="hud-meta-row" id="hud-landmark-row">
            <span class="meta-label">NEAR:</span>
            <span class="meta-val" id="hud-landmark" style="color: #c084fc;">--</span>
          </div>
          <div class="hud-meta-row" id="hud-lap-row">
            <span class="meta-label">LAP:</span>
            <span class="meta-val" id="hud-lap-time" style="color: #4ade80;">--:--.--</span>
            <span id="hud-lap-status" style="font-size: 10px; font-weight: 700; padding: 1px 4px; border-radius: 2px;"></span>
          </div>
          <div class="hud-meta-row" id="hud-best-row">
            <span class="meta-label">BEST:</span>
            <span class="meta-val" id="hud-best-time" style="color: #facc15;">--:--.--</span>
            <span class="meta-label" style="margin-left: 6px;">LAST:</span>
            <span class="meta-val" id="hud-last-time">--:--.--</span>
          </div>
          <div class="hud-meta-row" id="hud-sprint-row" style="display: none;">
            <span class="meta-label">0-100 KM/H:</span>
            <span class="meta-val" id="hud-sprint">--</span>
            <span class="meta-label">0-200:</span>
            <span class="meta-val" id="hud-sprint-200">--</span>
          </div>
        </div>

        <!-- Top Right Cluster: Cockpit Telemetry with 1:1 Physical Speed -->
        <div class="hud-panel hud-top-right">
          <div class="hud-speed-gear">
            <div class="hud-speed-box">
              <span class="hud-speed-num" id="hud-speed">0</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start;">
                <span class="hud-speed-unit">KM/H</span>
                <span id="hud-speed-ms" style="font-size: 11px; font-family: monospace; color: #94a3b8; font-weight: 600;">0.0 m/s</span>
              </div>
            </div>
            <div class="hud-gear-box" id="hud-gear">N</div>
          </div>
          <div class="hud-rpm-wrapper">
            <div class="hud-rpm-bar" id="hud-rpm"></div>
          </div>
        </div>

        <!-- Bottom Left: Live Circuit Radar Minimap -->
        <div class="hud-minimap-panel" id="hud-minimap-panel" title="Click or press [N] to toggle GPS North-Locked / Static Overview" style="cursor: pointer;">
          <div class="minimap-header">
            <span id="minimap-title-text">GPS RADAR</span>
            <button class="minimap-tag" id="minimap-track-tag" style="cursor: pointer; pointer-events: auto; border: 1px solid rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 700;">GPS: NORTH LOCKED</button>
          </div>
          <canvas id="hud-minimap-canvas" width="240" height="150"></canvas>
        </div>

        <!-- Center Bottom: Keyboard Controls Hint -->
        <div class="hud-footer-hints">
          <span>[W / UP] Gas</span>
          <span>[S / DOWN] Brake</span>
          <span>[A / D] Steer</span>
          <span>[N] GPS Map</span>
          <span>[ESC / M] Main Menu</span>
          <span>[B / V] Rear View</span>
          <span>[C] Camera</span>
          <span>[P] Livery</span>
          <span>[R] Respawn</span>
        </div>

        <!-- QR Code Connection Box (Dismissible) -->
        <div class="hud-qr-box" id="hud-qr-box">
          <div class="qr-title">CONNECT IPHONE CONTROLLER</div>
          <canvas id="qr-canvas"></canvas>
          <div class="qr-url" id="qr-url-text">Loading IP...</div>
          <div class="qr-sub">Scan with iPhone Camera on same Wi-Fi</div>
        </div>
      </div>

      <!-- Track Selection Modal -->
      <div class="track-menu-backdrop" id="track-menu-backdrop">
        <div class="track-menu-dialog">
          <div class="track-menu-header">
            <div class="track-menu-title">
              <span>🏁</span>
              <span>SELECT CIRCUIT & LAYOUT</span>
            </div>
            <button class="track-menu-close" id="track-menu-close-btn">ESC / CLOSE</button>
          </div>
          <div class="track-grid" id="track-grid-cards">
            <!-- Injected dynamically -->
          </div>
        </div>
      </div>
    `;

    this.speedDigits = this.container.querySelector('#hud-speed')!;
    this.speedMsDigits = this.container.querySelector('#hud-speed-ms')!;
    this.gearNumeral = this.container.querySelector('#hud-gear')!;
    this.rpmBar = this.container.querySelector('#hud-rpm')!;
    this.fpsDisplay = this.container.querySelector('#hud-fps')!;
    this.rttDisplay = this.container.querySelector('#hud-rtt')!;
    this.phoneStatusBadge = this.container.querySelector('#hud-phone-status')!;
    this.paintButton = this.container.querySelector('#hud-paint-btn') as HTMLButtonElement | null;
    this.exitMenuButton = this.container.querySelector('#hud-exit-menu-btn') as HTMLButtonElement;
    this.distLabel = this.container.querySelector('#hud-dist-label')!;
    this.distanceDisplay = this.container.querySelector('#hud-distance')!;
    this.landmarkRow = this.container.querySelector('#hud-landmark-row')!;
    this.landmarkDisplay = this.container.querySelector('#hud-landmark')!;
    this.lapRow = this.container.querySelector('#hud-lap-row')!;
    this.lapTimeDisplay = this.container.querySelector('#hud-lap-time')!;
    this.lapStatusBadge = this.container.querySelector('#hud-lap-status')!;
    this.bestRow = this.container.querySelector('#hud-best-row')!;
    this.bestTimeDisplay = this.container.querySelector('#hud-best-time')!;
    this.lastTimeDisplay = this.container.querySelector('#hud-last-time')!;
    this.sprintRow = this.container.querySelector('#hud-sprint-row')!;
    this.sprintTimeDisplay = this.container.querySelector('#hud-sprint')!;
    this.sprint200TimeDisplay = this.container.querySelector('#hud-sprint-200')!;
    this.maxSpeedDisplay = this.container.querySelector('#hud-max-speed');
    this.camModeDisplay = this.container.querySelector('#hud-cam-mode')!;
    this.qrContainer = this.container.querySelector('#hud-qr-box')!;

    // Minimap Canvas initialization
    this.minimapCanvas = this.container.querySelector('#hud-minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.minimapTag = this.container.querySelector('#minimap-track-tag')!;
    this.minimapTitleText = this.container.querySelector('#minimap-title-text')!;

    // Modal
    this.trackModalBackdrop = this.container.querySelector('#track-menu-backdrop')!;
    this.renderTrackCards();
  }

  private bindEvents(): void {
    this.paintButton?.addEventListener('click', () => {
      if (this.onPaintCycle) {
        const name = this.onPaintCycle();
        this.setPaintName(name);
      }
    });

    this.exitMenuButton.addEventListener('click', () => {
      this.onExitToMenu?.();
    });

    // Minimap click toggle
    const minimapPanel = this.container.querySelector('#hud-minimap-panel');
    minimapPanel?.addEventListener('click', () => {
      this.toggleMinimapMode();
    });

    this.qrContainer.addEventListener('click', () => {
      this.qrDismissed = true;
      this.qrContainer.style.display = 'none';
    });

    const closeBtn = this.container.querySelector('#track-menu-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.closeTrackMenu();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.onExitToMenu?.();
      } else if (e.code === 'KeyN') {
        this.toggleMinimapMode();
      }
    });
  }

  public show(): void {
    this.container.style.display = 'block';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public setCenterlineSamples(samples: { x: number; z: number }[]): void {
    this.cachedCenterlinePoints = samples;
  }

  public openTrackMenu(): void {
    this.isTrackModalOpen = true;
    this.renderTrackCards();
    this.trackModalBackdrop.classList.add('active');
  }

  public closeTrackMenu(): void {
    this.isTrackModalOpen = false;
    this.trackModalBackdrop.classList.remove('active');
  }

  public toggleTrackMenu(): void {
    if (this.isTrackModalOpen) {
      this.closeTrackMenu();
    } else {
      this.openTrackMenu();
    }
  }

  private renderTrackCards(): void {
    const grid = this.container.querySelector('#track-grid-cards');
    if (!grid) return;

    grid.innerHTML = TRACK_CATALOG.map((track) => {
      const isCurrent = track.id === this.currentTrackId;
      return `
        <div class="track-card ${isCurrent ? 'current' : ''}" data-track-id="${track.id}">
          <span class="track-card-badge ${track.badgeClass}">${track.badge}</span>
          <div>
            <div class="track-card-title">${track.title}</div>
            <div class="track-card-desc">${track.subtitle}</div>
            <div class="track-card-metrics">
              <div class="metric-item">
                <span class="metric-item-label">Length</span>
                <span class="metric-item-val">${track.length}</span>
              </div>
              <div class="metric-item">
                <span class="metric-item-label">Configuration</span>
                <span class="metric-item-val">${track.corners}</span>
              </div>
              <div class="metric-item">
                <span class="metric-item-label">Profile</span>
                <span class="metric-item-val">${track.elevation}</span>
              </div>
            </div>
          </div>
          <button class="track-card-action">
            ${isCurrent ? 'CURRENTLY ACTIVE' : 'SELECT TRACK'}
          </button>
        </div>
      `;
    }).join('');

    // Attach click events to cards
    grid.querySelectorAll('.track-card').forEach((card) => {
      card.addEventListener('click', () => {
        const trackId = card.getAttribute('data-track-id');
        if (trackId) {
          this.currentTrackId = trackId;
          this.closeTrackMenu();
          if (this.onSelectTrackCallback) {
            this.onSelectTrackCallback(trackId);
          }
        }
      });
    });
  }

  public setCurrentTrack(trackId: string): void {
    this.currentTrackId = trackId;
    this.updateMinimapHeader();
    this.renderTrackCards();
  }

  private updateMinimapHeader(): void {
    if (this.minimapTag) {
      if (this.minimapMode === 'gps_heading') {
        this.minimapTag.textContent = 'GPS: NORTH LOCKED';
        this.minimapTag.style.color = '#38bdf8';
        this.minimapTag.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        this.minimapTag.style.background = 'rgba(56, 189, 248, 0.15)';
      } else {
        const trackTitle = this.currentTrackId.toUpperCase().replace('_', ' ');
        this.minimapTag.textContent = `${trackTitle} [STATIC]`;
        this.minimapTag.style.color = '#94a3b8';
        this.minimapTag.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        this.minimapTag.style.background = 'rgba(148, 163, 184, 0.1)';
      }
    }
    if (this.minimapTitleText) {
      this.minimapTitleText.textContent = this.minimapMode === 'gps_heading' ? 'GPS RADAR' : 'CIRCUIT OVERVIEW';
    }
  }

  public toggleMinimapMode(): void {
    this.minimapMode = this.minimapMode === 'gps_heading' ? 'full_track' : 'gps_heading';
    this.updateMinimapHeader();
  }

  /**
   * Updates the live 2D HUD Minimap.
   * In GPS Mode: Player icon is permanently locked facing North (strictly UP) with rotating track and opponents.
   * In Full Track Mode: Static birds-eye view of complete track geometry with rotating blip.
   */
  public updateMinimap(
    carX: number,
    carZ: number,
    carRotation: { x: number; y: number; z: number; w: number },
    trackId: string,
    flagStatus = 'GREEN',
    opponentCars: Array<{ x: number; z: number; color: string; number: string }> = []
  ): void {
    if (this.minimapMode === 'gps_heading') {
      this.renderGpsTrackUpMinimap(carX, carZ, carRotation, trackId, flagStatus, opponentCars);
    } else {
      this.renderFullTrackMinimap(carX, carZ, carRotation, trackId, flagStatus, opponentCars);
    }
  }

  /**
   * Authentic GPS / Track-Up Navigation Display.
   * Player vehicle icon is permanently LOCKED FACING NORTH (strictly UP along -Y axis).
   * Circuit ribbon, sectors, FIA flag states, and competitors rotate and translate around the car.
   */
  private renderGpsTrackUpMinimap(
    carX: number,
    carZ: number,
    carRotation: { x: number; y: number; z: number; w: number },
    trackId: string,
    flagStatus: string,
    opponentCars: Array<{ x: number; z: number; color: string; number: string }>
  ): void {
    const ctx = this.minimapCtx;
    const cw = this.minimapCanvas.width;
    const ch = this.minimapCanvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Dark motorsport cockpit glass background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, cw, ch);

    // Car position on screen: centered horizontally, lower-middle vertically for forward lookahead
    const carScreenX = cw * 0.50;
    const carScreenY = ch * 0.62;
    const scale = 0.22; // Pixels per meter (~420m forward lookahead)

    // Compute car orientation vectors from quaternion in Three.js right-handed space
    const qx = carRotation.x, qy = carRotation.y, qz = carRotation.z, qw = carRotation.w;
    let fwdX = 2 * (qx * qz + qw * qy);
    let fwdZ = 1 - 2 * (qx * qx + qy * qy);
    const len = Math.hypot(fwdX, fwdZ) || 1.0;
    fwdX /= len;
    fwdZ /= len;
    // Driver's true right vector: perpendicular to forward vector (Right = -fwdZ, +fwdX)
    const rightX = -fwdZ;
    const rightZ = fwdX;

    const isFlashing = Math.sin(performance.now() * 0.008) > 0;

    // 1. Subtle Polar Range Rings (100m, 250m, 400m)
    const rangeRings = [
      { r: 100 * scale, label: '100m' },
      { r: 250 * scale, label: '250m' },
      { r: 400 * scale, label: '400m' },
    ];
    for (const ring of rangeRings) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(carScreenX, carScreenY, ring.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ring.label, carScreenX + ring.r + 2, carScreenY - 2);
    }

    // Ahead guide line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(carScreenX, carScreenY);
    ctx.lineTo(carScreenX, 26);
    ctx.stroke();
    ctx.setLineDash([]);

    if (trackId === 'proving_ground') {
      // Proving Ground GPS track-up view
      const laneWidth = 18; // Runway is 36m wide (-18m to +18m)
      const maxDist = 500;

      // Project runway center and borders
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let z = Math.max(0, carZ - 100); z <= Math.min(5000, carZ + maxDist); z += 50) {
        const dx = 0 - carX;
        const dz = z - carZ;
        const fwd = dx * fwdX + dz * fwdZ;
        const rgt = dx * rightX + dz * rightZ;
        const sx = carScreenX + rgt * scale;
        const sy = carScreenY - fwd * scale;
        if (z === Math.max(0, carZ - 100)) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Lateral borders
      for (const side of [-laneWidth, laneWidth]) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let z = Math.max(0, carZ - 100); z <= Math.min(5000, carZ + maxDist); z += 50) {
          const dx = side - carX;
          const dz = z - carZ;
          const fwd = dx * fwdX + dz * fwdZ;
          const rgt = dx * rightX + dz * rightZ;
          const sx = carScreenX + rgt * scale;
          const sy = carScreenY - fwd * scale;
          if (z === Math.max(0, carZ - 100)) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    } else {
      // Surveyed Circuit Ribbon (Car-Centric Track-Up)
      const pts = this.cachedCenterlinePoints;
      if (pts.length > 0) {
        const step = Math.max(1, Math.floor(pts.length / 500));
        const N = pts.length;
        const s1End = Math.floor(N / 3);
        const s2End = Math.floor((2 * N) / 3);

        const sectors = [
          {
            name: 'S1',
            start: 0,
            end: s1End,
            isYellow: flagStatus === 'SECTOR_1_YELLOW' || flagStatus === 'FULL_YELLOW',
          },
          {
            name: 'S2',
            start: s1End,
            end: s2End,
            isYellow: flagStatus === 'SECTOR_2_YELLOW' || flagStatus === 'FULL_YELLOW',
          },
          {
            name: 'S3',
            start: s2End,
            end: N,
            isYellow: flagStatus === 'SECTOR_3_YELLOW' || flagStatus === 'FULL_YELLOW',
          },
        ];

        for (const sec of sectors) {
          let strokeColor = 'rgba(56, 189, 248, 0.85)';
          let glowColor = 'rgba(56, 189, 248, 0.4)';
          let lineWidth = 2.4;

          if (flagStatus === 'RED') {
            strokeColor = isFlashing ? '#ef4444' : '#991b1b';
            glowColor = '#ef4444';
            lineWidth = 2.8;
          } else if (sec.isYellow) {
            strokeColor = isFlashing ? '#facc15' : '#ca8a04';
            glowColor = '#facc15';
            lineWidth = 2.8;
          }

          ctx.beginPath();
          let prevSx = 0, prevSy = 0;
          let isDrawing = false;

          for (let i = sec.start; i <= sec.end; i += step) {
            const pt = pts[Math.min(N - 1, i)];
            const dx = pt.x - carX;
            const dz = pt.z - carZ;
            const fwd = dx * fwdX + dz * fwdZ;
            const rgt = dx * rightX + dz * rightZ;
            const sx = carScreenX + rgt * scale;
            const sy = carScreenY - fwd * scale;

            // Cull points far outside screen view
            if (sx < -60 || sx > cw + 60 || sy < -60 || sy > ch + 60) {
              isDrawing = false;
              continue;
            }

            if (!isDrawing) {
              ctx.moveTo(sx, sy);
              isDrawing = true;
            } else {
              // Discard wrap-around line jumps across circuit boundaries
              if (Math.hypot(sx - prevSx, sy - prevSy) > 80) {
                ctx.moveTo(sx, sy);
              } else {
                ctx.lineTo(sx, sy);
              }
            }
            prevSx = sx;
            prevSy = sy;
          }

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 5;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Landmark Beacons in range
        const beaconFractions = [0.0, 0.25, 0.5, 0.75];
        const beaconColors = ['#22c55e', '#c084fc', '#facc15', '#38bdf8'];
        for (let b = 0; b < beaconFractions.length; b++) {
          const sampleIdx = Math.floor(beaconFractions[b] * pts.length);
          const lmPt = pts[sampleIdx];
          const dx = lmPt.x - carX;
          const dz = lmPt.z - carZ;
          const fwd = dx * fwdX + dz * fwdZ;
          const rgt = dx * rightX + dz * rightZ;
          const lx = carScreenX + rgt * scale;
          const ly = carScreenY - fwd * scale;

          if (lx >= 4 && lx <= cw - 4 && ly >= 4 && ly <= ch - 4) {
            ctx.fillStyle = beaconColors[b];
            ctx.beginPath();
            ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 2. Opponent Cars Projected in Car-Centric Coordinates
    for (const opp of opponentCars) {
      const odx = opp.x - carX;
      const odz = opp.z - carZ;
      const oFwd = odx * fwdX + odz * fwdZ;
      const oRgt = odx * rightX + odz * rightZ;
      const ox = carScreenX + oRgt * scale;
      const oy = carScreenY - oFwd * scale;

      if (ox >= 6 && ox <= cw - 6 && oy >= 6 && oy <= ch - 6) {
        // Outer halo
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox, oy, 3.4, 0, Math.PI * 2);
        ctx.fill();

        // Competitor colored core
        ctx.fillStyle = opp.color || '#eab308';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Competitor number tag
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2.0;
        ctx.strokeText(`${opp.number}`, ox + 5, oy + 3);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${opp.number}`, ox + 5, oy + 3);
      }
    }

    // 3. Player Vehicle Beacon: LOCKED FACING NORTH (Strictly UP along -Y axis)
    // Directional Pointer Arrow permanently points toward 12 o'clock / North
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(carScreenX, carScreenY - 11); // Tip strictly facing North
    ctx.lineTo(carScreenX - 5.5, carScreenY + 4.5); // Left fin
    ctx.lineTo(carScreenX, carScreenY + 2.0); // Center rear notch
    ctx.lineTo(carScreenX + 5.5, carScreenY + 4.5); // Right fin
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pulsing radar blip ring
    const pulse = 1 + 0.22 * Math.sin(performance.now() * 0.007);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(carScreenX, carScreenY, 6.0 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Motorsport Compass Rose (Geographic True North Indicator)
    const cx = 20, cy = 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();

    // True world North is (0, -1). In car local coordinates:
    // fwdNorth = -fwdZ, rightNorth = -rightZ
    const northAngle = Math.atan2(-rightZ, -fwdZ);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(northAngle);

    // Red North Needle
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.closePath();
    ctx.fill();

    // White South Needle
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 8);

    // 5. FIA Flag Status Pill (Top Right of Radar Box)
    this.drawFlagPill(ctx, cw, flagStatus, isFlashing);
  }

  /**
   * Static Full Track Birds-Eye Radar View (Toggleable via [N] or click).
   */
  private renderFullTrackMinimap(
    carX: number,
    carZ: number,
    carRotation: { x: number; y: number; z: number; w: number },
    trackId: string,
    flagStatus: string,
    opponentCars: Array<{ x: number; z: number; color: string; number: string }>
  ): void {
    const ctx = this.minimapCtx;
    const cw = this.minimapCanvas.width;
    const ch = this.minimapCanvas.height;

    ctx.clearRect(0, 0, cw, ch);

    if (trackId === 'proving_ground') {
      const pad = 20;
      const midY = ch / 2;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pad, midY);
      ctx.lineTo(cw - pad, midY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const x = pad + (i / 5) * (cw - 2 * pad);
        ctx.beginPath();
        ctx.moveTo(x, midY - 6);
        ctx.lineTo(x, midY + 6);
        ctx.stroke();
      }

      const normZ = Math.max(0, Math.min(5000, carZ)) / 5000;
      const carScreenX = pad + normZ * (cw - 2 * pad);
      const carScreenY = midY - (carX / 100) * 20;

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(carScreenX, carScreenY, 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const pts = this.cachedCenterlinePoints;
    if (pts.length > 0) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
    } else {
      minX = -3019; maxX = 3055; minZ = -1870; maxZ = 2950;
    }

    const spanX = Math.max(10, maxX - minX);
    const spanZ = Math.max(10, maxZ - minZ);
    const pad = 14;
    const scale = Math.min((cw - 2 * pad) / spanX, (ch - 2 * pad) / spanZ);
    const offsetX = (cw - spanX * scale) / 2;
    const offsetY = (ch - spanZ * scale) / 2;

    const isFlashing = Math.sin(performance.now() * 0.008) > 0;

    if (pts.length > 0) {
      const step = Math.max(1, Math.floor(pts.length / 450));
      const N = pts.length;
      const s1End = Math.floor(N / 3);
      const s2End = Math.floor((2 * N) / 3);

      const sectors = [
        {
          name: 'S1',
          start: 0,
          end: s1End,
          isYellow: flagStatus === 'SECTOR_1_YELLOW' || flagStatus === 'FULL_YELLOW',
        },
        {
          name: 'S2',
          start: s1End,
          end: s2End,
          isYellow: flagStatus === 'SECTOR_2_YELLOW' || flagStatus === 'FULL_YELLOW',
        },
        {
          name: 'S3',
          start: s2End,
          end: N,
          isYellow: flagStatus === 'SECTOR_3_YELLOW' || flagStatus === 'FULL_YELLOW',
        },
      ];

      for (const sec of sectors) {
        ctx.beginPath();
        let isFirst = true;
        for (let i = sec.start; i <= sec.end; i += step) {
          const pt = pts[Math.min(N - 1, i)];
          const sx = offsetX + (pt.x - minX) * scale;
          const sy = offsetY + (pt.z - minZ) * scale;
          if (isFirst) {
            ctx.moveTo(sx, sy);
            isFirst = false;
          } else {
            ctx.lineTo(sx, sy);
          }
        }

        if (flagStatus === 'RED') {
          ctx.strokeStyle = isFlashing ? '#ef4444' : '#991b1b';
          ctx.lineWidth = 2.4;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 6;
        } else if (sec.isYellow) {
          ctx.strokeStyle = isFlashing ? '#facc15' : '#ca8a04';
          ctx.lineWidth = 2.8;
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 6;
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 2.0;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
          ctx.shadowBlur = 4;
        }

        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Landmark Beacons
    if (pts.length > 0) {
      const beaconFractions = [0.0, 0.25, 0.5, 0.75];
      const beaconColors = ['#22c55e', '#c084fc', '#facc15', '#38bdf8'];
      for (let b = 0; b < beaconFractions.length; b++) {
        const sampleIdx = Math.floor(beaconFractions[b] * pts.length);
        const lmPt = pts[sampleIdx];
        const lx = offsetX + (lmPt.x - minX) * scale;
        const ly = offsetY + (lmPt.z - minZ) * scale;
        ctx.fillStyle = beaconColors[b];
        ctx.beginPath();
        ctx.arc(lx, ly, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Competitor dots
    for (const opp of opponentCars) {
      const ox = offsetX + (opp.x - minX) * scale;
      const oy = offsetY + (opp.z - minZ) * scale;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ox, oy, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = opp.color || '#eab308';
      ctx.beginPath();
      ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'left';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.0;
      ctx.strokeText(`${opp.number}`, ox + 4, oy + 3);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${opp.number}`, ox + 4, oy + 3);
    }

    // Player Vehicle Beacon with Heading Arrow
    const carScreenX = offsetX + (carX - minX) * scale;
    const carScreenY = offsetY + (carZ - minZ) * scale;

    const qx = carRotation.x, qy = carRotation.y, qz = carRotation.z, qw = carRotation.w;
    const fwdX = 2 * (qx * qz + qw * qy);
    const fwdZ = 1 - 2 * (qx * qx + qy * qy);
    const headingAngle = Math.atan2(fwdZ, fwdX);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(carScreenX, carScreenY, 7.0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(carScreenX, carScreenY, 3.8, 0, Math.PI * 2);
    ctx.fill();

    const arrowLen = 9;
    const tipX = carScreenX + Math.cos(headingAngle) * arrowLen;
    const tipY = carScreenY + Math.sin(headingAngle) * arrowLen;
    const leftX = carScreenX + Math.cos(headingAngle + 2.5) * 5;
    const leftY = carScreenY + Math.sin(headingAngle + 2.5) * 5;
    const rightX = carScreenX + Math.cos(headingAngle - 2.5) * 5;
    const rightY = carScreenY + Math.sin(headingAngle - 2.5) * 5;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();

    this.drawFlagPill(ctx, cw, flagStatus, isFlashing);
  }

  private drawFlagPill(ctx: CanvasRenderingContext2D, cw: number, flagStatus: string, isFlashing: boolean): void {
    let flagText = '🟢 ALL CLEAR';
    let flagBg = 'rgba(34, 197, 94, 0.25)';
    let flagBorder = '#22c55e';
    let flagColor = '#86efac';

    if (flagStatus === 'FULL_YELLOW') {
      flagText = '⚠️ FULL YELLOW (VSC)';
      flagBg = isFlashing ? 'rgba(234, 179, 8, 0.35)' : 'rgba(161, 98, 7, 0.2)';
      flagBorder = '#eab308';
      flagColor = '#fef08a';
    } else if (flagStatus === 'RED') {
      flagText = '🛑 RED FLAG';
      flagBg = isFlashing ? 'rgba(239, 68, 68, 0.4)' : 'rgba(153, 27, 27, 0.2)';
      flagBorder = '#ef4444';
      flagColor = '#fca5a5';
    } else if (flagStatus.startsWith('SECTOR_')) {
      const secNum = flagStatus.includes('1') ? 'S1' : flagStatus.includes('2') ? 'S2' : 'S3';
      flagText = `🟡 CAUTION ${secNum}`;
      flagBg = isFlashing ? 'rgba(250, 204, 21, 0.35)' : 'rgba(161, 98, 7, 0.2)';
      flagBorder = '#facc15';
      flagColor = '#fef08a';
    }

    ctx.fillStyle = flagBg;
    ctx.fillRect(cw - 128, 6, 120, 20);
    ctx.strokeStyle = flagBorder;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cw - 128, 6, 120, 20);
    ctx.fillStyle = flagColor;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(flagText, cw - 68, 19);
  }

  private async generateQRCode(): Promise<void> {
    const canvas = this.container.querySelector('#qr-canvas') as HTMLCanvasElement;
    const urlText = this.container.querySelector('#qr-url-text') as HTMLElement;
    if (!canvas) return;

    let controllerUrl = `${window.location.origin}/controller.html`;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const resp = await fetch('/api/network-info');
        if (resp.ok) {
          const info = await resp.json();
          if (info.controllerUrl) {
            controllerUrl = info.controllerUrl;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch network info for QR code', e);
      }
    }

    urlText.innerText = controllerUrl;

    try {
      await QRCode.toCanvas(canvas, controllerUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  }

  public update(data: HudData): void {
    const speedKmh = Math.abs(Math.round(data.telemetry.speedKmh));
    const speedMs = (Math.abs(data.telemetry.speedKmh) / 3.6).toFixed(1);

    this.speedDigits.innerText = speedKmh.toString();
    this.speedMsDigits.innerText = `${speedMs} m/s`;

    let gearText = 'N';
    if (data.telemetry.gear === -1) gearText = 'R';
    else if (data.telemetry.gear > 0) gearText = data.telemetry.gear.toString();
    this.gearNumeral.innerText = gearText;

    const rpmPercent = Math.min(100, Math.max(0, data.telemetry.rpmRatio * 100));
    this.rpmBar.style.width = `${rpmPercent}%`;

    this.rpmBar.classList.remove('rpm-normal', 'rpm-warn', 'rpm-shift-flash');
    if (data.telemetry.isShiftLightActive) {
      this.rpmBar.classList.add('rpm-shift-flash');
    } else if (rpmPercent > 85) {
      this.rpmBar.classList.add('rpm-warn');
    } else {
      this.rpmBar.classList.add('rpm-normal');
    }

    this.fpsDisplay.innerText = Math.round(data.fps).toString();

    if (data.phoneConnected || this.qrDismissed) {
      this.phoneStatusBadge.innerText = data.phoneConnected ? 'PHONE: CONNECTED' : 'KEYBOARD (WASD)';
      this.phoneStatusBadge.className = data.phoneConnected ? 'status-indicator status-connected' : 'status-indicator';
      this.qrContainer.style.display = 'none';
      this.qrContainer.style.opacity = '0';
      this.qrContainer.style.pointerEvents = 'none';
    } else {
      this.phoneStatusBadge.innerText = 'PHONE: WAITING';
      this.phoneStatusBadge.className = 'status-indicator status-waiting';
      this.qrContainer.style.display = 'flex';
      this.qrContainer.style.opacity = '1';
      this.qrContainer.style.pointerEvents = 'auto';
    }

    this.camModeDisplay.innerText = `CAM: ${data.cameraMode.toUpperCase()}`;

    const dist = data.telemetry.distanceM ?? 0;
    if (dist >= 1000) {
      this.distanceDisplay.innerText = `${(dist / 1000).toFixed(2)} km`;
    } else {
      this.distanceDisplay.innerText = `${Math.round(dist)} m`;
    }

    if (data.trackName.toLowerCase().includes('nordschleife') || data.trackName.toLowerCase().includes('24h')) {
      this.distLabel.innerText = 'LAP DIST:';
      this.landmarkRow.style.display = 'flex';
      this.landmarkDisplay.innerText = data.landmarkName || '--';
      this.lapRow.style.display = 'flex';
      this.lapTimeDisplay.innerText = formatLapTime(data.lapTimeMs);
      this.bestRow.style.display = 'flex';
      this.bestTimeDisplay.innerText = formatLapTime(data.bestLapTimeMs);
      this.lastTimeDisplay.innerText = formatLapTime(data.lastLapTimeMs);
      this.sprintRow.style.display = 'none';

      if (data.isLapValid === false) {
        this.lapStatusBadge.innerText = 'INVALID';
        this.lapStatusBadge.style.background = '#ef4444';
        this.lapStatusBadge.style.color = '#fff';
      } else {
        this.lapStatusBadge.innerText = 'VALID';
        this.lapStatusBadge.style.background = '#22c55e';
        this.lapStatusBadge.style.color = '#fff';
      }
    } else {
      this.distLabel.innerText = 'RUNWAY DIST:';
      this.landmarkRow.style.display = 'none';
      this.lapRow.style.display = 'none';
      this.bestRow.style.display = 'none';
      this.sprintRow.style.display = 'flex';

      if (data.telemetry.sprint0to100Time !== null && data.telemetry.sprint0to100Time !== undefined) {
        this.sprintTimeDisplay.innerText = `${data.telemetry.sprint0to100Time.toFixed(2)}s`;
      } else {
        this.sprintTimeDisplay.innerText = '--';
      }

      if (data.telemetry.sprint0to200Time !== null && data.telemetry.sprint0to200Time !== undefined) {
        this.sprint200TimeDisplay.innerText = `${data.telemetry.sprint0to200Time.toFixed(2)}s`;
      } else {
        this.sprint200TimeDisplay.innerText = '--';
      }
    }

    if (this.maxSpeedDisplay) {
      const maxSpeed = Math.round(data.telemetry.maxSpeedKmh ?? 0);
      this.maxSpeedDisplay.innerText = `${maxSpeed} km/h`;
    }
  }

  public setPaintName(name: string): void {
    if (this.paintButton) {
      this.paintButton.textContent = `LIVERY: ${name.toUpperCase()} [P]`;
    }
  }
}
