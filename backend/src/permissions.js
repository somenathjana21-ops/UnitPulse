/**
 * backend/src/permissions.js
 *
 * Permission and Role-Based Access Control (RBAC) / RLS rules for Unit Pulse 2.0.
 * Specifications: docs/03-srs.md, docs/09-database-design.md, docs/10-security-privacy.md
 *
 * NON-NEGOTIABLE SECURITY RULES:
 * 1. Anonymous users cannot access any private records or client-facing releases/reports.
 * 2. Commanders can ONLY query approved aggregate releases for their assigned units.
 * 3. Commanders CANNOT query raw personnel, leave, duty, or deployment rows.
 * 4. Commanders CANNOT view confidential welfare reports.
 * 5. Users CANNOT modify their own role or unit assignments.
 * 6. Welfare Officers can ONLY access welfare reports specifically assigned to them.
 * 7. Individual records can ONLY be queried via the transactional break-glass read function
 *    with an active, unexpired grant and mandatory audit logging.
 */

export const ALLOWED_ROLES = [
  'commander',
  'welfare_officer',
  'hr_uploader',
  'system_admin',
];

export const RELEASE_READ_ROLES = [
  'commander',
  'welfare_officer',
  'system_admin',
];

/**
 * Checks whether a user can read a public unit_week_release.
 * Mirrors RLS policy: public.unit_week_releases_select
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user object ({ id, role, assignedUnitIds })
 * @param {string} params.unitId Target unit ID (e.g. 'UNIT-A')
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canReadUnitRelease({ user, unitId }) {
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  if (!RELEASE_READ_ROLES.includes(user.role)) {
    return { allowed: false, reason: 'insufficient_role' };
  }

  const assignedUnits = user.assignedUnitIds || [];
  if (!assignedUnits.includes(unitId)) {
    return { allowed: false, reason: 'unit_not_assigned' };
  }

  return { allowed: true };
}

/**
 * Checks whether a user can read or update a public welfare_report.
 * Mirrors RLS policy: public.welfare_reports_select and public.welfare_reports_update
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user object
 * @param {Object} params.report Welfare report object ({ id, unit_id, assigned_to })
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canAccessWelfareReport({ user, report }) {
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  if (user.role !== 'welfare_officer') {
    return { allowed: false, reason: 'role_not_welfare_officer' };
  }

  if (report.assigned_to !== user.id) {
    return { allowed: false, reason: 'report_not_assigned_to_user' };
  }

  return { allowed: true };
}

/**
 * Checks whether an actor can directly query private raw source tables.
 * Raw tables: private.personnel, private.leave_records, private.duty_records, private.deployments
 *
 * @param {Object} params
 * @param {Object|null} params.user
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canDirectlyQueryPrivateRawTables({ user }) {
  // Client/browser roles (anonymous, commander, welfare_officer, hr_uploader) NEVER have direct SELECT on private tables
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated_anonymous' };
  }

  if (user.role !== 'service_role' && user.role !== 'postgres') {
    return {
      allowed: false,
      reason: `role_${user.role}_cannot_query_private_schema`,
    };
  }

  return { allowed: true, reason: 'service_role_internal' };
}

/**
 * Checks whether an actor can insert, update, or delete records in public.user_roles.
 *
 * @param {Object} params
 * @param {Object|null} params.user
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canMutateUserRoles({ user }) {
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  // Strictly forbidden for ordinary client sessions; only provision_user_role via service_role is permitted
  return { allowed: false, reason: 'user_roles_client_mutations_forbidden' };
}

/**
 * Checks whether an actor can insert, update, or delete records in public.unit_assignments.
 *
 * @param {Object} params
 * @param {Object|null} params.user
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canMutateUnitAssignments({ user }) {
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  return { allowed: false, reason: 'unit_assignments_client_mutations_forbidden' };
}
