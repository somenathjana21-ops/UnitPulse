import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBaseline, calculateMedian } from '../src/baseline.js';
import { evaluateTriggers } from '../src/triggers.js';

test('calculateMedian correctly computes median for odd and even length arrays', () => {
  assert.equal(calculateMedian([10, 20, 30]), 20);
  assert.equal(calculateMedian([10, 20, 30, 40]), 25);
  assert.equal(calculateMedian([]), null);
});

test('calculateBaseline requires at least 4 comparable weeks for spike analysis', () => {
  const threeWeeks = [
    { index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    { index: 32, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    { index: 34, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
  ];
  const result = calculateBaseline(threeWeeks, { scoreVersion: '1.0.0', featureMask: 'standard_v1' });
  assert.equal(result.isComparableForSpike, false);
  assert.equal(result.comparableWeeksCount, 3);
  assert.equal(result.status, 'insufficient_history');

  const fourWeeks = [
    ...threeWeeks,
    { index: 36, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
  ];
  const fourResult = calculateBaseline(fourWeeks, { scoreVersion: '1.0.0', featureMask: 'standard_v1' });
  assert.equal(fourResult.isComparableForSpike, true);
  assert.equal(fourResult.comparableWeeksCount, 4);
  assert.equal(fourResult.baselineIndex, 33);
});

test('evaluateTriggers fires spike trigger when index >= 40 and index >= baseline + 15', () => {
  const triggerResult = evaluateTriggers({
    currentIndex: 55,
    baselineIndex: 35,
    comparableWeeksCount: 4,
    hasActiveReport: false,
  });

  assert.equal(triggerResult.triggered, true);
  assert.equal(triggerResult.shouldCreateReport, true);
  assert.equal(triggerResult.activeRules[0].rule, 'spike');
});

test('evaluateTriggers fires sustained-high trigger when index >= 75 for two consecutive weeks', () => {
  const triggerResult = evaluateTriggers({
    currentIndex: 78,
    baselineIndex: null, // Even without a spike baseline
    comparableWeeksCount: 0,
    previousWeekIndex: 76,
    hasActiveReport: false,
  });

  assert.equal(triggerResult.triggered, true);
  assert.equal(triggerResult.shouldCreateReport, true);
  assert.equal(triggerResult.activeRules[0].rule, 'sustained_high');
});

test('evaluateTriggers deduplicates when an active report already exists', () => {
  const triggerResult = evaluateTriggers({
    currentIndex: 80,
    baselineIndex: 40,
    comparableWeeksCount: 5,
    hasActiveReport: true, // Already active!
  });

  assert.equal(triggerResult.triggered, true);
  assert.equal(triggerResult.shouldCreateReport, false);
  assert.equal(triggerResult.isDeduplicated, true);
});
