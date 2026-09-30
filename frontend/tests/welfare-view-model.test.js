/**
 * frontend/tests/welfare-view-model.test.js
 *
 * Tests for welfare inbox and report detail view models, in-app notifications, and overdue checks.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReportInboxViewModel,
  buildReportDetailViewModel,
  isReportOverdue,
} from '../src/lib/welfare/view-model.js';

describe('Phase 4 — Welfare View Models & In-App Notifications', () => {
  const refDate = new Date('2026-09-30T12:00:00Z');

  const sampleReports = [
    {
      id: 'rep-1',
      unit_id: 'UNIT-B',
      week_start: '2026-09-28',
      assigned_to: '00000000-0000-0000-0000-000000000003',
      trigger_rule: 'sustained_high',
      status: 'new',
      created_at: '2026-09-29T10:00:00Z', // <48h ago
      follow_up_on: null,
      aggregate_snapshot_json: {
        index: 75,
        baseline: 50,
        contributingFactors: ['Night duty load elevated', 'Recovery gap exceeds threshold'],
      },
      briefing_json: {
        summary: 'Unit B sustained high strain',
        suggestedActions: [{ category: 'rebalance_roster', text: 'Review night shifts' }],
      },
    },
    {
      id: 'rep-2',
      unit_id: 'UNIT-C',
      week_start: '2026-09-21',
      assigned_to: '00000000-0000-0000-0000-000000000003',
      trigger_rule: 'spike',
      status: 'follow_up',
      created_at: '2026-09-22T08:00:00Z',
      follow_up_on: '2026-09-25', // Past date -> OVERDUE
      aggregate_snapshot_json: {
        index: 60,
        baseline: 40,
        contributingFactors: ['Recovery gap elevated'],
      },
      briefing_json: {
        summary: 'Unit C leave backlog',
        suggestedActions: [{ category: 'review_leave_queue', text: 'Approve pending leave' }],
      },
    },
    {
      id: 'rep-3',
      unit_id: 'UNIT-D',
      week_start: '2026-09-14',
      assigned_to: '00000000-0000-0000-0000-000000000003',
      trigger_rule: 'spike',
      status: 'closed',
      created_at: '2026-09-15T08:00:00Z',
      follow_up_on: '2026-09-20', // In past, but case is closed
      aggregate_snapshot_json: { index: 45, baseline: 30 },
      briefing_json: { summary: 'Resolved' },
    },
  ];

  it('buildReportInboxViewModel correctly aggregates counts and flags overdue cases', () => {
    const inbox = buildReportInboxViewModel(sampleReports, refDate);

    assert.equal(inbox.reports.length, 3);
    assert.equal(inbox.stats.total, 3);
    assert.equal(inbox.stats.newCount, 1);
    assert.equal(inbox.stats.overdueCount, 1);
    assert.equal(inbox.stats.activeCount, 2);
    assert.equal(inbox.stats.closedCount, 1);

    // Overdue report (rep-2)
    const overdueReport = inbox.reports.find((r) => r.id === 'rep-2');
    assert.equal(overdueReport.isOverdue, true);
    assert.equal(overdueReport.overdueReason, 'follow_up_overdue');

    // Closed report (rep-3) is not overdue
    const closedReport = inbox.reports.find((r) => r.id === 'rep-3');
    assert.equal(closedReport.isOverdue, false);
  });

  it('buildReportInboxViewModel generates in-app notification banners without email leakage', () => {
    const inbox = buildReportInboxViewModel(sampleReports, refDate);

    assert.ok(inbox.notifications.length >= 2);
    const overdueNotif = inbox.notifications.find((n) => n.title === 'Overdue Review Alert');
    assert.ok(overdueNotif);
    assert.ok(overdueNotif.message.includes('1 welfare case'));

    const newNotif = inbox.notifications.find((n) => n.title === 'New Welfare Alerts');
    assert.ok(newNotif);
    assert.ok(newNotif.message.includes('1 unacknowledged'));
  });

  it('buildReportDetailViewModel provides valid status progression and safety disclaimer', () => {
    const detail = buildReportDetailViewModel(sampleReports[0], refDate);

    assert.equal(detail.id, 'rep-1');
    assert.equal(detail.unitId, 'UNIT-B');
    assert.equal(detail.status, 'new');
    // Allowed transitions from 'new' is only ['acknowledged']
    assert.deepEqual(detail.allowedNextStatuses, ['acknowledged']);
    assert.equal(detail.canClose, false);
    assert.ok(detail.disclaimer.includes('not a clinical or medical diagnosis'));
    assert.ok(detail.suggestedActions.length > 0);
  });

  it('buildReportDetailViewModel for action_taken allows follow_up or closed', () => {
    const actionTakenReport = {
      ...sampleReports[0],
      status: 'action_taken',
    };
    const detail = buildReportDetailViewModel(actionTakenReport, refDate);
    assert.deepEqual(detail.allowedNextStatuses, ['follow_up', 'closed']);
    assert.equal(detail.canClose, true);
  });
});
