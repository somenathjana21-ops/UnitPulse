/**
 * frontend/src/lib/welfare/break-glass.js
 *
 * Repository and domain service for the exceptional break-glass individual-read workflow.
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 *
 * NON-NEGOTIABLE SAFETY RULES:
 * 1. Must require an assigned welfare report.
 * 2. Compulsory reason code and typed justification (min 10 chars).
 * 3. Server-enforces strict 30-minute grant; client cannot specify expiry.
 * 4. Stored reasons are encrypted server-side with AES-256-GCM.
 * 5. Narrow transactional read rechecks officer/report/unit/grant/expiry in DB.
 * 6. Returns at most 20 pseudonymous records per page.
 * 7. Every individual read writes an immutable audit record in DB.
 * 8. Cache-Control: no-store and NO export/download functionality.
 */

import crypto from 'node:crypto';
import {
  encryptReason,
  validateGrantRequest,
  isGrantActive,
  BREAK_GLASS_EXPIRY_MINUTES,
} from '@unitpulse/backend';

// In-memory mock store for unit testing & local fallback when live Supabase is unconfigured
export const _testGrantStore = new Map();
export const _testAuditStore = [];

/**
 * Resets in-memory test stores (used between test runs).
 */
export function resetTestStores() {
  _testGrantStore.clear();
  _testAuditStore.length = 0;
}

/**
 * Generates synthetic pseudonymous individual records for a unit.
 * Used for testing / mock mode without direct private table access.
 *
 * @param {string} unitId
 * @param {number} total
 * @returns {Array<Object>}
 */
export function generateSyntheticPseudonymousRecords(unitId, total = 60) {
  const records = [];
  const unitSuffix = unitId.replace(/^UNIT-/, '') || 'B';

  for (let i = 1; i <= total; i++) {
    const pId = `PER-${unitSuffix}-${String(i).padStart(3, '0')}`;
    const nightShifts = i % 3 === 0 ? 14 : (i % 2 === 0 ? 8 : 4);
    const recordedHours = 40 + (i % 5) * 4.5;
    const leaveStatuses = ['taken', 'approved', 'none', 'denied'];
    const leaveStatus = leaveStatuses[i % leaveStatuses.length];

    records.push({
      personnel_id: pId,
      personnelId: pId,
      unit_id: unitId,
      unitId,
      history_start_on: '2026-01-01',
      historyStartOn: '2026-01-01',
      recent_leave_status: leaveStatus,
      recentLeaveStatus: leaveStatus,
      night_shifts_count: nightShifts,
      nightShiftsCount: nightShifts,
      recorded_duty_hours: recordedHours,
      recordedDutyHours: recordedHours,
    });
  }

  return records;
}

/**
 * Requests an exceptional 30-minute individual-read grant for an assigned welfare report.
 *
 * @param {Object} params
 * @param {string} params.officerId
 * @param {string} params.assignedOfficerId
 * @param {string} params.reportId
 * @param {string} [params.unitId]
 * @param {string} params.reasonCode
 * @param {string} params.reason
 * @param {Object} [params.serviceSupabase] Elevated service role client
 * @returns {Promise<Object>} Created grant metadata
 */
