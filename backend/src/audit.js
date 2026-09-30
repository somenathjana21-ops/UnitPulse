/**
 * backend/src/audit.js
 *
 * Scoped break-glass grant validation and audit specifications.
 * Specifications: docs/05-system-architecture.md, docs/08-api-specification.md, docs/10-security-privacy.md
 *
 * Rules:
 * - Access grant strictly limited to assigned Welfare Officer and specific report.
 * - Server enforces 30-minute expiry; client cannot choose expiry duration.
 * - Compulsory non-empty reason code and text explanation.
 * - Plaintext reason is NEVER logged; encrypted server-side with AES-256-GCM.
 * - Every individual read writes an audit record in the same database transaction.
 */

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
  'leave_rebalancing_assessment',
  'commander_briefing_prep',
  'emergency_support',
];

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
 * @returns {boolean}
 */
export function isGrantActive(grant, requestingOfficerId) {
  if (!grant || !grant.expiresAt || !grant.officerId) return false;
  if (grant.officerId !== requestingOfficerId) return false;
  const expiry = new Date(grant.expiresAt).getTime();
  return Date.now() < expiry;
}
