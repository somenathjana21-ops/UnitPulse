import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnitStrainIndex, MIN_COVERAGE_RATIO } from '../src/scoring.js';

// Independent boundary audit for docs/07-ml-specification.md's Unit Load &
// Recovery Index table. Every rule in that table is a strict ">" threshold:
// the value AT the threshold must score 0 (or the next tier down), never
// the tier above it.

function baseHealthyMetrics() {
  return {
    coverageRatio: 1.0,
    meanDaysSinceLeave: 0,
    recoveryGapPercent: 0,
    leaveDenialRatePercent: 0,
    decidedLeaveRequestsCount: 10,
    meanNightShifts28d: 0,
    meanDeploymentDays: 0,
    meanWeeklyDutyHours: 0,
  };
}

test('boundary: days-since-leave >60 is strict (60 = 0 pts, 61 = 15 pts)', () => {
  const at = calculateUnitStrainIndex({ ...baseHealthyMetrics(), meanDaysSinceLeave: 60 });
  const above = calculateUnitStrainIndex({ ...baseHealthyMetrics(), meanDaysSinceLeave: 61 });
  assert.equal(at.components.leave.points, 0);
  assert.equal(above.components.leave.points, 15);
});

test('boundary: recovery gap >35% is strict (35 = 0 pts, 36 = 10 pts)', () => {
  const at = calculateUnitStrainIndex({ ...baseHealthyMetrics(), recoveryGapPercent: 35 });
  const above = calculateUnitStrainIndex({ ...baseHealthyMetrics(), recoveryGapPercent: 36 });
  assert.equal(at.components.leave.points, 0);
  assert.equal(above.components.leave.points, 10);
});

test('boundary: denial rate >25% is strict, and requires >=5 decided requests', () => {
  const at = calculateUnitStrainIndex({ ...baseHealthyMetrics(), leaveDenialRatePercent: 25, decidedLeaveRequestsCount: 5 });
  const above = calculateUnitStrainIndex({ ...baseHealthyMetrics(), leaveDenialRatePercent: 26, decidedLeaveRequestsCount: 5 });
  const exactlyFive = calculateUnitStrainIndex({ ...baseHealthyMetrics(), leaveDenialRatePercent: 90, decidedLeaveRequestsCount: 5 });
  const belowFive = calculateUnitStrainIndex({ ...baseHealthyMetrics(), leaveDenialRatePercent: 90, decidedLeaveRequestsCount: 4 });

  assert.equal(at.components.leave.points, 0);
  assert.equal(above.components.leave.points, 5);
  assert.equal(exactlyFive.featureMask, 'standard_v1'); // 5 decided requests: denial rule available
  assert.equal(belowFive.featureMask, 'no_denial_v1'); // 4 decided requests: rule omitted
});

test('boundary: night-duty tiers (5/8/12) are strict', () => {
  const cases = [
    [5, 0], [6, 5],
    [8, 5], [9, 15],
    [12, 15], [13, 25],
  ];
  for (const [shifts, expectedPoints] of cases) {
    const result = calculateUnitStrainIndex({ ...baseHealthyMetrics(), meanNightShifts28d: shifts });
    assert.equal(result.components.nightDuty.points, expectedPoints, `night shifts=${shifts}`);
  }
});

test('boundary: deployment tiers (60/90) are strict', () => {
  const cases = [
    [60, 0], [61, 12],
    [90, 12], [91, 20],
  ];
  for (const [days, expectedPoints] of cases) {
    const result = calculateUnitStrainIndex({ ...baseHealthyMetrics(), meanDeploymentDays: days });
    assert.equal(result.components.deployment.points, expectedPoints, `deployment days=${days}`);
  }
});

test('boundary: workload tiers (52/60) are strict', () => {
  const cases = [
    [52, 0], [53, 8],
    [60, 8], [61, 25],
  ];
  for (const [hours, expectedPoints] of cases) {
    const result = calculateUnitStrainIndex({ ...baseHealthyMetrics(), meanWeeklyDutyHours: hours });
    assert.equal(result.components.workload.points, expectedPoints, `weekly hours=${hours}`);
  }
});

test('boundary: coverage ratio exactly at MIN_COVERAGE_RATIO is sufficient, just below is not', () => {
  assert.equal(MIN_COVERAGE_RATIO, 0.8);
  const at = calculateUnitStrainIndex({ ...baseHealthyMetrics(), coverageRatio: 0.8 });
  const below = calculateUnitStrainIndex({ ...baseHealthyMetrics(), coverageRatio: 0.7999 });
  assert.equal(at.status, 'calculated');
  assert.equal(below.status, 'insufficient_data');
  assert.equal(below.index, null);
});

test('absent/zero denominator: an empty metrics object never throws and never fabricates risk', () => {
  const result = calculateUnitStrainIndex({});
  // coverageRatio defaults to 1.0 when entirely absent (caller is expected to
  // pass a real coverage ratio; metrics.js always does). All components
  // default to their safest reading (0 pts) rather than throwing.
  assert.equal(result.status, 'calculated');
  assert.equal(result.index, 0);
  assert.equal(result.featureMask, 'no_denial_v1'); // decidedLeaveRequestsCount absent -> treated as 0, omitted
});
