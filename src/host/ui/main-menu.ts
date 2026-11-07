import QRCode from 'qrcode';
import { TrackMode } from '../../common/types';
import { PRESET_LIVERIES } from '../render/livery-system';

export interface MainMenuOptions {
  onStartRace: (track: TrackMode, liveryIndex: number, carNumber: string) => void;
  onLiveryChanged: (liveryIndex: number, carNumber: string) => void;
  onCarNumberChanged: (carNumber: string) => void;
}

interface TrackCardSpec {
  id: TrackMode;
  name: string;
  length: string;
  turns: string;
}

const TRACK_CARDS: TrackCardSpec[] = [
  {
    id: TrackMode.NORDSCHLEIFE,
    name: 'Nürburgring Nordschleife',
    length: '20.8 KM',
    turns: '73 TURNS',
  },
  {
    id: TrackMode.NURBURGRING_24H,
    name: 'Nürburgring 24h Gesamtkurs',
    length: '25.4 KM',
    turns: '89 TURNS',
  },
  {
    id: TrackMode.GP_STRECKE,
    name: 'Nürburgring GP-Strecke',
    length: '5.1 KM',
    turns: '15 TURNS',
  },
  {
    id: TrackMode.PROVING_GROUND,
    name: 'High-Speed Proving Ground',
    length: '6.0 KM',
    turns: 'RUNWAY',
  },
];

/**
 * Showroom Main Menu UI.
 * Minimalist luxury motorsport configurator over the interactive 360° 3D turntable.
 */
export class MainMenu {
  private container: HTMLElement;
  private rootElement: HTMLElement;
  private options: MainMenuOptions;

  private selectedTrack: TrackMode = TrackMode.NORDSCHLEIFE;
  private selectedLiveryIndex: number = 0; // Defaults to #80 Rexy Green
  private selectedCarNumber: string = PRESET_LIVERIES[0].carNumber;
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

