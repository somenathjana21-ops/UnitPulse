import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWeeklySourceMetrics, MIN_COVERAGE_RATIO } from '../src/metrics.js';

const UNIT_ID = 'UNIT-TEST';
const WEEK_START = '2026-09-07'; // Monday
const WEEK_END = '2026-09-13'; // Sunday

function makePersonnel(count, { historyStart = '2026-01-01' } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `PER-${String(i + 1).padStart(3, '0')}`,
    unit_id: UNIT_ID,
    active: true,
    history_start_on: historyStart,
  }));
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

test('computeWeeklySourceMetrics computes leave utilization, recovery gap, and denial rate from raw records', () => {
  const personnel = makePersonnel(5);
  const leaveEligibility = personnel.map((p) => ({
    personnel_id: p.id,
    snapshot_week: WEEK_START,
    eligible_days_90d: 30,
    verified: true,
  }));
  // Each person took a 10-day qualifying leave ending 70 days before week end (recovery gap > 60).
  const leaveTakenEnd = addDays(WEEK_END, -70);
  const leaveTakenStart = addDays(leaveTakenEnd, -9);
  const leaveRecords = personnel.map((p, i) => ({
    personnel_id: p.id,
    status: 'taken',
    start_on: leaveTakenStart,
    end_on: leaveTakenEnd,
    qualifying: true,
    decided_on: addDays(WEEK_END, -95), // outside the 90-day decided window on purpose
  }));
  // 5 additional decided (non-taken) requests: 2 denied, 3 approved -> 40% denial rate.
  for (let i = 0; i < 5; i++) {
    leaveRecords.push({
      personnel_id: personnel[i].id,
      status: i < 2 ? 'denied' : 'approved',
      start_on: addDays(WEEK_END, -20),
      end_on: addDays(WEEK_END, -18),
      qualifying: true,
      decided_on: addDays(WEEK_END, -15),
    });
  }
  const dutyRecords = personnel.flatMap((p) =>
    Array.from({ length: 7 }, (_, i) => ({
      personnel_id: p.id,
      duty_date: addDays(WEEK_END, -i),
      shift_type: 'day',
      hours: 8,
    }))
  );
  const deployments = [];

  const result = computeWeeklySourceMetrics({
    unitId: UNIT_ID,
    weekStart: WEEK_START,
    personnel,
    leaveEligibility,
    leaveRecords,
    dutyRecords,
    deployments,
  });

  assert.equal(result.eligibleN, 5);
  assert.equal(result.coverage.leave, 1);
  // Utilization: 10 taken days / 30 eligible days per person = 33.33%
  assert.ok(Math.abs(result.metrics.leaveUtilizationPercent - 33.33) < 0.1);
  assert.equal(result.metrics.meanDaysSinceLeave, 70);
  assert.equal(result.metrics.recoveryGapPercent, 100);
  assert.equal(result.metrics.decidedLeaveRequestsCount, 5);
  assert.equal(result.metrics.leaveDenialRatePercent, 40);
});

test('computeWeeklySourceMetrics excludes unverified/missing records instead of assuming zero', () => {
  const personnel = makePersonnel(5);
  // Only 3 of 5 have verified leave eligibility this week; 2 are simply absent.
  const leaveEligibility = personnel.slice(0, 3).map((p) => ({
    personnel_id: p.id,
    snapshot_week: WEEK_START,
    eligible_days_90d: 30,
    verified: true,
  }));
  const dutyRecords = personnel.flatMap((p) => [
    { personnel_id: p.id, duty_date: WEEK_END, shift_type: 'day', hours: 8 },
  ]);

  const result = computeWeeklySourceMetrics({
    unitId: UNIT_ID,
    weekStart: WEEK_START,
    personnel,
    leaveEligibility,
    leaveRecords: [],
    dutyRecords,
    deployments: [],
  });

  assert.equal(result.coverage.leave, 0.6); // 3/5, not silently zero-filled to 5/5 or 0/5
  // No qualifying leave anywhere, but the 3 covered people have known history:
  // days-since-leave falls back to time since enrollment, never null/zero-by-default.
  assert.equal(result.metrics.recoveryGapPercent, 100);
});

