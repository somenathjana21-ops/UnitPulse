/**
 * ml/src/scoring.js
 *
 * Deterministic calculation of the Unit Load & Recovery Index.
 * Based on specifications in docs/07-ml-specification.md and docs/06-data-specification.md.
 *
 * NOTE: The Unit Load & Recovery Index is an operational welfare planning indicator.
 * It is NOT a medical or psychological diagnosis.
 */

export const INDEX_MAX_SCORE = 100;
export const MIN_COVERAGE_RATIO = 0.80; // 80% verified coverage required

export const COMPONENT_WEIGHTS = {
  leave: {
    maxPoints: 30,
    daysSinceLeaveThreshold: 60, // >60 days: 15 pts
    daysSinceLeavePoints: 15,
    recoveryGapThreshold: 0.35, // >35%: 10 pts
    recoveryGapPoints: 10,
    denialRateThreshold: 0.25, // >25%: 5 pts
    denialRatePoints: 5,
    minDecidedRequests: 5, // minimum decided requests required to include denial rule
  },
  nightDuty: {
    maxPoints: 25,
    highThreshold: 12, // >12 shifts: 25 pts
    highPoints: 25,
    mediumThreshold: 8, // >8 shifts: 15 pts
    mediumPoints: 15,
    lowThreshold: 5, // >5 shifts: 5 pts
    lowPoints: 5,
  },
  deployment: {
    maxPoints: 20,
    highThreshold: 90, // >90 continuous days: 20 pts
    highPoints: 20,
    mediumThreshold: 60, // >60 continuous days: 12 pts
    mediumPoints: 12,
  },
  workload: {
    maxPoints: 25,
    highThreshold: 60, // >60 mean weekly hours: 25 pts
    highPoints: 25,
    mediumThreshold: 52, // >52 mean weekly hours: 8 pts
    mediumPoints: 8,
  },
};

/**
 * Calculates the Unit Load & Recovery Index from verified aggregate metrics.
 *
 * @param {Object} metrics
 * @param {number} [metrics.coverageRatio=1.0] Verified source coverage (0.0 to 1.0)
 * @param {number} [metrics.meanDaysSinceLeave] Mean days since qualifying leave
 * @param {number} [metrics.recoveryGapPercent] Percentage of unit with >60 days without qualifying leave (0 to 100)
 * @param {number} [metrics.leaveDenialRatePercent] Percentage of decided leave requests denied (0 to 100)
 * @param {number} [metrics.decidedLeaveRequestsCount] Number of decided leave requests
 * @param {number} [metrics.meanNightShifts28d] Mean 28-day night shifts per person
 * @param {number} [metrics.meanDeploymentDays] Mean continuous deployment days
 * @param {number} [metrics.meanWeeklyDutyHours] Mean weekly recorded duty hours
 * @returns {Object} Calculated index result with breakdown and feature mask
 */
