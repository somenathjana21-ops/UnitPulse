/**
 * backend/src/metrics.js
 *
 * Weekly verified-source metric aggregation from raw private records.
 * Specification: docs/06-data-specification.md, docs/07-ml-specification.md
 *
 * Turns raw personnel/leave/duty/deployment rows into the metrics object
 * expected by @unitpulse/ml's calculateUnitStrainIndex(). Never substitutes
 * zero for missing data: a person with no verified record for a domain is
 * excluded from that domain's average/ratio, and the domain's coverage
 * ratio drops accordingly.
 */

export const LEAVE_WINDOW_DAYS = 90;
export const NIGHT_DUTY_WINDOW_DAYS = 28;
export const WORKLOAD_WINDOW_DAYS = 7;
export const RECOVERY_GAP_THRESHOLD_DAYS = 60;
export const MIN_COVERAGE_RATIO = 0.8;
export const MIN_DECIDED_REQUESTS_FOR_DENIAL = 5;
export const WEEK_LENGTH_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(later, earlier) {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computes verified weekly source metrics for one unit's completed week.
 *
 * @param {Object} params
 * @param {string} params.unitId
 * @param {string} params.weekStart ISO date (Monday) of the completed week
 * @param {Array} params.personnel Rows: { id, unit_id, active, history_start_on }
 * @param {Array} params.leaveEligibility Rows: { personnel_id, snapshot_week, eligible_days_90d, verified }
 * @param {Array} params.leaveRecords Rows: { personnel_id, status, start_on, end_on, qualifying, decided_on }
 * @param {Array} params.dutyRecords Rows: { personnel_id, duty_date, shift_type, hours }
 * @param {Array} params.deployments Rows: { personnel_id, start_on, end_on, verified }
 * @returns {Object} Weekly source metrics, coverage breakdown, and status
 */
export function computeWeeklySourceMetrics({
  unitId,
  weekStart,
  personnel = [],
  leaveEligibility = [],
  leaveRecords = [],
  dutyRecords = [],
  deployments = [],
}) {
  const weekStartDate = parseISODate(weekStart);
  if (!unitId || !weekStartDate) {
    throw new Error('computeWeeklySourceMetrics requires unitId and a valid weekStart date');
  }
  const weekEndDate = addDays(weekStartDate, WEEK_LENGTH_DAYS - 1);
  const leaveWindowStart = addDays(weekEndDate, -(LEAVE_WINDOW_DAYS - 1));
  const nightWindowStart = addDays(weekEndDate, -(NIGHT_DUTY_WINDOW_DAYS - 1));
  const workloadWindowStart = addDays(weekEndDate, -(WORKLOAD_WINDOW_DAYS - 1));

  const activePersonnel = personnel.filter((p) => p.unit_id === unitId && p.active);
  const eligibleN = activePersonnel.length;
  const personnelIds = new Set(activePersonnel.map((p) => p.id));

  const eligibilityByPerson = new Map();
  for (const row of leaveEligibility) {
    if (!personnelIds.has(row.personnel_id)) continue;
    if (row.snapshot_week !== weekStart) continue;
    if (!row.verified) continue;
    eligibilityByPerson.set(row.personnel_id, row);
  }

  const leaveByPerson = new Map();
  for (const row of leaveRecords) {
    if (!personnelIds.has(row.personnel_id)) continue;
    if (!leaveByPerson.has(row.personnel_id)) leaveByPerson.set(row.personnel_id, []);
    leaveByPerson.get(row.personnel_id).push(row);
  }

  const dutyByPerson = new Map();
  for (const row of dutyRecords) {
    if (!personnelIds.has(row.personnel_id)) continue;
    if (!dutyByPerson.has(row.personnel_id)) dutyByPerson.set(row.personnel_id, []);
    dutyByPerson.get(row.personnel_id).push(row);
  }

  const deploymentByPerson = new Map();
  for (const row of deployments) {
    if (!personnelIds.has(row.personnel_id)) continue;
    if (!row.verified) continue;
    if (!deploymentByPerson.has(row.personnel_id)) deploymentByPerson.set(row.personnel_id, []);
    deploymentByPerson.get(row.personnel_id).push(row);
  }

  // --- Leave utilization (90d) + recovery gap ---
  let totalEligibleDays = 0;
  let totalTakenDays = 0;
  const daysSinceLeaveValues = [];
  let recoveryGapCoveredCount = 0;
  let recoveryGapOverThresholdCount = 0;

  for (const p of activePersonnel) {
    const eligibility = eligibilityByPerson.get(p.id);
    if (!eligibility) continue; // unverified: excluded, never assumed zero

    totalEligibleDays += eligibility.eligible_days_90d ?? 0;

    const records = leaveByPerson.get(p.id) ?? [];
    let takenDaysInWindow = 0;
    let lastQualifyingLeaveEnd = null;

    for (const lr of records) {
      if (lr.status !== 'taken' || !lr.qualifying) continue;
      const start = parseISODate(lr.start_on);
      const end = parseISODate(lr.end_on);
      if (!start || !end) continue;

      const clippedStart = start < leaveWindowStart ? leaveWindowStart : start;
      const clippedEnd = end > weekEndDate ? weekEndDate : end;
      if (clippedEnd >= clippedStart) {
        takenDaysInWindow += diffDays(clippedEnd, clippedStart) + 1;
      }

      if (end <= weekEndDate && (lastQualifyingLeaveEnd === null || end > lastQualifyingLeaveEnd)) {
        lastQualifyingLeaveEnd = end;
      }
    }

    totalTakenDays += takenDaysInWindow;

    const historyStart = parseISODate(p.history_start_on);
    let daysSinceLeave = null;
    if (lastQualifyingLeaveEnd) {
      daysSinceLeave = diffDays(weekEndDate, lastQualifyingLeaveEnd);
    } else if (historyStart) {
      // Never took qualifying leave across known verified history.
      daysSinceLeave = diffDays(weekEndDate, historyStart);
    }

    if (daysSinceLeave !== null) {
      daysSinceLeaveValues.push(daysSinceLeave);
      recoveryGapCoveredCount += 1;
      if (daysSinceLeave > RECOVERY_GAP_THRESHOLD_DAYS) {
        recoveryGapOverThresholdCount += 1;
      }
    }
  }

  const leaveCoverageRatio = eligibleN > 0 ? eligibilityByPerson.size / eligibleN : 0;
  const leaveUtilizationPercent = totalEligibleDays > 0 ? (100 * totalTakenDays) / totalEligibleDays : null;
  const meanDaysSinceLeave = mean(daysSinceLeaveValues);
  const recoveryGapPercent = recoveryGapCoveredCount > 0
    ? (100 * recoveryGapOverThresholdCount) / recoveryGapCoveredCount
    : null;

  // --- Leave denial rate (90d, decided_on within window) ---
  let decidedLeaveRequestsCount = 0;
  let deniedLeaveRequestsCount = 0;
  for (const records of leaveByPerson.values()) {
    for (const lr of records) {
      if (!['approved', 'taken', 'denied'].includes(lr.status)) continue;
      const decidedOn = parseISODate(lr.decided_on);
      if (!decidedOn || decidedOn < leaveWindowStart || decidedOn > weekEndDate) continue;
      decidedLeaveRequestsCount += 1;
      if (lr.status === 'denied') deniedLeaveRequestsCount += 1;
    }
  }
  const leaveDenialRatePercent = decidedLeaveRequestsCount > 0
    ? (100 * deniedLeaveRequestsCount) / decidedLeaveRequestsCount
    : null;

  // --- Night duty load (28d) + weekly workload (7d) ---
  let dutyCoveredCount = 0;
  const nightShiftCounts = [];
  const weeklyHoursValues = [];

  for (const p of activePersonnel) {
    const records = dutyByPerson.get(p.id) ?? [];
    const workloadRecords = records.filter((r) => {
      const d = parseISODate(r.duty_date);
      return d && d >= workloadWindowStart && d <= weekEndDate;
    });
    if (workloadRecords.length === 0) continue; // no verified duty activity this week: excluded

    dutyCoveredCount += 1;
    weeklyHoursValues.push(workloadRecords.reduce((sum, r) => sum + (r.hours ?? 0), 0));

    const nightRecords = records.filter((r) => {
      const d = parseISODate(r.duty_date);
      return d && d >= nightWindowStart && d <= weekEndDate && r.shift_type === 'night';
    });
    nightShiftCounts.push(nightRecords.length);
  }

  const dutyCoverageRatio = eligibleN > 0 ? dutyCoveredCount / eligibleN : 0;
  const meanNightShifts28d = mean(nightShiftCounts);
  const meanWeeklyDutyHours = mean(weeklyHoursValues);

  // --- Deployment continuity ---
  let deploymentCoveredCount = 0;
  let deployedPersonnelCount = 0;
  const deploymentDaysValues = [];
  for (const p of activePersonnel) {
    const historyStart = parseISODate(p.history_start_on);
    if (!historyStart) continue; // enrollment unverified: cannot confirm "no deployment"

    deploymentCoveredCount += 1;
    const records = deploymentByPerson.get(p.id) ?? [];
    const active = records.find((d) => {
      const start = parseISODate(d.start_on);
      const end = d.end_on ? parseISODate(d.end_on) : null;
      return start && start <= weekEndDate && (!end || end >= weekStartDate);
    });

    if (active) {
      const start = parseISODate(active.start_on);
      const effectiveStart = start < historyStart ? historyStart : start;
      deploymentDaysValues.push(diffDays(weekEndDate, effectiveStart) + 1);
      deployedPersonnelCount += 1;
    } else {
      // Verified enrolled with no matching deployment record: confirmed zero.
      deploymentDaysValues.push(0);
    }
  }

  const deploymentCoverageRatio = eligibleN > 0 ? deploymentCoveredCount / eligibleN : 0;
  const meanDeploymentDays = mean(deploymentDaysValues);

  const coverage = {
    hr: eligibleN > 0 ? 1.0 : 0,
    leave: leaveCoverageRatio,
    duty: dutyCoverageRatio,
    deployment: deploymentCoverageRatio,
  };
  const overallCoverage = eligibleN > 0
    ? Math.min(coverage.hr, coverage.leave, coverage.duty, coverage.deployment)
    : 0;

  return {
    unitId,
    weekStart,
    weekEnd: weekEndDate.toISOString().split('T')[0],
    eligibleN,
    coverage: { ...coverage, overall: overallCoverage },
    status: overallCoverage >= MIN_COVERAGE_RATIO ? 'sufficient' : 'insufficient_data',
    metrics: {
      coverageRatio: overallCoverage,
      leaveUtilizationPercent,
      meanDaysSinceLeave,
      recoveryGapPercent,
      leaveDenialRatePercent,
      decidedLeaveRequestsCount,
      meanNightShifts28d,
      meanDeploymentDays,
      meanWeeklyDutyHours,
    },
    // Bounded 0/1-per-person counts: candidates for cell suppression + noise
    // in the public release. Each person contributes at most 1.
    counts: {
      deployedPersonnelCount,
      recoveryGapExceededCount: recoveryGapOverThresholdCount,
    },
  };
}
