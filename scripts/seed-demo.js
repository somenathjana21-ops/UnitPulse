/**
 * scripts/seed-demo.js
 *
 * Unit Pulse 2.0 — Synthetic Demo Seed Generator (Phase 1)
 * Specifications: docs/03-srs.md, docs/06-data-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 *
 * Generates:
 * - 6 fictional units (e.g. UNIT-A through UNIT-F)
 * - 60 synthetic personnel per unit (360 total)
 * - ~180 days of record history (2026-04-01 to 2026-09-28)
 * - 12 completed usable weekly snapshots (plus 14 warm-up baseline weeks)
 * - Unit B: Elevated strain unit (high night duty, recovery gap, sustained high index -> welfare report)
 * - Unit A: Stable recovery unit (regular leave, low night shifts, index in normal band)
 * - Zero real names, genuine forces, or actual locations.
 * - Writes complete idempotent SQL statements to supabase/seed.sql
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateUnitStrainIndex,
  calculateBaseline,
  evaluateTriggers,
  applyPersistentBoundedNoise,
} from '@unitpulse/ml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedSqlPath = path.join(rootDir, 'supabase', 'seed.sql');

// Deterministic Pseudo-Random Number Generator (seeded LCG)
function makePrng(seed = 123456789) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const random = makePrng(20260930);

// Helper for dates (YYYY-MM-DD)
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(d, days) {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// 1. Fictional Units (Strictly synthetic; no real forces or locations)
export const FICTIONAL_UNITS = [
  { id: 'UNIT-A', display_code: 'UNIT-A', name: 'Alpha Support Battery (Synthetic)', profile: 'stable' },
  { id: 'UNIT-B', display_code: 'UNIT-B', name: 'Bravo Recon Battalion (Synthetic)', profile: 'elevated' },
  { id: 'UNIT-C', display_code: 'UNIT-C', name: 'Charlie Logistics Coy (Synthetic)', profile: 'moderate' },
  { id: 'UNIT-D', display_code: 'UNIT-D', name: 'Delta Signal Squadron (Synthetic)', profile: 'moderate' },
  { id: 'UNIT-E', display_code: 'UNIT-E', name: 'Echo Field Workshop (Synthetic)', profile: 'mild' },
  { id: 'UNIT-F', display_code: 'UNIT-F', name: 'Foxtrot Medical Platoon (Synthetic)', profile: 'stable' },
];

// 2. Auth Demo Users (Fictional credentials for role and RLS testing)
export const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'commander.alpha@synthetic.unitpulse.local',
    role: 'commander',
    unit_ids: ['UNIT-A'],
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'commander.bravo@synthetic.unitpulse.local',
    role: 'commander',
    unit_ids: ['UNIT-B'],
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'welfare.primary@synthetic.unitpulse.local',
    role: 'welfare_officer',
    unit_ids: ['UNIT-A', 'UNIT-B', 'UNIT-C', 'UNIT-D', 'UNIT-E', 'UNIT-F'],
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'welfare.secondary@synthetic.unitpulse.local',
    role: 'welfare_officer',
    unit_ids: ['UNIT-C'],
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'hr.uploader@synthetic.unitpulse.local',
    role: 'hr_uploader',
    unit_ids: ['UNIT-A', 'UNIT-B', 'UNIT-C', 'UNIT-D', 'UNIT-E', 'UNIT-F'],
  },
];

/**
 * Generates the complete synthetic dataset in memory.
 */