export function calculateUnitStrainIndex(metrics = {}) {
  const coverage = metrics.coverageRatio ?? 1.0;
  if (coverage < MIN_COVERAGE_RATIO) {
    return {
      index: null,
      status: 'insufficient_data',
      message: 'Not enough verified data for an index (coverage < 80%)',
      featureMask: 'incomplete',
      awardedPoints: 0,
      maxPossiblePoints: INDEX_MAX_SCORE,
      components: {},
    };
  }

  let awardedPoints = 0;
  const components = {};

  // 1. Leave Component (Max 30)
  let leavePoints = 0;
  const leaveDetails = {};

  if (metrics.meanDaysSinceLeave !== undefined && metrics.meanDaysSinceLeave > COMPONENT_WEIGHTS.leave.daysSinceLeaveThreshold) {
    leavePoints += COMPONENT_WEIGHTS.leave.daysSinceLeavePoints;
    leaveDetails.daysSinceLeave = COMPONENT_WEIGHTS.leave.daysSinceLeavePoints;
  }

  const recoveryGapRatio = (metrics.recoveryGapPercent ?? 0) / 100;
  if (recoveryGapRatio > COMPONENT_WEIGHTS.leave.recoveryGapThreshold) {
    leavePoints += COMPONENT_WEIGHTS.leave.recoveryGapPoints;
    leaveDetails.recoveryGap = COMPONENT_WEIGHTS.leave.recoveryGapPoints;
  }

  const decidedCount = metrics.decidedLeaveRequestsCount ?? 0;
  const denialAvailable = decidedCount >= COMPONENT_WEIGHTS.leave.minDecidedRequests;
  let maxPossiblePoints = INDEX_MAX_SCORE;

  if (denialAvailable) {
    const denialRatio = (metrics.leaveDenialRatePercent ?? 0) / 100;
    if (denialRatio > COMPONENT_WEIGHTS.leave.denialRateThreshold) {
      leavePoints += COMPONENT_WEIGHTS.leave.denialRatePoints;
      leaveDetails.denialRate = COMPONENT_WEIGHTS.leave.denialRatePoints;
    }
  } else {
    // Denial feature is omitted due to insufficient volume
    maxPossiblePoints = 95;
    leaveDetails.denialRateOmitted = true;
  }
  components.leave = { points: leavePoints, max: denialAvailable ? 30 : 25, details: leaveDetails };
  awardedPoints += leavePoints;

  // 2. Night Duty Component (Max 25)
  let nightPoints = 0;
  const nightShifts = metrics.meanNightShifts28d ?? 0;
  if (nightShifts > COMPONENT_WEIGHTS.nightDuty.highThreshold) {
    nightPoints = COMPONENT_WEIGHTS.nightDuty.highPoints;
  } else if (nightShifts > COMPONENT_WEIGHTS.nightDuty.mediumThreshold) {
    nightPoints = COMPONENT_WEIGHTS.nightDuty.mediumPoints;
  } else if (nightShifts > COMPONENT_WEIGHTS.nightDuty.lowThreshold) {
    nightPoints = COMPONENT_WEIGHTS.nightDuty.lowPoints;
  }
  components.nightDuty = { points: nightPoints, max: 25 };
  awardedPoints += nightPoints;

  // 3. Deployment Component (Max 20)
  let deploymentPoints = 0;
  const deploymentDays = metrics.meanDeploymentDays ?? 0;
  if (deploymentDays > COMPONENT_WEIGHTS.deployment.highThreshold) {
    deploymentPoints = COMPONENT_WEIGHTS.deployment.highPoints;
  } else if (deploymentDays > COMPONENT_WEIGHTS.deployment.mediumThreshold) {
    deploymentPoints = COMPONENT_WEIGHTS.deployment.mediumPoints;
  }
  components.deployment = { points: deploymentPoints, max: 20 };
  awardedPoints += deploymentPoints;

  // 4. Workload Component (Max 25)
  let workloadPoints = 0;
  const weeklyHours = metrics.meanWeeklyDutyHours ?? 0;
  if (weeklyHours > COMPONENT_WEIGHTS.workload.highThreshold) {
    workloadPoints = COMPONENT_WEIGHTS.workload.highPoints;
  } else if (weeklyHours > COMPONENT_WEIGHTS.workload.mediumThreshold) {
    workloadPoints = COMPONENT_WEIGHTS.workload.mediumPoints;
  }
  components.workload = { points: workloadPoints, max: 25 };
  awardedPoints += workloadPoints;

  // Normalization if feature mask changed
  let finalIndex;
  if (maxPossiblePoints === 95) {
    finalIndex = Math.round((100 * awardedPoints) / 95);
  } else {
    finalIndex = awardedPoints;
  }

  // Determine band
  let band = 'Normal';
  if (finalIndex >= 70) {
    band = 'Elevated';
  } else if (finalIndex >= 40) {
    band = 'Review';
  }

  return {
    index: Math.min(100, Math.max(0, finalIndex)),
    band,
    awardedPoints,
    maxPossiblePoints,
    featureMask: denialAvailable ? 'standard_v1' : 'no_denial_v1',
    scoreVersion: '1.0.0',
    components,
    status: 'calculated',
  };
}
