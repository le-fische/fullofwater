export interface DashUpdateData {
  rpmRatio: number;
  gear: number;
  speedKmh: number;
  shiftLight: boolean;
  abs: boolean;
  tc: boolean;
  rttMs: number;
  steerAngleDeg: number;
  connected: boolean;
}

export class DashDisplay {
  private container: HTMLElement;

  // Circular F1 Rev LEDs
  private f1LedElements: HTMLElement[] = [];

  // Segmented LCD Screen Elements
  private f1GearEl!: HTMLElement;
  private f1GearBoxEl!: HTMLElement;
  private f1SpeedEl!: HTMLElement;
  private f1RpmEl!: HTMLElement;

  // Status & Telemetry
  private rttEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private absBadge!: HTMLElement;
  private tcBadge!: HTMLElement;
  private steerGaugeNeedle!: HTMLElement;
  public rearViewBtn!: HTMLElement | null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.buildDOM();
  }

  private buildDOM(): void {
    // 15 Circular F1 Rev LEDs: 5 Green, 5 Red, 5 Blue
    let ledsHtml = '';
    for (let i = 0; i < 15; i++) {
      let colorClass = 'led-green';
      if (i >= 10) colorClass = 'led-blue';
      else if (i >= 5) colorClass = 'led-red';
      ledsHtml += `<div class="f1-circle-led ${colorClass}" data-index="${i}"></div>`;
    }

    this.container.innerHTML = `
      <div class="dash-screen mode-f1" id="dash-screen">
        
        <!-- Three-Zone Layout: Left (Brake), Center (F1 Wheel Display), Right (Throttle) -->
        <div class="controller-layout-grid">
          
          <!-- LEFT 1/3: BRAKE ZONE (ICON ONLY) -->
          <div class="zone-column zone-brake-col">
            <div class="zone-watermark-wrapper" id="brake-watermark">
              <svg class="zone-pedal-svg brake-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                <!-- Racing Brake Pedal -->
                <rect x="20" y="12" width="24" height="40" rx="4" stroke-width="3" fill="rgba(239, 68, 68, 0.12)"/>
                <line x1="25" y1="22" x2="39" y2="22" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="25" y1="32" x2="39" y2="32" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="25" y1="42" x2="39" y2="42" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
          </div>

          <!-- CENTER 1/3: REAL F1 STEERING WHEEL DISPLAY -->
          <div class="zone-column zone-center-col">
            
            <!-- Real F1 Wheel Central Housing -->
            <div class="f1-wheel-screen-housing">

              <!-- Top Circular Rev LEDs Bezel (15 Circles) -->
              <div class="f1-led-bezel">
                <div class="f1-led-tray">
                  ${ledsHtml}
                </div>
              </div>

              <!-- Segmented LCD Racing Box (Matching F1 Steering Reference) -->
              <div class="f1-lcd-box">
                <!-- Segment Header Row -->
                <div class="f1-lcd-header-row">
                  <span class="f1-hdr-cell">SPEED</span>
                  <span class="f1-hdr-cell">GEAR</span>
                  <span class="f1-hdr-cell">RPM</span>
                </div>

                <!-- Main Segment Grid Row -->
                <div class="f1-lcd-main-row">
                  <!-- Left Segment: Speed -->
                  <div class="f1-lcd-cell cell-speed">
                    <span class="f1-speed-digits" id="f1-speed">0</span>
                    <span class="f1-cell-unit">KM/H</span>
                  </div>

                  <!-- Center Segment: Gear Binnacle Box -->
                  <div class="f1-lcd-cell cell-gear gear-neutral" id="f1-gear-box">
                    <span class="f1-gear-num" id="f1-gear">N</span>
                  </div>

                  <!-- Right Segment: Modular RPM / Delta -->
                  <div class="f1-lcd-cell cell-rpm">
                    <span class="f1-rpm-digits" id="f1-rpm">2000</span>
                    <span class="f1-cell-unit">RPM</span>
                  </div>
                </div>

                <!-- Bottom Telemetry & Assist Segment Band -->
                <div class="f1-lcd-bottom-row">
                  <div class="f1-assist-group">
                    <span class="f1-status-badge" id="badge-abs">ABS</span>
                    <span class="f1-status-badge" id="badge-tc">TC</span>
                  </div>
                  <div class="f1-conn-group">
                    <span class="f1-meta-text" id="dash-conn-status">60Hz</span>
                    <span class="f1-meta-text rtt-num" id="dash-rtt">--ms</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- Momentary Look-Behind Rear View Button (Panoramic Mirror Icon) -->
            <div class="rear-view-control-wrapper">
              <button id="btn-rear-view" class="rear-view-btn" type="button" aria-label="Rear View Mirror">
                <svg class="mirror-svg" viewBox="0 0 54 20" fill="none" stroke="currentColor">
                  <path d="M4 6 C15 3, 39 3, 50 6 C52 9, 52 12, 50 15 C39 18, 15 18, 4 15 C2 12, 2 9, 4 6 Z" stroke-width="2.2" fill="rgba(56, 189, 248, 0.12)"/>
                  <line x1="20" y1="15" x2="24" y2="6" stroke-width="1.6" stroke-dasharray="2 2" stroke-linecap="round"/>
                  <line x1="34" y1="15" x2="30" y2="6" stroke-width="1.6" stroke-dasharray="2 2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- Butterfly Steering Wheel Orientation Indicator -->
            <div class="steer-indicator-wrapper">
              <div class="steer-horizon-bar"></div>
              <svg class="steer-wheel-svg" id="dash-steer-needle" viewBox="0 0 64 42" fill="none" aria-label="Steering Wheel Angle">
                <!-- Main Butterfly Outer Rim & Ergonomic Grips -->
                <path d="M22 10 C26 12, 38 12, 42 10 L48 11 C54 12, 59 16, 59 22 C59 26, 57 30, 53 34 C50 37, 44 37, 41 33 L39 28 L25 28 L23 33 C20 37, 14 37, 11 34 C7 30, 5 26, 5 22 C5 16, 10 12, 16 11 Z"
                      fill="#181a20" stroke="#52525b" stroke-width="1.8" stroke-linejoin="round" />
                <!-- Inner Spoke Cockpit Window -->
                <path d="M24 16 L40 16 L38 24 L26 24 Z" fill="#0c0d12" stroke="#27272a" stroke-width="1.2" />
                <!-- Left & Right Contoured Grips -->
                <path d="M7 21 C7 17, 10 14, 15 13 L16 26 C12 28, 7 26, 7 21 Z" fill="#27272a" />
                <path d="M57 21 C57 17, 54 14, 49 13 L48 26 C52 28, 57 26, 57 21 Z" fill="#27272a" />
                <!-- Center Hub Boss -->
                <rect x="27" y="17" width="10" height="9" rx="2" fill="#121318" stroke="#52525b" stroke-width="1" />
                <circle cx="32" cy="21.5" r="2.8" fill="#eab308" />
                <circle cx="32" cy="21.5" r="1.4" fill="#09090b" />
                <!-- Quick-Select Thumb Rotary Dials -->
                <circle cx="20" cy="18" r="1.4" fill="#38bdf8" />
                <circle cx="44" cy="18" r="1.4" fill="#ef4444" />
                <circle cx="20" cy="22" r="1.4" fill="#22c55e" />
                <circle cx="44" cy="22" r="1.4" fill="#facc15" />
                <!-- 12 O'Clock Motorsport Center Alignment Stripe -->
                <rect x="30.5" y="7" width="3" height="5" rx="0.8" fill="#facc15" stroke="#ca8a04" stroke-width="0.5" />
              </svg>
            </div>

            <!-- Bottom Center Action Buttons (CAM & RESET Icons Only) -->
            <div class="action-buttons-row">
              <button id="btn-cam" class="ctrl-btn icon-btn" type="button" aria-label="Switch Camera">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 7l-7 5 7 5V7z"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </button>
              <button id="btn-reset" class="ctrl-btn icon-btn respawn-btn" type="button" aria-label="Smart Respawn Track" title="Respawn Near Track (-8m)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            </div>

          </div>

          <!-- RIGHT 1/3: THROTTLE ZONE (ICON ONLY) -->
          <div class="zone-column zone-throttle-col">
            <div class="zone-watermark-wrapper" id="throttle-watermark">
              <svg class="zone-pedal-svg throttle-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                <!-- Racing Throttle Pedal -->
                <path d="M21 8 L43 8 L39 56 L25 56 Z" stroke-width="3" rx="3" fill="rgba(34, 197, 94, 0.12)"/>
                <!-- Acceleration Speed Chevrons -->
                <path d="M28 42 L32 37 L36 42" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M28 30 L32 25 L36 30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M28 18 L32 13 L36 18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

        </div>
      </div>
    `;

    // Cache elements
    this.rttEl = this.container.querySelector('#dash-rtt')!;
    this.statusEl = this.container.querySelector('#dash-conn-status')!;
    this.absBadge = this.container.querySelector('#badge-abs')!;
    this.tcBadge = this.container.querySelector('#badge-tc')!;
    this.steerGaugeNeedle = this.container.querySelector('#dash-steer-needle')!;
    this.rearViewBtn = this.container.querySelector('#btn-rear-view');

    // Segmented Screen Elements
    this.f1LedElements = Array.from(this.container.querySelectorAll('.f1-circle-led'));
    this.f1GearEl = this.container.querySelector('#f1-gear')!;
    this.f1GearBoxEl = this.container.querySelector('#f1-gear-box')!;
    this.f1SpeedEl = this.container.querySelector('#f1-speed')!;
    this.f1RpmEl = this.container.querySelector('#f1-rpm')!;
  }

  update(data: DashUpdateData): void {
    const rawSpeed = Math.abs(data.speedKmh);
    const safeSpeed = rawSpeed < 0.4 ? 0 : Math.round(rawSpeed);

    // Calculate approximate RPM dynamically from car powerband (2000 to 9000 RPM)
    const currentRpm = Math.round(2000 + data.rpmRatio * (9000 - 2000));

    // Gear formatting & Binnacle styling
    let gearText = 'N';
    this.f1GearBoxEl.className = 'f1-lcd-cell cell-gear';

    if (data.gear === -1) {
      gearText = 'R';
      this.f1GearBoxEl.classList.add('gear-reverse');
    } else if (data.gear === 0 || safeSpeed === 0) {
      gearText = 'N';
      this.f1GearBoxEl.classList.add('gear-neutral');
    } else {
      gearText = `${data.gear}`;
      this.f1GearBoxEl.classList.add('gear-drive');
    }

    // Update Segmented Screen Readouts
    this.f1GearEl.textContent = gearText;
    this.f1SpeedEl.textContent = `${safeSpeed}`;
    this.f1RpmEl.textContent = `${currentRpm}`;

    // Update 15 Circular Rev LEDs (5 Green, 5 Red, 5 Blue)
    // Authentic Porsche 911 RSR / Cosworth CCW powerband:
    // Rev LEDs unlit below 6,600 RPM.
    // 6,600 - 7,400 RPM: 5 Green LEDs
    // 7,400 - 8,200 RPM: 5 Red LEDs
    // 8,200 - 8,800 RPM: 5 Blue LEDs
    // >= 8,800 RPM or shiftLight flag: Shift strobe flash across all 15 LEDs
    let numActiveLeds = 0;
    if (currentRpm >= 6600) {
      if (currentRpm < 7400) {
        numActiveLeds = Math.min(5, Math.floor(((currentRpm - 6600) / 800) * 5) + 1);
      } else if (currentRpm < 8200) {
        numActiveLeds = 5 + Math.min(5, Math.floor(((currentRpm - 7400) / 800) * 5) + 1);
      } else {
        numActiveLeds = 10 + Math.min(5, Math.floor(((currentRpm - 8200) / 600) * 5) + 1);
      }
    }
    const isShiftStrobe = data.shiftLight || currentRpm >= 8800;

    for (let i = 0; i < 15; i++) {
      const led = this.f1LedElements[i];
      if (!led) continue;

      let baseColor = 'led-green';
      if (i >= 10) baseColor = 'led-blue';
      else if (i >= 5) baseColor = 'led-red';

      if (isShiftStrobe) {
        led.className = 'f1-circle-led shift-strobe';
      } else if (i < numActiveLeds) {
        led.className = `f1-circle-led ${baseColor} active`;
      } else {
        led.className = `f1-circle-led ${baseColor}`;
      }
    }

    // Update Assists
    if (data.abs) {
      this.absBadge.classList.add('active');
    } else {
      this.absBadge.classList.remove('active');
    }

    if (data.tc) {
      this.tcBadge.classList.add('active');
    } else {
      this.tcBadge.classList.remove('active');
    }

    if (data.connected) {
      this.statusEl.textContent = '60Hz';
      this.statusEl.className = 'f1-meta-text linked';
    } else {
      this.statusEl.textContent = 'WAIT';
      this.statusEl.className = 'f1-meta-text disconnected';
    }

    if (data.rttMs > 0 && data.connected) {
      const ms = Math.min(99, Math.max(0, Math.round(data.rttMs)));
      this.rttEl.textContent = `${String(ms).padStart(2, '0')}ms`;
    } else {
      this.rttEl.textContent = '--ms';
    }

    // Butterfly steering wheel orientation indicator (matches device tilt and car motion)
    if (this.steerGaugeNeedle) {
      this.steerGaugeNeedle.style.transform = `rotate(${data.steerAngleDeg}deg)`;
    }
  }
}
