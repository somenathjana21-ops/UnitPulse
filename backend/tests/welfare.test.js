/**
 * backend/tests/welfare.test.js
 *
 * Tests for welfare report lifecycle, overdue review checks, and officer assignment permissions.
 * Specifications: docs/03-srs.md, docs/04-user-flows.md, docs/08-api-specification.md, docs/09-database-design.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  REPORT_STATUSES,
  VALID_TRANSITIONS,
  validateStatusTransition,
  isReportOverdue,
  buildAggregateSnapshot,
  buildWelfareBriefing,
  canAccessWelfareReport,
} from '../src/index.js';

describe('Phase 4 — Welfare Report Status Transitions', () => {
  it('Enforces valid statuses: new, acknowledged, action_taken, follow_up, closed', () => {
    assert.deepEqual(REPORT_STATUSES, [
      'new',
      'acknowledged',
      'action_taken',
      'follow_up',
      'closed',
    ]);
  });

  it('Allows valid progression: new -> acknowledged -> action_taken -> follow_up -> closed', () => {
    // new -> acknowledged
    const t1 = validateStatusTransition('new', 'acknowledged');
    assert.equal(t1.valid, true);

    // acknowledged -> action_taken
    const t2 = validateStatusTransition('acknowledged', 'action_taken');
    assert.equal(t2.valid, true);

    // action_taken -> follow_up
    const t3 = validateStatusTransition('action_taken', 'follow_up');
    assert.equal(t3.valid, true);

    // follow_up -> closed (with valid notes)
    const t4 = validateStatusTransition('follow_up', 'closed', {
      notes: 'Follow-up consultation completed with unit commander and leave rebalanced.',
    });
    assert.equal(t4.valid, true);
  });

  it('Allows action_taken -> closed directly with documented notes', () => {
    const t = validateStatusTransition('action_taken', 'closed', {
      notes: 'Conducted supportive welfare check and addressed roster conflicts.',
    });
    assert.equal(t.valid, true);
  });

  it('Rejects closing without documented outcome notes or with notes <10 characters', () => {
    const tEmpty = validateStatusTransition('action_taken', 'closed', {});
    assert.equal(tEmpty.valid, false);
    assert.ok(tEmpty.error.includes('min 10 characters'));

    const tShort = validateStatusTransition('follow_up', 'closed', { notes: 'Too short' });
    assert.equal(tShort.valid, false);
  });

  it('Rejects invalid status transitions (e.g., skipping required workflow steps)', () => {
    // Cannot jump new -> closed
    const t1 = validateStatusTransition('new', 'closed', { notes: 'Skipping steps' });
    assert.equal(t1.valid, false);

    // Cannot jump new -> action_taken without acknowledging
    const t2 = validateStatusTransition('new', 'action_taken');
    assert.equal(t2.valid, false);

    // Cannot transition from closed (terminal state)
    const t3 = validateStatusTransition('closed', 'acknowledged');
    assert.equal(t3.valid, false);

    // Rejects unknown status
    const t4 = validateStatusTransition('new', 'in_progress');
    assert.equal(t4.valid, false);
  });
});

describe('Phase 4 — Welfare Overdue Review Indicator', () => {
  const refDate = new Date('2026-09-30T12:00:00Z');

  it('A closed report is never overdue', () => {
    const report = {
      status: 'closed',
      follow_up_on: '2026-09-01', // Date in past, but case is closed
      created_at: '2026-08-01T00:00:00Z',
    };
    const res = isReportOverdue(report, refDate);
    assert.equal(res.overdue, false);
    assert.equal(res.reason, null);
  });

  it('Flags a report as overdue when follow_up_on has passed and status is not closed', () => {
    const report = {
      status: 'follow_up',
      follow_up_on: '2026-09-25', // Past date
      created_at: '2026-09-15T00:00:00Z',
    };
    const res = isReportOverdue(report, refDate);
    assert.equal(res.overdue, true);
    assert.equal(res.reason, 'follow_up_overdue');
    assert.ok(res.message.includes('2026-09-25'));
  });

  it('Does not flag report as overdue when follow_up_on is in the future', () => {
    const report = {
      status: 'follow_up',
      follow_up_on: '2026-10-15', // Future date
      created_at: '2026-09-28T00:00:00Z',
    };
    const res = isReportOverdue(report, refDate);
    assert.equal(res.overdue, false);
  });

  it('Flags a "new" report as overdue if unacknowledged for more than 48 hours', () => {
    const report = {
      status: 'new',
      created_at: '2026-09-27T00:00:00Z', // >72 hours before 2026-09-30 12:00
    };
    const res = isReportOverdue(report, refDate);
    assert.equal(res.overdue, true);
    assert.equal(res.reason, 'initial_review_overdue');
    assert.ok(res.message.includes('48 hours'));
  });

  it('Does not flag a "new" report as overdue if created recently (<48 hours)', () => {
    const report = {
      status: 'new',
      created_at: '2026-09-30T00:00:00Z', // 12 hours ago
    };
    const res = isReportOverdue(report, refDate);
    assert.equal(res.overdue, false);
  });
});

describe('Phase 4 — Assigned Welfare Officer Access Control', () => {
  const officerOne = { id: '00000000-0000-0000-0000-000000000003', role: 'welfare_officer' };
  const officerTwo = { id: '00000000-0000-0000-0000-000000000004', role: 'welfare_officer' };
  const commander = { id: '00000000-0000-0000-0000-000000000001', role: 'commander' };

  const reportAssignedToOfficerOne = {
    id: 'rep-uuid-1',
    unit_id: 'UNIT-B',
    assigned_to: officerOne.id,
    status: 'new',
  };

  it('Allows access to the assigned welfare officer', () => {
    const check = canAccessWelfareReport({
      user: officerOne,
      report: reportAssignedToOfficerOne,
    });
    assert.equal(check.allowed, true);
  });

  it('Denies access to an unassigned welfare officer', () => {
    const check = canAccessWelfareReport({
      user: officerTwo,
      report: reportAssignedToOfficerOne,
    });
    assert.equal(check.allowed, false);
    assert.equal(check.reason, 'report_not_assigned_to_user');
  });

  it('Denies access to a commander', () => {
    const check = canAccessWelfareReport({
      user: commander,
      report: reportAssignedToOfficerOne,
    });
    assert.equal(check.allowed, false);
    assert.equal(check.reason, 'role_not_welfare_officer');
  });

  it('Denies access to anonymous requests', () => {
    const check = canAccessWelfareReport({
      user: null,
      report: reportAssignedToOfficerOne,
    });
    assert.equal(check.allowed, false);
    assert.equal(check.reason, 'unauthenticated');
  });
});

describe('Phase 4 — Snapshot and Briefing Builders', () => {
  it('buildAggregateSnapshot creates valid confidential aggregate snapshot without personal identifiers', () => {
    const snapshot = buildAggregateSnapshot({
      unitId: 'UNIT-B',
      weekStart: '2026-09-28',
      index: 75,
      baseline: 50,
      comparableWeeksCount: 6,
      triggerRule: 'sustained_high',
      triggerReason: 'Trigger condition met: sustained_high',
      activeRules: [{ rule: 'sustained_high', description: 'index >= 75 for 2 consecutive weeks' }],
      approvedMetrics: {
        meanNightShifts28d: 12.5,
        recoveryGapPercent: 42,
        meanWeeklyDutyHours: 56.0,
      },
    });

    assert.equal(snapshot.unitId, 'UNIT-B');
    assert.equal(snapshot.index, 75);
    assert.equal(snapshot.baseline, 50);
    assert.ok(snapshot.contributingFactors.length >= 3);

    // Verify zero personnel identifiers exist in snapshot
    const jsonStr = JSON.stringify(snapshot);
    assert.ok(!jsonStr.includes('PER-'));
    assert.ok(!jsonStr.includes('personnel_id'));
  });

  it('buildWelfareBriefing includes non-diagnostic safety disclaimer', () => {
    const briefing = buildWelfareBriefing({
      unitId: 'UNIT-B',
      weekStart: '2026-09-28',
    });

    assert.ok(briefing.disclaimer.includes('operational welfare planning indicator'));
    assert.ok(briefing.disclaimer.includes('not a clinical or medical diagnosis'));
    assert.ok(briefing.suggestedActions.length > 0);
  });
});
