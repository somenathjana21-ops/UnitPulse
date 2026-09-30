import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnitStrainIndex, COMPONENT_WEIGHTS } from '../src/scoring.js';

test('calculateUnitStrainIndex returns insufficient_data when coverage is below 80%', () => {
  const result = calculateUnitStrainIndex({ coverageRatio: 0.75 });
  assert.equal(result.index, null);
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.featureMask, 'incomplete');
});

test('calculateUnitStrainIndex produces 0 for clean healthy metrics', () => {
  const result = calculateUnitStrainIndex({
    coverageRatio: 1.0,
    meanDaysSinceLeave: 30,
    recoveryGapPercent: 10,
    leaveDenialRatePercent: 5,
    decidedLeaveRequestsCount: 10,
    meanNightShifts28d: 2,
    meanDeploymentDays: 20,
    meanWeeklyDutyHours: 40,
  });

  assert.equal(result.index, 0);
  assert.equal(result.band, 'Normal');
  assert.equal(result.status, 'calculated');
});

test('calculateUnitStrainIndex awards correct points for elevated metrics with standard mask', () => {
  const result = calculateUnitStrainIndex({
    coverageRatio: 1.0,
    meanDaysSinceLeave: 65, // >60 => +15
    recoveryGapPercent: 40, // >35% => +10
    leaveDenialRatePercent: 30, // >25% => +5
    decidedLeaveRequestsCount: 10, // >=5 => denial available
    meanNightShifts28d: 14, // >12 => +25
    meanDeploymentDays: 95, // >90 => +20
    meanWeeklyDutyHours: 65, // >60 => +25
  });

  // Total: 15 + 10 + 5 + 25 + 20 + 25 = 100
  assert.equal(result.index, 100);
  assert.equal(result.band, 'Elevated');
  assert.equal(result.featureMask, 'standard_v1');
});

test('calculateUnitStrainIndex normalizes score when leave denial rule is omitted', () => {
  const result = calculateUnitStrainIndex({
    coverageRatio: 1.0,
    meanDaysSinceLeave: 65, // +15
    recoveryGapPercent: 40, // +10
    decidedLeaveRequestsCount: 2, // <5 => denial feature omitted! max 95 pts
    meanNightShifts28d: 14, // +25
    meanDeploymentDays: 95, // +20
    meanWeeklyDutyHours: 65, // +25
  });

  // Awarded points = 15 + 10 + 25 + 20 + 25 = 95
  // Normalized: round(100 * 95 / 95) = 100
  assert.equal(result.awardedPoints, 95);
  assert.equal(result.maxPossiblePoints, 95);
  assert.equal(result.index, 100);
  assert.equal(result.featureMask, 'no_denial_v1');
});
