import { LeaderboardEntry, LeaderboardFilter, InputCategory } from '../../common/auth/driver-types';
import { DriverManager } from '../auth/driver-manager';

export interface LeaderboardModalOptions {
  driverManager: DriverManager;
  onRaceGhost?: (circuitId: string, vehicleClass: string, weather: string) => void;
}

export class LeaderboardModal {
  private container: HTMLElement;
  private modalEl: HTMLElement;
  private driverManager: DriverManager;
  private onRaceGhost?: (circuitId: string, vehicleClass: string, weather: string) => void;

  private currentCircuit = 'nordschleife';
  private currentClass = 'all';
  private currentWeather = 'all';
  private currentInput = 'all';

  private isOpen = false;

  constructor(container: HTMLElement, options: LeaderboardModalOptions) {
    this.container = container;
    this.driverManager = options.driverManager;
    this.onRaceGhost = options.onRaceGhost;

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'leaderboard-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.container.appendChild(this.modalEl);

    this.render();
  }

  public open(circuitId = 'nordschleife'): void {
    this.currentCircuit = circuitId;
    this.isOpen = true;
    this.modalEl.style.display = 'flex';
    this.refresh();
  }

  public close(): void {
    this.isOpen = false;
    this.modalEl.style.display = 'none';
  }

