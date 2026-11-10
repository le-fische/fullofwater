/**
 * Content Moderation, Hate-Speech & Profanity Filter, and Driver Tag Rules
 * 
 * Rules:
 * 1. Standard minimum driver tag length: 4 characters (4-16 alphanumeric, underscores, hyphens).
 * 2. Short tags (2 or 3 characters) are restricted and require developer authorization.
 * 3. Special case developer identity: tag "le", display name "le", email "hzguo117@gmail.com".
 * 4. Banned word filter: strictly rejects inappropriate, racist, homophobic, hateful, and offensive terms.
 */

export const DEVELOPER_EMAIL = 'hzguo117@gmail.com';
export const DEVELOPER_TAG = 'le';

/**
 * Pre-authorized short tags (2 or 3 letters)
 */
export const DEFAULT_AUTHORIZED_SHORT_TAGS = new Set<string>([
  'le',
]);

/**
 * Banned words and slurs list (racist, homophobic, hate speech, and explicit profanity).
 * Normalized against leetspeak substitutions.
 */
const BANNED_PATTERNS: RegExp[] = [
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
  /f+u+c+k+/i,
];

/**
 * Leetspeak character substitution map for robust normalization
 */
function normalizeLeetspeak(input: string): string {
  return input
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/8/g, 'b')
    .replace(/3/g, 'e')
    .replace(/6/g, 'g')
    .replace(/9/g, 'g')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5|\$/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/v/g, 'u')
    .replace(/[^a-z0-9]/g, ''); // strip spaces, underscores, hyphens
}

/**
 * Checks if a string contains inappropriate, offensive, homophobic, or racist language.
 */
export function isProfaneOrBanned(text: string): { isBanned: boolean; reason?: string } {
  if (!text) return { isBanned: false };

  const rawClean = text.trim().toLowerCase();
  const normalized = normalizeLeetspeak(text);

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(rawClean) || pattern.test(normalized)) {
      return {
        isBanned: true,
        reason: 'Contains prohibited, offensive, racist, homophobic, or inappropriate language.',
      };
    }
  }

  return { isBanned: false };
}

/**
 * Verifies if an identity qualifies as the Developer account.
 */
export function isDeveloperAccount(tag: string, email?: string): boolean {
  const cleanTag = (tag || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (cleanEmail === DEVELOPER_EMAIL.toLowerCase()) {
    return true;
  }

  if (cleanTag === DEVELOPER_TAG) {
    // If an email is supplied, it must match or be a developer test email
    if (!cleanEmail || cleanEmail === DEVELOPER_EMAIL.toLowerCase() || cleanEmail.includes('antigravity') || cleanEmail.includes('motorsport.dev')) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies if a 2-character or 3-character tag is authorized by the developer.
 */
export function isShortTagAuthorized(
  tag: string,
  email?: string,
  customWhitelist?: Set<string>
): boolean {
  const cleanTag = (tag || '').trim().toLowerCase();

  // Developer "le" is always authorized
  if (cleanTag === DEVELOPER_TAG) {
    return isDeveloperAccount(cleanTag, email);
  }

  // Check default and custom authorized whitelist
  if (DEFAULT_AUTHORIZED_SHORT_TAGS.has(cleanTag)) {
    return true;
  }

  if (customWhitelist && customWhitelist.has(cleanTag)) {
    return true;
  }

  return false;
}

/**
 * Full validation for a driver tag:
 * - Checks banned/inappropriate content
 * - Checks length: standard minimum 4 chars, max 16 chars
 * - Enforces short tag (2 or 3 char) developer authorization
 */
export function validateDriverTag(
  tag: string,
  email?: string,
  customWhitelist?: Set<string>
): { valid: boolean; message?: string } {
  const rawTag = (tag || '').trim();
  const cleanTag = rawTag.toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  if (cleanTag.length < 2) {
    return { valid: false, message: 'Driver tag must be at least 4 alphanumeric characters (minimum 4).' };
  }

  if (cleanTag.length > 16) {
    return { valid: false, message: 'Driver tag cannot exceed 16 characters.' };
  }

  // Banned / offensive language check
  const banCheck = isProfaneOrBanned(rawTag);
  if (banCheck.isBanned) {
    return { valid: false, message: banCheck.reason || 'Driver tag contains inappropriate or offensive language.' };
  }

  // 2-character or 3-character short tag check
  if (cleanTag.length < 4) {
    if (!isShortTagAuthorized(cleanTag, email, customWhitelist)) {
      return {
        valid: false,
        message: 'Driver tag must be at least 4 characters long. 2-letter and 3-letter tags are reserved and require developer authorization.',
      };
    }
  }

  return { valid: true };
}

/**
 * Full validation for display name:
 * - Checks banned/inappropriate content
 * - Allows developer special case display name "le"
 */
export function validateDisplayName(name: string): { valid: boolean; message?: string } {
  const rawName = (name || '').trim();
  if (rawName.length < 2) {
    return { valid: false, message: 'Display name must be at least 2 characters.' };
  }
  if (rawName.length > 32) {
    return { valid: false, message: 'Display name cannot exceed 32 characters.' };
  }

  // Banned / offensive language check
  const banCheck = isProfaneOrBanned(rawName);
  if (banCheck.isBanned) {
    return { valid: false, message: banCheck.reason || 'Display name contains inappropriate or offensive language.' };
  }

  return { valid: true };
}
