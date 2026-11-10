import {
  UserAccount,
  DriverProfile,
  DriverStats,
  PersonalRecord,
  LapSubmissionPayload,
  LapSubmissionResult,
  GhostKeyframePayload,
  RegisterPayload,
  LoginPayload,
  ClaimGuestPayload,
  AuthResponse,
  LeaderboardFilter,
  LeaderboardEntry,
  InputCategory,
} from '../../common/auth/driver-types';

const STORAGE_KEY_TOKEN = 'fullofwater_driver_token';
const STORAGE_KEY_GUEST_TAG = 'fullofwater_guest_tag';

export class DriverManager {
  private currentAccount: UserAccount | null = null;
  private currentProfile: DriverProfile | null = null;
  private currentStats: DriverStats | null = null;
  private currentRecords: PersonalRecord[] = [];
  private sessionToken: string | null = null;

  // Active Pairing Session
  private activePairToken: string | null = null;
  private isPhonePairingVerified = false;
  private pairingPollTimer: number | null = null;

  // Live session telemetry accumulation
  private sessionDistanceMeters = 0;
  private sessionFlightTimeSeconds = 0;
  private sessionMaxSpeedKmh = 0;
  private lastFlushTime = 0;

  // Event callbacks
  public onAuthChange?: (account: UserAccount | null, stats: DriverStats | null) => void;
  public onPairingStatusChange?: (isPaired: boolean, pairToken: string) => void;

  constructor() {
    this.initSession();
  }

