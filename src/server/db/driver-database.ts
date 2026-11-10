import {
  UserAccount,
  DriverProfile,
  DriverStats,
  PersonalRecord,
  LeaderboardEntry,
  LeaderboardFilter,
  LapSubmissionPayload,
  LapSubmissionResult,
  GhostKeyframePayload,
  SessionPairingToken,
  RegisterPayload,
  LoginPayload,
  ClaimGuestPayload,
  AuthResponse,
  CIRCUIT_HOMOLOGATION,
  InputCategory,
  isDeveloperTag,
} from '../../common/auth/driver-types';

export function formatLapTime(ms: number): string {
  if (ms <= 0 || !isFinite(ms)) return '--:--.---';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

export class DriverDatabase {
  private users = new Map<string, UserAccount>(); // id -> user
  private tagToUserId = new Map<string, string>(); // lowercase tag -> id
  private emailToUserId = new Map<string, string>(); // lowercase email -> id
  private passwords = new Map<string, string>(); // userId -> password_hash
  private sessions = new Map<string, string>(); // sessionToken -> userId

  private profiles = new Map<string, DriverProfile>(); // userId -> profile
  private stats = new Map<string, DriverStats>(); // userId -> stats
  private personalRecords = new Map<string, PersonalRecord[]>(); // userId -> records

  // Leaderboards: circuitId -> LeaderboardEntry[]
  private leaderboards = new Map<string, LeaderboardEntry[]>();

  // World Record Ghost Trajectories: key `${circuitId}_${vehicleClass}_${weather}` -> GhostKeyframePayload[]
  private wrGhosts = new Map<string, GhostKeyframePayload[]>();

  // Pairing tokens: pairToken -> SessionPairingToken
  private pairingTokens = new Map<string, SessionPairingToken>();

  // Email verification OTP codes: email -> { code, expiresAt }
  private emailVerificationCodes = new Map<string, { code: string; expiresAt: number }>();

  constructor() {
    this.seedBenchmarkData();
  }

  // ==========================================
  // EMAIL VERIFICATION CODES (PASSWORDLESS / 2FA)
  // ==========================================

  public sendVerificationCode(email: string): { success: boolean; code?: string; message: string } {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please provide a valid email address.' };
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.emailVerificationCodes.set(cleanEmail, { code, expiresAt });
    console.log(`[Auth Email Service] 📧 Verification OTP for ${cleanEmail}: ${code} (Expires in 10m)`);
    return {
      success: true,
      code,
      message: `Verification code sent to ${cleanEmail}. In development, use code ${code} or dev bypass 777777.`,
    };
  }

  public verifyEmail(email: string, code: string): boolean {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();
    if (!cleanCode) return false;
    if (cleanCode === '777777') return true; // Master developer test code
    const stored = this.emailVerificationCodes.get(cleanEmail);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      this.emailVerificationCodes.delete(cleanEmail);
      return false;
    }
    const match = stored.code === cleanCode;
    if (match) {
      this.emailVerificationCodes.delete(cleanEmail);
    }
    return match;
  }

  // ==========================================
  // AUTHENTICATION & DRIVER ACCOUNTS
  // ==========================================

  public register(payload: RegisterPayload, isGuest = false): AuthResponse {
    const cleanTag = payload.driverTag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanTag.length < 2) {
      return { success: false, message: 'Driver tag must be at least 2 alphanumeric characters.' };
    }

    const tagKey = cleanTag.toLowerCase();
    if (this.tagToUserId.has(tagKey)) {
      return { success: false, message: `Driver tag "${cleanTag}" is already registered.` };
    }

    const emailKey = (payload.email || '').trim().toLowerCase();
    if (!isGuest && emailKey && this.emailToUserId.has(emailKey)) {
      return { success: false, message: `Email "${payload.email}" is already in use.` };
    }

    const isDev = isDeveloperTag(cleanTag);
    const isEmailVerified = isDev || (payload.verificationCode ? this.verifyEmail(payload.email, payload.verificationCode) : false);

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const countryCode = (payload.countryCode || 'GLOBAL').toUpperCase();

    const account: UserAccount = {
      id: userId,
      driverTag: cleanTag,
      email: payload.email || `${cleanTag.toLowerCase()}@guest.local`,
      emailVerified: isEmailVerified,
      displayName: payload.displayName || cleanTag,
      countryCode,
      avatarColor: payload.avatarColor || (isDev ? '#f59e0b' : '#38bdf8'),
      preferredUnits: payload.preferredUnits || 'km/h',
      isGuest,
      isDeveloper: isDev,
      createdAt: now,
    };

    const profile: DriverProfile = {
      userId,
      driverTag: cleanTag,
      displayName: account.displayName,
      countryCode: account.countryCode,
      avatarColor: account.avatarColor,
      preferredUnits: account.preferredUnits,
      isDeveloper: isDev,
      joinedDate: now,
    };

    const initialStats: DriverStats = {
      userId,
      driverTag: cleanTag,
      totalDistanceKm: 0,
      totalLapsCompleted: 0,
      cleanLapsCompleted: 0,
      cleanLapRatio: 100,
      favoriteVehicle: 'Porsche 911 RSR-19 (992)',
      favoriteLivery: 'Rexy Green #80',
      totalFlightTimeSeconds: 0,
      maxTopSpeedKmh: 0,
      lastActive: now,
      vehiclesDriven: {},
      liveriesUsed: {},
    };

    this.users.set(userId, account);
    this.tagToUserId.set(tagKey, userId);
    if (!isGuest && emailKey) {
      this.emailToUserId.set(emailKey, userId);
    }
    if (payload.password) {
      this.passwords.set(userId, payload.password);
    }

    this.profiles.set(userId, profile);
    this.stats.set(userId, initialStats);
    this.personalRecords.set(userId, []);

    const sessionToken = `tok_${userId}_${Math.random().toString(36).substring(2, 10)}`;
    this.sessions.set(sessionToken, userId);

    return {
      success: true,
      account,
      profile,
      stats: initialStats,
      personalRecords: [],
      sessionToken,
    };
  }

  public login(payload: LoginPayload): AuthResponse {
    const key = payload.driverTagOrEmail.trim().toLowerCase();
    const userId = this.tagToUserId.get(key) || this.emailToUserId.get(key);

    if (!userId) {
      return { success: false, message: 'Driver tag or email not found.' };
    }

    const account = this.users.get(userId);
    if (!account) {
      return { success: false, message: 'Account not found.' };
    }

    const storedPassword = this.passwords.get(userId);

    // If verification code is provided, verify email OTP (Passwordless Login)
    if (payload.verificationCode) {
      const ok = this.verifyEmail(account.email, payload.verificationCode);
      if (!ok) {
        return { success: false, message: 'Invalid or expired email verification code.' };
      }
      account.emailVerified = true;
    } else if (storedPassword) {
      // If user set a password, verify it
      if (!payload.password || storedPassword !== payload.password) {
        return {
          success: false,
          message: 'Invalid password. (Or log in with a 6-digit email verification code)',
        };
      }
    }

    const sessionToken = `tok_${userId}_${Math.random().toString(36).substring(2, 10)}`;
    this.sessions.set(sessionToken, userId);

    return {
      success: true,
      account,
      profile: this.profiles.get(userId),
      stats: this.stats.get(userId),
      personalRecords: this.personalRecords.get(userId) || [],
      sessionToken,
    };
  }

  public getAccountBySession(token: string): AuthResponse {
    const userId = this.sessions.get(token);
    if (!userId) {
      return { success: false, message: 'Invalid or expired session token.' };
    }
    const account = this.users.get(userId);
    if (!account) {
      return { success: false, message: 'User not found.' };
    }
    return {
      success: true,
      account,
      profile: this.profiles.get(userId),
      stats: this.stats.get(userId),
      personalRecords: this.personalRecords.get(userId) || [],
      sessionToken: token,
    };
  }

  public claimGuestAccount(payload: ClaimGuestPayload): AuthResponse {
    const guestKey = payload.guestTag.trim().toLowerCase();
    const guestUserId = this.tagToUserId.get(guestKey);

    const cleanNewTag = payload.newDriverTag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanNewTag.length < 2) {
      return { success: false, message: 'New driver tag must be at least 2 characters.' };
    }

    const newTagKey = cleanNewTag.toLowerCase();
    if (newTagKey !== guestKey && this.tagToUserId.has(newTagKey)) {
      return { success: false, message: `Driver tag "${cleanNewTag}" is already taken.` };
    }

    const emailKey = payload.email.trim().toLowerCase();
    if (this.emailToUserId.has(emailKey)) {
      return { success: false, message: `Email "${payload.email}" is already registered.` };
    }

    let userId = guestUserId;
    let existingStats: DriverStats | undefined;
    let existingRecords: PersonalRecord[] = [];

    if (userId) {
      existingStats = this.stats.get(userId);
      existingRecords = this.personalRecords.get(userId) || [];
      // Remove old tag index
      this.tagToUserId.delete(guestKey);
    } else {
      userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    const isDev = isDeveloperTag(cleanNewTag);
    const countryCode = (payload.countryCode || 'GLOBAL').toUpperCase();
    const isEmailVerified = isDev || (payload.verificationCode ? this.verifyEmail(payload.email, payload.verificationCode) : false);

    const now = Date.now();
    const account: UserAccount = {
      id: userId,
      driverTag: cleanNewTag,
      email: payload.email,
      emailVerified: isEmailVerified,
      displayName: payload.displayName || cleanNewTag,
      countryCode,
      avatarColor: payload.avatarColor || (isDev ? '#f59e0b' : '#10b981'),
      preferredUnits: payload.preferredUnits || 'km/h',
      isGuest: false,
      isDeveloper: isDev,
      createdAt: now,
    };

    const profile: DriverProfile = {
      userId,
      driverTag: cleanNewTag,
      displayName: account.displayName,
      countryCode: account.countryCode,
      avatarColor: account.avatarColor,
      preferredUnits: account.preferredUnits,
      isDeveloper: isDev,
      joinedDate: now,
    };

    const stats: DriverStats = existingStats
      ? { ...existingStats, userId, driverTag: cleanNewTag, lastActive: now }
      : {
          userId,
          driverTag: cleanNewTag,
          totalDistanceKm: 0,
          totalLapsCompleted: 0,
          cleanLapsCompleted: 0,
          cleanLapRatio: 100,
          favoriteVehicle: 'Porsche 911 RSR-19 (992)',
          favoriteLivery: 'Rexy Green #80',
          totalFlightTimeSeconds: 0,
          maxTopSpeedKmh: 0,
          lastActive: now,
          vehiclesDriven: {},
          liveriesUsed: {},
        };

    this.users.set(userId, account);
    this.tagToUserId.set(newTagKey, userId);
    this.emailToUserId.set(emailKey, userId);
    if (payload.password) {
      this.passwords.set(userId, payload.password);
    }

    this.profiles.set(userId, profile);
    this.stats.set(userId, stats);
    this.personalRecords.set(userId, existingRecords);

    // Update driver tag across existing leaderboard submissions
    for (const [circuitId, entries] of this.leaderboards.entries()) {
      let modified = false;
      for (const entry of entries) {
        if (entry.id.startsWith(userId)) {
          entry.driverTag = cleanNewTag;
          entry.displayName = account.displayName;
          entry.countryCode = account.countryCode;
          entry.avatarColor = account.avatarColor;
          modified = true;
        }
      }
      if (modified) {
        this.leaderboards.set(circuitId, entries);
      }
    }

    const sessionToken = `tok_${userId}_${Math.random().toString(36).substring(2, 10)}`;
    this.sessions.set(sessionToken, userId);

    return {
      success: true,
      account,
      profile,
      stats,
      personalRecords: existingRecords,
      sessionToken,
    };
  }

  // ==========================================
  // DRIVER ACTIVITY & TELEMETRY STATS
  // ==========================================

  public updateDriverActivity(
    driverTag: string,
    deltaKm: number,
    lapCompleted: boolean,
    isCleanLap: boolean,
    vehicleId: string,
    liveryName: string,
    flightTimeDeltaSeconds: number,
    currentSpeedKmh: number
  ): DriverStats | null {
    const key = driverTag.trim().toLowerCase();
    const userId = this.tagToUserId.get(key);
    if (!userId) return null;

    const stats = this.stats.get(userId);
    if (!stats) return null;

    stats.totalDistanceKm = Math.round((stats.totalDistanceKm + deltaKm) * 100) / 100;
    stats.totalFlightTimeSeconds = Math.round((stats.totalFlightTimeSeconds + flightTimeDeltaSeconds) * 10) / 10;
    if (currentSpeedKmh > stats.maxTopSpeedKmh) {
      stats.maxTopSpeedKmh = Math.round(currentSpeedKmh * 10) / 10;
    }

    if (lapCompleted) {
      stats.totalLapsCompleted += 1;
      if (isCleanLap) {
        stats.cleanLapsCompleted += 1;
      }
      stats.cleanLapRatio = Math.round((stats.cleanLapsCompleted / stats.totalLapsCompleted) * 100);
    }

    // Vehicle usage tracking
    if (vehicleId) {
      stats.vehiclesDriven[vehicleId] = (stats.vehiclesDriven[vehicleId] || 0) + deltaKm;
      let topVehicle = stats.favoriteVehicle;
      let maxDist = 0;
      for (const [vId, d] of Object.entries(stats.vehiclesDriven)) {
        if (d > maxDist) {
          maxDist = d;
          topVehicle = vId;
        }
      }
      stats.favoriteVehicle = topVehicle;
    }

    // Livery usage tracking
    if (liveryName) {
      stats.liveriesUsed[liveryName] = (stats.liveriesUsed[liveryName] || 0) + 1;
      let topLivery = stats.favoriteLivery;
      let maxCount = 0;
      for (const [lName, c] of Object.entries(stats.liveriesUsed)) {
        if (c > maxCount) {
          maxCount = c;
          topLivery = lName;
        }
      }
      stats.favoriteLivery = topLivery;
    }

    stats.lastActive = Date.now();
    this.stats.set(userId, stats);
    return stats;
  }

  public getDriverProfile(driverTag: string): {
    account?: UserAccount;
    profile?: DriverProfile;
    stats?: DriverStats;
    personalRecords?: PersonalRecord[];
  } | null {
    const key = driverTag.trim().toLowerCase();
    const userId = this.tagToUserId.get(key);
    if (!userId) return null;

    return {
      account: this.users.get(userId),
      profile: this.profiles.get(userId),
      stats: this.stats.get(userId),
      personalRecords: this.personalRecords.get(userId) || [],
    };
  }

  // ==========================================
  // SERVERLESS ANTI-CHEAT & LAP SUBMISSION
  // ==========================================

  public submitLap(submission: LapSubmissionPayload): LapSubmissionResult {
    const tagKey = submission.driverTag.trim().toLowerCase();
    let userId = this.tagToUserId.get(tagKey);

    // Auto-create guest user if not yet known
    if (!userId) {
      const reg = this.register({ driverTag: submission.driverTag, email: '' }, true);
      if (!reg.account) {
        return { accepted: false, reason: 'Could not register guest driver.', newPersonalBest: false, newWorldRecord: false };
      }
      userId = reg.account.id;
    }

    const account = this.users.get(userId)!;
    const circuitId = (submission.circuitId || 'nordschleife').toLowerCase();
    const bounds = CIRCUIT_HOMOLOGATION[circuitId];

    // 1. Clean Lap Integrity Check
    if (!submission.isLapValid) {
      return {
        accepted: false,
        reason: 'Anti-Cheat: Lap is marked invalid (wall collision, cut track, or recovery respawn).',
        newPersonalBest: false,
        newWorldRecord: false,
      };
    }

    // 2. Monotonic Sector Timing Verification
    if (!submission.sectorSplitsMs || submission.sectorSplitsMs.length === 0) {
      return {
        accepted: false,
        reason: 'Anti-Cheat: Missing intermediate sector checkpoint splits.',
        newPersonalBest: false,
        newWorldRecord: false,
      };
    }

    const sectorSum = submission.sectorSplitsMs.reduce((sum, s) => sum + s, 0);
    const sectorDelta = Math.abs(sectorSum - submission.totalLapTimeMs);
    // Allow up to 50ms floating-point delta between split timer summation and total lap elapsed
    if (sectorDelta > 50) {
      return {
        accepted: false,
        reason: `Anti-Cheat: Sector timing non-monotonic. Sum of sectors (${sectorSum.toFixed(1)}ms) does not equal total lap time (${submission.totalLapTimeMs.toFixed(1)}ms). Delta: ${sectorDelta.toFixed(1)}ms.`,
        newPersonalBest: false,
        newWorldRecord: false,
      };
    }

    // 3. Homologation Physical Boundary Envelope Check
    if (bounds) {
      if (submission.totalLapTimeMs < bounds.minPlausibleLapTimeMs) {
        return {
          accepted: false,
          reason: `Anti-Cheat: Lap time (${(submission.totalLapTimeMs / 1000).toFixed(2)}s) exceeds physical minimum homologation threshold (${(bounds.minPlausibleLapTimeMs / 1000).toFixed(2)}s) for ${bounds.name}.`,
          newPersonalBest: false,
          newWorldRecord: false,
        };
      }

      // Check average speed
      let circuitLengthKm = 20.832;
      if (circuitId === '24h') circuitLengthKm = 25.378;
      else if (circuitId === 'gp_strecke') circuitLengthKm = 5.148;
      else if (circuitId === 'proving_ground') circuitLengthKm = 6.000;

      const lapHours = submission.totalLapTimeMs / (1000 * 3600);
      const avgSpeedKmh = circuitLengthKm / lapHours;
      if (avgSpeedKmh > bounds.maxPlausibleAverageSpeedKmh) {
        return {
          accepted: false,
          reason: `Anti-Cheat: Average speed (${avgSpeedKmh.toFixed(1)} km/h) exceeds physical limit (${bounds.maxPlausibleAverageSpeedKmh} km/h).`,
          newPersonalBest: false,
          newWorldRecord: false,
        };
      }
    }

    // 4. Physical Vehicle Top Speed Check
    if (submission.topSpeedKmh > 350.0) {
      return {
        accepted: false,
        reason: `Anti-Cheat: Recorded top speed (${submission.topSpeedKmh.toFixed(1)} km/h) exceeds homologated speed envelope.`,
        newPersonalBest: false,
        newWorldRecord: false,
      };
    }

    // 5. Ghost Keyframe Trajectory Monotonicity (if submitted)
    if (submission.ghostTrajectory && submission.ghostTrajectory.length > 0) {
      const frames = submission.ghostTrajectory;
      if (frames.length < 5) {
        return {
          accepted: false,
          reason: 'Anti-Cheat: Ghost trajectory frame count insufficient for verification.',
          newPersonalBest: false,
          newWorldRecord: false,
        };
      }
      for (let i = 1; i < frames.length; i++) {
        if (frames[i].timeMs < frames[i - 1].timeMs) {
          return {
            accepted: false,
            reason: 'Anti-Cheat: Ghost trajectory contains backwards timestamp regression.',
            newPersonalBest: false,
            newWorldRecord: false,
          };
        }
      }
    }

    // All Anti-Cheat checks passed! Commit to database
    let userRecords = this.personalRecords.get(userId) || [];
    const existingRecIdx = userRecords.findIndex(
      (r) => r.circuitId === circuitId && r.vehicleId === submission.vehicleId && r.weather === submission.weather
    );

    let newPersonalBest = false;
    if (existingRecIdx >= 0) {
      if (submission.totalLapTimeMs < userRecords[existingRecIdx].bestLapTimeMs) {
        userRecords[existingRecIdx].bestLapTimeMs = submission.totalLapTimeMs;
        userRecords[existingRecIdx].sectorSplitsMs = submission.sectorSplitsMs;
        userRecords[existingRecIdx].topSpeedKmh = Math.max(userRecords[existingRecIdx].topSpeedKmh, submission.topSpeedKmh);
        userRecords[existingRecIdx].achievedAt = Date.now();
        newPersonalBest = true;
      }
    } else {
      userRecords.push({
        circuitId,
        vehicleId: submission.vehicleId,
        weather: submission.weather,
        bestLapTimeMs: submission.totalLapTimeMs,
        sectorSplitsMs: submission.sectorSplitsMs,
        topSpeedKmh: submission.topSpeedKmh,
        achievedAt: Date.now(),
      });
      newPersonalBest = true;
    }
    this.personalRecords.set(userId, userRecords);

    // Commit to global leaderboard
    let board = this.leaderboards.get(circuitId) || [];
    const entryId = `${userId}_${circuitId}_${submission.vehicleId}_${submission.weather}`;
    const existingEntryIdx = board.findIndex((e) => e.id === entryId);

    const vehicleName = submission.vehicleId.includes('rsr')
      ? 'Porsche 911 RSR-19 (992)'
      : submission.vehicleId;

    const newEntry: LeaderboardEntry = {
      rank: 1,
      id: entryId,
      driverTag: account.driverTag,
      displayName: account.displayName,
      countryCode: account.countryCode,
      avatarColor: account.avatarColor,
      circuitId,
      vehicleId: submission.vehicleId,
      vehicleName,
      vehicleClass: submission.vehicleClass || 'GTE',
      weather: submission.weather || 'clear',
      inputCategory: submission.inputCategory || 'keyboard',
      lapTimeMs: submission.totalLapTimeMs,
      lapTimeFormatted: formatLapTime(submission.totalLapTimeMs),
      deltaToLeaderMs: 0,
      sectorSplitsMs: submission.sectorSplitsMs,
      topSpeedKmh: submission.topSpeedKmh,
      timestamp: Date.now(),
      hasGhostTrajectory: !!(submission.ghostTrajectory && submission.ghostTrajectory.length > 0),
    };

    if (existingEntryIdx >= 0) {
      if (submission.totalLapTimeMs < board[existingEntryIdx].lapTimeMs) {
        board[existingEntryIdx] = newEntry;
      }
    } else {
      board.push(newEntry);
    }

    // Sort leaderboard ascending by lap time
    board.sort((a, b) => a.lapTimeMs - b.lapTimeMs);

    // Recalculate ranks & deltas
    const leaderTime = board[0].lapTimeMs;
    board.forEach((entry, idx) => {
      entry.rank = idx + 1;
      entry.deltaToLeaderMs = Math.round(entry.lapTimeMs - leaderTime);
    });

    this.leaderboards.set(circuitId, board);

    const updatedEntry = board.find((e) => e.id === entryId);
    const leaderboardRank = updatedEntry ? updatedEntry.rank : 1;
    const isWorldRecord = leaderboardRank === 1;

    // If new World Record, persist active WR ghost trajectory
    if (isWorldRecord && submission.ghostTrajectory && submission.ghostTrajectory.length > 0) {
      const wrKey = `${circuitId}_${submission.vehicleClass || 'GTE'}_${submission.weather || 'clear'}`;
      this.wrGhosts.set(wrKey, submission.ghostTrajectory);
    }

    return {
      accepted: true,
      newPersonalBest,
      newWorldRecord: isWorldRecord,
      leaderboardRank,
      deltaToLeaderMs: updatedEntry ? updatedEntry.deltaToLeaderMs : 0,
      entry: updatedEntry,
    };
  }

  // ==========================================
  // MULTI-DIMENSIONAL LEADERBOARD QUERIES
  // ==========================================

  public queryLeaderboard(filter: LeaderboardFilter): {
    total: number;
    entries: LeaderboardEntry[];
  } {
    const circuitId = (filter.circuitId || 'nordschleife').toLowerCase();
    let board = this.leaderboards.get(circuitId) || [];

    // Filter by vehicle class
    if (filter.vehicleClass && filter.vehicleClass !== 'all') {
      const targetClass = filter.vehicleClass.toLowerCase();
      board = board.filter((e) => e.vehicleClass.toLowerCase() === targetClass);
    }

    // Filter by weather
    if (filter.weather && filter.weather !== 'all') {
      const targetWeather = filter.weather.toLowerCase();
      board = board.filter((e) => e.weather.toLowerCase() === targetWeather);
    }

    // Filter by input category (gyro, keyboard, wheel)
    if (filter.inputCategory && filter.inputCategory !== 'all') {
      board = board.filter((e) => e.inputCategory === filter.inputCategory);
    }

    // Recalculate filtered ranks and delta to filtered leader
    if (board.length > 0) {
      const filteredLeaderTime = board[0].lapTimeMs;
      board = board.map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        deltaToLeaderMs: Math.round(entry.lapTimeMs - filteredLeaderTime),
      }));
    }

    const total = board.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    const paged = board.slice(offset, offset + limit);

    return { total, entries: paged };
  }

  // ==========================================
  // WORLD RECORD GHOST RETRIEVAL
  // ==========================================

  public getWorldRecordGhost(
    circuitId: string,
    vehicleClass = 'GTE',
    weather = 'clear'
  ): {
    hasGhost: boolean;
    circuitId: string;
    vehicleClass: string;
    weather: string;
    lapTimeMs: number;
    driverTag: string;
    keyframes: GhostKeyframePayload[];
  } | null {
    const cid = circuitId.toLowerCase();
    const wrKey = `${cid}_${vehicleClass}_${weather}`;
    let frames = this.wrGhosts.get(wrKey);

    // Fallback to any ghost for this circuit if exact class/weather not found
    if (!frames || frames.length === 0) {
      for (const [key, f] of this.wrGhosts.entries()) {
        if (key.startsWith(cid) && f.length > 0) {
          frames = f;
          break;
        }
      }
    }

    if (!frames || frames.length === 0) {
      return null;
    }

    // Find corresponding leaderboard entry
    const board = this.leaderboards.get(cid) || [];
    const leader = board[0];

    return {
      hasGhost: true,
      circuitId: cid,
      vehicleClass,
      weather,
      lapTimeMs: leader ? leader.lapTimeMs : 403616,
      driverTag: leader ? leader.driverTag : 'KEVIN_ESTRE_911',
      keyframes: frames,
    };
  }

  // ==========================================
  // AUTOMATED PHONE CONTROLLER DEVICE PAIRING
  // ==========================================

  public createPairingSession(driverTag: string, hostIp = 'localhost'): SessionPairingToken {
    const cleanTag = driverTag.trim().toUpperCase();
    const pairToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric token
    const now = Date.now();
    const tokenObj: SessionPairingToken = {
      pairToken,
      driverTag: cleanTag,
      hostIp,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000, // 15 minutes validity
      paired: false,
    };

    this.pairingTokens.set(pairToken, tokenObj);
    return tokenObj;
  }

  public verifyPairingSession(pairToken: string, driverTag?: string): {
    success: boolean;
    tokenObj?: SessionPairingToken;
    message?: string;
  } {
    const tokenObj = this.pairingTokens.get(pairToken);
    if (!tokenObj) {
      return { success: false, message: 'Invalid pairing token.' };
    }

    if (Date.now() > tokenObj.expiresAt) {
      this.pairingTokens.delete(pairToken);
      return { success: false, message: 'Pairing token has expired.' };
    }

    if (driverTag && tokenObj.driverTag !== driverTag.trim().toUpperCase()) {
      return { success: false, message: 'Driver tag does not match host pairing session.' };
    }

    tokenObj.paired = true;
    this.pairingTokens.set(pairToken, tokenObj);
    return { success: true, tokenObj };
  }

  public checkPairingStatus(pairToken: string): {
    paired: boolean;
    driverTag?: string;
    expiresAt?: number;
  } {
    const tokenObj = this.pairingTokens.get(pairToken);
    if (!tokenObj) return { paired: false };
    if (Date.now() > tokenObj.expiresAt) {
      this.pairingTokens.delete(pairToken);
      return { paired: false };
    }
    return {
      paired: tokenObj.paired,
      driverTag: tokenObj.driverTag,
      expiresAt: tokenObj.expiresAt,
    };
  }

  // ==========================================
  // INITIAL BENCHMARK SEED DATA
  // ==========================================

  private seedBenchmarkData(): void {
    // 1. Seed Real-World Nordschleife Benchmark Alien Drivers
    const alienDrivers = [
      {
        tag: 'KEVIN_ESTRE_911',
        name: 'Kévin Estre',
        country: 'FR',
        color: '#ef4444',
        class: 'GTE',
        lapTimeMs: 403616, // 6:43.616 (Sub-6:45 Nordschleife Benchmark)
        splits: [44500, 43100, 46200, 45800, 44900, 43800, 45200, 44600, 45516],
        topSpeed: 312.4,
        input: 'wheel' as InputCategory,
      },
      {
        tag: 'TIMO_BERNHARD',
        name: 'Timo Bernhard',
        country: 'DE',
        color: '#f59e0b',
        class: 'GTE',
        lapTimeMs: 407250, // 6:47.250
        splits: [45100, 43600, 46500, 46100, 45200, 44100, 45600, 45100, 45950],
        topSpeed: 309.8,
        input: 'wheel' as InputCategory,
      },
      {
        tag: 'MAX_VERSTAPPEN_1',
        name: 'Max Verstappen',
        country: 'NL',
        color: '#3b82f6',
        class: 'GTE',
        lapTimeMs: 408800, // 6:48.800
        splits: [45300, 43800, 46700, 46200, 45400, 44300, 45800, 45300, 46000],
        topSpeed: 314.1,
        input: 'wheel' as InputCategory,
      },
      {
        tag: 'MOBILE_APEX_KING',
        name: 'Alexandre Giro',
        country: 'IT',
        color: '#10b981',
        class: 'GTE',
        lapTimeMs: 414320, // 6:54.320 (Mobile Gyro Record)
        splits: [45900, 44400, 47300, 46800, 46000, 44900, 46400, 45900, 46720],
        topSpeed: 306.2,
        input: 'gyro' as InputCategory,
      },
      {
        tag: 'KEYBOARD_WARRIOR',
        name: 'Jonas Schmidt',
        country: 'DE',
        color: '#8b5cf6',
        class: 'GTE',
        lapTimeMs: 421800, // 7:01.800 (Desktop Keyboard Benchmark)
        splits: [46700, 45200, 48100, 47600, 46800, 45700, 47200, 46700, 47800],
        topSpeed: 304.5,
        input: 'keyboard' as InputCategory,
      },
    ];

    const nordschleifeBoard: LeaderboardEntry[] = [];
    const leaderTime = alienDrivers[0].lapTimeMs;

    alienDrivers.forEach((driver, idx) => {
      const userId = `usr_alien_${idx}`;
      const acc: UserAccount = {
        id: userId,
        driverTag: driver.tag,
        email: `${driver.tag.toLowerCase()}@racers.net`,
        displayName: driver.name,
        countryCode: driver.country,
        avatarColor: driver.color,
        preferredUnits: 'km/h',
        isGuest: false,
        createdAt: 1700000000000,
      };
      this.users.set(userId, acc);
      this.tagToUserId.set(driver.tag.toLowerCase(), userId);
      this.emailToUserId.set(acc.email.toLowerCase(), userId);

      this.profiles.set(userId, {
        userId,
        driverTag: driver.tag,
        displayName: driver.name,
        countryCode: driver.country,
        avatarColor: driver.color,
        preferredUnits: 'km/h',
        joinedDate: 1700000000000,
      });

      this.stats.set(userId, {
        userId,
        driverTag: driver.tag,
        totalDistanceKm: 1420 + idx * 250,
        totalLapsCompleted: 68 + idx * 12,
        cleanLapsCompleted: 65 + idx * 11,
        cleanLapRatio: 96,
        favoriteVehicle: 'Porsche 911 RSR-19 (992)',
        favoriteLivery: 'Rexy Green #80',
        totalFlightTimeSeconds: 42.5,
        maxTopSpeedKmh: driver.topSpeed,
        lastActive: Date.now() - idx * 3600000,
        vehiclesDriven: { porsche_911_rsr_19_992: 1420 },
        liveriesUsed: { 'Rexy Green #80': 50 },
      });

      nordschleifeBoard.push({
        rank: idx + 1,
        id: `${userId}_nordschleife_porsche_rsr_clear`,
        driverTag: driver.tag,
        displayName: driver.name,
        countryCode: driver.country,
        avatarColor: driver.color,
        circuitId: 'nordschleife',
        vehicleId: 'porsche_911_rsr_19_992',
        vehicleName: 'Porsche 911 RSR-19 (992)',
        vehicleClass: driver.class,
        weather: 'clear',
        inputCategory: driver.input,
        lapTimeMs: driver.lapTimeMs,
        lapTimeFormatted: formatLapTime(driver.lapTimeMs),
        deltaToLeaderMs: driver.lapTimeMs - leaderTime,
        sectorSplitsMs: driver.splits,
        topSpeedKmh: driver.topSpeed,
        timestamp: Date.now() - idx * 7200000,
        hasGhostTrajectory: idx === 0, // #1 has active WR ghost
      });
    });

    this.leaderboards.set('nordschleife', nordschleifeBoard);

    // 2. Seed 24h Gesamtkurs, GP-Strecke & Proving Ground Leaderboards
    this.leaderboards.set('24h', [
      {
        rank: 1,
        id: 'usr_alien_0_24h_rsr',
        driverTag: 'KEVIN_ESTRE_911',
        displayName: 'Kévin Estre',
        countryCode: 'FR',
        avatarColor: '#ef4444',
        circuitId: '24h',
        vehicleId: 'porsche_911_rsr_19_992',
        vehicleName: 'Porsche 911 RSR-19 (992)',
        vehicleClass: 'GTE',
        weather: 'clear',
        inputCategory: 'wheel',
        lapTimeMs: 489120, // 8:09.120
        lapTimeFormatted: formatLapTime(489120),
        deltaToLeaderMs: 0,
        sectorSplitsMs: [52000, 54000, 56000, 55000, 53000, 54000, 55000, 55000, 55120],
        topSpeedKmh: 310.2,
        timestamp: Date.now() - 100000,
        hasGhostTrajectory: false,
      },
    ]);

    this.leaderboards.set('gp_strecke', [
      {
        rank: 1,
        id: 'usr_alien_0_gp_rsr',
        driverTag: 'KEVIN_ESTRE_911',
        displayName: 'Kévin Estre',
        countryCode: 'FR',
        avatarColor: '#ef4444',
        circuitId: 'gp_strecke',
        vehicleId: 'porsche_911_rsr_19_992',
        vehicleName: 'Porsche 911 RSR-19 (992)',
        vehicleClass: 'GTE',
        weather: 'clear',
        inputCategory: 'wheel',
        lapTimeMs: 113400, // 1:53.400
        lapTimeFormatted: formatLapTime(113400),
        deltaToLeaderMs: 0,
        sectorSplitsMs: [38200, 37400, 37800],
        topSpeedKmh: 278.6,
        timestamp: Date.now() - 200000,
        hasGhostTrajectory: false,
      },
    ]);

    this.leaderboards.set('proving_ground', [
      {
        rank: 1,
        id: 'usr_alien_0_pg_rsr',
        driverTag: 'TIMO_BERNHARD',
        displayName: 'Timo Bernhard',
        countryCode: 'DE',
        avatarColor: '#f59e0b',
        circuitId: 'proving_ground',
        vehicleId: 'porsche_911_rsr_19_992',
        vehicleName: 'Porsche 911 RSR-19 (992)',
        vehicleClass: 'GTE',
        weather: 'clear',
        inputCategory: 'wheel',
        lapTimeMs: 72850, // 1:12.850
        lapTimeFormatted: formatLapTime(72850),
        deltaToLeaderMs: 0,
        sectorSplitsMs: [24200, 24300, 24350],
        topSpeedKmh: 318.5,
        timestamp: Date.now() - 300000,
        hasGhostTrajectory: false,
      },
    ]);

    // 3. Seed synthetic 30 Hz keyframes for the #1 Nordschleife World Record Ghost
    const wrGhostFrames: GhostKeyframePayload[] = [];
    const totalLapMs = alienDrivers[0].lapTimeMs; // 403616 ms
    const frameIntervalMs = 1000 / 30; // 33.33 ms
    const totalFrames = Math.floor(totalLapMs / frameIntervalMs);
    const totalCircuitLengthM = 20710;

    for (let i = 0; i < totalFrames; i++) {
      const timeMs = Math.round(i * frameIntervalMs);
      const progress = i / totalFrames;
      const distanceM = progress * totalCircuitLengthM;
      // Synthetic smooth oval curve coordinates for benchmark fallback
      const angle = progress * Math.PI * 2;
      const x = Math.sin(angle) * 1200;
      const y = 350 + Math.sin(angle * 3) * 60;
      const z = Math.cos(angle) * 2400;
      const steerRad = Math.sin(angle * 8) * 0.15;

      wrGhostFrames.push({
        timeMs,
        distanceM,
        x,
        y,
        z,
        qx: 0,
        qy: Math.sin(angle / 2),
        qz: 0,
        qw: Math.cos(angle / 2),
        steerRad,
      });
    }

    this.wrGhosts.set('nordschleife_GTE_clear', wrGhostFrames);
  }
}

// Global singleton instance for the server runtime
export const globalDriverDatabase = new DriverDatabase();
