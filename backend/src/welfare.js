/**
 * backend/src/welfare.js
 *
 * Welfare report workflow and lifecycle transitions.
 * Specifications: docs/02-prd.md, docs/04-user-flows.md, docs/08-api-specification.md
 *
 * Report Statuses:
 * - new: Trigger condition met, report created and assigned to Welfare Officer.
 * - acknowledged: Officer has viewed the report.
 * - action_taken: Officer has recorded a supportive operational/welfare action.
 * - follow_up: Officer scheduled a review of the unit's conditions.
 * - closed: Welfare case concluded with documented outcome.
 */

export const REPORT_STATUSES = [
  'new',
  'acknowledged',
  'action_taken',
  'follow_up',
  'closed',
];

export const VALID_TRANSITIONS = {
  new: ['acknowledged'],
  acknowledged: ['action_taken'],
  action_taken: ['follow_up', 'closed'],
  follow_up: ['action_taken', 'closed'],
  closed: [], // Terminal state
};

/**
 * Validates a requested report status transition.
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @param {Object} [details={}]
 * @param {string} [details.notes] Documented action or follow-up note
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateStatusTransition(currentStatus, targetStatus, details = {}) {
  if (!REPORT_STATUSES.includes(currentStatus)) {
    return { valid: false, error: `Invalid current status: ${currentStatus}` };
  }

  if (!REPORT_STATUSES.includes(targetStatus)) {
    return { valid: false, error: `Invalid target status: ${targetStatus}` };
  }

  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
    };
  }

  if (targetStatus === 'closed' && (!details.notes || details.notes.trim().length < 10)) {
    return {
      valid: false,
      error: 'Closing a welfare report requires documented outcome notes (min 10 characters).',
    };
  }

  return { valid: true };
}

/**
 * Evaluates whether a welfare report is overdue for review or follow-up.
 *
 * Rules:
 * - A report in 'closed' status is never overdue.
 * - If 'follow_up_on' is specified and earlier than the current date, it is overdue.
 * - If status is 'new' and more than 48 hours have elapsed since 'created_at', it is overdue for initial review.
 *
 * @param {Object} report
 * @param {Date|string} [now=new Date()]
 * @returns {{ overdue: boolean, reason: string|null, message: string|null }}
 */
export function isReportOverdue(report, now = new Date()) {
  if (!report || report.status === 'closed') {
    return { overdue: false, reason: null, message: null };
  }

  const nowDate = typeof now === 'string' ? new Date(now) : now;
  const nowTime = nowDate.getTime();

  // 1. Scheduled follow-up date check (date comparison at start of day UTC)
  if (report.follow_up_on) {
    const followUpDate = new Date(`${report.follow_up_on}T00:00:00Z`);
    // Compare against today's start of day UTC
    const todayUtc = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()));
    if (followUpDate < todayUtc) {
      return {
        overdue: true,
        reason: 'follow_up_overdue',
        message: `Follow-up review was scheduled for ${report.follow_up_on} and is overdue.`,
      };
    }
  }

  // 2. Initial review overdue check for 'new' reports (>48 hours unacknowledged)
  if (report.status === 'new' && report.created_at) {
    const createdAtTime = new Date(report.created_at).getTime();
    const ageHours = (nowTime - createdAtTime) / (1000 * 60 * 60);
    if (ageHours > 48) {
      return {
        overdue: true,
        reason: 'initial_review_overdue',
        message: 'Report has been pending initial acknowledgment for more than 48 hours.',
      };
    }
  }

  return { overdue: false, reason: null, message: null };
}

/**
 * Builds the confidential aggregate snapshot JSON payload for a welfare report.
 * Strictly aggregate data; NEVER contains personnel IDs or names.
 *
 * @param {Object} params
 * @param {string} params.unitId
 * @param {string} params.weekStart
 * @param {number|null} params.index
 * @param {number|null} params.baseline
 * @param {number} [params.comparableWeeksCount=0]
 * @param {string} params.triggerRule
 * @param {string} params.triggerReason
 * @param {Array} [params.activeRules=[]]
 * @param {Object} [params.approvedMetrics={}]
 * @returns {Object} aggregate_snapshot_json
 */
export function buildAggregateSnapshot({
  unitId,
  weekStart,
  index,
  baseline,
  comparableWeeksCount = 0,
  triggerRule,
  triggerReason,
  activeRules = [],
  approvedMetrics = {},
}) {
  const contributingFactors = [];

  if (approvedMetrics.meanNightShifts28d > 8) {
    contributingFactors.push(`Night duty load is elevated (${approvedMetrics.meanNightShifts28d} shifts/28d avg).`);
  }
  if (approvedMetrics.recoveryGapPercent > 35) {
    contributingFactors.push(`Recovery gap exceeds policy threshold (${approvedMetrics.recoveryGapPercent}%).`);
  }
  if (approvedMetrics.meanWeeklyDutyHours > 52) {
    contributingFactors.push(`Weekly workload is elevated (${approvedMetrics.meanWeeklyDutyHours} hrs/week avg).`);
  }
  if (approvedMetrics.leaveUtilizationPercent !== undefined && approvedMetrics.leaveUtilizationPercent < 20) {
    contributingFactors.push(`Leave utilization is low (${approvedMetrics.leaveUtilizationPercent}%).`);
  }

  if (contributingFactors.length === 0) {
    contributingFactors.push('Elevated unit strain index detected relative to historical comparison period.');
  }

  return {
    unitId,
    weekStart,
    index,
    baseline,
    comparableWeeksCount,
    triggerRule,
    triggerReason,
    activeRules,
    contributingFactors,
    approvedMetrics,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Builds the deterministic aggregate briefing JSON for a welfare report.
 * Strictly adheres to allowed action categories and non-diagnostic wording.
 *
 * @param {Object} params
 * @param {string} params.unitId
 * @param {string} params.weekStart
 * @param {Array} [params.suggestedActions=[]]
 * @returns {Object} briefing_json
 */
export function buildWelfareBriefing({ unitId, weekStart, suggestedActions = [] }) {
  const actions = suggestedActions.length > 0 ? suggestedActions : [
    { category: 'offer_welfare_review', text: 'Coordinate with Unit Welfare Officer for supportive check-ins.' },
    { category: 'review_leave_queue', text: 'Prioritize pending leave requests for personnel with extended recovery gaps.' },
    { category: 'rebalance_roster', text: 'Review duty rosters to provide appropriate recovery intervals between shifts.' },
  ];

  return {
    summary: `Unit ${unitId} exhibits elevated strain indicators for completed week ${weekStart}. Operational review recommended.`,
    suggestedActions: actions,
    disclaimer: 'This briefing is an operational welfare planning indicator. It is not a clinical or medical diagnosis.',
  };
}

