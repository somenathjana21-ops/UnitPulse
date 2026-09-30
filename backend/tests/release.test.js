import test from 'node:test';
import assert from 'node:assert/strict';
import { runWeeklyRelease, deriveReleaseBand } from '../src/release.js';

const WEEK_START = '2026-09-07'; // Monday
const WEEK_END = '2026-09-13'; // Sunday

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Builds source data for a unit whose current week scores at (or near) the
 * maximum index -- every component threshold is comfortably exceeded.
 * `deployedCount` and `dutyCoveredCount` let individual tests dial down
 * coverage or create a small-cell breakout without duplicating the rest of
 * the fixture.
 */
function buildHighStrainFixture({
  unitId,
  personnelCount = 6,
  deployedCount = personnelCount,
  dutyCoveredCount = personnelCount,
  historyStart = '2026-01-01',
}) {
  const personnel = Array.from({ length: personnelCount }, (_, i) => ({
    id: `PER-${String(i + 1).padStart(3, '0')}`,
    unit_id: unitId,
    active: true,
    history_start_on: historyStart,
  }));

  const leaveEligibility = personnel.map((p) => ({
    personnel_id: p.id,
    snapshot_week: WEEK_START,
    eligible_days_90d: 30,
    verified: true,
  }));

  const leaveTakenEnd = addDays(WEEK_END, -70);
  const leaveTakenStart = addDays(leaveTakenEnd, -9);
  const leaveRecords = personnel.map((p) => ({
    personnel_id: p.id,
    status: 'taken',
    start_on: leaveTakenStart,
    end_on: leaveTakenEnd,
    qualifying: true,
    decided_on: addDays(WEEK_END, -95), // outside the 90-day decided window
  }));
  const denialSampleSize = Math.min(5, personnelCount);
  for (let i = 0; i < denialSampleSize; i++) {
    leaveRecords.push({
      personnel_id: personnel[i].id,
      status: i < 2 ? 'denied' : 'approved',
      start_on: addDays(WEEK_END, -20),
      end_on: addDays(WEEK_END, -18),
      qualifying: true,
      decided_on: addDays(WEEK_END, -15),
    });
  }

  const dutyRecords = personnel.slice(0, dutyCoveredCount).flatMap((p) =>
    Array.from({ length: 28 }, (_, i) => {
      const isRecentSeven = i < 7;
      const hoursPattern = [10, 10, 10, 10, 10, 10, 5];
      return {
        personnel_id: p.id,
        duty_date: addDays(WEEK_END, -i),
        shift_type: i >= 13 ? 'night' : 'day', // 15 of 28 days are night shifts
        hours: isRecentSeven ? hoursPattern[i] : 8,
      };
    })
  );

  const deployments = personnel.slice(0, deployedCount).map((p) => ({
    personnel_id: p.id,
    start_on: addDays(WEEK_END, -99),
    end_on: null,
    verified: true,
  }));

  return { personnel, leaveEligibility, leaveRecords, dutyRecords, deployments };
}

test('deriveReleaseBand maps the index to the public DB band vocabulary', () => {
  assert.equal(deriveReleaseBand(0), 'normal');
  assert.equal(deriveReleaseBand(39), 'normal');
  assert.equal(deriveReleaseBand(40), 'elevated');
  assert.equal(deriveReleaseBand(69), 'elevated');
  assert.equal(deriveReleaseBand(70), 'high');
  assert.equal(deriveReleaseBand(100), 'high');
  assert.equal(deriveReleaseBand(null), null);
});

test('fixture: group size four is fully suppressed, no figures leak', () => {
  const sourceData = buildHighStrainFixture({ unitId: 'UNIT-SMALL', personnelCount: 4 });
  const { publicRelease, triggerResult } = runWeeklyRelease({
    unitId: 'UNIT-SMALL',
    weekStart: WEEK_START,
    sourceData,
  });

  assert.equal(publicRelease.suppression_status, 'suppressed_small_group');
  assert.equal(publicRelease.index_approx, null);
  assert.equal(publicRelease.baseline_approx, null);
  assert.equal(publicRelease.band, null);
  assert.deepEqual(publicRelease.approved_metrics_json, {});
  assert.equal(triggerResult, null);
});

