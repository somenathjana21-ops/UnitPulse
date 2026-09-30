/**
 * frontend/src/lib/commander/authorize.js
 *
 * Maps @unitpulse/backend's RLS-mirroring permission check to page/route
 * verdicts. A cross-unit guess always resolves to 404 ("missing resource or
 * deliberately concealed unauthorized resource", docs/08-api-specification.md)
 * rather than 403 -- this avoids confirming a guessed unit ID even exists.
 */

import { canReadUnitRelease } from '@unitpulse/backend';

/**
 * @param {Object} params
 * @param {{id: string, role: string|null, assignedUnitIds: string[]}|null} params.user
 * @param {string} params.unitId
 * @returns {{ allowed: boolean, httpStatus: number, reason: string }}
 */
export function resolveCommanderUnitAccess({ user, unitId }) {
  if (!user) {
    return { allowed: false, httpStatus: 401, reason: 'unauthenticated' };
  }

  const verdict = canReadUnitRelease({ user, unitId });
  if (!verdict.allowed) {
    return { allowed: false, httpStatus: 404, reason: verdict.reason };
  }

  return { allowed: true, httpStatus: 200, reason: 'ok' };
}
