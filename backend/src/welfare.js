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
