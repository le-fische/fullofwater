import QRCode from 'qrcode';
import { TrackMode, WeatherCondition } from '../../common/types';
import { PRESET_LIVERIES } from '../render/livery-system';
import { DriverManager } from '../auth/driver-manager';
import { formatCountryBadge } from '../../common/auth/countries';
import { isDeveloperTag } from '../../common/auth/driver-types';

export interface MainMenuOptions {
  onStartRace: (
    track: TrackMode,
    liveryIndex: number,
    carNumber: string,
    weather: WeatherCondition,
    timeOfDayHours: number,
    lapCount: number,
    mode: string
  ) => void;
  onLiveryChanged: (liveryIndex: number, carNumber: string) => void;
  onCarNumberChanged: (carNumber: string) => void;
  onOpenMultiplayer: () => void;
  onOpenLeaderboard?: () => void;
  onOpenDriverProfile?: () => void;
  driverManager?: DriverManager;
}

interface TrackCardSpec {
  id: TrackMode;
  name: string;
  length: string;
  turns: string;
  startFormat: string;
}

const TRACK_CARDS: TrackCardSpec[] = [
  {
    id: TrackMode.NORDSCHLEIFE,
    name: 'Nürburgring Nordschleife',
    length: '20.8 KM',
    turns: '73 TURNS',
    startFormat: 'F1 5-RED-LIGHT STANDING',
  },
  {
    id: TrackMode.NURBURGRING_24H,
    name: 'Nürburgring 24h Gesamtkurs',
    length: '25.4 KM',
    turns: '89 TURNS',
    startFormat: 'F1 5-RED-LIGHT STANDING',
  },
  {
    id: TrackMode.GP_STRECKE,
    name: 'Nürburgring GP-Strecke',
    length: '5.1 KM',
    turns: '16 TURNS',
    startFormat: 'F1 5-RED-LIGHT STANDING',
  },
  {
    id: TrackMode.PROVING_GROUND,
    name: 'High-Speed Proving Ground',
    length: '6.0 KM',
    turns: 'RUNWAY',
    startFormat: 'STANDING START',
  },
];

export interface ClassSpec {
  id: string;
  name: string;
  carName: string;
  specs: string;
  status: 'active' | 'coming_soon';
}

const CLASS_ROSTER: ClassSpec[] = [
  {
    id: 'gt3_gte',
    name: 'GT3 / GTE CLASS',
    carName: 'Porsche 911 RSR-19 (992)',
    specs: '515 HP • 4.2L Boxer • 1,245 kg • Swan-Neck GTE Aero',
    status: 'active',
  },
  {
    id: 'hypercar',
    name: 'HYPERCAR / LMDh',
    carName: 'Porsche 963 LMDh',
    specs: '680 HP • 4.6L Twin-Turbo V8 Hybrid • 1,030 kg',
    status: 'coming_soon',
  },
  {
    id: 'formula1',
    name: 'FORMULA SINGLE-SEATER',
    carName: 'Grand Prix Concept 2026',
    specs: '1,000 HP • 1.6L V6 Turbo Hybrid • Ground Effect',
    status: 'coming_soon',
  },
  {
    id: 'cup',
    name: 'PORSCHE CARRERA CUP',
    carName: '911 GT3 Cup (Type 992)',
    specs: '510 HP • 4.0L Boxer • Pure Racing Spec (No ABS/TC)',
    status: 'coming_soon',
  },
  {
    id: 'gt4',
    name: 'GT4 CLUBSPORT',
    carName: '718 Cayman GT4 RS Clubsport',
    specs: '500 HP • 4.0L Boxer • Lightweight Carbon Chassis',
    status: 'coming_soon',
  },
];

export class MainMenu {
  private container: HTMLElement;
  private rootElement: HTMLElement;
  private options: MainMenuOptions;

  // View state: 'landing' (Option portal) or 'singleplayer' (Stepped wizard)
  private viewMode: 'landing' | 'singleplayer' = 'landing';
  private currentStep: number = 1; // 1 to 5
  private readonly totalSteps: number = 5;

  // Selected parameters
  private selectedClass: string = 'gt3_gte';
  private selectedTrack: TrackMode = TrackMode.NORDSCHLEIFE;
  private selectedLiveryIndex: number = 0; // #80 Rexy Green
  private selectedCarNumber: string = PRESET_LIVERIES[0].carNumber;
  private selectedMode: string = 'quick_race';
  private selectedLapCount: number = 3;
  private selectedWeather: WeatherCondition = 'clear';
  private selectedTimeOfDay: number = 12.0; // 12:00 High Noon

  private isPhoneConnected: boolean = false;
  private isQrModalOpen: boolean = false;

  constructor(container: HTMLElement, options: MainMenuOptions) {
    this.container = container;
    this.options = options;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'main-menu-root';
    this.container.appendChild(this.rootElement);

    this.render();
    this.bindEvents();
    this.generateQrCode();
  }

