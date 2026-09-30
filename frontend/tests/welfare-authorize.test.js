/**
 * frontend/tests/welfare-authorize.test.js
 *
 * Tests for Welfare Officer access resolution.
 * Specifications: docs/03-srs.md, docs/08-api-specification.md, docs/09-database-design.md
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveWelfareReportAccess } from '../src/lib/welfare/authorize.js';

describe('Phase 4 — Welfare Authorization (resolveWelfareReportAccess)', () => {
  const assignedOfficer = {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'welfare_officer',
  };

  const otherOfficer = {
    id: '00000000-0000-0000-0000-000000000004',
    role: 'welfare_officer',
  };

  const commander = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'commander',
  };

  const report = {
    id: 'rep-uuid-1234',
    unit_id: 'UNIT-B',
    assigned_to: assignedOfficer.id,
    status: 'new',
  };

  it('Resolves 401 for anonymous / unauthenticated user', () => {
    const res = resolveWelfareReportAccess({ user: null, report });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 401);
    assert.equal(res.reason, 'unauthenticated');
  });

  it('Resolves 403 for user with commander role', () => {
    const res = resolveWelfareReportAccess({ user: commander, report });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.reason, 'role_not_welfare_officer');
  });

  it('Resolves 404 for missing report (does not leak existence)', () => {
    const res = resolveWelfareReportAccess({ user: assignedOfficer, report: null });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 404);
    assert.equal(res.reason, 'report_not_found');
  });

  it('Resolves 404 for report assigned to a different welfare officer (no existence oracle)', () => {
    const res = resolveWelfareReportAccess({ user: otherOfficer, report });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 404);
    assert.equal(res.reason, 'report_not_assigned_to_user');
  });

  it('Resolves 200 for assigned welfare officer', () => {
    const res = resolveWelfareReportAccess({ user: assignedOfficer, report });
    assert.equal(res.allowed, true);
    assert.equal(res.httpStatus, 200);
    assert.equal(res.reason, 'ok');
  });
});
