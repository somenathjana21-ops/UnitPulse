/**
 * backend/src/release.js
 *
 * Private-to-public weekly release job.
 * Specifications: docs/05-system-architecture.md (weekly processing sequence),
 * docs/06-data-specification.md, docs/07-ml-specification.md,
 * docs/10-security-privacy.md, docs/15-decision-log.md (D-07, D-08, D-18).
 *
 * Pipeline: verified source metrics -> index -> comparable baseline ->
 * deterministic trigger -> group/small-cell privacy checks -> stable
 * noisy public release. The AI never runs in this module and never sees
 * anything not already approved for release.
 *
 * Idempotency: pass `existingRelease` for a unit/week that has already been
 * published and this function returns it unchanged. Noise is sampled at
 * most once per unit/week; callers MUST persist the returned release and
 * pass it back in on the next run instead of recomputing.
 */

import {
  calculateUnitStrainIndex,
  calculateBaseline,
  evaluateTriggers,
  applyPersistentBoundedNoise,
} from '@unitpulse/ml';
import { computeWeeklySourceMetrics, MIN_COVERAGE_RATIO } from './metrics.js';
import { checkGroupSuppression, checkCellSuppression, validatePublicReleasePayload } from './privacy.js';

export const RELEASE_NOISE_VERSION = 'laplace_eps_0_2_v1';
export const DEFAULT_RELEASE_EPSILON = 0.2;

/**
 * Maps the internal 0-100 index to the public release band vocabulary.
 * Deliberately independent of ml/scoring.js's internal `band` field, which
 * uses a different vocabulary ('Normal'/'Review'/'Elevated') for internal
 * debugging and is not a public contract. See decision log D-18.
 *
 * @param {number|null} index
 * @returns {'normal'|'elevated'|'high'|null}
 */
export function deriveReleaseBand(index) {
  if (index === null || index === undefined || Number.isNaN(index)) return null;
  if (index >= 70) return 'high';
  if (index >= 40) return 'elevated';
  return 'normal';
}

