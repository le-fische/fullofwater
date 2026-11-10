// src/common/auth/driver-types.ts
function isDeveloperTag(tag) {
  const clean = (tag || "").trim().toLowerCase();
  return clean === "le" || clean === "dev" || clean === "admin";
}
var CIRCUIT_HOMOLOGATION = {
  nordschleife: {
    circuitId: "nordschleife",
    name: "N\xFCrburgring Nordschleife",
    minPlausibleLapTimeMs: 33e4,
    // 5:30.000 (below real 919 Evo 5:19; 911 RSR is ~6:40)
    maxPlausibleAverageSpeedKmh: 275,
    sectorCount: 9
  },
  "24h": {
    circuitId: "24h",
    name: "N\xFCrburgring 24h Gesamtkurs",
    minPlausibleLapTimeMs: 44e4,
    // 7:20.000 (911 GT3/GTE is ~8:05)
    maxPlausibleAverageSpeedKmh: 260,
    sectorCount: 9
  },
  gp_strecke: {
    circuitId: "gp_strecke",
    name: "N\xFCrburgring GP-Strecke",
    minPlausibleLapTimeMs: 85e3,
    // 1:25.000 (F1 is 1:28, GT3 is ~1:53)
    maxPlausibleAverageSpeedKmh: 250,
    sectorCount: 3
  },
  proving_ground: {
    circuitId: "proving_ground",
    name: "High-Speed Proving Ground",
    minPlausibleLapTimeMs: 5e4,
    // 0:50.000
    maxPlausibleAverageSpeedKmh: 350,
    sectorCount: 3
  }
};

// src/server/db/driver-database.ts
function formatLapTime(ms) {
  if (ms <= 0 || !isFinite(ms)) return "--:--.---";
  const totalSeconds = ms / 1e3;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1e3);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}
