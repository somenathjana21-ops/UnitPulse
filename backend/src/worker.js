/**
 * backend/src/worker.js
 *
 * Protected, idempotent completed-week worker.
 * Specifications: docs/03-srs.md, docs/07-ml-specification.md,
 * docs/08-api-specification.md, docs/09-database-design.md, docs/11-testing-plan.md.
 *
 * Rules:
 * - Deterministic trigger evaluation:
 *   - Spike rule: (current >= 40 and current >= baseline + 15 with >= 4 earlier comparable weeks)
 *   - Sustained-high rule: (current >= 75 for two consecutive completed weeks)
 * - Idempotency: re-running for the same completed week never creates duplicate releases
 *   or duplicate active welfare reports.
 * - Concurrency & Retries: enforced via database constraints:
 *   - uq_unit_week_releases on (unit_id, week_start)
 *   - uq_welfare_report_retry on (unit_id, week_start, trigger_rule)
 *   - idx_welfare_reports_active_per_unit on (unit_id) WHERE (status not in ('closed'))
 * - Server-only authorization: verify CRON_SECRET before invoking.
 */

import { runWeeklyRelease, DEFAULT_RELEASE_EPSILON } from './release.js';
import { buildAggregateSnapshot, buildWelfareBriefing } from './welfare.js';
import { calculateBaseline, evaluateTriggers } from '@unitpulse/ml';

/**
 * Verifies the incoming Authorization header against the server-configured CRON_SECRET.
 *
 * @param {string|null|undefined} authHeader e.g. "Bearer <secret>"
 * @param {string|undefined} [cronSecret=process.env.CRON_SECRET]
 * @returns {boolean}
 */
export function verifyCronAuthorization(authHeader, cronSecret = process.env.CRON_SECRET) {
  if (!cronSecret || typeof cronSecret !== 'string' || cronSecret.trim().length === 0) {
    return false;
  }
  if (!authHeader || typeof authHeader !== 'string') {
    return false;
  }

  const cleanSecret = cronSecret.trim();
  const trimmedHeader = authHeader.trim();

  // Accept "Bearer <secret>" or direct secret match
  if (trimmedHeader === `Bearer ${cleanSecret}` || trimmedHeader === cleanSecret) {
    return true;
  }

  return false;
}

/**
 * Computes the Monday (YYYY-MM-DD) of the most recently completed week.
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} ISO Date string YYYY-MM-DD
 */
export function getLatestCompletedWeekStart(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  // Get day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const day = d.getUTCDay();
  // Most recent completed Monday:
  // If today is Monday (1), last completed Monday was 7 days ago.
  // If today is Sunday (0), last completed Monday was 6 days ago.
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const daysToSubtract = daysSinceMonday + 7;

  d.setUTCDate(d.getUTCDate() - daysToSubtract);
  return d.toISOString().split('T')[0];
}

/**
 * Pure processing function for a single unit's completed week.
 * Deterministic and unit-testable without a live database.
 *
 * @param {Object} params
 * @param {string} params.unitId
 * @param {string} params.weekStart Completed week Monday
 * @param {Object} params.sourceData Raw domain records
 * @param {Array} [params.priorWeeksHistory=[]] Prior weeks [{ index, scoreVersion, featureMask }]
 * @param {number|null} [params.previousWeekIndex=null] Immediately preceding week index
 * @param {boolean} [params.hasActiveReport=false] Whether an open report exists for unit
 * @param {string|null} [params.assignedOfficerId=null] Assigned welfare officer user ID
 * @param {Object|null} [params.existingRelease=null] Previously persisted release if any
 * @param {number} [params.epsilon=0.2]
 * @returns {Object} { privateMetrics, publicRelease, triggerResult, welfareReport: Object|null, reused: boolean }
 */