  private render(): void {
    const activeLivery = PRESET_LIVERIES[this.selectedLiveryIndex];

    this.rootElement.innerHTML = `
      <!-- Top Studio Header Bar -->
      <header class="menu-header">
        <div class="menu-brand">
          <span class="menu-logo-mark">PORSCHE</span>
          <span class="menu-brand-sep"></span>
          <span class="menu-title">911 RSR</span>
          <span class="menu-model-tag">GTE</span>
        </div>

        <div class="menu-header-actions">
          <div id="menu-controller-status" class="menu-pill ${this.isPhoneConnected ? 'menu-pill-green' : 'menu-pill-standby'}">
            <span class="status-dot"></span>
            <span class="status-text">${this.isPhoneConnected ? 'WHEEL LINKED' : 'KEYBOARD / WHEEL'}</span>
          </div>
          <button id="menu-qr-toggle-btn" class="menu-btn-secondary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1"></rect>
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2M19 14v2"></path>
            </svg>
            <span>PAIR PHONE</span>
          </button>
        </div>
      </header>

      <!-- Main Body Panels -->
      <div class="menu-body">
        <!-- Left Panel: Circuit Selector -->
        <aside class="menu-panel menu-panel-left">
          <div class="panel-header">
            <h2 class="panel-title">CIRCUIT</h2>
            <span class="panel-header-meta">04</span>
          </div>

          <div class="track-card-list">
            ${TRACK_CARDS.map((track) => `
              <div class="track-card ${track.id === this.selectedTrack ? 'track-card-active' : ''}" data-track-id="${track.id}">
                <div class="track-name">${track.name}</div>
                <div class="track-meta">
                  <span>${track.length}</span>
                  <span class="meta-sep">·</span>
                  <span>${track.turns}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </aside>

        <!-- Right Panel: Vehicle & Livery Studio -->
        <aside class="menu-panel menu-panel-right">
          <div class="panel-header">
            <h2 class="panel-title">911 RSR-19</h2>
            <span class="panel-header-meta">4.2L FLAT-6</span>
          </div>

          <!-- Compact Architectural Telemetry Strip -->
          <div class="specs-strip">
            <div class="spec-item">
              <span class="spec-val">515 <small>HP</small></span>
              <span class="spec-lbl">POWER</span>
            </div>
            <div class="spec-item">
              <span class="spec-val">9,000</span>
              <span class="spec-lbl">MAX RPM</span>
            </div>
            <div class="spec-item">
              <span class="spec-val">318 <small>KM/H</small></span>
              <span class="spec-lbl">TOP SPEED</span>
            </div>
            <div class="spec-item">
              <span class="spec-val">1,245 <small>KG</small></span>
              <span class="spec-lbl">DRY MASS</span>
            </div>
          </div>

          <!-- Livery Selector (4x2 Grid, Zero Clipping) -->
          <div class="livery-section">
            <div class="livery-section-header">
              <span class="panel-eyebrow">LIVERY</span>
              <span id="menu-active-livery-name" class="active-livery-title">${activeLivery.name}</span>
            </div>
            <div class="livery-swatches">
              ${PRESET_LIVERIES.map((liv, idx) => `
                <button class="livery-swatch-btn ${idx === this.selectedLiveryIndex ? 'livery-swatch-active' : ''}" data-livery-idx="${idx}" title="${liv.name} #${liv.carNumber}">
                  <span class="swatch-chip">
                    <span class="swatch-half" style="background: ${liv.primaryColor}"></span>
                    <span class="swatch-half" style="background: ${liv.secondaryColor}"></span>
                  </span>
                  <span class="swatch-number">#${liv.carNumber}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Competition Race Number -->
          <div class="car-number-section">
            <div class="livery-section-header">
              <span class="panel-eyebrow">COMPETITION NO.</span>
            </div>
            <div class="number-input-row">
              <div class="number-input-wrap">
                <span class="hash-prefix">#</span>
                <input
                  id="custom-car-number-input"
                  type="text"
                  maxlength="3"
                  value="${this.selectedCarNumber}"
                  placeholder="80"
                  class="custom-number-field"
                  aria-label="Custom Race Number"
                />
              </div>
              <div class="quick-number-pills">
                ${['80', '911', '77', '1', '92', '20', '93', '00'].map((num) => `
                  <button class="quick-num-btn ${this.selectedCarNumber === num ? 'quick-num-active' : ''}" data-quick-num="${num}">#${num}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Primary Session Launch CTA -->
          <div class="menu-launch-block">
            <button id="menu-start-btn" class="menu-btn-launch">
              <span class="launch-text">START SESSION</span>
              <span class="launch-kbd">ENTER</span>
            </button>
          </div>
        </aside>
      </div>

      <!-- QR Code Modal -->
      <div id="menu-qr-modal" class="menu-modal-backdrop" style="display: none;">
        <div class="menu-modal-card">
          <div class="modal-header">
            <h3>MOBILE TELEMETRY WHEEL</h3>
            <button id="menu-qr-close-btn" class="modal-close-btn" aria-label="Close">✕</button>
          </div>
          <p class="modal-desc">Scan with your phone camera to pair a 60 Hz gyro steering wheel and telemetry display.</p>
          <div class="qr-box">
            <canvas id="menu-qr-canvas"></canvas>
          </div>
          <div id="menu-qr-url" class="modal-tip"></div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Track cards
    const trackCards = this.rootElement.querySelectorAll('.track-card');
    trackCards.forEach((card) => {
      card.addEventListener('click', () => {
        const trackId = card.getAttribute('data-track-id') as TrackMode;
        if (trackId) {
          this.selectedTrack = trackId;
          trackCards.forEach((c) => c.classList.remove('track-card-active'));
          card.classList.add('track-card-active');
        }
      });
    });

    // Livery swatch buttons
    const swatchBtns = this.rootElement.querySelectorAll('.livery-swatch-btn');
    swatchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idxStr = btn.getAttribute('data-livery-idx');
        if (idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          // Sync default number for this preset livery when clicked
          this.selectedCarNumber = PRESET_LIVERIES[idx].carNumber;
          this.selectLivery(idx);
          this.syncCarNumberUI();
        }
      });
    });

    // Custom Race Number text input
    const numberInput = this.rootElement.querySelector('#custom-car-number-input') as HTMLInputElement | null;
    if (numberInput) {
      numberInput.addEventListener('input', () => {
        const sanitized = numberInput.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 3).toUpperCase();
        if (numberInput.value !== sanitized) {
          numberInput.value = sanitized;
        }
        this.selectedCarNumber = sanitized || '0';
        this.syncCarNumberUI(false);
        this.options.onCarNumberChanged(this.selectedCarNumber);
      });

      numberInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });
    }

    // Quick number preset pills
    const quickNumBtns = this.rootElement.querySelectorAll('.quick-num-btn');
    quickNumBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-quick-num');
        if (num) {
          this.selectedCarNumber = num;
          this.syncCarNumberUI(true);
          this.options.onCarNumberChanged(this.selectedCarNumber);
        }
      });
    });

    // Start Engine / Drive button
    const startBtn = this.rootElement.querySelector('#menu-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.options.onStartRace(this.selectedTrack, this.selectedLiveryIndex, this.selectedCarNumber);
      });
    }

    // QR Code Modal Toggle
    const qrToggleBtn = this.rootElement.querySelector('#menu-qr-toggle-btn');
    const qrModal = this.rootElement.querySelector('#menu-qr-modal') as HTMLElement | null;
    const qrCloseBtn = this.rootElement.querySelector('#menu-qr-close-btn');

    if (qrToggleBtn && qrModal) {
      qrToggleBtn.addEventListener('click', () => {
        this.isQrModalOpen = !this.isQrModalOpen;
        qrModal.style.display = this.isQrModalOpen ? 'flex' : 'none';
      });
    }

    if (qrCloseBtn && qrModal) {
      qrCloseBtn.addEventListener('click', () => {
        this.isQrModalOpen = false;
        qrModal.style.display = 'none';
      });
    }

    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          this.isQrModalOpen = false;
          qrModal.style.display = 'none';
        }
      });
    }
  }

  private syncCarNumberUI(updateInputField: boolean = true): void {
    const numberInput = this.rootElement.querySelector('#custom-car-number-input') as HTMLInputElement | null;
    if (updateInputField && numberInput) {
      numberInput.value = this.selectedCarNumber;
    }

    const badgeEl = this.rootElement.querySelector('#menu-active-number-badge');
    if (badgeEl) {
      badgeEl.textContent = `#${this.selectedCarNumber}`;
    }

    const activeLivery = PRESET_LIVERIES[this.selectedLiveryIndex];
    const titleEl = this.rootElement.querySelector('#menu-active-livery-name');
    if (titleEl && activeLivery) {
      titleEl.textContent = activeLivery.name;
    }

    const quickNumBtns = this.rootElement.querySelectorAll('.quick-num-btn');
    quickNumBtns.forEach((btn) => {
      const n = btn.getAttribute('data-quick-num');
      if (n === this.selectedCarNumber) {
        btn.classList.add('quick-num-active');
      } else {
        btn.classList.remove('quick-num-active');
      }
    });
  }

  public selectLivery(index: number): void {
    this.selectedLiveryIndex = (index + PRESET_LIVERIES.length) % PRESET_LIVERIES.length;
    const activeLivery = PRESET_LIVERIES[this.selectedLiveryIndex];

    const swatchBtns = this.rootElement.querySelectorAll('.livery-swatch-btn');
    swatchBtns.forEach((btn) => {
      const idx = parseInt(btn.getAttribute('data-livery-idx') || '-1', 10);
      if (idx === this.selectedLiveryIndex) {
        btn.classList.add('livery-swatch-active');
      } else {
        btn.classList.remove('livery-swatch-active');
      }
    });

    const titleEl = this.rootElement.querySelector('#menu-active-livery-name');
    if (titleEl && activeLivery) {
      titleEl.textContent = activeLivery.name;
    }

    this.options.onLiveryChanged(this.selectedLiveryIndex, this.selectedCarNumber);
  }

  public setPhoneConnected(connected: boolean): void {
    this.isPhoneConnected = connected;
    const pill = this.rootElement.querySelector('#menu-controller-status');
    if (pill) {
      pill.className = `menu-pill ${connected ? 'menu-pill-green' : 'menu-pill-standby'}`;
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">${connected ? 'WHEEL LINKED' : 'KEYBOARD / WHEEL'}</span>
      `;
    }
  }

  private async generateQrCode(): Promise<void> {
    const canvas = this.rootElement.querySelector('#menu-qr-canvas') as HTMLCanvasElement | null;
    const urlEl = this.rootElement.querySelector('#menu-qr-url');
    if (!canvas) return;

    const host = window.location.hostname || 'localhost';
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const controllerUrl = `${protocol}//${host}${port}/controller.html`;

    if (urlEl) {
      urlEl.innerHTML = `<code>${controllerUrl}</code>`;
    }

    try {
      await QRCode.toCanvas(canvas, controllerUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#090a0f',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.warn('Failed to generate QR code:', err);
    }
  }

  public setLiveryIndex(index: number): void {
    this.selectLivery(index);
  }

  public getSelectedTrack(): TrackMode {
    return this.selectedTrack;
  }

  public getSelectedLiveryIndex(): number {
    return this.selectedLiveryIndex;
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
}