  public setPhoneConnected(connected: boolean): void {
    this.isPhoneConnected = connected;
    const pill = this.rootElement.querySelector('#menu-controller-status');
    if (pill) {
      pill.className = `menu-pill ${connected ? 'menu-pill-green' : 'menu-pill-standby'}`;
      const text = pill.querySelector('.status-text');
      if (text) text.textContent = connected ? 'WHEEL LINKED' : 'KEYBOARD / WHEEL';
    }
  }

  public getSelectedTrack(): TrackMode {
    return this.selectedTrack;
  }

  public getSelectedLiveryIndex(): number {
    return this.selectedLiveryIndex;
  }

  public getSelectedCarNumber(): string {
    return this.selectedCarNumber;
  }

  public getSelectedWeather(): WeatherCondition {
    return this.selectedWeather;
  }

  public getSelectedTimeOfDay(): number {
    return this.selectedTimeOfDay;
  }

  public getSelectedLapCount(): number {
    return this.selectedLapCount;
  }

  public getSelectedMode(): string {
    return this.selectedMode;
  }

  public show(): void {
    this.rootElement.style.display = 'flex';
  }

  public hide(): void {
    this.rootElement.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.rootElement.style.display !== 'none';
  }

  public setLiveryIndex(index: number): void {
    this.selectLivery(index);
  }

  public selectLivery(index: number): void {
    if (index < 0 || index >= PRESET_LIVERIES.length) return;
    this.selectedLiveryIndex = index;
    const liv = PRESET_LIVERIES[index];
    this.selectedCarNumber = liv.carNumber;
    this.options.onLiveryChanged(index, this.selectedCarNumber);

    const titleEl = this.rootElement.querySelector('#menu-active-livery-name');
    if (titleEl) titleEl.textContent = liv.name;

    const btns = this.rootElement.querySelectorAll('.livery-swatch-btn');
    btns.forEach((btn, i) => {
      btn.classList.toggle('livery-swatch-active', i === index);
    });

    this.syncCarNumberUI(true);
  }

  private render(): void {
    if (this.viewMode === 'landing') {
      this.renderLandingPortal();
    } else {
      this.renderSingleplayerWizard();
    }
  }

  private renderLandingPortal(): void {
    this.rootElement.innerHTML = `
      <!-- Top Studio Header Bar -->
      <header class="menu-header">
        <div class="menu-brand">
          <span class="menu-logo-mark">FULL OF WATER</span>
          <span class="menu-brand-sep"></span>
          <span class="menu-title">MOTORSPORT SIMULATOR</span>
          <span class="menu-model-tag">FIA SIM-LITE</span>
        </div>

        <div class="menu-header-actions">
          ${this.renderHeaderActionsMarkup()}
        </div>
      </header>

      <!-- Center Landing Portal Choice Cards -->
      <div class="landing-portal-wrap">
        <div class="landing-headline-block">
          <span class="landing-badge">FULL OF WATER • MOTORSPORT SIMULATION</span>
          <h1 class="landing-title">SELECT RACING PLATFORM</h1>
          <p class="landing-sub">Experience dedicated singleplayer career & time attack simulations or enter a 10-car private multiplayer paddock with pre-race qualifying.</p>
        </div>

        <div class="landing-cards-row">
          <!-- Card 1: Singleplayer -->
          <div class="landing-card landing-card-sp" id="landing-btn-sp">
            <div class="landing-card-top">
              <span class="landing-card-tag tag-sp">SOLO SIMULATION</span>
              <span class="landing-arrow-tag">STEPPED SETUP &rarr;</span>
            </div>
            <h2 class="landing-card-title">SINGLEPLAYER CAREER</h2>
            <p class="landing-card-desc">
              Stepped paddock preparation: Select motorsport class &rarr; vehicle livery &rarr; circuit &rarr; lap count/mode &rarr; dynamic weather & time of day. Direct ingress into race start.
            </p>
            <div class="landing-feature-chips">
              <span>5-Step Sim Setup</span>
              <span>Direct Session Ingress</span>
              <span>Standing Starts</span>
              <span>Local Ghost Lap</span>
            </div>
            <div class="landing-card-cta cta-sp">
              <span>ENTER SINGLEPLAYER SETUP</span>
              <span class="cta-arrow">&rarr;</span>
            </div>
          </div>

          <!-- Card 2: Multiplayer -->
          <div class="landing-card landing-card-mp" id="landing-btn-mp">
            <div class="landing-card-top">
              <span class="landing-card-tag tag-mp">PRIVATE 4-DIGIT PADDOCK</span>
              <span class="landing-arrow-tag">UP TO 10 CARS &rarr;</span>
            </div>
            <h2 class="landing-card-title">MULTIPLAYER PADDOCK</h2>
            <p class="landing-card-desc">
              Connect up to 10 competitors via private 4-digit PIN. 2-Stage Ready system: Drivers ready up &rarr; Host launches Qualifying Hotlap &rarr; Drivers ready up &rarr; Race starts on seeded grid slots P1&ndash;P10.
            </p>
            <div class="landing-feature-chips">
              <span>4-Digit Room PIN</span>
              <span>10-Car Grid Limit</span>
              <span>Pre-Race Qualifying</span>
              <span>Seeded Grid P1&ndash;P10</span>
            </div>
            <div class="landing-card-cta cta-mp">
              <span>OPEN MULTIPLAYER PADDOCK</span>
              <span class="cta-arrow">&rarr;</span>
            </div>
          </div>

          <!-- Card 3: Leaderboard -->
          <div class="landing-card landing-card-lb" id="landing-btn-lb" style="border-color: rgba(245, 158, 11, 0.35);">
            <div class="landing-card-top">
              <span class="landing-card-tag tag-lb" style="background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #f59e0b;">GLOBAL HOTLAP MATRIX</span>
              <span class="landing-arrow-tag" style="color: #f59e0b;">VERIFIED RECORDS &rarr;</span>
            </div>
            <h2 class="landing-card-title">GLOBAL LEADERBOARDS</h2>
            <p class="landing-card-desc">
              Inspect verified alien hotlap telemetry across all surveyed circuits, car classes, and input categories. Download the #1 World Record ghost directly into your session to study apex lines.
            </p>
            <div class="landing-feature-chips">
              <span>Verified Sector Times</span>
              <span>Anti-Cheat Validated</span>
              <span>Race WR Ghosts</span>
              <span>Driver Lifetime Stats</span>
            </div>
            <div class="landing-card-cta cta-lb" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
              <span>VIEW GLOBAL LEADERBOARDS</span>
              <span class="cta-arrow">&rarr;</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3D Turntable Viewport Controls Hint -->
      <div class="showroom-viewport-hint">
        <span class="hint-icon">⤾</span>
        <span>DRAG TO ROTATE &bull; SCROLL TO ZOOM</span>
      </div>

      <!-- QR Code Modal Backdrop -->
      ${this.renderQrModalMarkup()}
    `;
  }

