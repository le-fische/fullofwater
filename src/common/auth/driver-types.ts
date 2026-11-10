import { TrackMode, WeatherCondition } from '../types';

export interface UserAccount {
  id: string;
  driverTag: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  countryCode: string;
  avatarColor: string;
  preferredUnits: 'km/h' | 'mph';
  isGuest: boolean;
  isDeveloper?: boolean;
  createdAt: number;
}

export interface DriverProfile {
  userId: string;
  driverTag: string;
  displayName: string;
  countryCode: string;
  avatarColor: string;
  preferredUnits: 'km/h' | 'mph';
  isDeveloper?: boolean;
  joinedDate: number;
}

export interface DriverStats {
  userId: string;
  driverTag: string;
  totalDistanceKm: number;
  totalLapsCompleted: number;
  cleanLapsCompleted: number;
  cleanLapRatio: number; // 0 to 100%
  favoriteVehicle: string;
  favoriteLivery: string;
  totalFlightTimeSeconds: number;
  maxTopSpeedKmh: number;
  lastActive: number;
  vehiclesDriven: Record<string, number>; // vehicleId -> km
  liveriesUsed: Record<string, number>;   // liveryName -> session count
}

export interface PersonalRecord {
  circuitId: TrackMode | string;
  vehicleId: string;
  weather: WeatherCondition | string;
  bestLapTimeMs: number;
  sectorSplitsMs: number[];
  topSpeedKmh: number;
  achievedAt: number;
}

export type InputCategory = 'gyro' | 'keyboard' | 'wheel';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  driverTag: string;
  displayName: string;
  countryCode: string;
  avatarColor: string;
  circuitId: string;
  vehicleId: string;
  vehicleName: string;
  vehicleClass: string;
  weather: string;
  inputCategory: InputCategory;
  lapTimeMs: number;
  lapTimeFormatted: string;
  deltaToLeaderMs: number;
  sectorSplitsMs: number[];
  topSpeedKmh: number;
  timestamp: number;
  hasGhostTrajectory: boolean;
}

export interface LeaderboardFilter {
  circuitId?: string;
  vehicleClass?: string;
  weather?: string;
  inputCategory?: InputCategory | 'all';
  limit?: number;
  offset?: number;
}

export interface GhostKeyframePayload {
  timeMs: number;
  distanceM: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  steerRad: number;
}

export interface LapSubmissionPayload {
  driverTag: string;
  sessionToken?: string;
  circuitId: string;
  vehicleId: string;
  vehicleClass: string;
  weather: string;
  inputCategory: InputCategory;
  totalLapTimeMs: number;
  sectorSplitsMs: number[];
  topSpeedKmh: number;
  isLapValid: boolean;
  ghostTrajectory?: GhostKeyframePayload[];
}

export interface LapSubmissionResult {
  accepted: boolean;
  reason?: string;
  newPersonalBest: boolean;
  newWorldRecord: boolean;
  leaderboardRank?: number;
  deltaToLeaderMs?: number;
  entry?: LeaderboardEntry;
}

export interface SessionPairingToken {
  pairToken: string;
  driverTag: string;
  hostIp?: string;
  createdAt: number;
  expiresAt: number;
  paired: boolean;
}

export interface RegisterPayload {
  driverTag: string;
  email: string;
  password?: string;
  displayName?: string;
  countryCode?: string;
  avatarColor?: string;
  preferredUnits?: 'km/h' | 'mph';
  verificationCode?: string;
}

export interface LoginPayload {
  driverTagOrEmail: string;
  password?: string;
  verificationCode?: string;
}

export interface ClaimGuestPayload {
  guestTag: string;
  newDriverTag: string;
  email: string;
  password?: string;
  displayName?: string;
  countryCode?: string;
  avatarColor?: string;
  preferredUnits?: 'km/h' | 'mph';
  verificationCode?: string;
}

export function isDeveloperTag(tag: string): boolean {
  const clean = (tag || '').trim().toLowerCase();
  return clean === 'le' || clean === 'dev' || clean === 'admin';
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  account?: UserAccount;
  profile?: DriverProfile;
  stats?: DriverStats;
  personalRecords?: PersonalRecord[];
  sessionToken?: string;
}

/**
 * Homologation & Anti-Cheat Thresholds per Circuit & Vehicle Class
 */
export interface CircuitHomologationBounds {
  circuitId: string;
  name: string;
  minPlausibleLapTimeMs: number; // Theoretical fastest possible time (world record threshold)
  maxPlausibleAverageSpeedKmh: number;
  sectorCount: number;
}

export const CIRCUIT_HOMOLOGATION: Record<string, CircuitHomologationBounds> = {
  nordschleife: {
    circuitId: 'nordschleife',
    name: 'Nürburgring Nordschleife',
    minPlausibleLapTimeMs: 330000, // 5:30.000 (below real 919 Evo 5:19; 911 RSR is ~6:40)
    maxPlausibleAverageSpeedKmh: 275.0,
    sectorCount: 9,
  },
  '24h': {
    circuitId: '24h',
    name: 'Nürburgring 24h Gesamtkurs',
    minPlausibleLapTimeMs: 440000, // 7:20.000 (911 GT3/GTE is ~8:05)
    maxPlausibleAverageSpeedKmh: 260.0,
    sectorCount: 9,
  },
  gp_strecke: {
    circuitId: 'gp_strecke',
    name: 'Nürburgring GP-Strecke',
    minPlausibleLapTimeMs: 85000, // 1:25.000 (F1 is 1:28, GT3 is ~1:53)
    maxPlausibleAverageSpeedKmh: 250.0,
    sectorCount: 3,
  },
  proving_ground: {
    circuitId: 'proving_ground',
    name: 'High-Speed Proving Ground',
    minPlausibleLapTimeMs: 50000, // 0:50.000
    maxPlausibleAverageSpeedKmh: 350.0,
    sectorCount: 3,
  },
};