export function processUnitWeek({
  unitId,
  weekStart,
  sourceData,
  priorWeeksHistory = [],
  previousWeekIndex = null,
  hasActiveReport = false,
  assignedOfficerId = null,
  existingRelease = null,
  epsilon = DEFAULT_RELEASE_EPSILON,
}) {
  const releaseResult = runWeeklyRelease({
    unitId,
    weekStart,
    sourceData,
    priorWeeksHistory,
    previousWeekIndex,
    hasActiveReport,
    existingRelease,
    epsilon,
  });

  const { privateMetrics, publicRelease, triggerResult, reused } = releaseResult;

  let activeTriggerResult = triggerResult;

  if (!activeTriggerResult && (existingRelease || publicRelease)) {
    const idx = existingRelease?.index_approx ?? publicRelease?.index_approx;
    if (typeof idx === 'number') {
      const baselineResult = calculateBaseline(priorWeeksHistory);
      activeTriggerResult = evaluateTriggers({
        currentIndex: idx,
        baselineIndex: baselineResult.baselineIndex,
        comparableWeeksCount: baselineResult.comparableWeeksCount,
        previousWeekIndex,
        hasActiveReport,
      });
    }
  }

  let welfareReport = null;

  if (activeTriggerResult && activeTriggerResult.triggered) {
    if (activeTriggerResult.shouldCreateReport) {
      const primaryRule = activeTriggerResult.activeRules[0]?.rule || 'spike';
      const aggregateSnapshot = buildAggregateSnapshot({
        unitId,
        weekStart,
        index: privateMetrics?.index_exact ?? publicRelease?.index_approx ?? existingRelease?.index_approx,
        baseline: privateMetrics?.baseline_exact ?? publicRelease?.baseline_approx ?? existingRelease?.baseline_approx,
        comparableWeeksCount: priorWeeksHistory.length,
        triggerRule: primaryRule,
        triggerReason: activeTriggerResult.evaluationSummary,
        activeRules: activeTriggerResult.activeRules,
        approvedMetrics: publicRelease?.approved_metrics_json ?? existingRelease?.approved_metrics_json ?? {},
      });

      const briefing = buildWelfareBriefing({
        unitId,
        weekStart,
      });

      welfareReport = {
        unit_id: unitId,
        week_start: weekStart,
        assigned_to: assignedOfficerId,
        trigger_rule: primaryRule,
        aggregate_snapshot_json: aggregateSnapshot,
        briefing_json: briefing,
        status: 'new',
      };
    }
  }

  return {
    unitId,
    weekStart,
    privateMetrics,
    publicRelease,
    triggerResult: activeTriggerResult,
    welfareReport,
    reused,
  };
}

/**
 * Runs the weekly completed-week worker across units.
 * Idempotent, handles concurrency and retries using database constraints.
 *
 * @param {Object} params
 * @param {string} [params.weekStart] Target completed week (defaults to latest completed Monday)
 * @param {string[]} [params.unitIds] Optional list of units to process (defaults to active units)
 * @param {Object} [params.supabase] Supabase client
 * @param {boolean} [params.force=false]
 * @param {number} [params.epsilon=0.2]
 * @param {Object} [params.logger=console]
 * @returns {Promise<Object>} Job summary
 */