  private async initSession(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (savedToken) {
      try {
        const res = await fetch(`/api/auth/profile?token=${encodeURIComponent(savedToken)}`);
        if (res.ok) {
          const data: AuthResponse = await res.json();
          if (data.success && data.account) {
            this.currentAccount = data.account;
            this.currentProfile = data.profile || null;
            this.currentStats = data.stats || null;
            this.currentRecords = data.personalRecords || [];
            this.sessionToken = savedToken;
            this.notifyAuthChange();
            return;
          }
        }
      } catch {
        // Fallback to local guest if network/api is down or offline
      }
    }

    // Initialize or restore guest identity
    let guestTag = localStorage.getItem(STORAGE_KEY_GUEST_TAG);
    if (!guestTag) {
      guestTag = `GUEST_${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem(STORAGE_KEY_GUEST_TAG, guestTag);
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverTag: guestTag,
          email: `${guestTag.toLowerCase()}@guest.local`,
          displayName: guestTag,
          isGuest: true,
        }),
      });
      if (res.ok) {
        const data: AuthResponse = await res.json();
        if (data.success && data.account) {
          this.currentAccount = data.account;
          this.currentProfile = data.profile || null;
          this.currentStats = data.stats || null;
          this.sessionToken = data.sessionToken || null;
          if (this.sessionToken) {
            localStorage.setItem(STORAGE_KEY_TOKEN, this.sessionToken);
          }
          this.notifyAuthChange();
          return;
        }
      }
    } catch {
      // Fallback in-memory guest
    }

    // Offline in-memory fallback
    this.currentAccount = {
      id: `usr_${guestTag}`,
      driverTag: guestTag,
      email: `${guestTag.toLowerCase()}@guest.local`,
      displayName: guestTag,
      countryCode: 'DE',
      avatarColor: '#38bdf8',
      preferredUnits: 'km/h',
      isGuest: true,
      createdAt: Date.now(),
    };
    this.currentProfile = {
      userId: this.currentAccount.id,
      driverTag: guestTag,
      displayName: guestTag,
      countryCode: 'DE',
      avatarColor: '#38bdf8',
      preferredUnits: 'km/h',
      joinedDate: Date.now(),
    };
    this.currentStats = {
      userId: this.currentAccount.id,
      driverTag: guestTag,
      totalDistanceKm: 0,
      totalLapsCompleted: 0,
      cleanLapsCompleted: 0,
      cleanLapRatio: 100,
      favoriteVehicle: 'Porsche 911 RSR-19 (992)',
      favoriteLivery: 'Rexy Green #80',
      totalFlightTimeSeconds: 0,
      maxTopSpeedKmh: 0,
      lastActive: Date.now(),
      vehiclesDriven: {},
      liveriesUsed: {},
    };
    this.notifyAuthChange();
  }

  public getAccount(): UserAccount | null {
    return this.currentAccount;
  }

  public getProfile(): DriverProfile | null {
    return this.currentProfile;
  }

  public getStats(): DriverStats | null {
    return this.currentStats;
  }

  public getPersonalRecords(): PersonalRecord[] {
    return this.currentRecords;
  }

  public isGuest(): boolean {
    return !this.currentAccount || this.currentAccount.isGuest;
  }

  public getDriverTag(): string {
    return this.currentAccount ? this.currentAccount.driverTag : 'GUEST';
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  private notifyAuthChange(): void {
    if (this.onAuthChange) {
      this.onAuthChange(this.currentAccount, this.currentStats);
    }
  }

  // ==========================================
  // AUTHENTICATION API METHODS
  // ==========================================

  public async register(payload: RegisterPayload): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: AuthResponse = await res.json();
      if (data.success && data.account) {
        this.currentAccount = data.account;
        this.currentProfile = data.profile || null;
        this.currentStats = data.stats || null;
        this.currentRecords = data.personalRecords || [];
        this.sessionToken = data.sessionToken || null;
        if (this.sessionToken && typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_TOKEN, this.sessionToken);
        }
        this.notifyAuthChange();
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error during registration.' };
    }
  }

  public async login(payload: LoginPayload): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: AuthResponse = await res.json();
      if (data.success && data.account) {
        this.currentAccount = data.account;
        this.currentProfile = data.profile || null;
        this.currentStats = data.stats || null;
        this.currentRecords = data.personalRecords || [];
        this.sessionToken = data.sessionToken || null;
        if (this.sessionToken && typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_TOKEN, this.sessionToken);
        }
        this.notifyAuthChange();
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error during login.' };
    }
  }

  public async claimGuestLicense(payload: ClaimGuestPayload): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/claim-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: AuthResponse = await res.json();
      if (data.success && data.account) {
        this.currentAccount = data.account;
        this.currentProfile = data.profile || null;
        this.currentStats = data.stats || null;
        this.currentRecords = data.personalRecords || [];
        this.sessionToken = data.sessionToken || null;
        if (this.sessionToken && typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_TOKEN, this.sessionToken);
        }
        this.notifyAuthChange();
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error claiming guest account.' };
    }
  }

  public logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    this.sessionToken = null;
    this.currentAccount = null;
    this.currentProfile = null;
    this.currentStats = null;
    this.currentRecords = [];
    this.initSession();
  }

  // ==========================================
  // AUTOMATED PHONE CONTROLLER PAIRING
  // ==========================================

  public async startPairingSession(hostIp: string): Promise<string | null> {
    this.stopPairingPoll();
    const tag = this.getDriverTag();

    try {
      const res = await fetch('/api/pair/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverTag: tag, hostIp }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pairing) {
          this.activePairToken = data.pairing.pairToken;
          this.isPhonePairingVerified = false;
          this.startPairingPoll();
          return this.activePairToken;
        }
      }
    } catch {
      // Fallback local 6-digit PIN
    }

    this.activePairToken = Math.floor(100000 + Math.random() * 900000).toString();
    this.startPairingPoll();
    return this.activePairToken;
  }

  public getActivePairToken(): string | null {
    return this.activePairToken;
  }

  public isPhonePaired(): boolean {
    return this.isPhonePairingVerified;
  }

  private startPairingPoll(): void {
    if (this.pairingPollTimer !== null) return;
    this.pairingPollTimer = window.setInterval(async () => {
      if (!this.activePairToken) return;
      try {
        const res = await fetch(`/api/pair/status?token=${this.activePairToken}`);
        if (res.ok) {
          const data = await res.json();
          if (data.paired && !this.isPhonePairingVerified) {
            this.isPhonePairingVerified = true;
            if (this.onPairingStatusChange) {
              this.onPairingStatusChange(true, this.activePairToken!);
            }
          }
        }
      } catch {
        // Silently retry
      }
    }, 1500);
  }

  public stopPairingPoll(): void {
    if (this.pairingPollTimer !== null) {
      clearInterval(this.pairingPollTimer);
      this.pairingPollTimer = null;
    }
  }

  // ==========================================
  // TELEMETRY & ACTIVITY STATS TRACKING
  // ==========================================

  public accumulateSessionStep(
    distanceDeltaM: number,
    speedKmh: number,
    isAirborne: boolean,
    stepDtSeconds: number
  ): void {
    if (distanceDeltaM > 0) {
      this.sessionDistanceMeters += distanceDeltaM;
    }
    if (isAirborne && stepDtSeconds > 0) {
      this.sessionFlightTimeSeconds += stepDtSeconds;
    }
    if (speedKmh > this.sessionMaxSpeedKmh) {
      this.sessionMaxSpeedKmh = speedKmh;
    }

    const now = performance.now();
    // Flush telemetry stats to API every 15 seconds or on significant milestone
    if (now - this.lastFlushTime > 15000 && this.sessionDistanceMeters > 50) {
      this.flushTelemetryStats(false, false, 'porsche_911_rsr_19_992', 'Rexy Green #80');
    }
  }

  public async flushTelemetryStats(
    lapCompleted: boolean,
    isCleanLap: boolean,
    vehicleId: string,
    liveryName: string
  ): Promise<void> {
    const deltaKm = Math.round((this.sessionDistanceMeters / 1000) * 100) / 100;
    const flightTime = Math.round(this.sessionFlightTimeSeconds * 10) / 10;
    const speed = this.sessionMaxSpeedKmh;

    this.sessionDistanceMeters = 0;
    this.sessionFlightTimeSeconds = 0;
    this.lastFlushTime = performance.now();

    if (deltaKm <= 0 && !lapCompleted) return;

    try {
      const res = await fetch('/api/stats/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverTag: this.getDriverTag(),
          deltaKm,
          lapCompleted,
          isCleanLap,
          vehicleId,
          liveryName,
          flightTimeDeltaSeconds: flightTime,
          currentSpeedKmh: speed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          this.currentStats = data.stats;
          this.notifyAuthChange();
        }
      }
    } catch {
      // Local stat accumulation fallback
      if (this.currentStats) {
        this.currentStats.totalDistanceKm += deltaKm;
        if (lapCompleted) {
          this.currentStats.totalLapsCompleted += 1;
          if (isCleanLap) this.currentStats.cleanLapsCompleted += 1;
          this.currentStats.cleanLapRatio = Math.round(
            (this.currentStats.cleanLapsCompleted / this.currentStats.totalLapsCompleted) * 100
          );
        }
        this.currentStats.maxTopSpeedKmh = Math.max(this.currentStats.maxTopSpeedKmh, speed);
        this.notifyAuthChange();
      }
    }
  }

  // ==========================================
  // SERVERLESS LAP SUBMISSION & LEADERBOARD
  // ==========================================

  public async submitLap(
    circuitId: string,
    vehicleId: string,
    vehicleClass: string,
    weather: string,
    inputCategory: InputCategory,
    totalLapTimeMs: number,
    sectorSplitsMs: number[],
    topSpeedKmh: number,
    isLapValid: boolean,
    ghostTrajectory?: GhostKeyframePayload[]
  ): Promise<LapSubmissionResult> {
    // Flush pending session stats with lap completed flag
    await this.flushTelemetryStats(true, isLapValid, vehicleId, 'Rexy Green #80');

    const payload: LapSubmissionPayload = {
      driverTag: this.getDriverTag(),
      sessionToken: this.sessionToken || undefined,
      circuitId,
      vehicleId,
      vehicleClass,
      weather,
      inputCategory,
      totalLapTimeMs,
      sectorSplitsMs,
      topSpeedKmh,
      isLapValid,
      ghostTrajectory,
    };

    try {
      const res = await fetch('/api/laps/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: LapSubmissionResult = await res.json();
      return data;
    } catch (err: any) {
      return {
        accepted: false,
        reason: err.message || 'Network submission error.',
        newPersonalBest: false,
        newWorldRecord: false,
      };
    }
  }

  public async fetchLeaderboard(filter: LeaderboardFilter): Promise<{
    total: number;
    entries: LeaderboardEntry[];
  }> {
    const params = new URLSearchParams();
    if (filter.circuitId) params.set('circuit', filter.circuitId);
    if (filter.vehicleClass) params.set('class', filter.vehicleClass);
    if (filter.weather) params.set('weather', filter.weather);
    if (filter.inputCategory) params.set('input', filter.inputCategory);
    if (filter.limit) params.set('limit', filter.limit.toString());
    if (filter.offset) params.set('offset', filter.offset.toString());

    try {
      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return { total: data.total, entries: data.entries };
      }
    } catch {
      // Fallback empty
    }
    return { total: 0, entries: [] };
  }

  public async fetchWorldRecordGhost(
    circuitId: string,
    vehicleClass = 'GTE',
    weather = 'clear'
  ): Promise<{
    hasGhost: boolean;
    lapTimeMs: number;
    driverTag: string;
    keyframes: GhostKeyframePayload[];
  } | null> {
    try {
      const res = await fetch(
        `/api/ghost/wr?circuit=${encodeURIComponent(circuitId)}&class=${encodeURIComponent(
          vehicleClass
        )}&weather=${encodeURIComponent(weather)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.ghost) {
          return data.ghost;
        }
      }
    } catch {
      // Network error
    }
    return null;
  }
}
