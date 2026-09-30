/**
 * ml/src/baseline.js
 *
 * Baseline calculation functions for Unit Pulse 2.0.
 * Specification: docs/07-ml-specification.md
 *
 * - Baseline: median of up to eight previous completed weekly indices from the same
 *   unit, score version, and feature mask.
 * - Minimum four comparable previous weeks required to apply the spike comparison.
 */

export const MAX_BASELINE_WEEKS = 8;
export const MIN_BASELINE_WEEKS_FOR_SPIKE = 4;

/**
 * Calculates the median of an array of numeric values.
 *
 * @param {number[]} numbers
 * @returns {number|null}
 */
export function calculateMedian(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return null;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/**
 * Computes the rolling baseline index from prior weeks.
 *
 * @param {Array<{ index: number, scoreVersion?: string, featureMask?: string }>} priorWeeks
 * @param {Object} [filterOptions]
 * @param {string} [filterOptions.scoreVersion='1.0.0']
 * @param {string} [filterOptions.featureMask='standard_v1']
 * @returns {Object} Baseline summary
 */
export function calculateBaseline(priorWeeks = [], filterOptions = {}) {
  const { scoreVersion, featureMask } = filterOptions;

  // Filter matching score version and feature mask
  const matchingWeeks = priorWeeks.filter((week) => {
    if (typeof week?.index !== 'number' || isNaN(week.index)) return false;
    if (scoreVersion && week.scoreVersion && week.scoreVersion !== scoreVersion) return false;
    if (featureMask && week.featureMask && week.featureMask !== featureMask) return false;
    return true;
  });

  // Take up to the 8 most recent completed weeks
  const windowWeeks = matchingWeeks.slice(-MAX_BASELINE_WEEKS);
  const indices = windowWeeks.map((w) => w.index);
  const median = calculateMedian(indices);
  const comparableWeeksCount = windowWeeks.length;
  const isComparableForSpike = comparableWeeksCount >= MIN_BASELINE_WEEKS_FOR_SPIKE;

  return {
    baselineIndex: median,
    comparableWeeksCount,
    isComparableForSpike,
    status: isComparableForSpike ? 'ready' : 'insufficient_history',
    message: isComparableForSpike
      ? 'Baseline established from comparable weeks'
      : 'Collecting comparable weeks (fewer than 4 historical weeks)',
  };
}
