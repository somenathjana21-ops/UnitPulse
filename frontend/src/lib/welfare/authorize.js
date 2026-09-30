/**
 * frontend/src/lib/welfare/authorize.js
 *
 * Welfare Officer access control resolution.
 * Specification: docs/03-srs.md, docs/08-api-specification.md, docs/09-database-design.md
 *
 * Rules:
 * - Anonymous requests -> 401
 * - Non-welfare_officer role -> 403
 * - Report not assigned to this officer -> 404 (conceals existence, no oracle)
 */

import { canAccessWelfareReport } from '@unitpulse/backend';

/**
 * Resolves access verdict for a welfare report.
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user context ({ id, role })
 * @param {Object|null} params.report Welfare report row ({ id, unit_id, assigned_to })
 * @returns {{ allowed: boolean, httpStatus: number, reason: string }}
 */
export function resolveWelfareReportAccess({ user, report }) {
  if (!user || !user.id) {
    return { allowed: false, httpStatus: 401, reason: 'unauthenticated' };
  }

  if (user.role !== 'welfare_officer') {
    return { allowed: false, httpStatus: 403, reason: 'role_not_welfare_officer' };
  }

  if (!report) {
    return { allowed: false, httpStatus: 404, reason: 'report_not_found' };
  }

  const check = canAccessWelfareReport({ user, report });
  if (!check.allowed) {
    // Deliberately concealed 404 for unauthorized officer per docs/08-api-specification.md
    return { allowed: false, httpStatus: 404, reason: check.reason };
  }

  return { allowed: true, httpStatus: 200, reason: 'ok' };
}

/**
 * Resolves access verdict for creating an exceptional break-glass access grant.
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user context
 * @param {Object|null} params.report Welfare report row
 * @returns {{ allowed: boolean, httpStatus: number, reason: string }}
 */
export function resolveBreakGlassGrantRequestAccess({ user, report }) {
  // Uses identical strict gate: 401 unauth, 403 commander, 404 unassigned officer
  return resolveWelfareReportAccess({ user, report });
}

/**
 * Resolves access verdict for reading individual pseudonymous records under an active grant.
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user context
 * @param {Object|null} params.report Welfare report row
 * @param {string|null} params.grantId Grant ID from query params
 * @param {Object|null} params.grant Grant record from database or store
 * @param {Date|number|string} [params.now] Optional time override for testing
 * @returns {{ allowed: boolean, httpStatus: number, reason: string }}
 */
export function resolveBreakGlassReadAccess({ user, report, grantId, grant, now = new Date() }) {
  // 1. Check user and report assignment
  const reportAccess = resolveWelfareReportAccess({ user, report });
  if (!reportAccess.allowed) {
    return reportAccess;
  }

  // 2. Validate grantId presence
  if (!grantId) {
    return { allowed: false, httpStatus: 400, reason: 'missing_grant_id' };
  }

  // 3. Validate grant existence and ownership
  if (!grant) {
    return { allowed: false, httpStatus: 403, reason: 'grant_not_found' };
  }

  if (grant.officer_id !== user.id || grant.report_id !== report.id) {
    return { allowed: false, httpStatus: 403, reason: 'grant_mismatch' };
  }

  // 4. Validate unit consistency
  if (grant.unit_id && grant.unit_id !== report.unit_id) {
    return { allowed: false, httpStatus: 403, reason: 'unit_mismatch' };
  }

  // 5. Enforce 30-minute expiry (T-08)
  const expiryTime = new Date(grant.expires_at).getTime();
  const currentTime = typeof now === 'number' ? now : (now instanceof Date ? now.getTime() : new Date(now).getTime());
  if (currentTime >= expiryTime) {
    return { allowed: false, httpStatus: 403, reason: 'grant_expired' };
  }

  return { allowed: true, httpStatus: 200, reason: 'ok' };
}