  public toggle(circuitId?: string): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(circuitId || this.currentCircuit);
    }
  }

  private render(): void {
    this.modalEl.innerHTML = `
      <div class="leaderboard-modal-window">
        <header class="leaderboard-modal-header">
          <div class="leaderboard-header-title-wrap">
            <span class="leaderboard-title-badge">GLOBAL VERIFIED MATRIX</span>
            <h2 class="leaderboard-title">HOTLAP LEADERBOARDS</h2>
          </div>
          <button class="leaderboard-modal-close" id="lb-close-btn" type="button" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <!-- Filter Navigation -->
        <div class="leaderboard-filters">
          <!-- Circuit Filters -->
          <div class="filter-group">
            <span class="filter-label">CIRCUIT:</span>
            <div class="filter-pills" id="lb-circuit-pills">
              <button class="filter-pill active" data-circuit="nordschleife">NORDSCHLEIFE (20.8 KM)</button>
              <button class="filter-pill" data-circuit="24h">24H GESAMTKURS (25.4 KM)</button>
              <button class="filter-pill" data-circuit="gp_strecke">GP-STRECKE (5.1 KM)</button>
              <button class="filter-pill" data-circuit="proving_ground">PROVING GROUND</button>
            </div>
          </div>

          <!-- Class & Input Sub-filters -->
          <div class="filter-subgroup-row">
            <div class="filter-group">
              <span class="filter-label">CLASS:</span>
              <div class="filter-pills" id="lb-class-pills">
                <button class="filter-pill active" data-class="all">ALL CLASSES</button>
                <button class="filter-pill" data-class="GTE">GT3 / GTE</button>
                <button class="filter-pill" data-class="LMDh">HYPERCAR</button>
              </div>
            </div>

            <div class="filter-group">
              <span class="filter-label">INPUT DEVICE:</span>
              <div class="filter-pills" id="lb-input-pills">
                <button class="filter-pill active" data-input="all">ALL INPUTS</button>
                <button class="filter-pill" data-input="gyro">📱 PHONE GYRO</button>
                <button class="filter-pill" data-input="keyboard">⌨️ KEYBOARD</button>
                <button class="filter-pill" data-input="wheel">🏎️ WHEEL</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Table Container -->
        <div class="leaderboard-table-container">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th style="width: 60px;">RANK</th>
                <th>DRIVER</th>
                <th>VEHICLE</th>
                <th style="width: 90px;">INPUT</th>
                <th style="width: 120px;">LAP TIME</th>
                <th style="width: 90px;">DELTA</th>
                <th style="width: 90px;">TOP SPEED</th>
                <th style="width: 130px; text-align: right;">ACTION</th>
              </tr>
            </thead>
            <tbody id="lb-table-body">
              <tr>
                <td colspan="8" class="lb-loading">Loading telemetry rankings...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const closeBtn = this.modalEl.querySelector('#lb-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // Circuit pills
    const circuitPills = this.modalEl.querySelectorAll('#lb-circuit-pills .filter-pill');
    circuitPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        circuitPills.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        this.currentCircuit = btn.getAttribute('data-circuit') || 'nordschleife';
        this.refresh();
      });
    });

    // Class pills
    const classPills = this.modalEl.querySelectorAll('#lb-class-pills .filter-pill');
    classPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        classPills.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        this.currentClass = btn.getAttribute('data-class') || 'all';
        this.refresh();
      });
    });

    // Input pills
    const inputPills = this.modalEl.querySelectorAll('#lb-input-pills .filter-pill');
    inputPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        inputPills.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        this.currentInput = btn.getAttribute('data-input') || 'all';
        this.refresh();
      });
    });
  }

  public async refresh(): Promise<void> {
    const tbody = this.modalEl.querySelector('#lb-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="lb-loading">Retrieving verified sector telemetry...</td></tr>`;

    const filter: LeaderboardFilter = {
      circuitId: this.currentCircuit,
      vehicleClass: this.currentClass !== 'all' ? this.currentClass : undefined,
      weather: this.currentWeather !== 'all' ? this.currentWeather : undefined,
      inputCategory: this.currentInput !== 'all' ? (this.currentInput as InputCategory) : undefined,
      limit: 50,
    };

    const res = await this.driverManager.fetchLeaderboard(filter);
    if (!this.isOpen) return;

    if (!res || res.entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="lb-empty">No verified hotlaps matching filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    res.entries.forEach((entry: LeaderboardEntry) => {
      const tr = document.createElement('tr');
      tr.className = `lb-row ${entry.rank === 1 ? 'lb-row-gold' : entry.rank === 2 ? 'lb-row-silver' : entry.rank === 3 ? 'lb-row-bronze' : ''}`;

      const rankBadge =
        entry.rank === 1
          ? '<span class="rank-badge rank-gold">P1</span>'
          : entry.rank === 2
          ? '<span class="rank-badge rank-silver">P2</span>'
          : entry.rank === 3
          ? '<span class="rank-badge rank-bronze">P3</span>'
          : `<span class="rank-number">${entry.rank}</span>`;

      const deltaFormatted =
        entry.deltaToLeaderMs === 0
          ? '<span class="delta-leader">LEADER</span>'
          : `<span class="delta-plus">+${(entry.deltaToLeaderMs / 1000).toFixed(3)}s</span>`;

      const inputIcon =
        entry.inputCategory === 'gyro'
          ? '<span class="input-badge" title="Phone Safari Gyro">📱 GYRO</span>'
          : entry.inputCategory === 'wheel'
          ? '<span class="input-badge input-wheel" title="Force Feedback Wheel">🏎️ WHEEL</span>'
          : '<span class="input-badge input-kb" title="Keyboard">⌨️ KEYS</span>';

      const ghostActionBtn =
        entry.hasGhostTrajectory || entry.rank === 1
          ? `<button class="lb-race-ghost-btn" data-circuit="${entry.circuitId}" data-class="${entry.vehicleClass}" data-weather="${entry.weather}" type="button">⚡ RACE WR GHOST</button>`
          : `<span class="no-ghost-label">—</span>`;

      tr.innerHTML = `
        <td class="lb-rank-col">${rankBadge}</td>
        <td class="lb-driver-col">
          <div class="lb-driver-wrap">
            <span class="lb-avatar-dot" style="background-color: ${entry.avatarColor || '#38bdf8'};"></span>
            <span class="lb-driver-tag">${entry.driverTag}</span>
            <span class="lb-country-badge">${entry.countryCode}</span>
          </div>
        </td>
        <td class="lb-car-col">${entry.vehicleName}</td>
        <td class="lb-input-col">${inputIcon}</td>
        <td class="lb-time-col"><strong>${entry.lapTimeFormatted}</strong></td>
        <td class="lb-delta-col">${deltaFormatted}</td>
        <td class="lb-speed-col">${entry.topSpeedKmh ? entry.topSpeedKmh.toFixed(1) + ' km/h' : '—'}</td>
        <td class="lb-action-col">${ghostActionBtn}</td>
      `;

      tbody.appendChild(tr);
    });

    // Bind Race Ghost buttons
    const raceBtns = tbody.querySelectorAll('.lb-race-ghost-btn');
    raceBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cId = btn.getAttribute('data-circuit') || 'nordschleife';
        const vClass = btn.getAttribute('data-class') || 'GTE';
        const wTh = btn.getAttribute('data-weather') || 'clear';
        if (this.onRaceGhost) {
          this.onRaceGhost(cId, vClass, wTh);
          this.close();
        }
      });
    });
  }
}
