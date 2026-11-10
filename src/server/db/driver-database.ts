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
  isDeveloperTag,
} from '../../common/auth/driver-types';
import {
  validateDriverTag,
  validateDisplayName,
  DEVELOPER_EMAIL,
} from '../../common/auth/moderation';

export interface ServerlessSignalMessage {
  id: string;
  roomCode: string;
  from: string;
  to?: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface ServerlessSignalRoom {
  roomCode: string;
  circuit: string;
  sessionStage: string;
  lapCount: number;
  maxDrivers: number;
  collisionEnabled: boolean;
  peers: Map<string, { peerId: string; driverTag: string; isHost: boolean; lastSeen: number }>;
  peerInboxes: Map<string, ServerlessSignalMessage[]>;
  lastActivity: number;
}

export interface PairSignalMessage {
  type: string;
  payload: any;
  timestamp: number;
}

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

  // Emergency Phase II-A: Serverless WebRTC signaling rooms
  private signalRooms = new Map<string, ServerlessSignalRoom>();

  // Emergency Phase II-A: Serverless WebRTC Phone-to-Desktop pairing signaling
  private pairSignals = new Map<string, { hostInbox: PairSignalMessage[]; controllerInbox: PairSignalMessage[]; lastActivity: number }>();

  // Authorized short tags (2 or 3 letters) approved by developer
  private authorizedShortTags = new Set<string>(['le']);

  constructor() {
    // Zero placeholder entries: clean slate. Leaderboards start blank until verified player hotlaps are recorded.
  }