export function generateSyntheticDataset() {
  const startDate = new Date('2026-04-01T00:00:00Z');
  const endDate = new Date('2026-09-28T00:00:00Z');
  const historyStartDate = new Date('2026-03-15T00:00:00Z');

  // Days list (~181 days)
  const days = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    days.push(formatDate(curr));
    curr = addDays(curr, 1);
  }

  // Weeks list (Every Monday)
  const allWeeks = [];
  curr = new Date('2026-04-06T00:00:00Z');
  while (curr <= endDate) {
    allWeeks.push(formatDate(curr));
    curr = addDays(curr, 7);
  }
  // The last 12 weeks are the usable snapshot weeks:
  const usableWeeks = allWeeks.slice(-12);

  // Generate Personnel (60 per unit)
  const personnel = [];
  const personnelByUnit = {};

  for (const unit of FICTIONAL_UNITS) {
    personnelByUnit[unit.id] = [];
    const prefix = unit.id.split('-')[1]; // 'A', 'B', etc.
    for (let i = 1; i <= 60; i++) {
      const pId = `PER-${prefix}-${String(i).padStart(3, '0')}`;
      const p = {
        id: pId,
        unit_id: unit.id,
        active: true,
        history_start_on: formatDate(historyStartDate),
      };
      personnel.push(p);
      personnelByUnit[unit.id].push(p);
    }
  }

  // Generate Duty Records
  const dutyRecords = [];
  for (const unit of FICTIONAL_UNITS) {
    const isElevated = unit.profile === 'elevated';
    const isStable = unit.profile === 'stable';

    for (const p of personnelByUnit[unit.id]) {
      for (const day of days) {
        let shiftType = 'day';
        let hours = 8.0;

        const roll = random();
        if (isElevated) {
          // Elevated Unit B: High night shifts and higher hours
          if (roll < 0.40) {
            shiftType = 'night';
            hours = 10.0;
          } else if (roll < 0.85) {
            shiftType = 'day';
            hours = 9.5;
          } else {
            shiftType = 'rest';
            hours = 0.0;
          }
        } else if (isStable) {
          // Stable Unit A: Low night shifts and normal duty hours
          if (roll < 0.07) {
            shiftType = 'night';
            hours = 8.0;
          } else if (roll < 0.77) {
            shiftType = 'day';
            hours = 8.0;
          } else if (roll < 0.95) {
            shiftType = 'rest';
            hours = 0.0;
          } else {
            shiftType = 'training';
            hours = 6.0;
          }
        } else {
          // Moderate units (C, D, E, F)
          if (roll < 0.15) {
            shiftType = 'night';
            hours = 8.0;
          } else if (roll < 0.80) {
            shiftType = 'day';
            hours = 8.0;
          } else {
            shiftType = 'rest';
            hours = 0.0;
          }
        }

        dutyRecords.push({
          personnel_id: p.id,
          duty_date: day,
          shift_type: shiftType,
          hours,
        });
      }
    }
  }

  // Generate Leave Eligibility (weekly for each person)
  const leaveEligibility = [];
  for (const p of personnel) {
    for (const w of allWeeks) {
      leaveEligibility.push({
        personnel_id: p.id,
        snapshot_week: w,
        eligible_days_90d: 30,
        verified: true,
      });
    }
  }

  // Generate Leave Records & Deployments
  const leaveRecords = [];
  const deployments = [];
  let lrCounter = 1;
  let depCounter = 1;

  for (const unit of FICTIONAL_UNITS) {
    const isElevated = unit.profile === 'elevated';
    const isStable = unit.profile === 'stable';

    for (const [idx, p] of personnelByUnit[unit.id].entries()) {
      if (isElevated) {
        // UNIT-B: High leave denial, long continuous deployment, large recovery gap
        // Deployments: 75% deployed continuously from July 1 to Sept 28
        if (idx < 45) {
          deployments.push({
            id: `DEP-${String(depCounter++).padStart(5, '0')}`,
            personnel_id: p.id,
            start_on: '2026-07-01',
            end_on: '2026-09-28',
            verified: true,
          });
        }

        // Leave: 30% of requests denied; taken leaves were far in the past (>60 days ago)
        leaveRecords.push({
          id: `LR-${String(lrCounter++).padStart(6, '0')}`,
          personnel_id: p.id,
          status: 'taken',
          start_on: '2026-04-10',
          end_on: '2026-04-18',
          qualifying: true,
          decided_on: '2026-04-05',
        });

        // Denied leave requests in August & September
        if (idx % 2 === 0) {
          leaveRecords.push({
            id: `LR-${String(lrCounter++).padStart(6, '0')}`,
            personnel_id: p.id,
            status: 'denied',
            start_on: '2026-08-15',
            end_on: '2026-08-25',
            qualifying: true,
            decided_on: '2026-08-10',
          });
        }
      } else if (isStable) {
        // UNIT-A: Regular restorative leave, short garrison deployments
        if (idx % 3 === 0) {
          deployments.push({
            id: `DEP-${String(depCounter++).padStart(5, '0')}`,
            personnel_id: p.id,
            start_on: '2026-05-01',
            end_on: '2026-05-20',
            verified: true,
          });
        }

        // Regular leaves taken in June and August
        leaveRecords.push({
          id: `LR-${String(lrCounter++).padStart(6, '0')}`,
          personnel_id: p.id,
          status: 'taken',
          start_on: '2026-06-01',
          end_on: '2026-06-10',
          qualifying: true,
          decided_on: '2026-05-25',
        });
        leaveRecords.push({
          id: `LR-${String(lrCounter++).padStart(6, '0')}`,
          personnel_id: p.id,
          status: 'taken',
          start_on: '2026-08-20',
          end_on: '2026-08-30',
          qualifying: true,
          decided_on: '2026-08-15',
        });
      } else {
        // Other units: balanced patterns
        leaveRecords.push({
          id: `LR-${String(lrCounter++).padStart(6, '0')}`,
          personnel_id: p.id,
          status: 'taken',
          start_on: '2026-06-15',
          end_on: '2026-06-25',
          qualifying: true,
          decided_on: '2026-06-10',
        });
        if (idx % 4 === 0) {
          deployments.push({
            id: `DEP-${String(depCounter++).padStart(5, '0')}`,
            personnel_id: p.id,
            start_on: '2026-06-01',
            end_on: '2026-07-15',
            verified: true,
          });
        }
      }
    }
  }

  // Precompute Weekly Metrics and Releases across all weeks
  const unitWeekMetrics = [];
  const unitWeekReleases = [];
  const welfareReports = [];

  for (const unit of FICTIONAL_UNITS) {
    const unitHistoricalScores = [];

    for (let wIdx = 0; wIdx < allWeeks.length; wIdx++) {
      const weekStart = allWeeks[wIdx];
      const isElevated = unit.profile === 'elevated';
      const isStable = unit.profile === 'stable';

      // Synthesize realistic component metrics for the week:
      let meanDaysSinceLeave;
      let recoveryGapPercent;
      let leaveDenialRatePercent;
      let decidedLeaveRequestsCount;
      let meanNightShifts28d;
      let meanDeploymentDays;
      let meanWeeklyDutyHours;

      if (isElevated) {
        // Unit B escalates starting from week 15 onwards
        const escalation = wIdx >= 14 ? 1.0 : 0.6;
        meanDaysSinceLeave = 68 * escalation;
        recoveryGapPercent = Math.min(65, 48 * escalation);
        leaveDenialRatePercent = 29.5;
        decidedLeaveRequestsCount = 18;
        meanNightShifts28d = 12.8 * escalation;
        meanDeploymentDays = 68 * escalation;
        meanWeeklyDutyHours = 55.4;
      } else if (isStable) {
        meanDaysSinceLeave = 32.0;
        recoveryGapPercent = 12.0;
        leaveDenialRatePercent = 2.0;
        decidedLeaveRequestsCount = 12;
        meanNightShifts28d = 2.4;
        meanDeploymentDays = 14.0;
        meanWeeklyDutyHours = 41.5;
      } else {
        meanDaysSinceLeave = 45.0;
        recoveryGapPercent = 22.0;
        leaveDenialRatePercent = 8.0;
        decidedLeaveRequestsCount = 10;
        meanNightShifts28d = 5.2;
        meanDeploymentDays = 25.0;
        meanWeeklyDutyHours = 44.0;
      }

      // 1. Calculate Unit Load & Recovery Index using deterministic @unitpulse/ml
      const scoreResult = calculateUnitStrainIndex({
        coverageRatio: 1.0,
        meanDaysSinceLeave,
        recoveryGapPercent,
        leaveDenialRatePercent,
        decidedLeaveRequestsCount,
        meanNightShifts28d,
        meanDeploymentDays,
        meanWeeklyDutyHours,
      });

      // 2. Calculate rolling baseline
      const baselineResult = calculateBaseline(unitHistoricalScores, {
        scoreVersion: scoreResult.scoreVersion,
        featureMask: scoreResult.featureMask,
      });

      const currentIndex = scoreResult.index;
      const baselineIndex = baselineResult.baselineIndex;

      // 3. Evaluate triggers
      const previousScore = unitHistoricalScores[unitHistoricalScores.length - 1]?.index ?? null;
      const triggerResult = evaluateTriggers({
        currentIndex,
        baselineIndex,
        comparableWeeksCount: baselineResult.comparableWeeksCount,
        previousWeekIndex: previousScore,
        hasActiveReport: false,
      });

      // Store in private unit_week_metrics
      unitWeekMetrics.push({
        unit_id: unit.id,
        week_start: weekStart,
        eligible_n: 60,
        source_coverage_json: { hr: 1.0, leave: 1.0, duty: 1.0, deployment: 1.0 },
        leave_utilization: isStable ? 84.5 : 42.0,
        recovery_gap: recoveryGapPercent,
        denial_rate: leaveDenialRatePercent,
        night_shifts_average: meanNightShifts28d,
        deployment_days_average: meanDeploymentDays,
        weekly_hours_average: meanWeeklyDutyHours,
        index_exact: currentIndex,
        baseline_exact: baselineIndex,
        score_version: '1.0.0',
        feature_mask: scoreResult.featureMask,
      });

      // Maintain rolling history
      unitHistoricalScores.push({
        index: currentIndex,
        scoreVersion: scoreResult.scoreVersion,
        featureMask: scoreResult.featureMask,
      });

      // Only produce public releases for the 12 usable completed snapshot weeks!
      if (usableWeeks.includes(weekStart)) {
        // Apply persistent bounded Laplace noise to select counts
        const noisyEligible = applyPersistentBoundedNoise(60, 60, 0.2);

        // Released band
        let band = 'normal';
        if (currentIndex >= 70) band = 'high';
        else if (currentIndex >= 40) band = 'elevated';

        unitWeekReleases.push({
          unit_id: unit.id,
          week_start: weekStart,
          suppression_status: 'published',
          index_approx: currentIndex,
          baseline_approx: baselineIndex,
          band,
          approved_metrics_json: {
            meanNightShifts28d: Math.round(meanNightShifts28d * 10) / 10,
            recoveryGapPercent: Math.round(recoveryGapPercent),
            meanWeeklyDutyHours: Math.round(meanWeeklyDutyHours * 10) / 10,
            leaveCoverageRatio: isStable ? 0.88 : 0.52,
            approxPersonnelCount: noisyEligible.approximateCount,
            isApproximate: true,
          },
          noise_version: 'laplace_eps_0_2_v1',
        });

        // Trigger welfare report if conditions are met on latest week for elevated unit
        if (isElevated && weekStart === usableWeeks[usableWeeks.length - 1] && triggerResult.triggered) {
          welfareReports.push({
            id: '11111111-2222-3333-4444-555555555555',
            unit_id: unit.id,
            week_start: weekStart,
            assigned_to: DEMO_USERS[2].id, // welfare_primary
            trigger_rule: triggerResult.activeRules[0]?.rule || 'sustained_high',
            aggregate_snapshot_json: {
              unitId: unit.id,
              weekStart,
              index: currentIndex,
              baseline: baselineIndex,
              triggerReason: triggerResult.evaluationSummary,
              contributingFactors: [
                'Night duty shifts elevated (>12 shifts/28d)',
                'Recovery gap exceeds policy threshold (>35%)',
                'Extended continuous field deployment (>60d)',
              ],
            },
            briefing_json: {
              summary: 'Bravo Recon Battalion exhibits elevated strain indicators across duty rotations and leave recovery.',
              suggestedActions: [
                { category: 'rebalance_roster', text: 'Review night shift distribution to provide 48h rest intervals.' },
                { category: 'review_leave_queue', text: 'Prioritize pending leave requests for personnel with >60d recovery gap.' },
                { category: 'offer_welfare_review', text: 'Coordinate with Unit Welfare Officer for supportive check-ins.' },
              ],
              disclaimer: 'This briefing is an operational welfare planning indicator. It is not a clinical or medical diagnosis.',
            },
            status: 'new',
          });
        }
      }
    }
  }

  return {
    units: FICTIONAL_UNITS,
    users: DEMO_USERS,
    personnel,
    dutyRecords,
    leaveEligibility,
    leaveRecords,
    deployments,
    unitWeekMetrics,
    unitWeekReleases,
    welfareReports,
    usableWeeks,
  };
}