test('computeWeeklySourceMetrics reports insufficient_data when domain coverage drops below 80%', () => {
  const personnel = makePersonnel(5);
  const leaveEligibility = personnel.map((p) => ({
    personnel_id: p.id,
    snapshot_week: WEEK_START,
    eligible_days_90d: 30,
    verified: true,
  }));
  // Only 3 of 5 have any duty record inside the 7-day workload window -> 60% duty coverage.
  const dutyRecords = personnel.slice(0, 3).map((p) => ({
    personnel_id: p.id,
    duty_date: WEEK_END,
    shift_type: 'day',
    hours: 8,
  }));

  const result = computeWeeklySourceMetrics({
    unitId: UNIT_ID,
    weekStart: WEEK_START,
    personnel,
    leaveEligibility,
    leaveRecords: [],
    dutyRecords,
    deployments: [],
  });

  assert.equal(result.coverage.duty, 0.6);
  assert.equal(result.status, 'insufficient_data');
  assert.ok(result.coverage.overall < MIN_COVERAGE_RATIO);
});

test('computeWeeklySourceMetrics respects the 28-day night-duty and 7-day workload window boundaries', () => {
  const personnel = makePersonnel(1);
  const p = personnel[0];
  const dutyRecords = [
    // Exactly on the 28-day boundary: included.
    { personnel_id: p.id, duty_date: addDays(WEEK_END, -27), shift_type: 'night', hours: 8 },
    // One day outside the 28-day boundary: excluded from night count.
    { personnel_id: p.id, duty_date: addDays(WEEK_END, -28), shift_type: 'night', hours: 8 },
    // Exactly on the 7-day workload boundary: included.
    { personnel_id: p.id, duty_date: addDays(WEEK_END, -6), shift_type: 'day', hours: 9 },
    // One day outside the 7-day boundary: excluded from workload sum.
    { personnel_id: p.id, duty_date: addDays(WEEK_END, -7), shift_type: 'day', hours: 100 },
    { personnel_id: p.id, duty_date: WEEK_END, shift_type: 'day', hours: 1 },
  ];

  const result = computeWeeklySourceMetrics({
    unitId: UNIT_ID,
    weekStart: WEEK_START,
    personnel,
    leaveEligibility: [],
    leaveRecords: [],
    dutyRecords,
    deployments: [],
  });

  assert.equal(result.metrics.meanNightShifts28d, 1); // only the in-window night shift counts
  assert.equal(result.metrics.meanWeeklyDutyHours, 10); // 9 + 1, excludes the 100-hour outlier
});

test('computeWeeklySourceMetrics treats verified non-deployed personnel as a confirmed zero, not missing', () => {
  const personnel = makePersonnel(2);
  const deployments = [
    {
      personnel_id: personnel[0].id,
      start_on: addDays(WEEK_END, -99),
      end_on: null,
      verified: true,
    },
    // personnel[1] has no deployment row at all, but has verified history -> confirmed 0 days.
  ];

  const result = computeWeeklySourceMetrics({
    unitId: UNIT_ID,
    weekStart: WEEK_START,
    personnel,
    leaveEligibility: [],
    leaveRecords: [],
    dutyRecords: [],
    deployments,
  });

  assert.equal(result.coverage.deployment, 1); // both are covered (verified history)
  assert.equal(result.metrics.meanDeploymentDays, 50); // (100 + 0) / 2
  assert.equal(result.counts.deployedPersonnelCount, 1);
});

test('computeWeeklySourceMetrics excludes personnel with unverified enrollment from deployment coverage', () => {
  const personnel = [
    { id: 'PER-001', unit_id: UNIT_ID, active: true, history_start_on: '2026-01-01' },
    { id: 'PER-002', unit_id: UNIT_ID, active: true, history_start_on: null },
  ];

  const result = computeWeeklySourceMetrics({
    unitId: UNIT_ID,
    weekStart: WEEK_START,
    personnel,
    leaveEligibility: [],
    leaveRecords: [],
    dutyRecords: [],
    deployments: [],
  });

  assert.equal(result.coverage.deployment, 0.5); // only PER-001 is verified enrolled
});
