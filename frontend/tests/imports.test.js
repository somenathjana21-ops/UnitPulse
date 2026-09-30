import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_GROUP_SIZE,
  SMALL_CELL_THRESHOLD,
  BREAK_GLASS_EXPIRY_MINUTES,
  checkGroupSuppression,
} from '@unitpulse/backend';

import {
  INDEX_MAX_SCORE,
  calculateUnitStrainIndex,
  calculateBaseline,
  evaluateTriggers,
} from '@unitpulse/ml';

test('frontend successfully resolves and invokes @unitpulse/backend exports', () => {
  assert.equal(MIN_GROUP_SIZE, 5);
  assert.equal(SMALL_CELL_THRESHOLD, 5);
  assert.equal(BREAK_GLASS_EXPIRY_MINUTES, 30);

  const suppressionCheck = checkGroupSuppression(4);
  assert.equal(suppressionCheck.suppressed, true);
});

test('frontend successfully resolves and invokes @unitpulse/ml exports', () => {
  assert.equal(INDEX_MAX_SCORE, 100);

  const indexResult = calculateUnitStrainIndex({ coverageRatio: 1.0 });
  assert.equal(typeof indexResult.index, 'number');

  const baselineResult = calculateBaseline([
    { index: 30 },
    { index: 32 },
    { index: 34 },
    { index: 36 },
  ]);
  assert.equal(baselineResult.isComparableForSpike, true);

  const triggerResult = evaluateTriggers({
    currentIndex: 60,
    baselineIndex: 35,
    comparableWeeksCount: 4,
  });
  assert.equal(triggerResult.triggered, true);
});
