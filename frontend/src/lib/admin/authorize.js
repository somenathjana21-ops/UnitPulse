/**
 * frontend/src/lib/admin/authorize.js
 *
 * Authorization resolution for restricted admin/import workflows.
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md, docs/10-security-privacy.md
 *
 * RULES:
 * - Anonymous callers -> 401
 * - Non-hr_uploader roles (e.g. commander, welfare_officer) -> 403
 * - hr_uploader or system_admin -> 200
 */

import { canAccessImport } from '@unitpulse/backend';

/**
 * Resolves access verdict for importing synthetic CSV datasets.
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user context ({ id, role })
 * @returns {{ allowed: boolean, httpStatus: number, reason: string }}
 */
export function resolveImportAccess({ user }) {
  if (!user || !user.id) {
    return { allowed: false, httpStatus: 401, reason: 'unauthenticated' };
  }

  const check = canAccessImport({ user });
  if (!check.allowed) {
    return { allowed: false, httpStatus: 403, reason: check.reason || 'role_not_hr_uploader' };
  }

  return { allowed: true, httpStatus: 200, reason: 'ok' };
}
