/**
 * ml/src/triggers.js
 *
 * Deterministic report trigger evaluation.
 * Specification: docs/07-ml-specification.md, docs/02-prd.md
 *
 * Rules:
 * - Spike trigger: current index >= 40 AND current index >= baseline + 15 (requires >=4 comparable weeks)
 * - Sustained-high trigger: index >= 75 for two consecutive completed weeks
 *
 * NOTE: The AI NEVER calculates or overrides the numeric score or alert.
 * Reports are created strictly by deterministic rules.
 */

export const TRIGGER_RULES = {
  spike: {
    minCurrentIndex: 40,
    minDeltaAboveBaseline: 15,
    minComparableWeeks: 4,
    description: 'Unit index is elevated (>=40) and at least 15 points above rolling baseline',
  },
  sustainedHigh: {
    threshold: 75,
    consecutiveWeeks: 2,
    description: 'Unit index is >=75 for two consecutive completed weeks',
  },
};

/**
 * Evaluates whether a unit triggers a confidential welfare report.
 *
 * @param {Object} params
 * @param {number} params.currentIndex Current completed week index
 * @param {number|null} params.baselineIndex Calculated rolling baseline median
 * @param {number} params.comparableWeeksCount Number of historical weeks used in baseline
 * @param {number|null} [params.previousWeekIndex=null] Immediately preceding week's index
 * @param {boolean} [params.hasActiveReport=false] Whether an active report already exists
 * @returns {Object} Trigger evaluation result
 */
export function evaluateTriggers({
  currentIndex,
  baselineIndex,
  comparableWeeksCount,
  previousWeekIndex = null,
  hasActiveReport = false,
}) {
  if (currentIndex === null || currentIndex === undefined || isNaN(currentIndex)) {
    return {
      triggered: false,
      reason: 'no_index',
      message: 'Not enough verified data to evaluate triggers',
    };
  }

  // 1. Spike rule evaluation
  const spikeEligible =
    comparableWeeksCount >= TRIGGER_RULES.spike.minComparableWeeks &&
    baselineIndex !== null &&
    !isNaN(baselineIndex);

  const spikeFired =
    spikeEligible &&
    currentIndex >= TRIGGER_RULES.spike.minCurrentIndex &&
    currentIndex >= baselineIndex + TRIGGER_RULES.spike.minDeltaAboveBaseline;

  // 2. Sustained-high rule evaluation
  const sustainedHighFired =
    currentIndex >= TRIGGER_RULES.sustainedHigh.threshold &&
    previousWeekIndex !== null &&
    previousWeekIndex >= TRIGGER_RULES.sustainedHigh.threshold;

  const triggered = spikeFired || sustainedHighFired;

  const activeRules = [];
  if (spikeFired) {
    activeRules.push({
      rule: 'spike',
      description: TRIGGER_RULES.spike.description,
      details: {
        currentIndex,
        baselineIndex,
        delta: currentIndex - baselineIndex,
      },
    });
  }

  if (sustainedHighFired) {
    activeRules.push({
      rule: 'sustained_high',
      description: TRIGGER_RULES.sustainedHigh.description,
      details: {
        currentIndex,
        previousWeekIndex,
        threshold: TRIGGER_RULES.sustainedHigh.threshold,
      },
    });
  }

  return {
    triggered,
    activeRules,
    shouldCreateReport: triggered && !hasActiveReport,
    isDeduplicated: triggered && hasActiveReport,
    hasActiveReport,
    spikeEligible,
    evaluationSummary: triggered
      ? `Trigger condition met: ${activeRules.map((r) => r.rule).join(', ')}${hasActiveReport ? ' (active report already open, deduplicated)' : ''}`
      : 'No welfare alert trigger conditions met',
  };
}