  private renderSingleplayerWizard(): void {
    const activeLivery = PRESET_LIVERIES[this.selectedLiveryIndex];

    this.rootElement.innerHTML = `
      <!-- Top Studio Header Bar with Steps Tracker -->
      <header class="menu-header">
        <div class="menu-brand">
          <button id="wizard-home-btn" class="wizard-back-home-btn" type="button" title="Return to Portal">
            &larr; MAIN MENU
          </button>
          <span class="menu-brand-sep"></span>
          <span class="menu-title">SINGLEPLAYER SIMULATION</span>
          <span class="menu-model-tag">STEP ${this.currentStep} OF ${this.totalSteps}</span>
        </div>

        <!-- Wizard Steps Breadcrumb Nav -->
        <nav class="wizard-steps-nav">
          <button class="step-pill ${this.currentStep === 1 ? 'step-pill-active' : (this.currentStep > 1 ? 'step-pill-done' : '')}" data-goto-step="1">1. CLASS</button>
          <span class="step-arrow">&rarr;</span>
          <button class="step-pill ${this.currentStep === 2 ? 'step-pill-active' : (this.currentStep > 2 ? 'step-pill-done' : '')}" data-goto-step="2">2. VEHICLE</button>
          <span class="step-arrow">&rarr;</span>
          <button class="step-pill ${this.currentStep === 3 ? 'step-pill-active' : (this.currentStep > 3 ? 'step-pill-done' : '')}" data-goto-step="3">3. CIRCUIT</button>
          <span class="step-arrow">&rarr;</span>
          <button class="step-pill ${this.currentStep === 4 ? 'step-pill-active' : (this.currentStep > 4 ? 'step-pill-done' : '')}" data-goto-step="4">4. LAPS / MODE</button>
          <span class="step-arrow">&rarr;</span>
          <button class="step-pill ${this.currentStep === 5 ? 'step-pill-active' : (this.currentStep > 5 ? 'step-pill-done' : '')}" data-goto-step="5">5. CONDITIONS</button>
        </nav>

        <div class="menu-header-actions">
          ${this.renderHeaderActionsMarkup()}
        </div>
      </header>

      <!-- Left Docked Wizard Column -->
      <div class="wizard-sidebar">
        <!-- Main Body Panels: Dynamic based on step -->
        <div class="menu-body wizard-body">
        
        <!-- STEP 1: CLASS SELECTION -->
        <div class="wizard-pane ${this.currentStep === 1 ? 'pane-active' : 'pane-hidden'}" id="pane-step-1">
          <div class="panel-header">
            <h2 class="panel-title">SELECT MOTORSPORT CATEGORY</h2>
            <span class="panel-header-meta">HOMOLOGATION</span>
          </div>
          <div class="class-cards-grid">
            ${CLASS_ROSTER.map((cls) => `
              <div class="class-card ${cls.id === this.selectedClass ? 'class-card-active' : ''} ${cls.status === 'coming_soon' ? 'class-card-locked' : ''}" data-class-id="${cls.id}">
                <div class="class-card-header">
                  <span class="class-name">${cls.name}</span>
                  <span class="class-status-badge ${cls.status === 'active' ? 'status-active' : 'status-locked'}">${cls.status === 'active' ? 'HOMOLOGATED' : 'PHASE 5'}</span>
                </div>
                <div class="class-car-name">${cls.carName}</div>
                <div class="class-specs-text">${cls.specs}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- STEP 2: VEHICLE & LIVERY STUDIO -->
        <div class="wizard-pane ${this.currentStep === 2 ? 'pane-active' : 'pane-hidden'}" id="pane-step-2">
          <div class="panel-header">
            <h2 class="panel-title">PORSCHE 911 RSR-19 (GTE)</h2>
            <span class="panel-header-meta">360° SHOWROOM STAGE</span>
          </div>
          <div class="specs-strip">
            <div class="spec-item"><span class="spec-val">515 <small>HP</small></span><span class="spec-lbl">POWER</span></div>
            <div class="spec-item"><span class="spec-val">9,000</span><span class="spec-lbl">MAX RPM</span></div>
            <div class="spec-item"><span class="spec-val">318 <small>KM/H</small></span><span class="spec-lbl">TOP SPEED</span></div>
            <div class="spec-item"><span class="spec-val">1,245 <small>KG</small></span><span class="spec-lbl">DRY MASS</span></div>
          </div>
          <div class="livery-section">
            <div class="livery-section-header">
              <span class="panel-eyebrow">FACTORY RACING LIVERY</span>
              <span id="menu-active-livery-name" class="active-livery-title">${activeLivery.name}</span>
            </div>
            <div class="livery-swatches">
              ${PRESET_LIVERIES.map((liv, idx) => `
                <button class="livery-swatch-btn ${idx === this.selectedLiveryIndex ? 'livery-swatch-active' : ''}" data-livery-idx="${idx}" title="${liv.name} #${liv.carNumber}" type="button">
                  <span class="swatch-chip">
                    <span class="swatch-half" style="background: ${liv.primaryColor}"></span>
                    <span class="swatch-half" style="background: ${liv.secondaryColor}"></span>
                  </span>
                  <span class="swatch-number">#${liv.carNumber}</span>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="car-number-section">
            <div class="livery-section-header">
              <span class="panel-eyebrow">COMPETITION NO.</span>
            </div>
            <div class="number-input-row">
              <div class="number-input-wrap">
                <span class="hash-prefix">#</span>
                <input id="custom-car-number-input" type="text" maxlength="3" value="${this.selectedCarNumber}" placeholder="80" class="custom-number-field" aria-label="Custom Race Number" />
              </div>
              <div class="quick-number-pills">
                ${['80', '911', '77', '1', '92', '20', '93', '00'].map((num) => `
                  <button class="quick-num-btn ${this.selectedCarNumber === num ? 'quick-num-active' : ''}" data-quick-num="${num}" type="button">#${num}</button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 3: CIRCUIT SELECTION -->
        <div class="wizard-pane ${this.currentStep === 3 ? 'pane-active' : 'pane-hidden'}" id="pane-step-3">
          <div class="panel-header">
            <h2 class="panel-title">SELECT RACING CIRCUIT</h2>
            <span class="panel-header-meta">SURVEYED PROFILES</span>
          </div>
          <div class="track-card-list">
            ${TRACK_CARDS.map((track) => `
              <div class="track-card ${track.id === this.selectedTrack ? 'track-card-active' : ''}" data-track-id="${track.id}">
                <div class="track-name">${track.name}</div>
                <div class="track-meta">
                  <span>${track.length}</span>
                  <span class="meta-sep">·</span>
                  <span>${track.turns}</span>
                  <span class="meta-sep">·</span>
                  <span class="track-start-format">${track.startFormat}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- STEP 4: MODE & LAPS -->
        <div class="wizard-pane ${this.currentStep === 4 ? 'pane-active' : 'pane-hidden'}" id="pane-step-4">
          <div class="panel-header">
            <h2 class="panel-title">RACE MODE & DISTANCE</h2>
            <span class="panel-header-meta">RULES</span>
          </div>
          <div class="mode-options-grid">
            <div class="mode-card ${this.selectedMode === 'quick_race' ? 'mode-card-active' : ''}" data-mode-id="quick_race">
              <div class="mode-card-title">QUICK RACE</div>
              <div class="mode-card-desc">F1 5-red-light standing start sequence with launch clamp against ghost peer.</div>
            </div>
            <div class="mode-card ${this.selectedMode === 'time_attack' ? 'mode-card-active' : ''}" data-mode-id="time_attack">
              <div class="mode-card-title">TIME TRIAL / HOTLAP</div>
              <div class="mode-card-desc">Official global ranking. Standardized benchmark conditions: always Sunny Noon (12:00) &amp; Optimal Dry Asphalt.</div>
            </div>
            <div class="mode-card ${this.selectedMode === 'practice' ? 'mode-card-active' : ''}" data-mode-id="practice">
              <div class="mode-card-title">FREE PRACTICE</div>
              <div class="mode-card-desc">Unlimited laps, relaxed tire/engine thermal monitoring, and track familiarization.</div>
            </div>
          </div>
          <div class="lap-slider-wrap">
            <div class="lap-slider-header">
              <span class="panel-eyebrow">RACE DISTANCE (LAPS)</span>
              <span class="lap-count-val" id="menu-lap-count-display">${this.selectedLapCount} LAPS</span>
            </div>
            <input type="range" min="1" max="25" value="${this.selectedLapCount}" id="menu-lap-slider" class="sim-range-slider" />
            <div class="lap-range-meta">
              <span>1 LAP (SPRINT)</span>
              <span>10 LAPS</span>
              <span>25 LAPS (ENDURANCE)</span>
            </div>
          </div>
        </div>

        <!-- STEP 5: WEATHER & TIME OF DAY -->
        <div class="wizard-pane ${this.currentStep === 5 ? 'pane-active' : 'pane-hidden'}" id="pane-step-5">
          <div class="panel-header">
            <h2 class="panel-title">CONDITIONS & DIRECT INGRESS</h2>
            <span class="panel-header-meta">ATMOSPHERE</span>
          </div>
          <div class="env-settings-grid">
            <div class="env-card-section">
              <span class="panel-eyebrow">WEATHER & SURFACE</span>
              <div class="env-btn-row">
                <button class="env-choice-btn ${this.selectedWeather === 'clear' ? 'env-choice-active' : ''}" data-weather="clear" type="button">
                  ☀️ CLEAR SKY<small>100% Grip</small>
                </button>
                <button class="env-choice-btn ${this.selectedWeather === 'drizzle' ? 'env-choice-active' : ''}" data-weather="drizzle" type="button">
                  ☁️ OVERCAST<small>Cooler Track</small>
                </button>
                <button class="env-choice-btn ${this.selectedWeather === 'heavy_rain' ? 'env-choice-active' : ''}" data-weather="heavy_rain" type="button">
                  🌧️ HEAVY RAIN<small>-40% Wet Grip</small>
                </button>
              </div>
            </div>

            <div class="env-card-section">
              <span class="panel-eyebrow">SESSION TIME OF DAY</span>
              <div class="env-btn-row">
                <button class="env-choice-btn ${this.selectedTimeOfDay === 12.0 ? 'env-choice-active' : ''}" data-time="12.0" type="button">
                  12:00 NOON<small>Direct Sun</small>
                </button>
                <button class="env-choice-btn ${this.selectedTimeOfDay === 19.5 ? 'env-choice-active' : ''}" data-time="19.5" type="button">
                  19:30 SUNSET<small>Golden Light</small>
                </button>
                <button class="env-choice-btn ${this.selectedTimeOfDay === 23.5 ? 'env-choice-active' : ''}" data-time="23.5" type="button">
                  23:30 MIDNIGHT<small>280m High-Beams</small>
                </button>
                <button class="env-choice-btn ${this.selectedTimeOfDay === 6.5 ? 'env-choice-active' : ''}" data-time="6.5" type="button">
                  06:30 DAWN<small>Morning Mist</small>
                </button>
              </div>
            </div>
          </div>

          <!-- Direct Ingress CTA Block (0 Buffer) -->
          <div class="direct-launch-banner">
            <div class="direct-launch-info">
              <div class="direct-launch-badge">DIRECT SESSION INGRESS &bull; ZERO BUFFER</div>
              <div class="direct-launch-desc">Setup locked. Spawns directly on track into format-specific starting procedure with no artificial delay.</div>
            </div>
            <button id="menu-start-btn" class="menu-btn-launch" type="button">
              <span class="launch-text">ENTER CIRCUIT &bull; START RACE</span>
              <span class="launch-kbd">ENTER</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Wizard Navigation Footer -->
      <footer class="wizard-footer">
        <button id="wizard-prev-step-btn" class="wizard-nav-btn wizard-prev-btn" type="button" ${this.currentStep === 1 ? 'disabled style="opacity:0.3;"' : ''}>
          &larr; PREVIOUS STEP
        </button>

        <span class="wizard-step-tag">STEP ${this.currentStep} OF ${this.totalSteps}</span>

        ${this.currentStep < this.totalSteps ? `
          <button id="wizard-next-step-btn" class="wizard-nav-btn wizard-next-btn" type="button">
            NEXT STEP &rarr;
          </button>
        ` : `
          <button id="wizard-launch-step-btn" class="wizard-nav-btn wizard-launch-btn" type="button">
            ENTER CIRCUIT &rarr;
          </button>
        `}
      </footer>
      </div>

      <!-- 3D Turntable Viewport Controls Hint -->
      <div class="showroom-viewport-hint">
        <span class="hint-icon">⤾</span>
        <span>DRAG TO ROTATE &bull; SCROLL TO ZOOM</span>
      </div>

      <!-- QR Code Modal Backdrop -->
      ${this.renderQrModalMarkup()}
    `;
  }

  private renderHeaderActionsMarkup(): string {
    const dm = this.options.driverManager;
    const acc = dm?.getAccount();
    const tag = dm?.getDriverTag() || 'GUEST';
    const isGuest = dm?.isGuest() ?? true;
    const country = acc?.countryCode || 'GLOBAL';
    const isDev = acc?.isDeveloper || isDeveloperTag(tag);
    const color = acc?.avatarColor || (isDev ? '#f59e0b' : '#38bdf8');

    return `
      <!-- Phase I: Driver Identity Passport Pill -->
      <div id="menu-driver-passport-pill" class="menu-driver-pill" title="View Driver Passport & Lifetime Stats">
        <span class="menu-driver-avatar" style="background-color: ${color};"></span>
        <span class="menu-driver-tag">${tag}</span>
        ${isDev ? '<span class="dev-badge-xs">DEV</span>' : ''}
        <span class="menu-driver-country">${formatCountryBadge(country)}</span>
        ${isGuest ? '<button class="menu-claim-btn" id="header-claim-license-btn" type="button">CLAIM</button>' : ''}
      </div>

      <!-- Phase I: Global Hotlap Leaderboard Button -->
      <button id="menu-leaderboard-btn" class="menu-btn-secondary" type="button" title="View Global Hotlap Leaderboards">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7"></path>
          <path d="M14 14.66V17c0 .55.45 1 1 1h2"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
        </svg>
        <span>LEADERBOARDS</span>
      </button>

      <div id="menu-controller-status" class="menu-pill ${this.isPhoneConnected ? 'menu-pill-green' : 'menu-pill-standby'}">
        <span class="status-dot"></span>
        <span class="status-text">${this.isPhoneConnected ? 'WHEEL LINKED' : 'KEYBOARD / WHEEL'}</span>
      </div>

      <button id="menu-qr-toggle-btn" class="menu-btn-secondary" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
          <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2M19 14v2"></path>
        </svg>
        <span>PAIR PHONE</span>
      </button>
    `;
  }

  private renderQrModalMarkup(): string {
    const dm = this.options.driverManager;
    const tag = dm?.getDriverTag() || 'GUEST';
    const pairToken = dm?.getActivePairToken() || '------';

    return `
      <div id="menu-qr-modal" class="menu-modal-backdrop" style="display: ${this.isQrModalOpen ? 'flex' : 'none'};">
        <div class="menu-modal-card">
          <div class="modal-header">
            <h3>AUTOMATED PHONE CONTROLLER PAIRING</h3>
            <button id="menu-qr-close-btn" class="modal-close-btn" aria-label="Close" type="button">✕</button>
          </div>
          <p class="modal-desc">Scan with your phone camera or connect with Driver Tag: <strong>${tag}</strong>.</p>
          <div class="qr-box">
            <canvas id="menu-qr-canvas"></canvas>
          </div>
          <div id="menu-qr-pin-wrap" style="text-align: center; margin: 10px 0 4px 0; font-size: 11px; color: #94a3b8;">
            AUTOMATED SESSION PIN: <strong id="menu-qr-pin-code" style="color: #38bdf8; font-family: monospace; font-size: 16px; letter-spacing: 2px;">${pairToken}</strong>
          </div>
          <div id="menu-qr-url" class="modal-tip"></div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // 1. Landing View Events
    if (this.viewMode === 'landing') {
      const spBtn = this.rootElement.querySelector('#landing-btn-sp');
      spBtn?.addEventListener('click', () => {
        this.viewMode = 'singleplayer';
        this.currentStep = 1;
        this.render();
        this.bindEvents();
      });

      const mpBtn = this.rootElement.querySelector('#landing-btn-mp');
      mpBtn?.addEventListener('click', () => {
        this.options.onOpenMultiplayer();
      });

      const lbCardBtn = this.rootElement.querySelector('#landing-btn-lb');
      lbCardBtn?.addEventListener('click', () => {
        this.options.onOpenLeaderboard?.();
      });
    }

    // 2. Wizard Navigation Events
    const homeBtn = this.rootElement.querySelector('#wizard-home-btn');
    homeBtn?.addEventListener('click', () => {
      this.viewMode = 'landing';
      this.render();
      this.bindEvents();
    });

    const prevBtn = this.rootElement.querySelector('#wizard-prev-step-btn');
    prevBtn?.addEventListener('click', () => {
      if (this.currentStep > 1) {
        this.currentStep--;
        this.render();
        this.bindEvents();
      }
    });

    const nextBtn = this.rootElement.querySelector('#wizard-next-step-btn');
    nextBtn?.addEventListener('click', () => {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        this.render();
        this.bindEvents();
      }
    });

    const stepPills = this.rootElement.querySelectorAll('.step-pill');
    stepPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const step = parseInt(pill.getAttribute('data-goto-step') || '1', 10);
        this.currentStep = step;
        this.render();
        this.bindEvents();
      });
    });

    // Step 1: Class Selection
    const classCards = this.rootElement.querySelectorAll('.class-card:not(.class-card-locked)');
    classCards.forEach((card) => {
      card.addEventListener('click', () => {
        const classId = card.getAttribute('data-class-id');
        if (classId) {
          this.selectedClass = classId;
          this.rootElement.querySelectorAll('.class-card').forEach((c) => c.classList.remove('class-card-active'));
          card.classList.add('class-card-active');
        }
      });
    });

    // Step 2: Livery and Race Number
    const liveryBtns = this.rootElement.querySelectorAll('.livery-swatch-btn');
    liveryBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-livery-idx') || '0', 10);
        this.selectLivery(idx);
      });
    });

    const numberInput = this.rootElement.querySelector('#custom-car-number-input') as HTMLInputElement;
    if (numberInput) {
      numberInput.addEventListener('input', () => {
        const clean = numberInput.value.replace(/[^0-9]/g, '').slice(0, 3);
        numberInput.value = clean;
        this.selectedCarNumber = clean || '80';
        this.syncCarNumberUI(false);
        this.options.onCarNumberChanged(this.selectedCarNumber);
      });
    }

    const quickNumBtns = this.rootElement.querySelectorAll('.quick-num-btn');
    quickNumBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-quick-num') || '80';
        this.selectedCarNumber = num;
        this.syncCarNumberUI(true);
        this.options.onCarNumberChanged(num);
      });
    });

    // Step 3: Circuit Selection
    const trackCards = this.rootElement.querySelectorAll('.track-card');
    trackCards.forEach((card) => {
      card.addEventListener('click', () => {
        const trackId = card.getAttribute('data-track-id') as TrackMode;
        if (trackId) {
          this.selectedTrack = trackId;
          this.rootElement.querySelectorAll('.track-card').forEach((c) => c.classList.remove('track-card-active'));
          card.classList.add('track-card-active');
        }
      });
    });

    // Step 4: Mode & Laps
    const modeCards = this.rootElement.querySelectorAll('.mode-card');
    modeCards.forEach((card) => {
      card.addEventListener('click', () => {
        const modeId = card.getAttribute('data-mode-id') || 'quick_race';
        this.selectedMode = modeId;
        this.rootElement.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('mode-card-active'));
        card.classList.add('mode-card-active');

        // Standardized Time Trial conditions: Sunny Noon (12:00) & Dry Asphalt
        if (modeId === 'time_attack') {
          this.selectedWeather = 'clear';
          this.selectedTimeOfDay = 12.0;
          this.rootElement.querySelectorAll('[data-weather]').forEach((b) => {
            b.classList.toggle('env-choice-active', b.getAttribute('data-weather') === 'clear');
          });
          this.rootElement.querySelectorAll('[data-time]').forEach((b) => {
            b.classList.toggle('env-choice-active', b.getAttribute('data-time') === '12.0');
          });
        }
      });
    });

    const lapSlider = this.rootElement.querySelector('#menu-lap-slider') as HTMLInputElement;
    const lapDisplay = this.rootElement.querySelector('#menu-lap-count-display');
    if (lapSlider && lapDisplay) {
      lapSlider.addEventListener('input', () => {
        this.selectedLapCount = parseInt(lapSlider.value, 10);
        lapDisplay.textContent = `${this.selectedLapCount} LAPS`;
      });
    }

    // Step 5: Weather & Time of Day
    const weatherBtns = this.rootElement.querySelectorAll('[data-weather]');
    weatherBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-weather') as WeatherCondition;
        if (w) {
          this.selectedWeather = w;
          this.rootElement.querySelectorAll('[data-weather]').forEach((b) => b.classList.remove('env-choice-active'));
          btn.classList.add('env-choice-active');
        }
      });
    });

    const timeBtns = this.rootElement.querySelectorAll('[data-time]');
    timeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = parseFloat(btn.getAttribute('data-time') || '12.0');
        this.selectedTimeOfDay = t;
        this.rootElement.querySelectorAll('[data-time]').forEach((b) => b.classList.remove('env-choice-active'));
        btn.classList.add('env-choice-active');
      });
    });

    // Start Race Launch Buttons (Zero Buffer)
    const launchHandler = () => {
      const isTimeTrial = this.selectedMode === 'time_attack';
      const weather = isTimeTrial ? 'clear' : this.selectedWeather;
      const timeOfDay = isTimeTrial ? 12.0 : this.selectedTimeOfDay;

      this.options.onStartRace(
        this.selectedTrack,
        this.selectedLiveryIndex,
        this.selectedCarNumber,
        weather,
        timeOfDay,
        this.selectedLapCount,
        this.selectedMode
      );
    };

    const startBtn = this.rootElement.querySelector('#menu-start-btn');
    startBtn?.addEventListener('click', launchHandler);

    const wizardLaunchBtn = this.rootElement.querySelector('#wizard-launch-step-btn');
    wizardLaunchBtn?.addEventListener('click', launchHandler);

    // Phase I: Driver Passport & Leaderboards modal bindings
    const passportPill = this.rootElement.querySelector('#menu-driver-passport-pill');
    passportPill?.addEventListener('click', () => {
      this.options.onOpenDriverProfile?.();
    });

    const headerClaimBtn = this.rootElement.querySelector('#header-claim-license-btn');
    headerClaimBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onOpenDriverProfile?.();
    });

    const lbBtn = this.rootElement.querySelector('#menu-leaderboard-btn');
    lbBtn?.addEventListener('click', () => {
      this.options.onOpenLeaderboard?.();
    });

    // QR Modal
    const qrToggleBtn = this.rootElement.querySelector('#menu-qr-toggle-btn');
    qrToggleBtn?.addEventListener('click', () => {
      this.isQrModalOpen = !this.isQrModalOpen;
      const modal = this.rootElement.querySelector('#menu-qr-modal') as HTMLElement;
      if (modal) modal.style.display = this.isQrModalOpen ? 'flex' : 'none';
      if (this.isQrModalOpen) this.generateQrCode();
    });

    const qrCloseBtn = this.rootElement.querySelector('#menu-qr-close-btn');
    qrCloseBtn?.addEventListener('click', () => {
      this.isQrModalOpen = false;
      const modal = this.rootElement.querySelector('#menu-qr-modal') as HTMLElement;
      if (modal) modal.style.display = 'none';
    });
  }

  public updateDriverUI(): void {
    const avatar = this.rootElement.querySelector('.menu-driver-avatar') as HTMLElement;
    const tagEl = this.rootElement.querySelector('.menu-driver-tag');
    const countryEl = this.rootElement.querySelector('.menu-driver-country');
    const claimBtn = this.rootElement.querySelector('#header-claim-license-btn') as HTMLElement;
    if (!this.options.driverManager) return;
    const dm = this.options.driverManager;
    const acc = dm.getAccount();
    const tag = dm.getDriverTag();
    const isDev = acc?.isDeveloper || isDeveloperTag(tag);
    if (avatar) avatar.style.backgroundColor = acc?.avatarColor || (isDev ? '#f59e0b' : '#38bdf8');
    if (tagEl) tagEl.textContent = tag;
    if (countryEl) countryEl.innerHTML = formatCountryBadge(acc?.countryCode || 'GLOBAL');
    if (claimBtn) claimBtn.style.display = dm.isGuest() ? 'inline-block' : 'none';
  }

  private syncCarNumberUI(updateInputField: boolean = true): void {
    if (updateInputField) {
      const input = this.rootElement.querySelector('#custom-car-number-input') as HTMLInputElement;
      if (input) input.value = this.selectedCarNumber;
    }
    const quickBtns = this.rootElement.querySelectorAll('.quick-num-btn');
    quickBtns.forEach((btn) => {
      const val = btn.getAttribute('data-quick-num');
      btn.classList.toggle('quick-num-active', val === this.selectedCarNumber);
    });
  }

  private async generateQrCode(): Promise<void> {
    const canvas = this.rootElement.querySelector('#menu-qr-canvas') as HTMLCanvasElement;
    const urlEl = this.rootElement.querySelector('#menu-qr-url');
    const pinEl = this.rootElement.querySelector('#menu-qr-pin-code');
    if (!canvas || typeof window === 'undefined') return;

    let controllerUrl = `${window.location.origin}/controller.html`;
    let hostIp = window.location.hostname;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const resp = await fetch('/api/network-info');
        if (resp.ok) {
          const info = await resp.json();
          if (info.controllerUrl) {
            controllerUrl = info.controllerUrl;
          }
          if (info.ip) {
            hostIp = info.ip;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch network info for QR code', e);
      }
    }

    if (this.options.driverManager) {
      const pairToken = await this.options.driverManager.startPairingSession(hostIp);
      if (pairToken) {
        if (pinEl) pinEl.textContent = pairToken;
        const separator = controllerUrl.includes('?') ? '&' : '?';
        controllerUrl += `${separator}pairToken=${pairToken}&driverTag=${encodeURIComponent(
          this.options.driverManager.getDriverTag()
        )}`;
      }
    }

    if (urlEl) {
      urlEl.innerHTML = `<a href="${controllerUrl}" target="_blank" rel="noopener" style="color: #38bdf8; text-decoration: underline; font-family: monospace; word-break: break-all;">${controllerUrl}</a>`;
    }

    try {
      await QRCode.toCanvas(canvas, controllerUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('Failed to generate Menu QR code:', err);
    }
  }
}
