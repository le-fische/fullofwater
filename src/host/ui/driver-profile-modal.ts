import { DriverManager } from '../auth/driver-manager';

export interface DriverProfileModalOptions {
  driverManager: DriverManager;
}

export class DriverProfileModal {
  private container: HTMLElement;
  private modalEl: HTMLElement;
  private driverManager: DriverManager;
  private isOpen = false;
  private activeTab: 'stats' | 'claim' | 'login' = 'stats';

  constructor(container: HTMLElement, options: DriverProfileModalOptions) {
    this.container = container;
    this.driverManager = options.driverManager;

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'driver-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.container.appendChild(this.modalEl);

    this.render();
  }

  public open(tab?: 'stats' | 'claim' | 'login'): void {
    if (tab) {
      this.activeTab = tab;
    } else {
      this.activeTab = this.driverManager.isGuest() ? 'claim' : 'stats';
    }
    this.isOpen = true;
    this.modalEl.style.display = 'flex';
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.modalEl.style.display = 'none';
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private render(): void {
    const isGuest = this.driverManager.isGuest();
    const account = this.driverManager.getAccount();
    const stats = this.driverManager.getStats();
    const records = this.driverManager.getPersonalRecords();
    const driverTag = this.driverManager.getDriverTag();

    this.modalEl.innerHTML = `
      <div class="driver-modal-window">
        <header class="driver-modal-header">
          <div class="driver-header-id-row">
            <span class="driver-avatar-circle" style="background-color: ${account?.avatarColor || '#38bdf8'};">
              ${driverTag.substring(0, 2)}
            </span>
            <div class="driver-id-meta">
              <div class="driver-tag-row">
                <h2 class="driver-name-title">${account?.displayName || driverTag}</h2>
                <span class="driver-tag-badge">${driverTag}</span>
                <span class="driver-country-tag">${account?.countryCode || 'DE'}</span>
                ${isGuest ? '<span class="guest-pill">GUEST LICENSE</span>' : '<span class="verified-pill">VERIFIED PRO</span>'}
              </div>
              <p class="driver-sub-meta">FIA SIM-LITE PASSPORT • ${account?.preferredUnits || 'KM/H'} TELEMETRY</p>
            </div>
          </div>
          <button class="driver-modal-close" id="driver-close-btn" type="button" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <!-- Navigation Tabs -->
        <div class="driver-tabs">
          <button class="driver-tab-btn ${this.activeTab === 'stats' ? 'active' : ''}" id="tab-btn-stats" type="button">LIFETIME STATS</button>
          ${
            isGuest
              ? `<button class="driver-tab-btn ${this.activeTab === 'claim' ? 'active' : ''}" id="tab-btn-claim" type="button">CLAIM LICENSE</button>`
              : ''
          }
          <button class="driver-tab-btn ${this.activeTab === 'login' ? 'active' : ''}" id="tab-btn-login" type="button">${isGuest ? 'DRIVER LOGIN' : 'ACCOUNT'}</button>
        </div>

        <!-- Tab Content -->
        <div class="driver-tab-body">
          ${this.renderTabContent(isGuest, stats, records)}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderTabContent(isGuest: boolean, stats: any, records: any[]): string {
    if (this.activeTab === 'stats') {
      const distanceKm = stats ? stats.totalDistanceKm.toFixed(1) : '0.0';
      const laps = stats ? stats.totalLapsCompleted : 0;
      const cleanRatio = stats ? stats.cleanLapRatio : 100;
      const topSpeed = stats ? stats.maxTopSpeedKmh.toFixed(1) : '0.0';
      const flightTime = stats ? stats.totalFlightTimeSeconds.toFixed(1) : '0.0';
      const favCar = stats ? stats.favoriteVehicle : 'Porsche 911 RSR-19 (992)';
      const favLivery = stats ? stats.favoriteLivery : 'Rexy Green #80';

      return `
        <div class="driver-stats-grid">
          <div class="stat-box">
            <span class="stat-label">TOTAL DISTANCE</span>
            <span class="stat-val stat-val-cyan">${distanceKm} <small>KM</small></span>
          </div>
          <div class="stat-box">
            <span class="stat-label">LAPS COMPLETED</span>
            <span class="stat-val">${laps} <small>LAPS</small></span>
          </div>
          <div class="stat-box">
            <span class="stat-label">CLEAN LAP RATIO</span>
            <span class="stat-val stat-val-green">${cleanRatio}%</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">MAX TOP SPEED</span>
            <span class="stat-val stat-val-gold">${topSpeed} <small>KM/H</small></span>
          </div>
          <div class="stat-box">
            <span class="stat-label">AIRBORNE FLIGHT TIME</span>
            <span class="stat-val">${flightTime} <small>SEC</small></span>
          </div>
          <div class="stat-box">
            <span class="stat-label">FAVORITE LIVERY</span>
            <span class="stat-val stat-val-sm">${favLivery}</span>
          </div>
        </div>

        <div class="driver-car-highlight">
          <span class="stat-label">PRIMARY MOTORSPORT HOMOLOGATION:</span>
          <div class="fav-car-title">🏎️ ${favCar}</div>
        </div>

        <!-- Personal Records Table -->
        <div class="records-header-row">
          <span class="records-section-title">PERSONAL BEST LAP ARCHIVE</span>
        </div>
        ${
          records && records.length > 0
            ? `
          <table class="personal-records-table">
            <thead>
              <tr>
                <th>CIRCUIT</th>
                <th>BEST TIME</th>
                <th>MAX SPEED</th>
                <th>CONDITIONS</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (r) => `
                <tr>
                  <td><strong>${r.circuitId.toUpperCase()}</strong></td>
                  <td class="record-time">${(r.bestLapTimeMs / 1000).toFixed(3)}s</td>
                  <td>${r.topSpeedKmh ? r.topSpeedKmh.toFixed(1) + ' km/h' : '—'}</td>
                  <td><span class="cond-pill">${r.weather || 'DRY'}</span></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
            : `<div class="records-empty">Complete a clean lap on any surveyed circuit to record your personal best.</div>`
        }

        ${
          isGuest
            ? `
          <div class="claim-prompt-banner">
            <div class="claim-banner-text">
              <strong>Guest Profile Active:</strong> Convert this session into a permanent verified account to secure your lifetime km and hotlap rankings.
            </div>
            <button class="claim-action-btn" id="claim-license-cta-btn" type="button">CLAIM DRIVER LICENSE</button>
          </div>
        `
            : ''
        }
      `;
    }

    if (this.activeTab === 'claim') {
      const guestTag = this.driverManager.getDriverTag();
      return `
        <div class="driver-form-wrap">
          <p class="form-desc">
            Keep your current driving records (<strong>${stats?.totalDistanceKm.toFixed(1) || 0} km</strong> driven, all hotlaps and settings) and convert your temporary guest tag into a permanent verified driver identity.
          </p>

          <form id="claim-license-form" class="driver-auth-form">
            <div class="form-row">
              <label>PERMANENT DRIVER TAG</label>
              <input type="text" id="claim-tag" value="${guestTag.replace('GUEST_', 'RACER_')}" required minlength="3" maxlength="16" autocomplete="off" />
              <small>3-16 alphanumeric characters, underscores or hyphens.</small>
            </div>

            <div class="form-row">
              <label>DISPLAY NAME</label>
              <input type="text" id="claim-name" placeholder="Driver Name" value="${guestTag}" required />
            </div>

            <div class="form-row">
              <label>EMAIL ADDRESS</label>
              <input type="email" id="claim-email" placeholder="driver@motorsport.com" required />
            </div>

            <div class="form-row">
              <label>PASSWORD (OPTIONAL / PASSKEY)</label>
              <input type="password" id="claim-password" placeholder="••••••••" />
            </div>

            <div class="form-row-grid">
              <div class="form-row">
                <label>COUNTRY CODE</label>
                <select id="claim-country">
                  <option value="DE" selected>🇩🇪 Germany (DE)</option>
                  <option value="US">🇺🇸 United States (US)</option>
                  <option value="GB">🇬🇧 United Kingdom (GB)</option>
                  <option value="FR">🇫🇷 France (FR)</option>
                  <option value="IT">🇮🇹 Italy (IT)</option>
                  <option value="NL">🇳🇱 Netherlands (NL)</option>
                  <option value="JP">🇯🇵 Japan (JP)</option>
                </select>
              </div>
              <div class="form-row">
                <label>UNITS</label>
                <select id="claim-units">
                  <option value="km/h" selected>Metric (KM/H)</option>
                  <option value="mph">Imperial (MPH)</option>
                </select>
              </div>
            </div>

            <div id="claim-error-msg" class="auth-error-msg" style="display: none;"></div>

            <button type="submit" class="submit-auth-btn">CONFIRM & CLAIM LICENSE</button>
          </form>
        </div>
      `;
    }

    // Login tab
    return `
      <div class="driver-form-wrap">
        ${
          !isGuest
            ? `
          <div class="logged-in-box">
            <p>Signed in as <strong>${this.driverManager.getDriverTag()}</strong></p>
            <button class="logout-btn" id="driver-logout-btn" type="button">SIGN OUT TO GUEST MODE</button>
          </div>
        `
            : `
          <p class="form-desc">Log into an existing verified driver license or register a new one.</p>
          <form id="driver-login-form" class="driver-auth-form">
            <div class="form-row">
              <label>DRIVER TAG OR EMAIL</label>
              <input type="text" id="login-tag" placeholder="SPEED_KING_99" required />
            </div>
            <div class="form-row">
              <label>PASSWORD</label>
              <input type="password" id="login-password" placeholder="••••••••" />
            </div>
            <div id="login-error-msg" class="auth-error-msg" style="display: none;"></div>
            <button type="submit" class="submit-auth-btn">DRIVER LOGIN</button>
          </form>
        `
        }
      </div>
    `;
  }

  private bindEvents(): void {
    const closeBtn = this.modalEl.querySelector('#driver-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    const tabStats = this.modalEl.querySelector('#tab-btn-stats');
    tabStats?.addEventListener('click', () => {
      this.activeTab = 'stats';
      this.render();
    });

    const tabClaim = this.modalEl.querySelector('#tab-btn-claim');
    tabClaim?.addEventListener('click', () => {
      this.activeTab = 'claim';
      this.render();
    });

    const tabLogin = this.modalEl.querySelector('#tab-btn-login');
    tabLogin?.addEventListener('click', () => {
      this.activeTab = 'login';
      this.render();
    });

    const ctaBtn = this.modalEl.querySelector('#claim-license-cta-btn');
    ctaBtn?.addEventListener('click', () => {
      this.activeTab = 'claim';
      this.render();
    });

    const logoutBtn = this.modalEl.querySelector('#driver-logout-btn');
    logoutBtn?.addEventListener('click', () => {
      this.driverManager.logout();
      this.activeTab = 'stats';
      this.render();
    });

    // Handle Claim Form submission
    const claimForm = this.modalEl.querySelector('#claim-license-form') as HTMLFormElement | null;
    claimForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTag = (this.modalEl.querySelector('#claim-tag') as HTMLInputElement).value;
      const displayName = (this.modalEl.querySelector('#claim-name') as HTMLInputElement).value;
      const email = (this.modalEl.querySelector('#claim-email') as HTMLInputElement).value;
      const password = (this.modalEl.querySelector('#claim-password') as HTMLInputElement).value;
      const countryCode = (this.modalEl.querySelector('#claim-country') as HTMLSelectElement).value;
      const preferredUnits = (this.modalEl.querySelector('#claim-units') as HTMLSelectElement).value as any;

      const errEl = this.modalEl.querySelector('#claim-error-msg') as HTMLElement;
      if (errEl) errEl.style.display = 'none';

      const res = await this.driverManager.claimGuestLicense({
        guestTag: this.driverManager.getDriverTag(),
        newDriverTag: newTag,
        displayName,
        email,
        password: password || undefined,
        countryCode,
        preferredUnits,
      });

      if (res.success) {
        this.activeTab = 'stats';
        this.render();
      } else {
        if (errEl) {
          errEl.textContent = res.message || 'Error claiming license.';
          errEl.style.display = 'block';
        }
      }
    });

    // Handle Login Form submission
    const loginForm = this.modalEl.querySelector('#driver-login-form') as HTMLFormElement | null;
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tagOrEmail = (this.modalEl.querySelector('#login-tag') as HTMLInputElement).value;
      const password = (this.modalEl.querySelector('#login-password') as HTMLInputElement).value;

      const errEl = this.modalEl.querySelector('#login-error-msg') as HTMLElement;
      if (errEl) errEl.style.display = 'none';

      const res = await this.driverManager.login({
        driverTagOrEmail: tagOrEmail,
        password: password || undefined,
      });

      if (res.success) {
        this.activeTab = 'stats';
        this.render();
      } else {
        if (errEl) {
          errEl.textContent = res.message || 'Invalid login credentials.';
          errEl.style.display = 'block';
        }
      }
    });
  }
}