export async function createBreakGlassGrant({
  officerId,
  assignedOfficerId,
  reportId,
  unitId,
  reasonCode,
  reason,
  serviceSupabase = null,
}) {
  // 1. Validate request parameters
  const validation = validateGrantRequest({
    officerId,
    assignedOfficerId,
    reportId,
    reasonCode,
    reason,
  });

  if (!validation.valid) {
    const error = new Error(validation.error);
    error.code = 'invalid_grant_request';
    throw error;
  }

  // 2. Encrypt reason server-side with AES-256-GCM (never log plaintext reason)
  const encryptedReason = encryptReason(reason);

  // 3. Database persistence
  if (serviceSupabase) {
    const { data, error } = await serviceSupabase.rpc('create_access_grant', {
      p_report_id: reportId,
      p_officer_id: officerId,
      p_reason_code: reasonCode,
      p_encrypted_reason: encryptedReason,
    });

    if (error || !data || data.length === 0) {
      const err = new Error(error?.message || 'Failed to create access grant');
      err.code = 'grant_creation_failed';
      throw err;
    }

    const grantRow = data[0];
    return {
      grantId: grantRow.id,
      reportId: grantRow.report_id,
      officerId: grantRow.officer_id,
      unitId: grantRow.unit_id,
      reasonCode: grantRow.reason_code,
      expiresAt: grantRow.expires_at,
      expiryMinutes: BREAK_GLASS_EXPIRY_MINUTES,
    };
  }

  // Fallback in-memory mock mode
  const grantId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BREAK_GLASS_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const grantRecord = {
    id: grantId,
    report_id: reportId,
    officer_id: officerId,
    unit_id: unitId || 'UNIT-B',
    reason_code: reasonCode,
    encrypted_reason: encryptedReason,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  };

  _testGrantStore.set(grantId, grantRecord);

  // Record audit log for grant request
  _testAuditStore.push({
    id: crypto.randomUUID(),
    grant_id: grantId,
    actor_id: officerId,
    report_id: reportId,
    unit_id: unitId || 'UNIT-B',
    action: 'grant_requested',
    row_count: 0,
    reason_code: reasonCode,
    occurred_at: now.toISOString(),
  });

  return {
    grantId,
    reportId,
    officerId,
    unitId: grantRecord.unit_id,
    reasonCode,
    expiresAt,
    expiryMinutes: BREAK_GLASS_EXPIRY_MINUTES,
  };
}

/**
 * Retrieves grant metadata and evaluates remaining active time.
 *
 * @param {Object} params
 * @param {string} params.grantId
 * @param {string} params.officerId
 * @param {string} params.reportId
 * @param {Object} [params.serviceSupabase]
 * @returns {Promise<{ grant: Object|null, active: boolean, remainingMinutes: number }>}
 */
export async function getBreakGlassGrant({
  grantId,
  officerId,
  reportId,
  serviceSupabase = null,
}) {
  if (!grantId || !officerId || !reportId) {
    return { grant: null, active: false, remainingMinutes: 0 };
  }

  let grant = null;

  if (serviceSupabase) {
    const { data } = await serviceSupabase
      .schema('private')
      .from('access_grants')
      .select('*')
      .eq('id', grantId)
      .eq('officer_id', officerId)
      .eq('report_id', reportId)
      .maybeSingle();

    grant = data;
  } else {
    grant = _testGrantStore.get(grantId) || null;
    if (grant && (grant.officer_id !== officerId || grant.report_id !== reportId)) {
      grant = null;
    }
  }

  if (!grant) {
    return { grant: null, active: false, remainingMinutes: 0 };
  }

  const active = isGrantActive({
    expiresAt: grant.expires_at,
    officerId: grant.officer_id,
    is_revoked: grant.is_revoked,
  }, officerId);
  const remainingMs = new Date(grant.expires_at).getTime() - Date.now();
  const remainingMinutes = active ? Math.max(0, Math.ceil(remainingMs / (60 * 1000))) : 0;

  return {
    grant,
    active,
    remainingMinutes,
  };
}

/**
 * Executes a transactional audited read of pseudonymous individual records.
 * Clamped to at most 20 records per page.
 * Atomically records an audit log row in private.access_audit.
 *
 * @param {Object} params
 * @param {string} params.grantId
 * @param {string} params.officerId
 * @param {string} params.reportId
 * @param {number} [params.limit=20] Max 20 records
 * @param {number} [params.offset=0]
 * @param {Object} [params.serviceSupabase]
 * @returns {Promise<{ records: Array<Object>, count: number, limit: number, offset: number, hasMore: boolean }>}
 */