/**
 * Converts the dataset into standard SQL script statements.
 */
export function buildSqlSeed(data) {
  const sql = [];

  sql.push('-- ==============================================================================');
  sql.push('-- Unit Pulse 2.0 — Synthetic Demo Database Seed (Phase 1)');
  sql.push('-- Generated deterministically by scripts/seed-demo.js');
  sql.push('-- Contains NO real names, locations, or genuine armed-force rosters.');
  sql.push('-- ==============================================================================\n');

  // 1. Units
  sql.push('-- 1. Units');
  for (const u of data.units) {
    sql.push(`INSERT INTO private.units (id, display_code, name, active) VALUES ('${u.id}', '${u.display_code}', '${u.name}', true) ON CONFLICT (id) DO NOTHING;`);
  }
  sql.push('');

  // 2. Auth Users & Roles & Unit Assignments
  sql.push('-- 2. Auth Users & Role Provisioning');
  for (const u of data.users) {
    sql.push(`INSERT INTO auth.users (id, email) VALUES ('${u.id}', '${u.email}') ON CONFLICT (id) DO NOTHING;`);
    sql.push(`INSERT INTO public.user_roles (user_id, role) VALUES ('${u.id}', '${u.role}') ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;`);
    for (const unitId of u.unit_ids) {
      sql.push(`INSERT INTO public.unit_assignments (user_id, unit_id) VALUES ('${u.id}', '${unitId}') ON CONFLICT (user_id, unit_id) DO NOTHING;`);
    }
  }
  sql.push('');

  // 3. Personnel
  sql.push('-- 3. Personnel (360 pseudonymous individuals)');
  const personRows = data.personnel.map(
    (p) => `('${p.id}', '${p.unit_id}', ${p.active}, '${p.history_start_on}')`
  );
  sql.push(`INSERT INTO private.personnel (id, unit_id, active, history_start_on) VALUES\n  ${personRows.join(',\n  ')}\nON CONFLICT (id) DO NOTHING;\n`);

  // 4. Leave Records (batches of 200)
  sql.push('-- 4. Leave Records');
  const lrChunks = [];
  for (let i = 0; i < data.leaveRecords.length; i += 200) {
    lrChunks.push(data.leaveRecords.slice(i, i + 200));
  }
  for (const chunk of lrChunks) {
    const rows = chunk.map(
      (lr) => `('${lr.id}', '${lr.personnel_id}', '${lr.status}', '${lr.start_on}', '${lr.end_on}', ${lr.qualifying}, '${lr.decided_on}')`
    );
    sql.push(`INSERT INTO private.leave_records (id, personnel_id, status, start_on, end_on, qualifying, decided_on) VALUES\n  ${rows.join(',\n  ')}\nON CONFLICT (id) DO NOTHING;`);
  }
  sql.push('');

  // 5. Deployments
  sql.push('-- 5. Deployments');
  const depChunks = [];
  for (let i = 0; i < data.deployments.length; i += 200) {
    depChunks.push(data.deployments.slice(i, i + 200));
  }
  for (const chunk of depChunks) {
    const rows = chunk.map(
      (d) => `('${d.id}', '${d.personnel_id}', '${d.start_on}', ${d.end_on ? `'${d.end_on}'` : 'NULL'}, ${d.verified})`
    );
    sql.push(`INSERT INTO private.deployments (id, personnel_id, start_on, end_on, verified) VALUES\n  ${rows.join(',\n  ')}\nON CONFLICT (id) DO NOTHING;`);
  }
  sql.push('');

  // 6. Duty Records (batches of 1000)
  sql.push('-- 6. Duty Records (~65,000 daily shift records)');
  const dutyChunks = [];
  for (let i = 0; i < data.dutyRecords.length; i += 1000) {
    dutyChunks.push(data.dutyRecords.slice(i, i + 1000));
  }
  for (const chunk of dutyChunks) {
    const rows = chunk.map(
      (dr) => `('${dr.personnel_id}', '${dr.duty_date}', '${dr.shift_type}', ${dr.hours})`
    );
    sql.push(`INSERT INTO private.duty_records (personnel_id, duty_date, shift_type, hours) VALUES\n  ${rows.join(',\n  ')}\nON CONFLICT (personnel_id, duty_date) DO NOTHING;`);
  }
  sql.push('');

  // 7. Internal Unit Week Metrics
  sql.push('-- 7. Internal Unit Week Metrics');
  for (const m of data.unitWeekMetrics) {
    const cov = JSON.stringify(m.source_coverage_json);
    sql.push(
      `INSERT INTO private.unit_week_metrics (unit_id, week_start, eligible_n, source_coverage_json, leave_utilization, recovery_gap, denial_rate, night_shifts_average, deployment_days_average, weekly_hours_average, index_exact, baseline_exact, score_version, feature_mask) VALUES ('${m.unit_id}', '${m.week_start}', ${m.eligible_n}, '${cov}'::jsonb, ${m.leave_utilization}, ${m.recovery_gap}, ${m.denial_rate}, ${m.night_shifts_average}, ${m.deployment_days_average}, ${m.weekly_hours_average}, ${m.index_exact ?? 'NULL'}, ${m.baseline_exact ?? 'NULL'}, '${m.score_version}', '${m.feature_mask}') ON CONFLICT (unit_id, week_start, score_version, feature_mask) DO NOTHING;`
    );
  }
  sql.push('');

  // 8. Public Unit Week Releases
  sql.push('-- 8. Public Unit Week Releases (12 snapshots per unit; no personnel IDs)');
  for (const r of data.unitWeekReleases) {
    const approvedJson = JSON.stringify(r.approved_metrics_json);
    sql.push(
      `INSERT INTO public.unit_week_releases (unit_id, week_start, suppression_status, index_approx, baseline_approx, band, approved_metrics_json, noise_version) VALUES ('${r.unit_id}', '${r.week_start}', '${r.suppression_status}', ${r.index_approx ?? 'NULL'}, ${r.baseline_approx ?? 'NULL'}, '${r.band}', '${approvedJson}'::jsonb, '${r.noise_version}') ON CONFLICT (unit_id, week_start) DO NOTHING;`
    );
  }
  sql.push('');

  // 9. Public Welfare Reports
  sql.push('-- 9. Public Welfare Reports (Assigned to Welfare Officer)');
  for (const wr of data.welfareReports) {
    const snapJson = JSON.stringify(wr.aggregate_snapshot_json);
    const briefJson = JSON.stringify(wr.briefing_json);
    sql.push(
      `INSERT INTO public.welfare_reports (id, unit_id, week_start, assigned_to, trigger_rule, aggregate_snapshot_json, briefing_json, status) VALUES ('${wr.id}', '${wr.unit_id}', '${wr.week_start}', '${wr.assigned_to}', '${wr.trigger_rule}', '${snapJson}'::jsonb, '${briefJson}'::jsonb, '${wr.status}') ON CONFLICT (unit_id, week_start, trigger_rule) DO NOTHING;`
    );
  }
  sql.push('');

  return sql.join('\n');
}

