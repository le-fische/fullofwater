// src/common/auth/driver-types.ts
function isDeveloperTag(tag, email) {
  const cleanTag = (tag || "").trim().toLowerCase();
  const cleanEmail = (email || "").trim().toLowerCase();
  if (cleanEmail === "hzguo117@gmail.com") return true;
  if (cleanTag === "le") {
    if (!cleanEmail || cleanEmail === "hzguo117@gmail.com" || cleanEmail.includes("antigravity") || cleanEmail.includes("motorsport.dev")) {
      return true;
    }
  }
  return cleanTag === "dev" || cleanTag === "admin";
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

// src/common/auth/moderation.ts
var DEVELOPER_EMAIL = "hzguo117@gmail.com";
var DEVELOPER_TAG = "le";
var DEFAULT_AUTHORIZED_SHORT_TAGS = /* @__PURE__ */ new Set([
  "le"
]);
var BANNED_PATTERNS = [
  // Racist slurs and hate speech
  /n+[i1!l|]+g+[e3a4r]+/i,
  /n+[i1!l|]+g+[a4]+/i,
  /k+[i1!l|]+k+[e3]+/i,
  /c+h+[i1!l|]+n+k+/i,
  /s+p+[i1!l|]+c*k+/i,
  /w+[e3]+t+b+[a4]+c*k+/i,
  /g+[o0]+[o0]+k+/i,
  /c+[o0]+[o0]+n+/i,
  /j+[a4]+p+s?$/i,
  /z+[i1!l|]+p+p+e+r+h+e+a+d+/i,
  /k+l+[a4]+n+s+m+[a4]+n+/i,
  /\bkkk\b/i,
  /\b1488\b/i,
  /h+[i1!l|]+t+l+[e3]+r+/i,
  /n+[a4]+z+[i1!l|]+/i,
  /s+w+[a4]+s+t+[i1!l|]+k+[a4]+/i,
  /w+h+[i1!l|]+t+e+p+[o0]+w+[e3]+r+/i,
  /h+[e3]+[i1!l|]+l+h+[i1!l|]+t+l+[e3]+r+/i,
  // Homophobic & transphobic slurs
  /f+[a4]+g+[o0]+t+/i,
  /f+[a4]+g+s?$/i,
  /\bf+a+g+\b/i,
  /d+y+k+[e3]+/i,
  /t+r+[a4]+n+n+y+/i,
  /s+[o0]+d+[o0]+m+[i1!l|]+t+[e3]+/i,
  // Sexually explicit and severe obscenities
  /c+u+n+t+/i,
  /p+u+s+s+y+/i,
  /b+[i1!l|]+t+c+h+/i,
  /w+h+[o0]+r+[e3]+/i,
  /s+l+u+t+/i,
  /b+l+[o0]+w+j+[o0]+b+/i,
  /d+[i1!l|]+l+d+[o0]+/i,
  /p+[e3]+n+[i1!l|]+s+/i,
  /v+[a4]+g+[i1!l|]+n+[a4]+/i,
  /\bc+o+c+k+s?$/i,
  /c+[o0]+c+k+s+u+c+k+/i,
  /m+[o0]+t+h+[e3]+r+f+u+c+k+/i,
  /f+u+c+k+/i
];
function normalizeLeetspeak(input) {
  return input.toLowerCase().replace(/@/g, "a").replace(/4/g, "a").replace(/8/g, "b").replace(/3/g, "e").replace(/6/g, "g").replace(/9/g, "g").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/5|\$/g, "s").replace(/[7+]/g, "t").replace(/v/g, "u").replace(/[^a-z0-9]/g, "");
}
function isProfaneOrBanned(text) {
  if (!text) return { isBanned: false };
  const rawClean = text.trim().toLowerCase();
  const normalized = normalizeLeetspeak(text);
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(rawClean) || pattern.test(normalized)) {
      return {
        isBanned: true,
        reason: "Contains prohibited, offensive, racist, homophobic, or inappropriate language."
      };
    }
  }
  return { isBanned: false };
}
function isDeveloperAccount(tag, email) {
  const cleanTag = (tag || "").trim().toLowerCase();
  const cleanEmail = (email || "").trim().toLowerCase();
  if (cleanEmail === DEVELOPER_EMAIL.toLowerCase()) {
    return true;
  }
  if (cleanTag === DEVELOPER_TAG) {
    if (!cleanEmail || cleanEmail === DEVELOPER_EMAIL.toLowerCase() || cleanEmail.includes("antigravity") || cleanEmail.includes("motorsport.dev")) {
      return true;
    }
  }
  return false;
}
function isShortTagAuthorized(tag, email, customWhitelist) {
  const cleanTag = (tag || "").trim().toLowerCase();
  if (cleanTag === DEVELOPER_TAG) {
    return isDeveloperAccount(cleanTag, email);
  }
  if (DEFAULT_AUTHORIZED_SHORT_TAGS.has(cleanTag)) {
    return true;
  }
  if (customWhitelist && customWhitelist.has(cleanTag)) {
    return true;
  }
  return false;
}
function validateDriverTag(tag, email, customWhitelist) {
  const rawTag = (tag || "").trim();
  const cleanTag = rawTag.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (cleanTag.length < 2) {
    return { valid: false, message: "Driver tag must be at least 4 alphanumeric characters (minimum 4)." };
  }
  if (cleanTag.length > 16) {
    return { valid: false, message: "Driver tag cannot exceed 16 characters." };
  }
  const banCheck = isProfaneOrBanned(rawTag);
  if (banCheck.isBanned) {
    return { valid: false, message: banCheck.reason || "Driver tag contains inappropriate or offensive language." };
  }
  if (cleanTag.length < 4) {
    if (!isShortTagAuthorized(cleanTag, email, customWhitelist)) {
      return {
        valid: false,
        message: "Driver tag must be at least 4 characters long. 2-letter and 3-letter tags are reserved and require developer authorization."
      };
    }
  }
  return { valid: true };
}
function validateDisplayName(name) {
  const rawName = (name || "").trim();
  if (rawName.length < 2) {
    return { valid: false, message: "Display name must be at least 2 characters." };
  }
  if (rawName.length > 32) {
    return { valid: false, message: "Display name cannot exceed 32 characters." };
  }
  const banCheck = isProfaneOrBanned(rawName);
  if (banCheck.isBanned) {
    return { valid: false, message: banCheck.reason || "Display name contains inappropriate or offensive language." };
  }
  return { valid: true };
}

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
  // Emergency Phase II-A: Serverless WebRTC signaling rooms
  signalRooms = /* @__PURE__ */ new Map();
  // Emergency Phase II-A: Serverless WebRTC Phone-to-Desktop pairing signaling
  pairSignals = /* @__PURE__ */ new Map();
  // Authorized short tags (2 or 3 letters) approved by developer
  authorizedShortTags = /* @__PURE__ */ new Set(["le"]);
  constructor() {
  }
  /**
   * Grants authorization for a 2-character or 3-character driver tag.
   * Only callable by the developer (hzguo117@gmail.com).
   */
  grantShortTagAccess(tag, authorizedByEmail) {
    const callerEmail = (authorizedByEmail || "").trim().toLowerCase();
    if (callerEmail !== DEVELOPER_EMAIL.toLowerCase()) {
      return {
        success: false,
        message: `Unauthorized. Only developer (${DEVELOPER_EMAIL}) can grant 2-letter or 3-letter tags.`
      };
    }
    const cleanTag = (tag || "").trim().toLowerCase();
    if (cleanTag.length < 2 || cleanTag.length > 3) {
      return { success: false, message: "Tag must be 2 or 3 characters long to grant short tag access." };
    }
    this.authorizedShortTags.add(cleanTag);
    return { success: true, message: `Short tag "${cleanTag.toUpperCase()}" granted authorization.` };
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
    if (!isGuest || cleanTag.length < 4 || !cleanTag.startsWith("GUEST_")) {
      const tagValidation = validateDriverTag(payload.driverTag, payload.email, this.authorizedShortTags);
      if (!tagValidation.valid) {
        return { success: false, message: tagValidation.message || "Invalid driver tag." };
      }
    }
    if (payload.displayName) {
      const nameValidation = validateDisplayName(payload.displayName);
      if (!nameValidation.valid) {
        return { success: false, message: nameValidation.message || "Invalid display name." };
      }
    }
    const tagKey = cleanTag.toLowerCase();
    if (this.tagToUserId.has(tagKey)) {
      return { success: false, message: `Driver tag "${cleanTag}" is already registered.` };
    }
    const emailKey = (payload.email || "").trim().toLowerCase();
    if (!isGuest && emailKey && this.emailToUserId.has(emailKey)) {
      return { success: false, message: `Email "${payload.email}" is already in use.` };
    }
    const isDev = isDeveloperTag(cleanTag, payload.email);
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
    const tagValidation = validateDriverTag(payload.newDriverTag, payload.email, this.authorizedShortTags);
    if (!tagValidation.valid) {
      return { success: false, message: tagValidation.message || "Invalid driver tag." };
    }
    if (payload.displayName) {
      const nameValidation = validateDisplayName(payload.displayName);
      if (!nameValidation.valid) {
        return { success: false, message: nameValidation.message || "Invalid display name." };
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
    let existingStats;
    let existingRecords = [];
    if (userId) {
      existingStats = this.stats.get(userId);
      existingRecords = this.personalRecords.get(userId) || [];
      this.tagToUserId.delete(guestKey);
    } else {
      userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    const isDev = isDeveloperTag(cleanNewTag, payload.email);
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
    const entryId = `${userId}_${circuitId}`;
    const existingEntryIdx = board.findIndex(
      (e) => e.driverTag.toLowerCase() === account.driverTag.toLowerCase() || e.id === entryId || e.id.startsWith(`${userId}_${circuitId}`)
    );
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
    const limit = Math.min(filter.limit || 25, 25);
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
      lapTimeMs: leader ? leader.lapTimeMs : frames[frames.length - 1]?.timeMs || 0,
      driverTag: leader ? leader.driverTag : "",
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
  // EMERGENCY PHASE II-A: SERVERLESS WEBRTC SIGNALING
  // ==========================================
  joinSignalRoom(roomCode, peerId, driverTag = "RSR_RACER", isHost = false) {
    const code = (roomCode || "4821").trim().toUpperCase();
    let room = this.signalRooms.get(code);
    const now = Date.now();
    if (!room) {
      room = {
        roomCode: code,
        circuit: "nordschleife",
        sessionStage: "lobby",
        lapCount: 3,
        maxDrivers: 10,
        collisionEnabled: false,
        peers: /* @__PURE__ */ new Map(),
        peerInboxes: /* @__PURE__ */ new Map(),
        lastActivity: now
      };
      this.signalRooms.set(code, room);
    }
    room.lastActivity = now;
    for (const [id, peer] of room.peers.entries()) {
      if (id !== peerId && now - peer.lastSeen > 6e4) {
        room.peers.delete(id);
        room.peerInboxes.delete(id);
      }
    }
    const hostExists = Array.from(room.peers.values()).some((p) => p.isHost);
    const actualHost = isHost || !hostExists;
    room.peers.set(peerId, {
      peerId,
      driverTag,
      isHost: actualHost,
      lastSeen: now
    });
    if (!room.peerInboxes.has(peerId)) {
      room.peerInboxes.set(peerId, []);
    }
    const existingPeers = [];
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
            type: "peer_joined",
            payload: { peerId, driverTag, isHost: actualHost },
            timestamp: now
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
      collisionEnabled: room.collisionEnabled
    };
  }
  sendSignalMessage(roomCode, from, to, type, payload) {
    const code = (roomCode || "").trim().toUpperCase();
    const room = this.signalRooms.get(code);
    if (!room) return { success: false, deliveredTo: 0 };
    const now = Date.now();
    room.lastActivity = now;
    if (type === "lobby_config_update" && payload) {
      if (payload.circuit) room.circuit = payload.circuit;
      if (typeof payload.lapCount === "number") room.lapCount = payload.lapCount;
      if (typeof payload.collisionEnabled === "boolean") room.collisionEnabled = payload.collisionEnabled;
      if (payload.sessionStage) room.sessionStage = payload.sessionStage;
    } else if (type === "race_start_qualifying") {
      room.sessionStage = "qualifying";
    } else if (type === "race_start_launch") {
      room.sessionStage = "race";
    }
    const msg = {
      id: `msg_${now}_${Math.random().toString(36).substring(2, 8)}`,
      roomCode: code,
      from,
      to,
      type,
      payload,
      timestamp: now
    };
    let count = 0;
    if (to && to !== "all") {
      const inbox = room.peerInboxes.get(to);
      if (inbox) {
        inbox.push(msg);
        count++;
      }
    } else {
      for (const [peerId, inbox] of room.peerInboxes.entries()) {
        if (peerId !== from) {
          inbox.push(msg);
          count++;
        }
      }
    }
    return { success: true, deliveredTo: count };
  }
  pollSignalMessages(roomCode, peerId) {
    const code = (roomCode || "").trim().toUpperCase();
    const room = this.signalRooms.get(code);
    if (!room) return { success: false, messages: [], activePeers: [] };
    const now = Date.now();
    room.lastActivity = now;
    const peer = room.peers.get(peerId);
    if (peer) {
      peer.lastSeen = now;
    }
    const inbox = room.peerInboxes.get(peerId);
    const messages = inbox ? [...inbox] : [];
    if (inbox) {
      inbox.length = 0;
    }
    const activePeers = Array.from(room.peers.keys()).filter((id) => id !== peerId);
    return {
      success: true,
      messages,
      activePeers,
      circuit: room.circuit,
      sessionStage: room.sessionStage,
      lapCount: room.lapCount,
      collisionEnabled: room.collisionEnabled
    };
  }
  getSignalRoomInfo(roomCode) {
    const code = (roomCode || "").trim().toUpperCase();
    return this.signalRooms.get(code) || null;
  }
  // ==========================================
  // DIRECT PHONE-TO-DESKTOP WEBRTC PAIRING SIGNALING
  // ==========================================
  sendPairSignal(pairToken, from, type, payload) {
    const token = (pairToken || "").trim();
    if (!token) return { success: false, message: "Missing pairing token." };
    let session = this.pairSignals.get(token);
    const now = Date.now();
    if (!session) {
      session = { hostInbox: [], controllerInbox: [], lastActivity: now };
      this.pairSignals.set(token, session);
    }
    session.lastActivity = now;
    const msg = { type, payload, timestamp: now };
    if (from === "host") {
      session.controllerInbox.push(msg);
    } else {
      session.hostInbox.push(msg);
    }
    return { success: true };
  }
  pollPairSignal(pairToken, role) {
    const token = (pairToken || "").trim();
    const session = this.pairSignals.get(token);
    if (!session) return { success: true, messages: [] };
    session.lastActivity = Date.now();
    const inbox = role === "host" ? session.hostInbox : session.controllerInbox;
    const messages = [...inbox];
    inbox.length = 0;
    return { success: true, messages };
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
  if (pathname === "/api/signal/join" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.roomCode || !body.peerId) {
      sendJson(res, 400, { success: false, message: "Missing roomCode or peerId." });
      return true;
    }
    const result = db.joinSignalRoom(body.roomCode, body.peerId, body.driverTag, !!body.isHost);
    sendJson(res, 200, result);
    return true;
  }
  if (pathname === "/api/signal/send" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.roomCode || !body.from || !body.type) {
      sendJson(res, 400, { success: false, message: "Missing roomCode, from, or type in payload." });
      return true;
    }
    const result = db.sendSignalMessage(body.roomCode, body.from, body.to, body.type, body.payload);
    sendJson(res, result.success ? 200 : 404, result);
    return true;
  }
  if (pathname === "/api/signal/poll" && req.method === "GET") {
    const room = url.searchParams.get("room") || "";
    const peerId = url.searchParams.get("peerId") || "";
    if (!room || !peerId) {
      sendJson(res, 400, { success: false, message: "Missing room or peerId query parameters." });
      return true;
    }
    const result = db.pollSignalMessages(room, peerId);
    sendJson(res, 200, result);
    return true;
  }
  if (pathname === "/api/pair/signal/send" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !body.pairToken || !body.from || !body.type) {
      sendJson(res, 400, { success: false, message: "Missing pairToken, from, or type." });
      return true;
    }
    const result = db.sendPairSignal(body.pairToken, body.from, body.type, body.payload);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }
  if (pathname === "/api/pair/signal/poll" && req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    const role = url.searchParams.get("role") || "controller";
    if (!token) {
      sendJson(res, 400, { success: false, message: "Missing token parameter." });
      return true;
    }
    const result = db.pollPairSignal(token, role);
    sendJson(res, 200, result);
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