test('fixture: group size five with a one-person breakout suppresses only the revealing cell', () => {
  const sourceData = buildHighStrainFixture({ unitId: 'UNIT-BREAKOUT', personnelCount: 5, deployedCount: 1 });
  const { publicRelease } = runWeeklyRelease({
    unitId: 'UNIT-BREAKOUT',
    weekStart: WEEK_START,
    sourceData,
  });

  // Not suppressed for privacy reasons -- still has an index, just no baseline yet.
  assert.equal(publicRelease.suppression_status, 'building_baseline');
  assert.ok(typeof publicRelease.index_approx === 'number');
  // The 1-of-5 deployed breakout must be withheld even though the unit-level release still publishes.
  assert.equal('approxDeployedPersonnelCount' in publicRelease.approved_metrics_json, false);
});

test('fixture: incomplete duty coverage yields "insufficient data", never a zero index', () => {
  const sourceData = buildHighStrainFixture({ unitId: 'UNIT-INCOMPLETE', personnelCount: 6, dutyCoveredCount: 2 });
  const { publicRelease, privateMetrics } = runWeeklyRelease({
    unitId: 'UNIT-INCOMPLETE',
    weekStart: WEEK_START,
    sourceData,
  });

  assert.equal(publicRelease.suppression_status, 'insufficient_coverage');
  assert.equal(publicRelease.band, 'insufficient_data');
  assert.equal(publicRelease.index_approx, null);
  assert.equal(privateMetrics.index_exact, null);
});

test('fixture: repeated release calls return identical stored values, never resampled', () => {
  const sourceData = buildHighStrainFixture({ unitId: 'UNIT-STABLE', personnelCount: 6 });
  const first = runWeeklyRelease({ unitId: 'UNIT-STABLE', weekStart: WEEK_START, sourceData });

  const second = runWeeklyRelease({
    unitId: 'UNIT-STABLE',
    weekStart: WEEK_START,
    sourceData,
    existingRelease: first,
  });

  assert.equal(second.reused, true);
  assert.deepEqual(second.publicRelease, first.publicRelease);
});

test('fixture: baseline boundary -- spike rule requires at least four comparable prior weeks', () => {
  const sourceData = buildHighStrainFixture({ unitId: 'UNIT-BOUNDARY', personnelCount: 6 });
  const threeWeeks = [
    { index: 20, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    { index: 22, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    { index: 18, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
  ];
  const fourWeeks = [
    ...threeWeeks,
    { index: 21, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
  ];

  const withThree = runWeeklyRelease({
    unitId: 'UNIT-BOUNDARY',
    weekStart: WEEK_START,
    sourceData,
    priorWeeksHistory: threeWeeks,
  });
  const withFour = runWeeklyRelease({
    unitId: 'UNIT-BOUNDARY',
    weekStart: WEEK_START,
    sourceData,
    priorWeeksHistory: fourWeeks,
  });

  assert.equal(withThree.triggerResult.spikeEligible, false);
  assert.equal(withThree.publicRelease.suppression_status, 'building_baseline');
  assert.equal(withFour.triggerResult.spikeEligible, true);
  assert.equal(withFour.triggerResult.triggered, true); // index >=40 and >=baseline+15
  assert.equal(withFour.publicRelease.suppression_status, 'published');
});

test('fixture: a triggered unit produces a deduplicated sustained-high result', () => {
  const sourceData = buildHighStrainFixture({ unitId: 'UNIT-TRIGGERED', personnelCount: 6 });

  const firstRun = runWeeklyRelease({
    unitId: 'UNIT-TRIGGERED',
    weekStart: WEEK_START,
    sourceData,
    previousWeekIndex: 80, // last week was also >=75
    hasActiveReport: false,
  });

  assert.equal(firstRun.triggerResult.triggered, true);
  assert.ok(firstRun.triggerResult.activeRules.some((r) => r.rule === 'sustained_high'));
  assert.equal(firstRun.triggerResult.shouldCreateReport, true);

  const retriedRun = runWeeklyRelease({
    unitId: 'UNIT-TRIGGERED',
    weekStart: WEEK_START,
    sourceData,
    previousWeekIndex: 80,
    hasActiveReport: true, // a report already exists; cron retried the same week
  });

  assert.equal(retriedRun.triggerResult.triggered, true);
  assert.equal(retriedRun.triggerResult.shouldCreateReport, false);
  assert.equal(retriedRun.triggerResult.isDeduplicated, true);
});