export async function executeIndividualRead({
  grantId,
  officerId,
  reportId,
  limit = 20,
  offset = 0,
  serviceSupabase = null,
}) {
  // Strictly clamp limit to maximum 20 per specification
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 20);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  if (serviceSupabase) {
    const { data, error } = await serviceSupabase.rpc('execute_audited_break_glass_read', {
      p_grant_id: grantId,
      p_officer_id: officerId,
      p_report_id: reportId,
      p_limit: safeLimit,
      p_offset: safeOffset,
    });

    if (error) {
      const err = new Error(error.message);
      if (error.message.includes('revoked')) {
        err.code = 'grant_revoked';
      } else if (error.message.includes('expired')) {
        err.code = 'grant_expired';
      } else if (error.message.includes('not found')) {
        err.code = 'grant_not_found';
      } else {
        err.code = 'read_failed';
      }
      throw err;
    }

    const records = (data || []).map((row) => ({
      personnelId: row.personnel_id,
      unitId: row.unit_id,
      historyStartOn: row.history_start_on,
      recentLeaveStatus: row.recent_leave_status,
      nightShiftsCount: parseInt(row.night_shifts_count || '0', 10),
      recordedDutyHours: parseFloat(row.recorded_duty_hours || '0.0'),
    }));

    return {
      records,
      count: records.length,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: records.length === safeLimit,
    };
  }

  // Fallback in-memory mock mode:
  const grant = _testGrantStore.get(grantId);
  if (!grant) {
    const err = new Error('Access grant not found');
    err.code = 'grant_not_found';
    throw err;
  }

  if (grant.officer_id !== officerId || grant.report_id !== reportId) {
    const err = new Error('Access grant is not valid for this officer or report');
    err.code = 'grant_mismatch';
    throw err;
  }

  if (grant.is_revoked || grant.isRevoked || grant.revoked || grant.status === 'revoked') {
    const err = new Error(`Access grant ${grantId} has been revoked`);
    err.code = 'grant_revoked';
    throw err;
  }

  if (!isGrantActive({ expiresAt: grant.expires_at, officerId: grant.officer_id, is_revoked: grant.is_revoked }, officerId)) {
    const err = new Error(`Access grant ${grantId} has expired at ${grant.expires_at}`);
    err.code = 'grant_expired';
    throw err;
  }

  // Generate synthetic records for unit
  const allUnitRecords = generateSyntheticPseudonymousRecords(grant.unit_id, 60);
  const sliced = allUnitRecords.slice(safeOffset, safeOffset + safeLimit);

  // Atomically record audit row in test store
  _testAuditStore.push({
    id: crypto.randomUUID(),
    grant_id: grantId,
    actor_id: officerId,
    report_id: reportId,
    unit_id: grant.unit_id,
    action: 'individual_read',
    row_count: sliced.length,
    reason_code: grant.reason_code,
    occurred_at: new Date().toISOString(),
  });

  return {
    records: sliced.map((r) => ({
      personnelId: r.personnelId,
      unitId: r.unitId,
      historyStartOn: r.historyStartOn,
      recentLeaveStatus: r.recentLeaveStatus,
      nightShiftsCount: r.nightShiftsCount,
      recordedDutyHours: r.recordedDutyHours,
    })),
    count: sliced.length,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: safeOffset + safeLimit < allUnitRecords.length,
  };
}

/**
 * Fetches only the officer's OWN audit trail events.
 *
 * @param {Object} params
 * @param {string} params.officerId
 * @param {number} [params.limit=50]
 * @param {Object} [params.serviceSupabase]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchOfficerAuditTrail({
  officerId,
  limit = 50,
  serviceSupabase = null,
}) {
  if (!officerId) return [];
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  if (serviceSupabase) {
    const { data, error } = await serviceSupabase.rpc('get_officer_audit_log', {
      p_officer_id: officerId,
      p_limit: safeLimit,
    });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      grantId: row.grant_id,
      reportId: row.report_id,
      unitId: row.unit_id,
      weekStart: row.week_start,
      action: row.action,
      rowCount: row.row_count,
      reasonCode: row.reason_code,
      occurredAt: row.occurred_at,
    }));
  }

  // Mock mode: Filter by actor_id = officerId only
  return _testAuditStore
    .filter((event) => event.actor_id === officerId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, safeLimit)
    .map((e) => ({
      id: e.id,
      grantId: e.grant_id,
      reportId: e.report_id,
      unitId: e.unit_id || 'UNIT-B',
      weekStart: e.week_start || '2026-09-28',
      action: e.action,
      rowCount: e.row_count,
      reasonCode: e.reason_code || 'welfare_review',
      occurredAt: e.occurred_at,
    }));
}
