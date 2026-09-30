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