export async function runWeeklyWorker({
  weekStart,
  unitIds = null,
  supabase = null,
  force = false,
  epsilon = DEFAULT_RELEASE_EPSILON,
  logger = console,
} = {}) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const targetWeek = weekStart || getLatestCompletedWeekStart();

  logger.log?.(`[WORKER ${jobId}] Starting completed-week worker for week ${targetWeek}`);

  const summary = {
    jobId,
    weekStart: targetWeek,
    unitsProcessed: 0,
    releasesCreated: 0,
    releasesReused: 0,
    reportsCreated: 0,
    reportsDeduplicated: 0,
    errors: [],
    status: 'in_progress',
  };

  if (!supabase) {
    logger.warn?.(`[WORKER ${jobId}] No Supabase client provided; returning initial state`);
    summary.status = 'no_client';
    return summary;
  }

  try {
    // 1. Determine target units
    let targetUnitList = unitIds;
    if (!targetUnitList || targetUnitList.length === 0) {
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id')
        .eq('active', true);

      if (unitsError) {
        // In case private.units is called through schema or public view
        logger.warn?.(`[WORKER ${jobId}] Error querying units: ${unitsError.message}`);
      }
      targetUnitList = (unitsData || []).map((u) => u.id);
    }

    if (targetUnitList.length === 0) {
      // Default fictional units fallback if units table query empty or unconfigured
      targetUnitList = ['UNIT-A', 'UNIT-B', 'UNIT-C', 'UNIT-D', 'UNIT-E', 'UNIT-F'];
    }

    // 2. Process each unit
    for (const unitId of targetUnitList) {
      try {
        summary.unitsProcessed++;

        // A. Check for existing release (Idempotency)
        let existingRelease = null;
        if (!force) {
          const { data: relData } = await supabase
            .from('unit_week_releases')
            .select('*')
            .eq('unit_id', unitId)
            .eq('week_start', targetWeek)
            .maybeSingle();

          if (relData) {
            existingRelease = relData;
            summary.releasesReused++;
          }
        }

        // B. Check for active welfare report (status not closed)
        const { data: activeReportData } = await supabase
          .from('welfare_reports')
          .select('id, status')
          .eq('unit_id', unitId)
          .neq('status', 'closed')
          .maybeSingle();

        const hasActiveReport = Boolean(activeReportData);

        // C. Fetch historical metrics for baseline comparison
        const { data: historyData } = await supabase
          .from('unit_week_metrics')
          .select('week_start, index_exact, score_version, feature_mask')
          .eq('unit_id', unitId)
          .lt('week_start', targetWeek)
          .order('week_start', { ascending: true });

        const priorWeeksHistory = (historyData || []).map((h) => ({
          weekStart: h.week_start,
          index: h.index_exact,
          scoreVersion: h.score_version,
          featureMask: h.feature_mask,
        }));

        const previousWeekIndex =
          priorWeeksHistory.length > 0
            ? priorWeeksHistory[priorWeeksHistory.length - 1].index
            : null;

        // D. Fetch assigned welfare officer for unit
        let assignedOfficerId = null;
        const { data: assignments } = await supabase
          .from('unit_assignments')
          .select('user_id')
          .eq('unit_id', unitId);

        if (assignments && assignments.length > 0) {
          const userIds = assignments.map((a) => a.user_id);
          const { data: officerRole } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('user_id', userIds)
            .eq('role', 'welfare_officer')
            .maybeSingle();

          if (officerRole) {
            assignedOfficerId = officerRole.user_id;
          }
        }

        if (!assignedOfficerId) {
          // Fallback: any welfare officer in user_roles
          const { data: anyOfficer } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'welfare_officer')
            .maybeSingle();
          assignedOfficerId = anyOfficer?.user_id ?? null;
        }

        // E. Fetch source records for unit (if computing fresh release)
        let sourceData = {
          personnel: [],
          leaveEligibility: [],
          leaveRecords: [],
          dutyRecords: [],
          deployments: [],
        };

        if (!existingRelease) {
          const [persRes, eligRes, leaveRes, dutyRes, depRes] = await Promise.all([
            supabase.from('personnel').select('*').eq('unit_id', unitId).eq('active', true),
            supabase.from('leave_eligibility').select('*').eq('snapshot_week', targetWeek),
            supabase.from('leave_records').select('*'),
            supabase.from('duty_records').select('*'),
            supabase.from('deployments').select('*'),
          ]);

          sourceData = {
            personnel: persRes.data || [],
            leaveEligibility: eligRes.data || [],
            leaveRecords: leaveRes.data || [],
            dutyRecords: dutyRes.data || [],
            deployments: depRes.data || [],
          };
        }

        // F. Run unit week processing
        const result = processUnitWeek({
          unitId,
          weekStart: targetWeek,
          sourceData,
          priorWeeksHistory,
          previousWeekIndex,
          hasActiveReport,
          assignedOfficerId,
          existingRelease,
          epsilon,
        });

        // G. Persist private metrics and public release if newly computed
        if (!existingRelease && result.publicRelease) {
          if (result.privateMetrics) {
            await supabase
              .from('unit_week_metrics')
              .upsert(result.privateMetrics, {
                onConflict: 'unit_id,week_start,score_version,feature_mask',
              });
          }

          const { error: relInsertError } = await supabase
            .from('unit_week_releases')
            .upsert(result.publicRelease, { onConflict: 'unit_id,week_start' });

          if (!relInsertError) {
            summary.releasesCreated++;
          }
        }

        // H. Persist welfare report if triggered and eligible
        if (result.welfareReport && assignedOfficerId) {
          // Attempt insert relying on database constraints for concurrency/idempotency
          const { error: reportError } = await supabase
            .from('welfare_reports')
            .insert(result.welfareReport);

          if (reportError) {
            // Postgres error code 23505 indicates unique constraint / partial index collision
            if (reportError.code === '23505' || reportError.message?.includes('duplicate key')) {
              logger.log?.(`[WORKER ${jobId}] Deduplicated welfare report for unit ${unitId}: active report or retry exists`);
              summary.reportsDeduplicated++;
            } else {
              logger.error?.(`[WORKER ${jobId}] Error inserting welfare report for unit ${unitId}:`, reportError.message);
              summary.errors.push({ unitId, error: reportError.message });
            }
          } else {
            logger.log?.(`[WORKER ${jobId}] Created confidential welfare report for unit ${unitId} (assigned to ${assignedOfficerId})`);
            summary.reportsCreated++;
          }
        } else if (result.triggerResult?.isDeduplicated) {
          summary.reportsDeduplicated++;
        }
      } catch (unitErr) {
        logger.error?.(`[WORKER ${jobId}] Failed processing unit ${unitId}:`, unitErr.message);
        summary.errors.push({ unitId, error: unitErr.message });
      }
    }

    summary.status = summary.errors.length === 0 ? 'completed' : 'completed_with_errors';
  } catch (err) {
    logger.error?.(`[WORKER ${jobId}] Worker fatal error:`, err.message);
    summary.status = 'failed';
    summary.errors.push({ global: err.message });
  }

  logger.log?.(`[WORKER ${jobId}] Finished. Processed: ${summary.unitsProcessed}, Releases created: ${summary.releasesCreated}, Releases reused: ${summary.releasesReused}, Reports created: ${summary.reportsCreated}, Reports deduplicated: ${summary.reportsDeduplicated}`);
  return summary;
}