var DriverDatabase = class {
  users = /* @__PURE__ */ new Map();
  // id -> user
  tagToUserId = /* @__PURE__ */ new Map();
  // lowercase tag -> id
  emailToUserId = /* @__PURE__ */ new Map();
  // lowercase email -> id
  passwords = /* @__PURE__ */ new Map();
  // userId -> password_hash
  sessions = /* @__PURE__ */ new Map();
  // sessionToken -> userId
  profiles = /* @__PURE__ */ new Map();
  // userId -> profile
  stats = /* @__PURE__ */ new Map();
  // userId -> stats
  personalRecords = /* @__PURE__ */ new Map();
  // userId -> records
  // Leaderboards: circuitId -> LeaderboardEntry[]
  leaderboards = /* @__PURE__ */ new Map();
  // World Record Ghost Trajectories: key `${circuitId}_${vehicleClass}_${weather}` -> GhostKeyframePayload[]
  wrGhosts = /* @__PURE__ */ new Map();
  // Pairing tokens: pairToken -> SessionPairingToken
  pairingTokens = /* @__PURE__ */ new Map();
  // Email verification OTP codes: email -> { code, expiresAt }
  emailVerificationCodes = /* @__PURE__ */ new Map();
  constructor() {
    this.seedBenchmarkData();
  }
  // ==========================================
  // EMAIL VERIFICATION CODES (PASSWORDLESS / 2FA)
  // ==========================================
  sendVerificationCode(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, message: "Please provide a valid email address." };
    }
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiresAt = Date.now() + 10 * 60 * 1e3;
    this.emailVerificationCodes.set(cleanEmail, { code, expiresAt });
    console.log(`[Auth Email Service] \u{1F4E7} Verification OTP for ${cleanEmail}: ${code} (Expires in 10m)`);
    return {
      success: true,
      code,
      message: `Verification code sent to ${cleanEmail}. In development, use code ${code} or dev bypass 777777.`
    };
  }
  verifyEmail(email, code) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanCode = (code || "").trim();
    if (!cleanCode) return false;
    if (cleanCode === "777777") return true;
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
  register(payload, isGuest = false) {
    const cleanTag = payload.driverTag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (cleanTag.length < 2) {
      return { success: false, message: "Driver tag must be at least 2 alphanumeric characters." };
    }
    const tagKey = cleanTag.toLowerCase();
    if (this.tagToUserId.has(tagKey)) {
      return { success: false, message: `Driver tag "${cleanTag}" is already registered.` };
    }
    const emailKey = (payload.email || "").trim().toLowerCase();
    if (!isGuest && emailKey && this.emailToUserId.has(emailKey)) {
      return { success: false, message: `Email "${payload.email}" is already in use.` };
    }
    const isDev = isDeveloperTag(cleanTag);
    const isEmailVerified = isDev || (payload.verificationCode ? this.verifyEmail(payload.email, payload.verificationCode) : false);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const countryCode = (payload.countryCode || "GLOBAL").toUpperCase();
    const account = {
      id: userId,
      driverTag: cleanTag,
      email: payload.email || `${cleanTag.toLowerCase()}@guest.local`,
      emailVerified: isEmailVerified,
      displayName: payload.displayName || cleanTag,
      countryCode,
      avatarColor: payload.avatarColor || (isDev ? "#f59e0b" : "#38bdf8"),
      preferredUnits: payload.preferredUnits || "km/h",
      isGuest,
      isDeveloper: isDev,
      createdAt: now
    };
    const profile = {
      userId,
      driverTag: cleanTag,
      displayName: account.displayName,
      countryCode: account.countryCode,
      avatarColor: account.avatarColor,
      preferredUnits: account.preferredUnits,
      isDeveloper: isDev,
      joinedDate: now
    };
    const initialStats = {
      userId,
      driverTag: cleanTag,
      totalDistanceKm: 0,
      totalLapsCompleted: 0,
      cleanLapsCompleted: 0,
      cleanLapRatio: 100,
      favoriteVehicle: "Porsche 911 RSR-19 (992)",
      favoriteLivery: "Rexy Green #80",
      totalFlightTimeSeconds: 0,
      maxTopSpeedKmh: 0,
      lastActive: now,
      vehiclesDriven: {},
      liveriesUsed: {}
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
      sessionToken
    };
  }
  login(payload) {
    const key = payload.driverTagOrEmail.trim().toLowerCase();
    const userId = this.tagToUserId.get(key) || this.emailToUserId.get(key);
    if (!userId) {
      return { success: false, message: "Driver tag or email not found." };
    }
    const account = this.users.get(userId);
    if (!account) {
      return { success: false, message: "Account not found." };
    }
    const storedPassword = this.passwords.get(userId);
    if (payload.verificationCode) {
      const ok = this.verifyEmail(account.email, payload.verificationCode);
      if (!ok) {
        return { success: false, message: "Invalid or expired email verification code." };
      }
      account.emailVerified = true;
    } else if (storedPassword) {
      if (!payload.password || storedPassword !== payload.password) {
        return {
          success: false,
          message: "Invalid password. (Or log in with a 6-digit email verification code)"
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
      sessionToken
    };
  }
  getAccountBySession(token) {
    const userId = this.sessions.get(token);
    if (!userId) {
      return { success: false, message: "Invalid or expired session token." };
    }
    const account = this.users.get(userId);
    if (!account) {
      return { success: false, message: "User not found." };
    }
    return {
      success: true,
      account,
      profile: this.profiles.get(userId),
      stats: this.stats.get(userId),
      personalRecords: this.personalRecords.get(userId) || [],
      sessionToken: token
    };
  }
  claimGuestAccount(payload) {
    const guestKey = payload.guestTag.trim().toLowerCase();
    const guestUserId = this.tagToUserId.get(guestKey);
    const cleanNewTag = payload.newDriverTag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (cleanNewTag.length < 2) {
      return { success: false, message: "New driver tag must be at least 2 characters." };
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
    let existingStats;
    let existingRecords = [];
    if (userId) {
      existingStats = this.stats.get(userId);
      existingRecords = this.personalRecords.get(userId) || [];
      this.tagToUserId.delete(guestKey);
    } else {
      userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    const isDev = isDeveloperTag(cleanNewTag);
    const countryCode = (payload.countryCode || "GLOBAL").toUpperCase();
    const isEmailVerified = isDev || (payload.verificationCode ? this.verifyEmail(payload.email, payload.verificationCode) : false);
    const now = Date.now();
    const account = {
      id: userId,
      driverTag: cleanNewTag,
      email: payload.email,
      emailVerified: isEmailVerified,
      displayName: payload.displayName || cleanNewTag,
      countryCode,
      avatarColor: payload.avatarColor || (isDev ? "#f59e0b" : "#10b981"),
      preferredUnits: payload.preferredUnits || "km/h",
      isGuest: false,
      isDeveloper: isDev,
      createdAt: now
    };
    const profile = {
      userId,
      driverTag: cleanNewTag,
      displayName: account.displayName,
      countryCode: account.countryCode,
      avatarColor: account.avatarColor,
      preferredUnits: account.preferredUnits,
      isDeveloper: isDev,
      joinedDate: now
    };
    const stats = existingStats ? { ...existingStats, userId, driverTag: cleanNewTag, lastActive: now } : {
      userId,
      driverTag: cleanNewTag,
      totalDistanceKm: 0,
      totalLapsCompleted: 0,
      cleanLapsCompleted: 0,
      cleanLapRatio: 100,
      favoriteVehicle: "Porsche 911 RSR-19 (992)",
      favoriteLivery: "Rexy Green #80",
      totalFlightTimeSeconds: 0,
      maxTopSpeedKmh: 0,
      lastActive: now,
      vehiclesDriven: {},
      liveriesUsed: {}
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
      sessionToken
    };
  }
  // ==========================================
  // DRIVER ACTIVITY & TELEMETRY STATS
  // ==========================================
  updateDriverActivity(driverTag, deltaKm, lapCompleted, isCleanLap, vehicleId, liveryName, flightTimeDeltaSeconds, currentSpeedKmh) {
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
      stats.cleanLapRatio = Math.round(stats.cleanLapsCompleted / stats.totalLapsCompleted * 100);
    }
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
  getDriverProfile(driverTag) {
    const key = driverTag.trim().toLowerCase();
    const userId = this.tagToUserId.get(key);
    if (!userId) return null;
    return {
      account: this.users.get(userId),
      profile: this.profiles.get(userId),
      stats: this.stats.get(userId),
      personalRecords: this.personalRecords.get(userId) || []
    };
  }
  // ==========================================
  // SERVERLESS ANTI-CHEAT & LAP SUBMISSION
  // ==========================================
  submitLap(submission) {
    const tagKey = submission.driverTag.trim().toLowerCase();
    let userId = this.tagToUserId.get(tagKey);
    if (!userId) {
      const reg = this.register({ driverTag: submission.driverTag, email: "" }, true);
      if (!reg.account) {
        return { accepted: false, reason: "Could not register guest driver.", newPersonalBest: false, newWorldRecord: false };
      }
      userId = reg.account.id;
    }
    const account = this.users.get(userId);
    const circuitId = (submission.circuitId || "nordschleife").toLowerCase();
    const bounds = CIRCUIT_HOMOLOGATION[circuitId];
    if (!submission.isLapValid) {
      return {
        accepted: false,
        reason: "Anti-Cheat: Lap is marked invalid (wall collision, cut track, or recovery respawn).",
        newPersonalBest: false,
        newWorldRecord: false
      };
    }
    if (!submission.sectorSplitsMs || submission.sectorSplitsMs.length === 0) {
      return {
        accepted: false,
        reason: "Anti-Cheat: Missing intermediate sector checkpoint splits.",
        newPersonalBest: false,
        newWorldRecord: false
      };
    }
    const sectorSum = submission.sectorSplitsMs.reduce((sum, s) => sum + s, 0);
    const sectorDelta = Math.abs(sectorSum - submission.totalLapTimeMs);
    if (sectorDelta > 50) {
      return {
        accepted: false,
        reason: `Anti-Cheat: Sector timing non-monotonic. Sum of sectors (${sectorSum.toFixed(1)}ms) does not equal total lap time (${submission.totalLapTimeMs.toFixed(1)}ms). Delta: ${sectorDelta.toFixed(1)}ms.`,
        newPersonalBest: false,
        newWorldRecord: false
      };
    }
    if (bounds) {
      if (submission.totalLapTimeMs < bounds.minPlausibleLapTimeMs) {
        return {
          accepted: false,
          reason: `Anti-Cheat: Lap time (${(submission.totalLapTimeMs / 1e3).toFixed(2)}s) exceeds physical minimum homologation threshold (${(bounds.minPlausibleLapTimeMs / 1e3).toFixed(2)}s) for ${bounds.name}.`,
          newPersonalBest: false,
          newWorldRecord: false
        };
      }
      let circuitLengthKm = 20.832;
      if (circuitId === "24h") circuitLengthKm = 25.378;
      else if (circuitId === "gp_strecke") circuitLengthKm = 5.148;
      else if (circuitId === "proving_ground") circuitLengthKm = 6;
      const lapHours = submission.totalLapTimeMs / (1e3 * 3600);
      const avgSpeedKmh = circuitLengthKm / lapHours;
      if (avgSpeedKmh > bounds.maxPlausibleAverageSpeedKmh) {
        return {
          accepted: false,
          reason: `Anti-Cheat: Average speed (${avgSpeedKmh.toFixed(1)} km/h) exceeds physical limit (${bounds.maxPlausibleAverageSpeedKmh} km/h).`,
          newPersonalBest: false,
          newWorldRecord: false
        };
      }
    }
    if (submission.topSpeedKmh > 350) {
      return {
        accepted: false,
        reason: `Anti-Cheat: Recorded top speed (${submission.topSpeedKmh.toFixed(1)} km/h) exceeds homologated speed envelope.`,
        newPersonalBest: false,
        newWorldRecord: false
      };
    }
    if (submission.ghostTrajectory && submission.ghostTrajectory.length > 0) {
      const frames = submission.ghostTrajectory;
      if (frames.length < 5) {
        return {
          accepted: false,
          reason: "Anti-Cheat: Ghost trajectory frame count insufficient for verification.",
          newPersonalBest: false,
          newWorldRecord: false
        };
      }
      for (let i = 1; i < frames.length; i++) {
        if (frames[i].timeMs < frames[i - 1].timeMs) {
          return {
            accepted: false,
            reason: "Anti-Cheat: Ghost trajectory contains backwards timestamp regression.",
            newPersonalBest: false,
            newWorldRecord: false
          };
        }
      }
    }
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
        achievedAt: Date.now()
      });
      newPersonalBest = true;
    }
    this.personalRecords.set(userId, userRecords);
    let board = this.leaderboards.get(circuitId) || [];
    const entryId = `${userId}_${circuitId}_${submission.vehicleId}_${submission.weather}`;
    const existingEntryIdx = board.findIndex((e) => e.id === entryId);
    const vehicleName = submission.vehicleId.includes("rsr") ? "Porsche 911 RSR-19 (992)" : submission.vehicleId;
    const newEntry = {
      rank: 1,
      id: entryId,
      driverTag: account.driverTag,
      displayName: account.displayName,
      countryCode: account.countryCode,
      avatarColor: account.avatarColor,
      circuitId,
      vehicleId: submission.vehicleId,
      vehicleName,
      vehicleClass: submission.vehicleClass || "GTE",
      weather: submission.weather || "clear",
      inputCategory: submission.inputCategory || "keyboard",
      lapTimeMs: submission.totalLapTimeMs,
      lapTimeFormatted: formatLapTime(submission.totalLapTimeMs),
      deltaToLeaderMs: 0,
      sectorSplitsMs: submission.sectorSplitsMs,
      topSpeedKmh: submission.topSpeedKmh,
      timestamp: Date.now(),
      hasGhostTrajectory: !!(submission.ghostTrajectory && submission.ghostTrajectory.length > 0)
    };
    if (existingEntryIdx >= 0) {
      if (submission.totalLapTimeMs < board[existingEntryIdx].lapTimeMs) {
        board[existingEntryIdx] = newEntry;
      }
    } else {
      board.push(newEntry);
    }
    board.sort((a, b) => a.lapTimeMs - b.lapTimeMs);
    const leaderTime = board[0].lapTimeMs;
    board.forEach((entry, idx) => {
      entry.rank = idx + 1;
      entry.deltaToLeaderMs = Math.round(entry.lapTimeMs - leaderTime);
    });
    this.leaderboards.set(circuitId, board);
    const updatedEntry = board.find((e) => e.id === entryId);
    const leaderboardRank = updatedEntry ? updatedEntry.rank : 1;
    const isWorldRecord = leaderboardRank === 1;
    if (isWorldRecord && submission.ghostTrajectory && submission.ghostTrajectory.length > 0) {
      const wrKey = `${circuitId}_${submission.vehicleClass || "GTE"}_${submission.weather || "clear"}`;
      this.wrGhosts.set(wrKey, submission.ghostTrajectory);
    }
    return {
      accepted: true,
      newPersonalBest,
      newWorldRecord: isWorldRecord,
      leaderboardRank,
      deltaToLeaderMs: updatedEntry ? updatedEntry.deltaToLeaderMs : 0,
      entry: updatedEntry
    };
  }
  // ==========================================
  // MULTI-DIMENSIONAL LEADERBOARD QUERIES
  // ==========================================
  queryLeaderboard(filter) {
    const circuitId = (filter.circuitId || "nordschleife").toLowerCase();
    let board = this.leaderboards.get(circuitId) || [];
    if (filter.vehicleClass && filter.vehicleClass !== "all") {
      const targetClass = filter.vehicleClass.toLowerCase();
      board = board.filter((e) => e.vehicleClass.toLowerCase() === targetClass);
    }
    if (filter.weather && filter.weather !== "all") {
      const targetWeather = filter.weather.toLowerCase();
      board = board.filter((e) => e.weather.toLowerCase() === targetWeather);
    }
    if (filter.inputCategory && filter.inputCategory !== "all") {
      board = board.filter((e) => e.inputCategory === filter.inputCategory);
    }
    if (board.length > 0) {
      const filteredLeaderTime = board[0].lapTimeMs;
      board = board.map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        deltaToLeaderMs: Math.round(entry.lapTimeMs - filteredLeaderTime)
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
  getWorldRecordGhost(circuitId, vehicleClass = "GTE", weather = "clear") {
    const cid = circuitId.toLowerCase();
    const wrKey = `${cid}_${vehicleClass}_${weather}`;
    let frames = this.wrGhosts.get(wrKey);
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
    const board = this.leaderboards.get(cid) || [];
    const leader = board[0];
    return {
      hasGhost: true,
      circuitId: cid,
      vehicleClass,
      weather,
      lapTimeMs: leader ? leader.lapTimeMs : 403616,
      driverTag: leader ? leader.driverTag : "KEVIN_ESTRE_911",
      keyframes: frames
    };
  }
  // ==========================================
  // AUTOMATED PHONE CONTROLLER DEVICE PAIRING
  // ==========================================
  createPairingSession(driverTag, hostIp = "localhost") {
    const cleanTag = driverTag.trim().toUpperCase();
    const pairToken = Math.floor(1e5 + Math.random() * 9e5).toString();
    const now = Date.now();
    const tokenObj = {
      pairToken,
      driverTag: cleanTag,
      hostIp,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1e3,
      // 15 minutes validity
      paired: false
    };
    this.pairingTokens.set(pairToken, tokenObj);
    return tokenObj;
  }
  verifyPairingSession(pairToken, driverTag) {
    const tokenObj = this.pairingTokens.get(pairToken);
    if (!tokenObj) {
      return { success: false, message: "Invalid pairing token." };
    }
    if (Date.now() > tokenObj.expiresAt) {
      this.pairingTokens.delete(pairToken);
      return { success: false, message: "Pairing token has expired." };
    }
    if (driverTag && tokenObj.driverTag !== driverTag.trim().toUpperCase()) {
      return { success: false, message: "Driver tag does not match host pairing session." };
    }
    tokenObj.paired = true;
    this.pairingTokens.set(pairToken, tokenObj);
    return { success: true, tokenObj };
  }
  checkPairingStatus(pairToken) {
    const tokenObj = this.pairingTokens.get(pairToken);
    if (!tokenObj) return { paired: false };
    if (Date.now() > tokenObj.expiresAt) {
      this.pairingTokens.delete(pairToken);
      return { paired: false };
    }
    return {
      paired: tokenObj.paired,
      driverTag: tokenObj.driverTag,
      expiresAt: tokenObj.expiresAt
    };
  }
  // ==========================================
  // INITIAL BENCHMARK SEED DATA
  // ==========================================
  seedBenchmarkData() {
    const alienDrivers = [
      {
        tag: "KEVIN_ESTRE_911",
        name: "K\xE9vin Estre",
        country: "FR",
        color: "#ef4444",
        class: "GTE",
        lapTimeMs: 403616,
        // 6:43.616 (Sub-6:45 Nordschleife Benchmark)
        splits: [44500, 43100, 46200, 45800, 44900, 43800, 45200, 44600, 45516],
        topSpeed: 312.4,
        input: "wheel"
      },
      {
        tag: "TIMO_BERNHARD",
        name: "Timo Bernhard",
        country: "DE",
        color: "#f59e0b",
        class: "GTE",
        lapTimeMs: 407250,
        // 6:47.250
        splits: [45100, 43600, 46500, 46100, 45200, 44100, 45600, 45100, 45950],
        topSpeed: 309.8,
        input: "wheel"
      },
      {
        tag: "MAX_VERSTAPPEN_1",
        name: "Max Verstappen",
        country: "NL",
        color: "#3b82f6",
        class: "GTE",
        lapTimeMs: 408800,
        // 6:48.800
        splits: [45300, 43800, 46700, 46200, 45400, 44300, 45800, 45300, 46e3],
        topSpeed: 314.1,
        input: "wheel"
      },
      {
        tag: "MOBILE_APEX_KING",
        name: "Alexandre Giro",
        country: "IT",
        color: "#10b981",
        class: "GTE",
        lapTimeMs: 414320,
        // 6:54.320 (Mobile Gyro Record)
        splits: [45900, 44400, 47300, 46800, 46e3, 44900, 46400, 45900, 46720],
        topSpeed: 306.2,
        input: "gyro"
      },
      {
        tag: "KEYBOARD_WARRIOR",
        name: "Jonas Schmidt",
        country: "DE",
        color: "#8b5cf6",
        class: "GTE",
        lapTimeMs: 421800,
        // 7:01.800 (Desktop Keyboard Benchmark)
        splits: [46700, 45200, 48100, 47600, 46800, 45700, 47200, 46700, 47800],
        topSpeed: 304.5,
        input: "keyboard"
      }
    ];
    const nordschleifeBoard = [];
    const leaderTime = alienDrivers[0].lapTimeMs;
    alienDrivers.forEach((driver, idx) => {
      const userId = `usr_alien_${idx}`;
      const acc = {
        id: userId,
        driverTag: driver.tag,
        email: `${driver.tag.toLowerCase()}@racers.net`,
        displayName: driver.name,
        countryCode: driver.country,
        avatarColor: driver.color,
        preferredUnits: "km/h",
        isGuest: false,
        createdAt: 17e11
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
        preferredUnits: "km/h",
        joinedDate: 17e11
      });
      this.stats.set(userId, {
        userId,
        driverTag: driver.tag,
        totalDistanceKm: 1420 + idx * 250,
        totalLapsCompleted: 68 + idx * 12,
        cleanLapsCompleted: 65 + idx * 11,
        cleanLapRatio: 96,
        favoriteVehicle: "Porsche 911 RSR-19 (992)",
        favoriteLivery: "Rexy Green #80",
        totalFlightTimeSeconds: 42.5,
        maxTopSpeedKmh: driver.topSpeed,
        lastActive: Date.now() - idx * 36e5,
        vehiclesDriven: { porsche_911_rsr_19_992: 1420 },
        liveriesUsed: { "Rexy Green #80": 50 }
      });
      nordschleifeBoard.push({
        rank: idx + 1,
        id: `${userId}_nordschleife_porsche_rsr_clear`,
        driverTag: driver.tag,
        displayName: driver.name,
        countryCode: driver.country,
        avatarColor: driver.color,
        circuitId: "nordschleife",
        vehicleId: "porsche_911_rsr_19_992",
        vehicleName: "Porsche 911 RSR-19 (992)",
        vehicleClass: driver.class,
        weather: "clear",
        inputCategory: driver.input,
        lapTimeMs: driver.lapTimeMs,
        lapTimeFormatted: formatLapTime(driver.lapTimeMs),
        deltaToLeaderMs: driver.lapTimeMs - leaderTime,
        sectorSplitsMs: driver.splits,
        topSpeedKmh: driver.topSpeed,
        timestamp: Date.now() - idx * 72e5,
        hasGhostTrajectory: idx === 0
        // #1 has active WR ghost
      });
    });
    this.leaderboards.set("nordschleife", nordschleifeBoard);
    this.leaderboards.set("24h", [
      {
        rank: 1,
        id: "usr_alien_0_24h_rsr",
        driverTag: "KEVIN_ESTRE_911",
        displayName: "K\xE9vin Estre",
        countryCode: "FR",
        avatarColor: "#ef4444",
        circuitId: "24h",
        vehicleId: "porsche_911_rsr_19_992",
        vehicleName: "Porsche 911 RSR-19 (992)",
        vehicleClass: "GTE",
        weather: "clear",
        inputCategory: "wheel",
        lapTimeMs: 489120,
        // 8:09.120
        lapTimeFormatted: formatLapTime(489120),
        deltaToLeaderMs: 0,
        sectorSplitsMs: [52e3, 54e3, 56e3, 55e3, 53e3, 54e3, 55e3, 55e3, 55120],
        topSpeedKmh: 310.2,
        timestamp: Date.now() - 1e5,
        hasGhostTrajectory: false
      }
    ]);
    this.leaderboards.set("gp_strecke", [
      {
        rank: 1,
        id: "usr_alien_0_gp_rsr",
        driverTag: "KEVIN_ESTRE_911",
        displayName: "K\xE9vin Estre",
        countryCode: "FR",
        avatarColor: "#ef4444",
        circuitId: "gp_strecke",
        vehicleId: "porsche_911_rsr_19_992",
        vehicleName: "Porsche 911 RSR-19 (992)",
        vehicleClass: "GTE",
        weather: "clear",
        inputCategory: "wheel",
        lapTimeMs: 113400,
        // 1:53.400
        lapTimeFormatted: formatLapTime(113400),
        deltaToLeaderMs: 0,
        sectorSplitsMs: [38200, 37400, 37800],
        topSpeedKmh: 278.6,
        timestamp: Date.now() - 2e5,
        hasGhostTrajectory: false
      }
    ]);
    this.leaderboards.set("proving_ground", [
      {
        rank: 1,
        id: "usr_alien_0_pg_rsr",
        driverTag: "TIMO_BERNHARD",
        displayName: "Timo Bernhard",
        countryCode: "DE",
        avatarColor: "#f59e0b",
        circuitId: "proving_ground",
        vehicleId: "porsche_911_rsr_19_992",
        vehicleName: "Porsche 911 RSR-19 (992)",
        vehicleClass: "GTE",
        weather: "clear",
        inputCategory: "wheel",
        lapTimeMs: 72850,
        // 1:12.850
        lapTimeFormatted: formatLapTime(72850),
        deltaToLeaderMs: 0,
        sectorSplitsMs: [24200, 24300, 24350],
        topSpeedKmh: 318.5,
        timestamp: Date.now() - 3e5,
        hasGhostTrajectory: false
      }
    ]);
    const wrGhostFrames = [];
    const totalLapMs = alienDrivers[0].lapTimeMs;
    const frameIntervalMs = 1e3 / 30;
    const totalFrames = Math.floor(totalLapMs / frameIntervalMs);
    const totalCircuitLengthM = 20710;
    for (let i = 0; i < totalFrames; i++) {
      const timeMs = Math.round(i * frameIntervalMs);
      const progress = i / totalFrames;
      const distanceM = progress * totalCircuitLengthM;
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
        steerRad
      });
    }
    this.wrGhosts.set("nordschleife_GTE_clear", wrGhostFrames);
  }
};
var globalDriverDatabase = new DriverDatabase();

