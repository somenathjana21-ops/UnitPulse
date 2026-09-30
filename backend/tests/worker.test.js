/**
 * backend/tests/worker.test.js
 *
 * Tests for completed-week worker and trigger rules.
 * Specifications: docs/03-srs.md, docs/07-ml-specification.md,
 * docs/08-api-specification.md, docs/09-database-design.md, docs/11-testing-plan.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyCronAuthorization,
  getLatestCompletedWeekStart,
  processUnitWeek,
  runWeeklyWorker,
} from '../src/worker.js';

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

describe('Phase 4 — CRON_SECRET Server-Side Authorization', () => {
  const secret = 'test-cron-secret-12345';

  it('Rejects requests when CRON_SECRET is not configured', () => {
    assert.equal(verifyCronAuthorization('Bearer something', undefined), false);
    assert.equal(verifyCronAuthorization('Bearer something', ''), false);
  });

  it('Rejects requests with missing or empty Authorization header', () => {
    assert.equal(verifyCronAuthorization(null, secret), false);
    assert.equal(verifyCronAuthorization('', secret), false);
    assert.equal(verifyCronAuthorization(undefined, secret), false);
  });

  it('Rejects requests with mismatched secret or wrong bearer token', () => {
    assert.equal(verifyCronAuthorization('Bearer wrong-secret', secret), false);
    assert.equal(verifyCronAuthorization('wrong-token', secret), false);
  });

  it('Accepts valid Bearer token matching CRON_SECRET', () => {
    assert.equal(verifyCronAuthorization(`Bearer ${secret}`, secret), true);
    assert.equal(verifyCronAuthorization(secret, secret), true);
  });
});

describe('Phase 4 — Completed-Week Worker Date Helper', () => {
  it('Computes the most recent completed Monday', () => {
    const ref = new Date('2026-09-30T12:00:00Z');
    const monday = getLatestCompletedWeekStart(ref);
    assert.equal(monday, '2026-09-21');
  });
});

describe('Phase 4 — Deterministic Trigger Rules in Worker (processUnitWeek)', () => {
  const weekStart = '2026-09-28';
  const weekEnd = '2026-10-04';
  const unitId = 'UNIT-B';
  const officerId = '00000000-0000-0000-0000-000000000003';

  // Synthetic source data fixture generating an elevated score (~75)
  // 60 personnel, high night shifts (>12 avg), high recovery gap (>35%), high deployment
  function createElevatedSourceData(n = 60) {
    const personnel = [];
    const leaveEligibility = [];
    const leaveRecords = [];
    const dutyRecords = [];
    const deployments = [];

    for (let i = 1; i <= n; i++) {
      const pid = `PER-B-${String(i).padStart(3, '0')}`;
      personnel.push({ id: pid, unit_id: unitId, active: true, history_start_on: '2026-01-01' });
      leaveEligibility.push({ personnel_id: pid, snapshot_week: weekStart, eligible_days_90d: 30, verified: true });

      // Leave record with extended recovery gap (>60 days since qualifying leave)
      leaveRecords.push({
        id: `LR-${i}`,
        personnel_id: pid,
        status: 'taken',
        start_on: addDays(weekEnd, -80),
        end_on: addDays(weekEnd, -71),
        qualifying: true,
        decided_on: addDays(weekEnd, -85),
      });

      // 28 days of duty covering the entire window including the last 7 days
      for (let d = 0; d < 28; d++) {
        dutyRecords.push({
          personnel_id: pid,
          duty_date: addDays(weekEnd, -d),
          shift_type: d >= 13 ? 'night' : 'day', // 15 night shifts in 28 days
          hours: d < 7 ? 10 : 8, // 70 hours in past 7 days (>60h)
        });
      }

      // Continuous deployment > 60 days
      deployments.push({
        id: `DEP-${i}`,
        personnel_id: pid,
        start_on: addDays(weekEnd, -75),
        end_on: null,
        verified: true,
      });
    }

    return { personnel, leaveEligibility, leaveRecords, dutyRecords, deployments };
  }

  // Healthy fixture with low indicators
  function createHealthySourceData(n = 60) {
    const personnel = [];
    const leaveEligibility = [];
    const leaveRecords = [];
    const dutyRecords = [];
    const deployments = [];

    for (let i = 1; i <= n; i++) {
      const pid = `PER-A-${String(i).padStart(3, '0')}`;
      personnel.push({ id: pid, unit_id: 'UNIT-A', active: true, history_start_on: '2026-01-01' });
      leaveEligibility.push({ personnel_id: pid, snapshot_week: weekStart, eligible_days_90d: 30, verified: true });

      // Recent qualifying leave (10 days ago)
      leaveRecords.push({
        id: `LR-H-${i}`,
        personnel_id: pid,
        status: 'taken',
        start_on: addDays(weekEnd, -15),
        end_on: addDays(weekEnd, -10),
        qualifying: true,
        decided_on: addDays(weekEnd, -20),
      });

      // Regular day shifts, only 1 night shift in 28 days, 40 hours in past 7 days
      for (let d = 0; d < 28; d++) {
        dutyRecords.push({
          personnel_id: pid,
          duty_date: addDays(weekEnd, -d),
          shift_type: d === 0 ? 'night' : 'day',
          hours: d < 7 ? 5.7 : 6,
        });
      }
    }

    return { personnel, leaveEligibility, leaveRecords, dutyRecords, deployments };
  }

  it('Trigger rule 1 (Spike): triggers report when current >= 40 and current >= baseline + 15 with >= 4 earlier comparable weeks', () => {
    const sourceData = createElevatedSourceData();

    // 4 earlier comparable weeks with median baseline = 30
    const priorWeeksHistory = [
      { weekStart: '2026-08-31', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-07', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-14', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-21', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    ];

    const result = processUnitWeek({
      unitId,
      weekStart,
      sourceData,
      priorWeeksHistory,
      previousWeekIndex: 30,
      hasActiveReport: false,
      assignedOfficerId: officerId,
    });

    assert.ok(result.triggerResult.triggered, 'Must trigger');
    assert.ok(result.triggerResult.activeRules.some((r) => r.rule === 'spike'), 'Must fire spike rule');
    assert.ok(result.welfareReport !== null, 'Must generate welfare report');
    assert.equal(result.welfareReport.assigned_to, officerId);
    assert.equal(result.welfareReport.status, 'new');
    assert.equal(result.welfareReport.unit_id, unitId);
    assert.equal(result.welfareReport.week_start, weekStart);
  });

  it('Trigger rule 1 (Spike boundary): does NOT fire spike trigger if fewer than 4 earlier comparable weeks', () => {
    const sourceData = createElevatedSourceData();

    // Only 3 comparable prior weeks (<4)
    const priorWeeksHistory = [
      { weekStart: '2026-09-07', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-14', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-21', index: 30, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    ];

    const result = processUnitWeek({
      unitId,
      weekStart,
      sourceData,
      priorWeeksHistory,
      previousWeekIndex: 30, // previous week was 30 (not >=75)
      hasActiveReport: false,
      assignedOfficerId: officerId,
    });

    assert.equal(result.triggerResult.spikeEligible, false, 'Spike rule should not be eligible with <4 weeks');
    const spikeFired = result.triggerResult.activeRules.some((r) => r.rule === 'spike');
    assert.equal(spikeFired, false, 'Spike rule must NOT fire with <4 weeks');
  });

  it('Trigger rule 2 (Sustained-high): triggers report when current >= 75 for two consecutive completed weeks', () => {
    const sourceData = createElevatedSourceData();

    // No baseline history (0 prior weeks), but previous week index was 75
    const result = processUnitWeek({
      unitId,
      weekStart,
      sourceData,
      priorWeeksHistory: [],
      previousWeekIndex: 75, // Previous completed week was >= 75
      hasActiveReport: false,
      assignedOfficerId: officerId,
    });

    assert.ok(result.triggerResult.triggered, 'Must trigger on sustained high');
    assert.ok(result.triggerResult.activeRules.some((r) => r.rule === 'sustained_high'), 'Must fire sustained_high rule');
    assert.ok(result.welfareReport !== null, 'Must create report');
    assert.equal(result.welfareReport.trigger_rule, 'sustained_high');
  });

  it('Maintains at most ONE active report per unit (deduplication)', () => {
    const sourceData = createElevatedSourceData();

    // An active report is ALREADY open for this unit (hasActiveReport = true)
    const result = processUnitWeek({
      unitId,
      weekStart,
      sourceData,
      priorWeeksHistory: [],
      previousWeekIndex: 80,
      hasActiveReport: true, // Existing active report
      assignedOfficerId: officerId,
    });

    assert.ok(result.triggerResult.triggered, 'Trigger conditions are met');
    assert.equal(result.triggerResult.shouldCreateReport, false, 'Should not create duplicate report');
    assert.equal(result.triggerResult.isDeduplicated, true, 'Must be marked deduplicated');
    assert.equal(result.welfareReport, null, 'welfareReport must be null when an active report exists');
  });

  it('Healthy unit does not trigger a welfare report', () => {
    const sourceData = createHealthySourceData();

    const priorWeeksHistory = [
      { weekStart: '2026-08-31', index: 10, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-07', index: 10, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-14', index: 10, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
      { weekStart: '2026-09-21', index: 10, scoreVersion: '1.0.0', featureMask: 'standard_v1' },
    ];

    const result = processUnitWeek({
      unitId: 'UNIT-A',
      weekStart,
      sourceData,
      priorWeeksHistory,
      previousWeekIndex: 10,
      hasActiveReport: false,
      assignedOfficerId: officerId,
    });

    assert.equal(result.triggerResult.triggered, false);
    assert.equal(result.welfareReport, null);
  });
});

function createMockSupabase({
  releases = [],
  reports = [],
  metrics = [],
  assignments = [{ user_id: '00000000-0000-0000-0000-000000000003', unit_id: 'UNIT-B' }],
  roles = [{ user_id: '00000000-0000-0000-0000-000000000003', role: 'welfare_officer' }],
  sourceData = {},
  insertReportError = null,
} = {}) {
  return {
    from(table) {
      let filterUnit = null;
      let filterWeek = null;
      let filterStatusNeq = null;

      const queryBuilder = {
        select() {
          return queryBuilder;
        },
        eq(col, val) {
          if (col === 'unit_id') filterUnit = val;
          if (col === 'week_start' || col === 'snapshot_week') filterWeek = val;
          return queryBuilder;
        },
        neq(col, val) {
          if (col === 'status') filterStatusNeq = val;
          return queryBuilder;
        },
        lt() {
          return queryBuilder;
        },
        in() {
          return queryBuilder;
        },
        order() {
          return queryBuilder;
        },
        async maybeSingle() {
          if (table === 'unit_week_releases') {
            const found = releases.find((r) => (!filterUnit || r.unit_id === filterUnit) && (!filterWeek || r.week_start === filterWeek));
            return { data: found || null, error: null };
          }
          if (table === 'welfare_reports') {
            const found = reports.find((r) => (!filterUnit || r.unit_id === filterUnit) && (!filterStatusNeq || r.status !== filterStatusNeq));
            return { data: found || null, error: null };
          }
          if (table === 'user_roles') {
            return { data: roles[0] || null, error: null };
          }
          return { data: null, error: null };
        },
        async then(resolve) {
          if (table === 'unit_week_releases') {
            return resolve({ data: releases, error: null });
          }
          if (table === 'welfare_reports') {
            return resolve({ data: reports, error: null });
          }
          if (table === 'unit_week_metrics') {
            return resolve({ data: metrics, error: null });
          }
          if (table === 'unit_assignments') {
            return resolve({ data: assignments, error: null });
          }
          if (table === 'user_roles') {
            return resolve({ data: roles, error: null });
          }
          if (table === 'personnel') {
            return resolve({ data: sourceData.personnel || [], error: null });
          }
          if (table === 'leave_eligibility') {
            return resolve({ data: sourceData.leaveEligibility || [], error: null });
          }
          if (table === 'leave_records') {
            return resolve({ data: sourceData.leaveRecords || [], error: null });
          }
          if (table === 'duty_records') {
            return resolve({ data: sourceData.dutyRecords || [], error: null });
          }
          if (table === 'deployments') {
            return resolve({ data: sourceData.deployments || [], error: null });
          }
          return resolve({ data: [], error: null });
        },
        async upsert(row) {
          return { data: row, error: null };
        },
        async insert(row) {
          if (insertReportError) {
            return { data: null, error: insertReportError };
          }
          reports.push(row);
          return { data: row, error: null };
        },
      };

      return queryBuilder;
    },
  };
}

describe('Phase 4 — Worker Idempotency & Database Constraint Simulation', () => {
  it('Re-running the worker with existing release reuses release and creates no duplicate', async () => {
    const fakeSupabase = createMockSupabase({
      releases: [{ unit_id: 'UNIT-B', week_start: '2026-09-28', index_approx: 75, band: 'high', approved_metrics_json: {} }],
      reports: [{ id: 'rep-1', unit_id: 'UNIT-B', week_start: '2026-09-28', status: 'new', assigned_to: 'officer-1' }],
      metrics: [{ week_start: '2026-09-21', index_exact: 75, score_version: '1.0.0', feature_mask: 'standard_v1' }],
    });

    const summary = await runWeeklyWorker({
      weekStart: '2026-09-28',
      unitIds: ['UNIT-B'],
      supabase: fakeSupabase,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    assert.equal(summary.unitsProcessed, 1);
    assert.equal(summary.releasesReused, 1);
    assert.equal(summary.releasesCreated, 0);
    assert.equal(summary.reportsCreated, 0);
    assert.equal(summary.reportsDeduplicated, 1);
  });

  it('Handles concurrent retry collision via unique database constraints (Postgres 23505)', async () => {
    const weekEnd = '2026-10-04';
    const personnel = Array.from({ length: 10 }, (_, i) => ({
      id: `PER-B-${i + 1}`,
      unit_id: 'UNIT-B',
      active: true,
      history_start_on: '2026-01-01',
    }));
    const leaveEligibility = personnel.map((p) => ({
      personnel_id: p.id,
      snapshot_week: '2026-09-28',
      eligible_days_90d: 30,
      verified: true,
    }));
    const leaveRecords = personnel.map((p) => ({
      personnel_id: p.id,
      status: 'taken',
      start_on: addDays(weekEnd, -80),
      end_on: addDays(weekEnd, -71),
      qualifying: true,
      decided_on: addDays(weekEnd, -85),
    }));
    const dutyRecords = personnel.flatMap((p) =>
      Array.from({ length: 28 }, (_, d) => ({
        personnel_id: p.id,
        duty_date: addDays(weekEnd, -d),
        shift_type: d >= 13 ? 'night' : 'day',
        hours: d < 7 ? 10 : 8,
      }))
    );
    const deployments = personnel.map((p) => ({
      personnel_id: p.id,
      start_on: addDays(weekEnd, -75),
      end_on: null,
      verified: true,
    }));

    const fakeSupabase = createMockSupabase({
      releases: [],
      reports: [], // Initially no active report found
      metrics: [{ week_start: '2026-09-21', index_exact: 75, score_version: '1.0.0', feature_mask: 'standard_v1' }],
      sourceData: { personnel, leaveEligibility, leaveRecords, dutyRecords, deployments },
      insertReportError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_welfare_reports_active_per_unit"',
      },
    });

    const summary = await runWeeklyWorker({
      weekStart: '2026-09-28',
      unitIds: ['UNIT-B'],
      supabase: fakeSupabase,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    assert.equal(summary.reportsCreated, 0);
    assert.equal(summary.reportsDeduplicated, 1);
    assert.equal(summary.errors.length, 0, 'Must not treat unique constraint deduplication as an unhandled error');
  });
});
