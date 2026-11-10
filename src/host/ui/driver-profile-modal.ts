import { DriverManager } from '../auth/driver-manager';
import { COUNTRIES, formatCountryBadge } from '../../common/auth/countries';
import { isDeveloperTag } from '../../common/auth/driver-types';

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
    const isDev = account?.isDeveloper || isDeveloperTag(driverTag);

    this.modalEl.innerHTML = `
      <div class="driver-modal-window">
        <header class="driver-modal-header">
          <div class="driver-header-id-row">
            <span class="driver-avatar-circle" style="background-color: ${account?.avatarColor || (isDev ? '#f59e0b' : '#38bdf8')};">
              ${driverTag.substring(0, 2).toUpperCase()}
            </span>
            <div class="driver-id-meta">
              <div class="driver-tag-row">
                <h2 class="driver-name-title">${account?.displayName || driverTag}</h2>
                <span class="driver-tag-badge">${driverTag}</span>
                ${isDev ? '<span class="dev-badge">⚡ DEV</span>' : ''}
                <span class="driver-country-tag">${formatCountryBadge(account?.countryCode || 'GLOBAL')}</span>
                ${isGuest ? '<span class="guest-pill">GUEST LICENSE</span>' : '<span class="verified-pill">VERIFIED PRO</span>'}
              </div>
              <p class="driver-sub-meta">FIA SIM-LITE PASSPORT • ${account?.preferredUnits || 'KM/H'} TELEMETRY ${isDev ? '• DEVELOPER ACCESS' : ''}</p>
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
    const account = this.driverManager.getAccount();

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
      const defaultTag = guestTag.startsWith('GUEST_') ? guestTag.replace('GUEST_', 'RACER_') : guestTag;
      const currentCountry = account?.countryCode || 'GLOBAL';

      return `
        <div class="driver-form-wrap">
          <p class="form-desc">
            Keep your current driving records (<strong>${stats?.totalDistanceKm.toFixed(1) || 0} km</strong> driven, all hotlaps and settings) and convert your temporary guest tag into a permanent verified driver identity.
          </p>

          <form id="claim-license-form" class="driver-auth-form">
            <div class="form-row">
              <label>PERMANENT DRIVER TAG</label>
              <input type="text" id="claim-tag" value="${defaultTag}" required minlength="2" maxlength="16" autocomplete="off" />
              <small>4-16 alphanumeric characters, underscores or hyphens (2-3 letter tags reserved for developer authorization, e.g. "le").</small>
            </div>

            <div class="form-row">
              <label>DISPLAY NAME</label>
              <input type="text" id="claim-name" placeholder="Driver Name" value="${guestTag}" required />
            </div>

            <div class="form-row">
              <label>EMAIL ADDRESS</label>
              <div class="input-with-button-row">
                <input type="email" id="claim-email" placeholder="driver@motorsport.com" required />
                <button type="button" id="btn-send-claim-otp" class="otp-send-btn">SEND CODE</button>
              </div>
              <small id="claim-otp-hint" class="otp-hint-text">Click "Send Code" to receive a 6-digit verification code (passwordless magic login supported).</small>
            </div>

            <div class="form-row">
              <label>EMAIL VERIFICATION CODE (OTP)</label>
              <input type="text" id="claim-otp" placeholder="6-digit code (e.g. 123456 or dev code 777777)" maxlength="6" autocomplete="one-time-code" />
              <small>Optional if password set, or use code for passwordless instant verification.</small>
            </div>

            <div class="form-row">
              <label>PASSWORD (OPTIONAL / PASSKEY)</label>
              <input type="password" id="claim-password" placeholder="•••••••• (leave blank for passwordless login)" />
            </div>

            <div class="form-row-grid">
              <div class="form-row">
                <label>COUNTRY AFFILIATION</label>
                <select id="claim-country">
                  ${COUNTRIES.map(
                    (c) => `<option value="${c.code}" ${c.code === currentCountry ? 'selected' : ''}>${c.flag} ${c.name} (${c.code})</option>`
                  ).join('')}
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
            <p>Signed in as <strong>${this.driverManager.getDriverTag()}</strong> ${account?.isDeveloper ? '<span class="dev-badge">⚡ DEV</span>' : ''}</p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Email: ${account?.email || 'verified'}</p>
            <button class="logout-btn" id="driver-logout-btn" type="button">SIGN OUT TO GUEST MODE</button>
          </div>
        `
            : `
          <p class="form-desc">Log into an existing verified driver license using your password OR passwordless email verification code.</p>
          <form id="driver-login-form" class="driver-auth-form">
            <div class="form-row">
              <label>DRIVER TAG OR EMAIL</label>
              <div class="input-with-button-row">
                <input type="text" id="login-tag" placeholder="le or driver@motorsport.com" required />
                <button type="button" id="btn-send-login-otp" class="otp-send-btn">EMAIL CODE</button>
              </div>
              <small id="login-otp-hint" class="otp-hint-text">To log in without a password, enter your email and click "Email Code".</small>
            </div>
            <div class="form-row">
              <label>ONE-TIME EMAIL CODE (OTP)</label>
              <input type="text" id="login-otp" placeholder="6-digit code (or master dev 777777)" maxlength="6" />
            </div>
            <div class="form-row">
              <label>PASSWORD (OPTIONAL IF OTP ENTERED)</label>
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

    // Send OTP on Claim tab
    const sendClaimOtpBtn = this.modalEl.querySelector('#btn-send-claim-otp') as HTMLButtonElement | null;
    sendClaimOtpBtn?.addEventListener('click', async () => {
      const emailInput = this.modalEl.querySelector('#claim-email') as HTMLInputElement;
      const hintEl = this.modalEl.querySelector('#claim-otp-hint') as HTMLElement;
      const email = emailInput?.value.trim();
      if (!email || !email.includes('@')) {
        if (hintEl) {
          hintEl.textContent = '⚠️ Please enter a valid email address first.';
          hintEl.style.color = '#f87171';
        }
        return;
      }
      sendClaimOtpBtn.textContent = 'SENDING...';
      sendClaimOtpBtn.disabled = true;
      try {
        const res = await this.driverManager.sendVerificationCode(email);
        if (res.success) {
          if (hintEl) {
            hintEl.textContent = res.message || '✅ Verification code dispatched! (Check dev console or use 777777)';
            hintEl.style.color = '#38bdf8';
          }
          sendClaimOtpBtn.textContent = 'RESEND';
        } else {
          if (hintEl) {
            hintEl.textContent = '⚠️ ' + (res.message || 'Failed to send code.');
            hintEl.style.color = '#f87171';
          }
          sendClaimOtpBtn.textContent = 'RETRY';
        }
      } catch (err) {
        if (hintEl) hintEl.textContent = '⚠️ Network error.';
      } finally {
        sendClaimOtpBtn.disabled = false;
      }
    });

    // Send OTP on Login tab
    const sendLoginOtpBtn = this.modalEl.querySelector('#btn-send-login-otp') as HTMLButtonElement | null;
    sendLoginOtpBtn?.addEventListener('click', async () => {
      const tagInput = this.modalEl.querySelector('#login-tag') as HTMLInputElement;
      const hintEl = this.modalEl.querySelector('#login-otp-hint') as HTMLElement;
      const target = tagInput?.value.trim();
      if (!target || !target.includes('@')) {
        if (hintEl) {
          hintEl.textContent = '⚠️ Please enter your registered email address in the field above.';
          hintEl.style.color = '#f87171';
        }
        return;
      }
      sendLoginOtpBtn.textContent = 'SENDING...';
      sendLoginOtpBtn.disabled = true;
      try {
        const res = await this.driverManager.sendVerificationCode(target);
        if (res.success) {
          if (hintEl) {
            hintEl.textContent = res.message || '✅ Code sent! Check dev console or use 777777.';
            hintEl.style.color = '#38bdf8';
          }
          sendLoginOtpBtn.textContent = 'RESEND';
        } else {
          if (hintEl) {
            hintEl.textContent = '⚠️ ' + (res.message || 'Failed to send code.');
            hintEl.style.color = '#f87171';
          }
          sendLoginOtpBtn.textContent = 'RETRY';
        }
      } catch (err) {
        if (hintEl) hintEl.textContent = '⚠️ Network error.';
      } finally {
        sendLoginOtpBtn.disabled = false;
      }
    });

    // Handle Claim Form submission
    const claimForm = this.modalEl.querySelector('#claim-license-form') as HTMLFormElement | null;
    claimForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTag = (this.modalEl.querySelector('#claim-tag') as HTMLInputElement).value.trim();
      const displayName = (this.modalEl.querySelector('#claim-name') as HTMLInputElement).value.trim();
      const email = (this.modalEl.querySelector('#claim-email') as HTMLInputElement).value.trim();
      const password = (this.modalEl.querySelector('#claim-password') as HTMLInputElement).value;
      const otpCode = (this.modalEl.querySelector('#claim-otp') as HTMLInputElement)?.value.trim();
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
        verificationCode: otpCode || undefined,
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
      const tagOrEmail = (this.modalEl.querySelector('#login-tag') as HTMLInputElement).value.trim();
      const password = (this.modalEl.querySelector('#login-password') as HTMLInputElement).value;
      const otpCode = (this.modalEl.querySelector('#login-otp') as HTMLInputElement)?.value.trim();

      const errEl = this.modalEl.querySelector('#login-error-msg') as HTMLElement;
      if (errEl) errEl.style.display = 'none';

      const res = await this.driverManager.login({
        driverTagOrEmail: tagOrEmail,
        password: password || undefined,
        verificationCode: otpCode || undefined,
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