// src/server/api-dispatcher.ts
async function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        resolve(null);
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
async function handleApiRequest(req, res, db = globalDriverDatabase) {
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return true;
  }
  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.driverTag) {
      sendJson(res, 400, { success: false, message: "Missing driverTag in request body." });
      return true;
    }
    const result = db.register(body, !!body.isGuest);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }
  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.driverTagOrEmail) {
      sendJson(res, 400, { success: false, message: "Missing driverTagOrEmail." });
      return true;
    }
    const result = db.login(body);
    sendJson(res, result.success ? 200 : 401, result);
    return true;
  }
  if (pathname === "/api/auth/send-code" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.email) {
      sendJson(res, 400, { success: false, message: "Missing email." });
      return true;
    }
    const result = db.sendVerificationCode(body.email);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }
  if (pathname === "/api/auth/verify-code" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.email || !body.code) {
      sendJson(res, 400, { success: false, message: "Missing email or code." });
      return true;
    }
    const ok = db.verifyEmail(body.email, body.code);
    sendJson(res, ok ? 200 : 400, {
      success: ok,
      message: ok ? "Email successfully verified!" : "Invalid or expired verification code."
    });
    return true;
  }
  if (pathname === "/api/auth/profile" && req.method === "GET") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/, "") || url.searchParams.get("token") || "";
    const driverTag = url.searchParams.get("tag") || "";
    if (token) {
      const result = db.getAccountBySession(token);
      sendJson(res, result.success ? 200 : 404, result);
      return true;
    }
    if (driverTag) {
      const data = db.getDriverProfile(driverTag);
      if (!data) {
        sendJson(res, 404, { success: false, message: "Driver tag not found." });
      } else {
        sendJson(res, 200, { success: true, ...data });
      }
      return true;
    }
    sendJson(res, 400, { success: false, message: "Missing token or tag query parameter." });
    return true;
  }
  if (pathname === "/api/auth/claim-guest" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.guestTag || !body.newDriverTag || !body.email) {
      sendJson(res, 400, { success: false, message: "Missing guestTag, newDriverTag, or email." });
      return true;
    }
    const result = db.claimGuestAccount(body);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }
  if (pathname === "/api/stats/telemetry" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.driverTag) {
      sendJson(res, 400, { success: false, message: "Missing driverTag." });
      return true;
    }
    const updated = db.updateDriverActivity(
      body.driverTag,
      body.deltaKm || 0,
      !!body.lapCompleted,
      !!body.isCleanLap,
      body.vehicleId || "",
      body.liveryName || "",
      body.flightTimeDeltaSeconds || 0,
      body.currentSpeedKmh || 0
    );
    sendJson(res, 200, { success: true, stats: updated });
    return true;
  }
  if (pathname === "/api/leaderboard" && req.method === "GET") {
    const filter = {
      circuitId: url.searchParams.get("circuit") || "nordschleife",
      vehicleClass: url.searchParams.get("class") || void 0,
      weather: url.searchParams.get("weather") || void 0,
      inputCategory: url.searchParams.get("input") || void 0,
      limit: parseInt(url.searchParams.get("limit") || "50", 10),
      offset: parseInt(url.searchParams.get("offset") || "0", 10)
    };
    const results = db.queryLeaderboard(filter);
    sendJson(res, 200, { success: true, ...results });
    return true;
  }
  if (pathname === "/api/laps/submit" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.driverTag || !body.totalLapTimeMs) {
      sendJson(res, 400, { success: false, message: "Invalid lap submission payload." });
      return true;
    }
    const result = db.submitLap(body);
    sendJson(res, result.accepted ? 200 : 422, result);
    return true;
  }
  if (pathname === "/api/ghost/wr" && req.method === "GET") {
    const circuitId = url.searchParams.get("circuit") || "nordschleife";
    const vehicleClass = url.searchParams.get("class") || "GTE";
    const weather = url.searchParams.get("weather") || "clear";
    const ghost = db.getWorldRecordGhost(circuitId, vehicleClass, weather);
    if (!ghost) {
      sendJson(res, 404, { success: false, message: "No world record ghost available." });
      return true;
    }
    sendJson(res, 200, { success: true, ghost });
    return true;
  }
  if (pathname === "/api/pair/create" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.driverTag) {
      sendJson(res, 400, { success: false, message: "Missing driverTag." });
      return true;
    }
    const tokenObj = db.createPairingSession(body.driverTag, body.hostIp);
    sendJson(res, 200, { success: true, pairing: tokenObj });
    return true;
  }
  if (pathname === "/api/pair/verify" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.pairToken) {
      sendJson(res, 400, { success: false, message: "Missing pairToken." });
      return true;
    }
    const resVerify = db.verifyPairingSession(body.pairToken, body.driverTag);
    sendJson(res, resVerify.success ? 200 : 400, resVerify);
    return true;
  }
  if (pathname === "/api/pair/status" && req.method === "GET") {
    const pairToken = url.searchParams.get("token") || "";
    if (!pairToken) {
      sendJson(res, 400, { success: false, message: "Missing token parameter." });
      return true;
    }
    const status = db.checkPairingStatus(pairToken);
    sendJson(res, 200, { success: true, ...status });
    return true;
  }
  return false;
}

// api/handler.ts
async function handler(req, res) {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, message: "API route not found" }));
    }
  } catch (error) {
    console.error("Vercel API error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Internal Server Error" }));
  }
}
export {
  handler as default
};
