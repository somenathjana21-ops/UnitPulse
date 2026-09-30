/**
 * frontend/src/lib/welfare/view-model.js
 *
 * View-model transformations for the Welfare Officer inbox and report detail.
 * Specifications: docs/03-srs.md, docs/04-user-flows.md, docs/07-ml-specification.md
 */

import { isReportOverdue as backendIsReportOverdue, VALID_TRANSITIONS } from '@unitpulse/backend';

export const STATUS_CONFIG = {
  new: {
    label: 'New Alert',
    badgeClass: 'status-elevated',
    description: 'Trigger condition met; awaiting officer review',
  },
  acknowledged: {
    label: 'Acknowledged',
    badgeClass: 'status-pending',
    description: 'Reviewed by assigned Welfare Officer',
  },
  action_taken: {
    label: 'Action Taken',
    badgeClass: 'status-ready',
    description: 'Supportive operational or welfare action recorded',
  },
  follow_up: {
    label: 'Follow-Up Scheduled',
    badgeClass: 'status-pending',
    description: 'Scheduled for condition review',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'hero-badge',
    description: 'Case concluded with documented outcome',
  },
};

export const TRIGGER_RULE_LABELS = {
  spike: 'Spike Trigger (Index >= 40 and >= Baseline + 15)',
  sustained_high: 'Sustained-High Trigger (Index >= 75 for 2 consecutive weeks)',
  manual_escalation: 'Manual Escalation',
};

/**
 * Re-exports overdue calculation with UI view-model guarantees.
 */
export function isReportOverdue(report, now = new Date()) {
  return backendIsReportOverdue(report, now);
}

/**
 * Transforms an array of welfare report rows into an inbox view model.
 *
 * @param {Object[]} reports
 * @param {Date|string} [now=new Date()]
 * @returns {Object} Inbox view model with in-app notifications and stats
 */
export function buildReportInboxViewModel(reports = [], now = new Date()) {
  let newCount = 0;
  let overdueCount = 0;

  const items = (reports || []).map((report) => {
    const overdueCheck = isReportOverdue(report, now);
    if (report.status === 'new') newCount++;
    if (overdueCheck.overdue) overdueCount++;

    const config = STATUS_CONFIG[report.status] || {
      label: report.status,
      badgeClass: 'hero-badge',
      description: '',
    };

    const snapshot = report.aggregate_snapshot_json || {};
    const briefing = report.briefing_json || {};

    return {
      id: report.id,
      unitId: report.unit_id,
      weekStart: report.week_start,
      status: report.status,
      statusLabel: config.label,
      badgeClass: config.badgeClass,
      triggerRule: report.trigger_rule,
      triggerRuleLabel: TRIGGER_RULE_LABELS[report.trigger_rule] || report.trigger_rule,
      index: snapshot.index ?? '—',
      baseline: snapshot.baseline ?? '—',
      contributingFactors: snapshot.contributingFactors || [],
      summary: briefing.summary || 'Elevated conditions observed.',
      createdAt: report.created_at,
      acknowledgedAt: report.acknowledged_at,
      followUpOn: report.follow_up_on,
      isOverdue: overdueCheck.overdue,
      overdueReason: overdueCheck.reason,
      overdueMessage: overdueCheck.message,
    };
  });

  // Construct in-app notification banners (replaces email dispatch per MVP spec)
  const notifications = [];
  if (overdueCount > 0) {
    notifications.push({
      type: 'warning',
      title: 'Overdue Review Alert',
      message: `${overdueCount} welfare case(s) have overdue review or follow-up milestones requiring immediate attention.`,
    });
  }
  if (newCount > 0) {
    notifications.push({
      type: 'info',
      title: 'New Welfare Alerts',
      message: `You have ${newCount} unacknowledged welfare report(s) assigned to your review queue.`,
    });
  }

  return {
    reports: items,
    notifications,
    stats: {
      total: items.length,
      newCount,
      overdueCount,
      activeCount: items.filter((r) => r.status !== 'closed').length,
      closedCount: items.filter((r) => r.status === 'closed').length,
    },
  };
}

/**
 * Builds the view model for a single welfare report detail page.
 *
 * @param {Object} report
 * @param {Date|string} [now=new Date()]
 * @returns {Object} Report detail view model
 */
export function buildReportDetailViewModel(report, now = new Date()) {
  if (!report) return null;

  const overdueCheck = isReportOverdue(report, now);
  const config = STATUS_CONFIG[report.status] || {
    label: report.status,
    badgeClass: 'hero-badge',
    description: '',
  };

  const allowedNextStatuses = VALID_TRANSITIONS[report.status] || [];
  const snapshot = report.aggregate_snapshot_json || {};
  const briefing = report.briefing_json || {};

  return {
    id: report.id,
    unitId: report.unit_id,
    weekStart: report.week_start,
    assignedTo: report.assigned_to,
    status: report.status,
    statusLabel: config.label,
    badgeClass: config.badgeClass,
    statusDescription: config.description,
    allowedNextStatuses,
    canClose: allowedNextStatuses.includes('closed'),
    triggerRule: report.trigger_rule,
    triggerRuleLabel: TRIGGER_RULE_LABELS[report.trigger_rule] || report.trigger_rule,
    triggerReason: snapshot.triggerReason || 'Elevated strain indicators exceeded threshold',
    index: snapshot.index ?? '—',
    baseline: snapshot.baseline ?? '—',
    comparableWeeksCount: snapshot.comparableWeeksCount ?? 0,
    contributingFactors: snapshot.contributingFactors || [],
    approvedMetrics: snapshot.approvedMetrics || {},
    summary: briefing.summary || `Operational review recommended for Unit ${report.unit_id}.`,
    suggestedActions: briefing.suggestedActions || [],
    disclaimer: briefing.disclaimer || 'This briefing is an operational welfare planning indicator. It is not a clinical or medical diagnosis.',
    createdAt: report.created_at,
    acknowledgedAt: report.acknowledged_at,
    followUpOn: report.follow_up_on,
    isOverdue: overdueCheck.overdue,
    overdueReason: overdueCheck.reason,
    overdueMessage: overdueCheck.message,
  };
}