  /**
   * Grants authorization for a 2-character or 3-character driver tag.
   * Only callable by the developer (hzguo117@gmail.com).
   */
  public grantShortTagAccess(tag: string, authorizedByEmail: string): { success: boolean; message: string } {
    const callerEmail = (authorizedByEmail || '').trim().toLowerCase();
    if (callerEmail !== DEVELOPER_EMAIL.toLowerCase()) {
      return {
        success: false,
        message: `Unauthorized. Only developer (${DEVELOPER_EMAIL}) can grant 2-letter or 3-letter tags.`,
      };
    }
    const cleanTag = (tag || '').trim().toLowerCase();
    if (cleanTag.length < 2 || cleanTag.length > 3) {
      return { success: false, message: 'Tag must be 2 or 3 characters long to grant short tag access.' };
    }
    this.authorizedShortTags.add(cleanTag);
    return { success: true, message: `Short tag "${cleanTag.toUpperCase()}" granted authorization.` };
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

    // Full validation: length (min 4 for standard, 2-3 restricted), profanity/hate-speech filter
    if (!isGuest || cleanTag.length < 4 || !cleanTag.startsWith('GUEST_')) {
      const tagValidation = validateDriverTag(payload.driverTag, payload.email, this.authorizedShortTags);
      if (!tagValidation.valid) {
        return { success: false, message: tagValidation.message || 'Invalid driver tag.' };
      }
    }

    if (payload.displayName) {
      const nameValidation = validateDisplayName(payload.displayName);
      if (!nameValidation.valid) {
        return { success: false, message: nameValidation.message || 'Invalid display name.' };
      }
    }

    const tagKey = cleanTag.toLowerCase();
    if (this.tagToUserId.has(tagKey)) {
      return { success: false, message: `Driver tag "${cleanTag}" is already registered.` };
    }

    const emailKey = (payload.email || '').trim().toLowerCase();
    if (!isGuest && emailKey && this.emailToUserId.has(emailKey)) {
      return { success: false, message: `Email "${payload.email}" is already in use.` };
    }

    const isDev = isDeveloperTag(cleanTag, payload.email);
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

    const tagValidation = validateDriverTag(payload.newDriverTag, payload.email, this.authorizedShortTags);
    if (!tagValidation.valid) {
      return { success: false, message: tagValidation.message || 'Invalid driver tag.' };
    }

    if (payload.displayName) {
      const nameValidation = validateDisplayName(payload.displayName);
      if (!nameValidation.valid) {
        return { success: false, message: nameValidation.message || 'Invalid display name.' };
      }
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

    const isDev = isDeveloperTag(cleanNewTag, payload.email);
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

    // Commit to global leaderboard (strictly ONE personal best entry per driver account per circuit)
    let board = this.leaderboards.get(circuitId) || [];
    const entryId = `${userId}_${circuitId}`;
    const existingEntryIdx = board.findIndex(
      (e) => e.driverTag.toLowerCase() === account.driverTag.toLowerCase() || e.id === entryId || e.id.startsWith(`${userId}_${circuitId}`)
    );

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
    const limit = Math.min(filter.limit || 25, 25);
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
      lapTimeMs: leader ? leader.lapTimeMs : (frames[frames.length - 1]?.timeMs || 0),
      driverTag: leader ? leader.driverTag : '',
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
  // EMERGENCY PHASE II-A: SERVERLESS WEBRTC SIGNALING
  // ==========================================

  public joinSignalRoom(
    roomCode: string,
    peerId: string,
    driverTag = 'RSR_RACER',
    isHost = false
  ): {
    success: boolean;
    roomCode: string;
    peerId: string;
    isHost: boolean;
    activePeers: string[];
    circuit: string;
    sessionStage: string;
    lapCount: number;
    collisionEnabled: boolean;
  } {
    const code = (roomCode || '4821').trim().toUpperCase();
    let room = this.signalRooms.get(code);
    const now = Date.now();

    if (!room) {
      room = {
        roomCode: code,
        circuit: 'nordschleife',
        sessionStage: 'lobby',
        lapCount: 3,
        maxDrivers: 10,
        collisionEnabled: false,
        peers: new Map(),
        peerInboxes: new Map(),
        lastActivity: now,
      };
      this.signalRooms.set(code, room);
    }

    room.lastActivity = now;

    // Purge peers inactive for > 60 seconds (except the calling peer)
    for (const [id, peer] of room.peers.entries()) {
      if (id !== peerId && now - peer.lastSeen > 60000) {
        room.peers.delete(id);
        room.peerInboxes.delete(id);
      }
    }

    // Determine host status: if no host exists or caller isHost, establish host
    const hostExists = Array.from(room.peers.values()).some((p) => p.isHost);
    const actualHost = isHost || !hostExists;

    room.peers.set(peerId, {
      peerId,
      driverTag,
      isHost: actualHost,
      lastSeen: now,
    });

    if (!room.peerInboxes.has(peerId)) {
      room.peerInboxes.set(peerId, []);
    }

    // Notify other peers in the room
    const existingPeers: string[] = [];
    for (const otherPeerId of room.peers.keys()) {
      if (otherPeerId !== peerId) {
        existingPeers.push(otherPeerId);
        const inbox = room.peerInboxes.get(otherPeerId);
        if (inbox) {
          inbox.push({
            id: `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
            roomCode: code,
            from: peerId,
            to: otherPeerId,
            type: 'peer_joined',
            payload: { peerId, driverTag, isHost: actualHost },
            timestamp: now,
          });
        }
      }
    }

    return {
      success: true,
      roomCode: code,
      peerId,
      isHost: actualHost,
      activePeers: existingPeers,
      circuit: room.circuit,
      sessionStage: room.sessionStage,
      lapCount: room.lapCount,
      collisionEnabled: room.collisionEnabled,
    };
  }

  public sendSignalMessage(
    roomCode: string,
    from: string,
    to: string | undefined,
    type: string,
    payload: any
  ): { success: boolean; deliveredTo: number } {
    const code = (roomCode || '').trim().toUpperCase();
    let room = this.signalRooms.get(code);
    if (!room) {
      room = {
        roomCode: code,
        circuit: 'nordschleife',
        sessionStage: 'lobby',
        lapCount: 3,
        maxDrivers: 10,
        collisionEnabled: false,
        peers: new Map(),
        peerInboxes: new Map(),
        lastActivity: Date.now(),
      };
      this.signalRooms.set(code, room);
    }

    const now = Date.now();
    room.lastActivity = now;

    // Update room configuration state if config payload
    if (type === 'lobby_config_update' && payload) {
      if (payload.circuit) room.circuit = payload.circuit;
      if (typeof payload.lapCount === 'number') room.lapCount = payload.lapCount;
      if (typeof payload.collisionEnabled === 'boolean') room.collisionEnabled = payload.collisionEnabled;
      if (payload.sessionStage) room.sessionStage = payload.sessionStage;
    } else if (type === 'race_start_qualifying') {
      room.sessionStage = 'qualifying';
    } else if (type === 'race_start_launch') {
      room.sessionStage = 'race';
    }

    const msg: ServerlessSignalMessage = {
      id: `msg_${now}_${Math.random().toString(36).substring(2, 8)}`,
      roomCode: code,
      from,
      to,
      type,
      payload,
      timestamp: now,
    };

    let count = 0;
    if (to && to !== 'all') {
      let inbox = room.peerInboxes.get(to);
      if (!inbox) {
        inbox = [];
        room.peerInboxes.set(to, inbox);
      }
      inbox.push(msg);
      count++;
    } else {
      // Broadcast to all other peers in room
      for (const [peerId, inbox] of room.peerInboxes.entries()) {
        if (peerId !== from) {
          inbox.push(msg);
          count++;
        }
      }
    }

    return { success: true, deliveredTo: count };
  }

  public pollSignalMessages(
    roomCode: string,
    peerId: string
  ): {
    success: boolean;
    messages: ServerlessSignalMessage[];
    activePeers: string[];
    circuit?: string;
    sessionStage?: string;
    lapCount?: number;
    collisionEnabled?: boolean;
  } {
    const code = (roomCode || '').trim().toUpperCase();
    let room = this.signalRooms.get(code);
    if (!room) {
      room = {
        roomCode: code,
        circuit: 'nordschleife',
        sessionStage: 'lobby',
        lapCount: 3,
        maxDrivers: 10,
        collisionEnabled: false,
        peers: new Map(),
        peerInboxes: new Map(),
        lastActivity: Date.now(),
      };
      this.signalRooms.set(code, room);
    }

    const now = Date.now();
    room.lastActivity = now;

    let peer = room.peers.get(peerId);
    if (peer) {
      peer.lastSeen = now;
    } else {
      peer = { peerId, driverTag: peerId, isHost: false, lastSeen: now };
      room.peers.set(peerId, peer);
    }

    let inbox = room.peerInboxes.get(peerId);
    if (!inbox) {
      inbox = [];
      room.peerInboxes.set(peerId, inbox);
    }
    const messages = [...inbox];
    inbox.length = 0; // Drain messages atomically

    const activePeers = Array.from(room.peers.keys()).filter((id) => id !== peerId);

    return {
      success: true,
      messages,
      activePeers,
      circuit: room.circuit,
      sessionStage: room.sessionStage,
      lapCount: room.lapCount,
      collisionEnabled: room.collisionEnabled,
    };
  }

  public getSignalRoomInfo(roomCode: string): ServerlessSignalRoom | null {
    const code = (roomCode || '').trim().toUpperCase();
    return this.signalRooms.get(code) || null;
  }

  // ==========================================
  // DIRECT PHONE-TO-DESKTOP WEBRTC PAIRING SIGNALING
  // ==========================================

  public sendPairSignal(
    pairToken: string,
    from: 'host' | 'controller',
    type: string,
    payload: any
  ): { success: boolean; message?: string } {
    const token = (pairToken || '').trim();
    if (!token) return { success: false, message: 'Missing pairing token.' };

    let session = this.pairSignals.get(token);
    const now = Date.now();
    if (!session) {
      session = { hostInbox: [], controllerInbox: [], lastActivity: now };
      this.pairSignals.set(token, session);
    }
    session.lastActivity = now;

    const msg: PairSignalMessage = { type, payload, timestamp: now };
    if (from === 'host') {
      session.controllerInbox.push(msg);
    } else {
      session.hostInbox.push(msg);
    }

    return { success: true };
  }

  public pollPairSignal(
    pairToken: string,
    role: 'host' | 'controller'
  ): { success: boolean; messages: PairSignalMessage[] } {
    const token = (pairToken || '').trim();
    const session = this.pairSignals.get(token);
    if (!session) return { success: true, messages: [] };

    session.lastActivity = Date.now();
    const inbox = role === 'host' ? session.hostInbox : session.controllerInbox;
    const messages = [...inbox];
    inbox.length = 0; // Drain messages

    return { success: true, messages };
  }

}

// Global singleton instance for the server runtime
export const globalDriverDatabase = new DriverDatabase();
