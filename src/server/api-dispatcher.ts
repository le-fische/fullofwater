import { IncomingMessage, ServerResponse } from 'http';
import { globalDriverDatabase, DriverDatabase } from './db/driver-database';
import {
  RegisterPayload,
  LoginPayload,
  ClaimGuestPayload,
  LapSubmissionPayload,
  LeaderboardFilter,
} from '../common/auth/driver-types';

async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        // Guard against massive payloads
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  db: DriverDatabase = globalDriverDatabase
): Promise<boolean> {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return true;
  }

  // 1. POST /api/auth/register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const body = await readJsonBody<RegisterPayload & { isGuest?: boolean }>(req);
    if (!body || !body.driverTag) {
      sendJson(res, 400, { success: false, message: 'Missing driverTag in request body.' });
      return true;
    }
    const result = db.register(body, !!body.isGuest);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  // 2. POST /api/auth/login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readJsonBody<LoginPayload>(req);
    if (!body || !body.driverTagOrEmail) {
      sendJson(res, 400, { success: false, message: 'Missing driverTagOrEmail.' });
      return true;
    }
    const result = db.login(body);
    sendJson(res, result.success ? 200 : 401, result);
    return true;
  }

  // 2b. POST /api/auth/send-code
  if (pathname === '/api/auth/send-code' && req.method === 'POST') {
    const body = await readJsonBody<{ email: string }>(req);
    if (!body || !body.email) {
      sendJson(res, 400, { success: false, message: 'Missing email.' });
      return true;
    }
    const result = db.sendVerificationCode(body.email);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  // 2c. POST /api/auth/verify-code
  if (pathname === '/api/auth/verify-code' && req.method === 'POST') {
    const body = await readJsonBody<{ email: string; code: string }>(req);
    if (!body || !body.email || !body.code) {
      sendJson(res, 400, { success: false, message: 'Missing email or code.' });
      return true;
    }
    const ok = db.verifyEmail(body.email, body.code);
    sendJson(res, ok ? 200 : 400, {
      success: ok,
      message: ok ? 'Email successfully verified!' : 'Invalid or expired verification code.',
    });
    return true;
  }

  // 3. GET /api/auth/profile
  if (pathname === '/api/auth/profile' && req.method === 'GET') {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '') || url.searchParams.get('token') || '';
    const driverTag = url.searchParams.get('tag') || '';

    if (token) {
      const result = db.getAccountBySession(token);
      sendJson(res, result.success ? 200 : 404, result);
      return true;
    }

    if (driverTag) {
      const data = db.getDriverProfile(driverTag);
      if (!data) {
        sendJson(res, 404, { success: false, message: 'Driver tag not found.' });
      } else {
        sendJson(res, 200, { success: true, ...data });
      }
      return true;
    }

    sendJson(res, 400, { success: false, message: 'Missing token or tag query parameter.' });
    return true;
  }

  // 4. POST /api/auth/claim-guest
  if (pathname === '/api/auth/claim-guest' && req.method === 'POST') {
    const body = await readJsonBody<ClaimGuestPayload>(req);
    if (!body || !body.guestTag || !body.newDriverTag || !body.email) {
      sendJson(res, 400, { success: false, message: 'Missing guestTag, newDriverTag, or email.' });
      return true;
    }
    const result = db.claimGuestAccount(body);
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  // 5. POST /api/stats/telemetry
  if (pathname === '/api/stats/telemetry' && req.method === 'POST') {
    const body = await readJsonBody<{
      driverTag: string;
      deltaKm?: number;
      lapCompleted?: boolean;
      isCleanLap?: boolean;
      vehicleId?: string;
      liveryName?: string;
      flightTimeDeltaSeconds?: number;
      currentSpeedKmh?: number;
    }>(req);

    if (!body || !body.driverTag) {
      sendJson(res, 400, { success: false, message: 'Missing driverTag.' });
      return true;
    }

    const updated = db.updateDriverActivity(
      body.driverTag,
      body.deltaKm || 0,
      !!body.lapCompleted,
      !!body.isCleanLap,
      body.vehicleId || '',
      body.liveryName || '',
      body.flightTimeDeltaSeconds || 0,
      body.currentSpeedKmh || 0
    );

    sendJson(res, 200, { success: true, stats: updated });
    return true;
  }

  // 6. GET /api/leaderboard
  if (pathname === '/api/leaderboard' && req.method === 'GET') {
    const filter: LeaderboardFilter = {
      circuitId: url.searchParams.get('circuit') || 'nordschleife',
      vehicleClass: url.searchParams.get('class') || undefined,
      weather: url.searchParams.get('weather') || undefined,
      inputCategory: (url.searchParams.get('input') as any) || undefined,
      limit: parseInt(url.searchParams.get('limit') || '50', 10),
      offset: parseInt(url.searchParams.get('offset') || '0', 10),
    };

    const results = db.queryLeaderboard(filter);
    sendJson(res, 200, { success: true, ...results });
    return true;
  }

  // 7. POST /api/laps/submit
  if (pathname === '/api/laps/submit' && req.method === 'POST') {
    const body = await readJsonBody<LapSubmissionPayload>(req);
    if (!body || !body.driverTag || !body.totalLapTimeMs) {
      sendJson(res, 400, { success: false, message: 'Invalid lap submission payload.' });
      return true;
    }

    const result = db.submitLap(body);
    sendJson(res, result.accepted ? 200 : 422, result);
    return true;
  }

  // 8. GET /api/ghost/wr
  if (pathname === '/api/ghost/wr' && req.method === 'GET') {
    const circuitId = url.searchParams.get('circuit') || 'nordschleife';
    const vehicleClass = url.searchParams.get('class') || 'GTE';
    const weather = url.searchParams.get('weather') || 'clear';

    const ghost = db.getWorldRecordGhost(circuitId, vehicleClass, weather);
    if (!ghost) {
      sendJson(res, 404, { success: false, message: 'No world record ghost available.' });
      return true;
    }

    sendJson(res, 200, { success: true, ghost });
    return true;
  }

  // 9. POST /api/pair/create
  if (pathname === '/api/pair/create' && req.method === 'POST') {
    const body = await readJsonBody<{ driverTag: string; hostIp?: string }>(req);
    if (!body || !body.driverTag) {
      sendJson(res, 400, { success: false, message: 'Missing driverTag.' });
      return true;
    }
    const tokenObj = db.createPairingSession(body.driverTag, body.hostIp);
    sendJson(res, 200, { success: true, pairing: tokenObj });
    return true;
  }

  // 10. POST /api/pair/verify
  if (pathname === '/api/pair/verify' && req.method === 'POST') {
    const body = await readJsonBody<{ pairToken: string; driverTag?: string }>(req);
    if (!body || !body.pairToken) {
      sendJson(res, 400, { success: false, message: 'Missing pairToken.' });
      return true;
    }
    const resVerify = db.verifyPairingSession(body.pairToken, body.driverTag);
    sendJson(res, resVerify.success ? 200 : 400, resVerify);
    return true;
  }

  // 11. GET /api/pair/status
  if (pathname === '/api/pair/status' && req.method === 'GET') {
    const pairToken = url.searchParams.get('token') || '';
    if (!pairToken) {
      sendJson(res, 400, { success: false, message: 'Missing token parameter.' });
      return true;
    }
    const status = db.checkPairingStatus(pairToken);
    sendJson(res, 200, { success: true, ...status });
    return true;
  }

  // Not an API request handled by this dispatcher
  return false;
}