function roundOrNull(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Builds the approved public metrics payload, applying small-cell
 * suppression and one-time persistent noise to bounded person counts.
 *
 * @param {Object} sourceMetrics Result of computeWeeklySourceMetrics()
 * @param {number} epsilon
 * @returns {Object} approved_metrics_json payload (never contains personnel IDs)
 */
function buildApprovedMetrics(sourceMetrics, epsilon) {
  const { metrics, counts, eligibleN } = sourceMetrics;
  const payload = {
    recoveryGapPercent: roundOrNull(metrics.recoveryGapPercent, 0),
    meanNightShifts28d: roundOrNull(metrics.meanNightShifts28d, 1),
    meanWeeklyDutyHours: roundOrNull(metrics.meanWeeklyDutyHours, 1),
    leaveUtilizationPercent: roundOrNull(metrics.leaveUtilizationPercent, 0),
    isApproximate: true,
  };

  // Eligible personnel count: always a bounded 0/1-per-person count, noised once.
  const noisyEligible = applyPersistentBoundedNoise(eligibleN, eligibleN, epsilon);
  payload.approxPersonnelCount = noisyEligible.approximateCount;

  // Deployed personnel count: suppress if it (or its complement) would reveal
  // an individual; otherwise noise it once, same as the eligible count.
  const deployedCellCheck = checkCellSuppression(counts.deployedPersonnelCount, eligibleN);
  if (!deployedCellCheck.suppressed) {
    const noisyDeployed = applyPersistentBoundedNoise(counts.deployedPersonnelCount, eligibleN, epsilon);
    payload.approxDeployedPersonnelCount = noisyDeployed.approximateCount;
  }

  // Recovery-gap-exceeded count: same small-cell treatment.
  const recoveryCellCheck = checkCellSuppression(counts.recoveryGapExceededCount, eligibleN);
  if (!recoveryCellCheck.suppressed) {
    const noisyRecovery = applyPersistentBoundedNoise(counts.recoveryGapExceededCount, eligibleN, epsilon);
    payload.approxRecoveryGapExceededCount = noisyRecovery.approximateCount;
  }

  return validatePublicReleasePayload(payload);
}

/**
 * Runs the private-to-public weekly release pipeline for one unit/week.
 *
 * @param {Object} params
 * @param {string} params.unitId
 * @param {string} params.weekStart ISO date (Monday) of the completed week
 * @param {Object} params.sourceData { personnel, leaveEligibility, leaveRecords, dutyRecords, deployments }
 * @param {Array} [params.priorWeeksHistory=[]] Prior completed weeks: [{ index, scoreVersion, featureMask }]
 * @param {number|null} [params.previousWeekIndex=null] Immediately preceding week's index (for sustained-high)
 * @param {boolean} [params.hasActiveReport=false] Whether an active welfare report already exists for this unit
 * @param {Object|null} [params.existingRelease=null] A previously persisted release for this exact unit/week
 * @param {number} [params.epsilon=0.2] Laplace privacy budget per released bounded count
 * @returns {{ privateMetrics: Object, publicRelease: Object, triggerResult: Object|null, reused: boolean }}
 */
export function runWeeklyRelease({
  unitId,
  weekStart,
  sourceData,
  priorWeeksHistory = [],
  previousWeekIndex = null,
  hasActiveReport = false,
  existingRelease = null,
  epsilon = DEFAULT_RELEASE_EPSILON,
}) {
  // Idempotency: never resample noise or recompute a release that already exists.
  if (existingRelease) {
    return {
      privateMetrics: existingRelease.privateMetrics ?? null,
      publicRelease: existingRelease.publicRelease ?? existingRelease,
      triggerResult: existingRelease.triggerResult ?? null,
      reused: true,
    };
  }

  const sourceMetrics = computeWeeklySourceMetrics({ unitId, weekStart, ...sourceData });
  const computedAt = new Date().toISOString();

  const basePrivateMetrics = {
    unit_id: unitId,
    week_start: weekStart,
    eligible_n: sourceMetrics.eligibleN,
    source_coverage_json: sourceMetrics.coverage,
    leave_utilization: roundOrNull(sourceMetrics.metrics.leaveUtilizationPercent, 2),
    recovery_gap: roundOrNull(sourceMetrics.metrics.recoveryGapPercent, 2),
    denial_rate: roundOrNull(sourceMetrics.metrics.leaveDenialRatePercent, 2),
    night_shifts_average: roundOrNull(sourceMetrics.metrics.meanNightShifts28d, 2),
    deployment_days_average: roundOrNull(sourceMetrics.metrics.meanDeploymentDays, 2),
    weekly_hours_average: roundOrNull(sourceMetrics.metrics.meanWeeklyDutyHours, 2),
    computed_at: computedAt,
  };

  const groupCheck = checkGroupSuppression(sourceMetrics.eligibleN);
  if (groupCheck.suppressed) {
    return {
      privateMetrics: { ...basePrivateMetrics, index_exact: null, baseline_exact: null, score_version: null, feature_mask: null },
      publicRelease: {
        unit_id: unitId,
        week_start: weekStart,
        suppression_status: 'suppressed_small_group',
        index_approx: null,
        baseline_approx: null,
        band: null,
        approved_metrics_json: {},
        noise_version: RELEASE_NOISE_VERSION,
        released_at: computedAt,
      },
      triggerResult: null,
      reused: false,
    };
  }

  if (sourceMetrics.status === 'insufficient_data') {
    return {
      privateMetrics: { ...basePrivateMetrics, index_exact: null, baseline_exact: null, score_version: null, feature_mask: null },
      publicRelease: {
        unit_id: unitId,
        week_start: weekStart,
        suppression_status: 'insufficient_coverage',
        index_approx: null,
        baseline_approx: null,
        band: 'insufficient_data',
        approved_metrics_json: {},
        noise_version: RELEASE_NOISE_VERSION,
        released_at: computedAt,
      },
      triggerResult: null,
      reused: false,
    };
  }

  const scoreResult = calculateUnitStrainIndex(sourceMetrics.metrics);
  const baselineResult = calculateBaseline(priorWeeksHistory, {
    scoreVersion: scoreResult.scoreVersion,
    featureMask: scoreResult.featureMask,
  });
  const triggerResult = evaluateTriggers({
    currentIndex: scoreResult.index,
    baselineIndex: baselineResult.baselineIndex,
    comparableWeeksCount: baselineResult.comparableWeeksCount,
    previousWeekIndex,
    hasActiveReport,
  });

  const privateMetrics = {
    ...basePrivateMetrics,
    index_exact: scoreResult.index,
    baseline_exact: baselineResult.baselineIndex,
    score_version: scoreResult.scoreVersion,
    feature_mask: scoreResult.featureMask,
  };

  const publicRelease = {
    unit_id: unitId,
    week_start: weekStart,
    suppression_status: baselineResult.status === 'ready' ? 'published' : 'building_baseline',
    index_approx: scoreResult.index,
    baseline_approx: baselineResult.baselineIndex,
    band: deriveReleaseBand(scoreResult.index),
    approved_metrics_json: buildApprovedMetrics(sourceMetrics, epsilon),
    noise_version: RELEASE_NOISE_VERSION,
    released_at: computedAt,
  };

  return { privateMetrics, publicRelease, triggerResult, reused: false };
}
