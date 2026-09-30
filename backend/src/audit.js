/**
 * backend/src/audit.js
 *
 * Scoped break-glass grant validation, AES-256-GCM encryption, and audit specifications.
 * Specifications: docs/05-system-architecture.md, docs/08-api-specification.md, docs/09-database-design.md, docs/10-security-privacy.md
 *
 * Rules:
 * - Access grant strictly limited to assigned Welfare Officer and specific report.
 * - Server enforces 30-minute expiry; client cannot choose expiry duration.
 * - Compulsory non-empty reason code and text explanation (min 10 characters).
 * - Plaintext reason is NEVER logged; encrypted server-side with AES-256-GCM.
 * - Every individual read writes an audit record in the same database transaction.
 */

import crypto from 'node:crypto';

export const BREAK_GLASS_EXPIRY_MINUTES = 30;

export const AUDIT_EVENT_TYPES = [
  'report_viewed',
  'grant_requested',
  'grant_expired',
  'individual_read',
  'status_changed',
  'unauthorized_access_attempt',
];

export const ALLOWED_REASON_CODES = [
  'welfare_review',
  'roster_audit',
  'safety_check',
  'leave_rebalancing_assessment',
  'emergency_support',
];

// Fallback encryption secret for local tests / development when ENCRYPTION_SECRET is not configured
const DEFAULT_DEV_ENCRYPTION_SECRET = 'unitpulse-synthetic-demo-audit-encryption-key-32b!';

/**
 * Derives a 32-byte key from the provided secret or process.env.ENCRYPTION_SECRET.
 *
 * @param {string} [customSecret]
 * @returns {Buffer}
 */
export function deriveEncryptionKey(customSecret) {
  const secret = customSecret || process.env.ENCRYPTION_SECRET || DEFAULT_DEV_ENCRYPTION_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a sensitive free-text justification using AES-256-GCM.
 * Never logs plaintext reasons. Includes key version ('v1') and unique 12-byte nonce.
 *
 * @param {string} plaintext Free-text reason (min 10 characters)
 * @param {string} [secret] Optional custom secret for key derivation
 * @returns {string} Serialized format: "v1:<hex-iv>:<hex-tag>:<hex-ciphertext>"
 */
export function encryptReason(plaintext, secret) {
  if (typeof plaintext !== 'string' || plaintext.trim().length < 10) {
    throw new Error('Reason must be at least 10 characters explaining operational welfare purpose');
  }

  const key = deriveEncryptionKey(secret);
  const iv = crypto.randomBytes(12); // NIST-recommended 96-bit nonce for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a stored AES-256-GCM encrypted justification string.
 *
 * @param {string} encryptedPayload Serialized "v1:<hex-iv>:<hex-tag>:<hex-ciphertext>"
 * @param {string} [secret] Optional custom secret
 * @returns {string} Plaintext reason
 */
export function decryptReason(encryptedPayload, secret) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported or malformed encrypted payload format');
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  const key = deriveEncryptionKey(secret);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Validates a break-glass grant request submitted by a Welfare Officer.
 *
 * @param {Object} request
 * @param {string} request.officerId ID of authenticated user requesting access
 * @param {string} request.assignedOfficerId ID of officer assigned to this specific report
 * @param {string} request.reportId ID of triggered welfare report
 * @param {string} request.reasonCode One of ALLOWED_REASON_CODES
 * @param {string} request.reason Free-text justification (min 10 chars)
 * @returns {{ valid: boolean, error?: string, grantMetadata?: Object }}
 */
export function validateGrantRequest(request = {}) {
  const { officerId, assignedOfficerId, reportId, reasonCode, reason } = request;

  if (!officerId || !assignedOfficerId) {
    return { valid: false, error: 'Officer identification missing' };
  }

  if (officerId !== assignedOfficerId) {
    return { valid: false, error: 'Officer is not assigned to this report' };
  }

  if (!reportId) {
    return { valid: false, error: 'Missing reportId linkage' };
  }

  if (!reasonCode || !ALLOWED_REASON_CODES.includes(reasonCode)) {
    return {
      valid: false,
      error: `Invalid or missing reason code. Must be one of: ${ALLOWED_REASON_CODES.join(', ')}`,
    };
  }

  if (typeof reason !== 'string' || reason.trim().length < 10) {
    return {
      valid: false,
      error: 'Reason must be at least 10 characters explaining operational welfare purpose',
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BREAK_GLASS_EXPIRY_MINUTES * 60 * 1000);

  return {
    valid: true,
    grantMetadata: {
      reportId,
      officerId,
      reasonCode,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      expiryMinutes: BREAK_GLASS_EXPIRY_MINUTES,
    },
  };
}

/**
 * Checks whether an existing grant is currently active and valid.
 *
 * @param {Object} grant
 * @param {string} grant.expiresAt ISO timestamp
 * @param {string} grant.officerId
 * @param {string} requestingOfficerId
 * @param {Date|number|string} [now=new Date()]
 * @returns {boolean}
 */
export function isGrantActive(grant, requestingOfficerId, now = new Date()) {
  if (!grant || !grant.expiresAt || !grant.officerId) return false;
  if (grant.officerId !== requestingOfficerId) return false;
  const expiry = new Date(grant.expiresAt).getTime();
  const currentTime = typeof now === 'number' ? now : (now instanceof Date ? now.getTime() : new Date(now).getTime());
  return currentTime < expiry;
}
