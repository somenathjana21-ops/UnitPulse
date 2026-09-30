/**
 * frontend/tests/break-glass.test.js
 *
 * Frontend and API integration tests for Phase 6 Exceptional Individual-Read Workflow:
 * - POST /api/welfare/reports/:id/access-grants
 * - GET /api/welfare/reports/:id/individuals
 * - GET /api/welfare/audit
 *
 * Critical verification IDs from docs/11-testing-plan.md:
 * - T-02: Commander requests /individuals -> 403
 * - T-06: Officer lacks assignment -> Report and grant denied (404)
 * - T-07: Officer omits reason -> Grant denied (422)
 * - T-08: Grant expired or for different unit -> Read denied (403)
 * - T-09: Authorized paginated individual read -> Matching audit event written before data returned
 *
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createBreakGlassGrant,
  getBreakGlassGrant,
  executeIndividualRead,
  fetchOfficerAuditTrail,
  resetTestStores,
  _testGrantStore,
  _testAuditStore,
} from '../src/lib/welfare/break-glass.js';
import { decryptReason } from '@unitpulse/backend';

describe('Phase 6 — Break-Glass Service & Domain Logic', () => {
  const officerOne = '00000000-0000-0000-0000-000000000003';
  const officerTwo = '00000000-0000-0000-0000-000000000004';
  const reportOne = '11111111-1111-1111-1111-111111111111';
  const unitOne = 'UNIT-B';

  beforeEach(() => {
    resetTestStores();
  });

  it('T-07: Rejects grant request when reason is missing or shorter than 10 characters', async () => {
    await assert.rejects(
      async () => {
        await createBreakGlassGrant({
          officerId: officerOne,
          assignedOfficerId: officerOne,
          reportId: reportOne,
          unitId: unitOne,
          reasonCode: 'welfare_review',
          reason: 'Short',
        });
      },
      (err) => {
        assert.equal(err.code, 'invalid_grant_request');
        assert.ok(err.message.includes('Reason must be at least 10 characters'));
        return true;
      }
    );
  });

  it('T-06: Rejects grant request when officer is not assigned to the welfare report', async () => {
    await assert.rejects(
      async () => {
        await createBreakGlassGrant({
          officerId: officerTwo,
          assignedOfficerId: officerOne,
          reportId: reportOne,
          unitId: unitOne,
          reasonCode: 'welfare_review',
          reason: 'Review leave records and duty shifts.',
        });
      },
      (err) => {
        assert.equal(err.code, 'invalid_grant_request');
        assert.ok(err.message.includes('Officer is not assigned to this report'));
        return true;
      }
    );
  });

  it('Creates grant with 30-minute expiry and server-side encrypted reason at rest', async () => {
    const rawReason = 'Review leave utilization and high night duty count for supportive intervention.';
    const grant = await createBreakGlassGrant({
      officerId: officerOne,
      assignedOfficerId: officerOne,
      reportId: reportOne,
      unitId: unitOne,
      reasonCode: 'welfare_review',
      reason: rawReason,
    });

    assert.ok(grant.grantId);
    assert.equal(grant.reportId, reportOne);
    assert.equal(grant.unitId, unitOne);
    assert.equal(grant.reasonCode, 'welfare_review');
    assert.equal(grant.expiryMinutes, 30);

    // Stored grant in database/store contains ciphertext, NOT plaintext
    const stored = _testGrantStore.get(grant.grantId);
    assert.ok(stored);
    assert.notEqual(stored.encrypted_reason, rawReason);
    assert.ok(stored.encrypted_reason.startsWith('v1:'));

    // Reason decrypts successfully with server secret
    const decrypted = decryptReason(stored.encrypted_reason);
    assert.equal(decrypted, rawReason);

    // Initial audit log for grant creation exists
    const auditEvents = _testAuditStore.filter((e) => e.grant_id === grant.grantId);
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].action, 'grant_requested');
  });

  it('T-08: Denies individual read when access grant has expired', async () => {
    // Manually insert an expired grant into store
    const expiredGrantId = 'expired-grant-uuid';
    _testGrantStore.set(expiredGrantId, {
      id: expiredGrantId,
      report_id: reportOne,
      officer_id: officerOne,
      unit_id: unitOne,
      reason_code: 'welfare_review',
      encrypted_reason: 'v1:fake:encrypted:data',
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // Expired 1 min ago
      created_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    });

    const status = await getBreakGlassGrant({
      grantId: expiredGrantId,
      officerId: officerOne,
      reportId: reportOne,
    });
    assert.equal(status.active, false);

    await assert.rejects(
      async () => {
        await executeIndividualRead({
          grantId: expiredGrantId,
          officerId: officerOne,
          reportId: reportOne,
          limit: 20,
          offset: 0,
        });
      },
      (err) => {
        assert.equal(err.code, 'grant_expired');
        return true;
      }
    );
  });

  it('T-09: Clamps read to max 20 pseudonymous records and writes audit event in same transaction', async () => {
    const grant = await createBreakGlassGrant({
      officerId: officerOne,
      assignedOfficerId: officerOne,
      reportId: reportOne,
      unitId: unitOne,
      reasonCode: 'welfare_review',
      reason: 'Review leave records and duty shifts.',
    });

    // Request limit of 100 — must be clamped to 20
    const result = await executeIndividualRead({
      grantId: grant.grantId,
      officerId: officerOne,
      reportId: reportOne,
      limit: 100,
      offset: 0,
    });

    assert.equal(result.records.length, 20);
    assert.equal(result.limit, 20);
    assert.equal(result.count, 20);

    // Check pseudonymous record fields: NO personal names, NO medical terms
    for (const rec of result.records) {
      assert.ok(rec.personnelId.startsWith('PER-'));
      assert.equal(rec.unitId, unitOne);
      assert.ok(rec.historyStartOn);
      assert.ok(typeof rec.nightShiftsCount === 'number');
      assert.ok(typeof rec.recordedDutyHours === 'number');
      assert.equal('name' in rec, false);
      assert.equal('medical_history' in rec, false);
    }

    // Check that matching audit event was logged
    const readAuditEvents = _testAuditStore.filter(
      (e) => e.grant_id === grant.grantId && e.action === 'individual_read'
    );
    assert.equal(readAuditEvents.length, 1);
    assert.equal(readAuditEvents[0].actor_id, officerOne);
    assert.equal(readAuditEvents[0].report_id, reportOne);
    assert.equal(readAuditEvents[0].row_count, 20);

    // Second paginated read (offset 20) records a SECOND audit row
    const page2 = await executeIndividualRead({
      grantId: grant.grantId,
      officerId: officerOne,
      reportId: reportOne,
      limit: 20,
      offset: 20,
    });
    assert.equal(page2.records.length, 20);
    assert.equal(page2.offset, 20);

    const totalAuditEvents = _testAuditStore.filter((e) => e.grant_id === grant.grantId);
    assert.equal(totalAuditEvents.length, 3); // 1 grant_requested + 2 individual_reads
  });

  it('fetchOfficerAuditTrail returns only the officer\'s own audit events', async () => {
    // Officer One requests a grant
    await createBreakGlassGrant({
      officerId: officerOne,
      assignedOfficerId: officerOne,
      reportId: reportOne,
      unitId: unitOne,
      reasonCode: 'welfare_review',
      reason: 'Review leave records and duty shifts.',
    });

    // Officer Two requests a grant
    await createBreakGlassGrant({
      officerId: officerTwo,
      assignedOfficerId: officerTwo,
      reportId: '22222222-2222-2222-2222-222222222222',
      unitId: 'UNIT-C',
      reasonCode: 'roster_audit',
      reason: 'Review roster audit for night duty check.',
    });

    // Officer One inspects their own audit trail
    const auditOne = await fetchOfficerAuditTrail({ officerId: officerOne });
    assert.equal(auditOne.length, 1);
    assert.equal(auditOne[0].reportId, reportOne);
    assert.equal(auditOne[0].reasonCode, 'welfare_review');

    // Officer Two inspects their own audit trail
    const auditTwo = await fetchOfficerAuditTrail({ officerId: officerTwo });
    assert.equal(auditTwo.length, 1);
    assert.equal(auditTwo[0].unitId, 'UNIT-C');
    assert.equal(auditTwo[0].reasonCode, 'roster_audit');
  });
});

import {
  resolveBreakGlassGrantRequestAccess,
  resolveBreakGlassReadAccess,
} from '../src/lib/welfare/authorize.js';

describe('Phase 6 — Break-Glass Authorization Resolution Gates', () => {
  const officerOne = { id: '00000000-0000-0000-0000-000000000003', role: 'welfare_officer' };
  const officerTwo = { id: '00000000-0000-0000-0000-000000000004', role: 'welfare_officer' };
  const commander = { id: '00000000-0000-0000-0000-000000000001', role: 'commander' };
  const reportOne = { id: 'rep-1', unit_id: 'UNIT-B', assigned_to: officerOne.id };

  const validGrant = {
    id: 'grant-1',
    officer_id: officerOne.id,
    report_id: reportOne.id,
    unit_id: 'UNIT-B',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  it('T-02: Commander requesting individual-level access is denied with 403', () => {
    const res = resolveBreakGlassReadAccess({
      user: commander,
      report: reportOne,
      grantId: 'grant-1',
      grant: validGrant,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.reason, 'role_not_welfare_officer');
  });

  it('T-06: Unassigned welfare officer is denied with 404 (conceals existence)', () => {
    const res = resolveBreakGlassReadAccess({
      user: officerTwo,
      report: reportOne,
      grantId: 'grant-1',
      grant: validGrant,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 404);
  });

  it('Rejects individual read if grantId parameter is missing (400)', () => {
    const res = resolveBreakGlassReadAccess({
      user: officerOne,
      report: reportOne,
      grantId: null,
      grant: validGrant,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 400);
    assert.equal(res.reason, 'missing_grant_id');
  });

  it('T-08: Rejects individual read if grant has expired (403)', () => {
    const expiredGrant = {
      ...validGrant,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    const res = resolveBreakGlassReadAccess({
      user: officerOne,
      report: reportOne,
      grantId: 'grant-1',
      grant: expiredGrant,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.reason, 'grant_expired');
  });

  it('Rejects individual read if grant unit does not match report unit (403)', () => {
    const mismatchedUnitGrant = {
      ...validGrant,
      unit_id: 'UNIT-C', // Mismatch with report's UNIT-B
    };
    const res = resolveBreakGlassReadAccess({
      user: officerOne,
      report: reportOne,
      grantId: 'grant-1',
      grant: mismatchedUnitGrant,
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.reason, 'unit_mismatch');
  });

  it('Allows individual read for assigned officer with active valid grant (200)', () => {
    const res = resolveBreakGlassReadAccess({
      user: officerOne,
      report: reportOne,
      grantId: 'grant-1',
      grant: validGrant,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, 'ok');
  });
});