// CLI Execution
export async function runSeedGenerator() {
  console.log('====================================================');
  console.log('Unit Pulse 2.0 — Synthetic Demo Seed Generator');
  console.log('====================================================\n');

  console.log('[1/4] Generating synthetic records according to specifications...');
  const data = generateSyntheticDataset();

  console.log(`  - Fictional Units:     ${data.units.length} units`);
  console.log(`  - Synthetic Personnel: ${data.personnel.length} individuals (60 per unit)`);
  console.log(`  - Duty Records:        ${data.dutyRecords.length} daily entries (~180 days)`);
  console.log(`  - Leave Records:       ${data.leaveRecords.length} leave requests/taken`);
  console.log(`  - Deployments:         ${data.deployments.length} assignment periods`);
  console.log(`  - Internal Metrics:    ${data.unitWeekMetrics.length} unit-week score snapshots`);
  console.log(`  - Public Releases:     ${data.unitWeekReleases.length} releases (12 completed weeks x 6 units)`);
  console.log(`  - Welfare Reports:     ${data.welfareReports.length} triggered confidential report(s)`);

  console.log('\n[2/4] Verifying synthetic dataset safety invariants...');
  // Invariant checks:
  const unitBReleases = data.unitWeekReleases.filter((r) => r.unit_id === 'UNIT-B');
  const unitAReleases = data.unitWeekReleases.filter((r) => r.unit_id === 'UNIT-A');
  const latestUnitB = unitBReleases[unitBReleases.length - 1];
  const latestUnitA = unitAReleases[unitAReleases.length - 1];

  console.log(`  - UNIT-B (Elevated): Index = ${latestUnitB.index_approx}, Band = ${latestUnitB.band}`);
  console.log(`  - UNIT-A (Stable):   Index = ${latestUnitA.index_approx}, Band = ${latestUnitA.band}`);

  if (latestUnitB.band !== 'high') {
    throw new Error('Safety check failed: UNIT-B is not elevated/high');
  }
  if (latestUnitA.band !== 'normal') {
    throw new Error('Safety check failed: UNIT-A is not stable/normal');
  }
  if (data.welfareReports.length !== 1) {
    throw new Error(`Safety check failed: Expected 1 active report, got ${data.welfareReports.length}`);
  }
  console.log('  ✅ Invariants verified: 1 elevated unit, 1 stable unit, 1 confidential report.');

  console.log('\n[3/4] Writing SQL statements to supabase/seed.sql...');
  const sqlContent = buildSqlSeed(data);
  fs.writeFileSync(seedSqlPath, sqlContent, 'utf8');
  console.log(`  ✅ Successfully written ${sqlContent.length.toLocaleString()} bytes to supabase/seed.sql`);

  console.log('\n[4/4] Seed generation complete.');
  console.log('  - SQL seed file ready for: npx supabase db reset / remote migration.');
  return data;
}

// Run directly if invoked from command line
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runSeedGenerator()
    .then(() => {
      console.log('\n[PASS] Synthetic seed generation succeeded.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[FAIL] Seed generation error:', err);
      process.exit(1);
    });
}
