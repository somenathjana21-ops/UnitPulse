/**
 * frontend/src/lib/briefings/repository.js
 *
 * Scoped data fetching and persistence for weekly aggregate briefings.
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md, docs/09-database-design.md
 *
 * NON-NEGOTIABLE PRIVACY RULES:
 * 1. Only reads from public.unit_week_releases.
 * 2. NEVER queries or exposes raw personnel rows or individual identifiers.
 * 3. Briefings ground strictly in privacy-checked aggregate metrics.
 */

import { generateAggregateBriefing, getDeterministicBriefing } from '@unitpulse/backend';

/**
 * Fetches the approved weekly release and stored aggregate briefing for an assigned unit.
 * If the release has no stored briefing yet, generates and stores a validated briefing.
 *
 * @param {Object} supabase Authenticated Supabase client
 * @param {string} unitId e.g. "UNIT-B"
 * @param {string|null} [weekStart=null] Optional completed week start (YYYY-MM-DD)
 * @returns {Promise<{ release: Object|null, briefing: Object|null }>}
 */
export async function fetchUnitReleaseWithBriefing(supabase, unitId, weekStart = null) {
  if (!supabase) return { release: null, briefing: null };

  let query = supabase
    .from('unit_week_releases')
    .select('id, unit_id, week_start, suppression_status, index_approx, baseline_approx, band, approved_metrics_json, briefing_json, released_at')
    .eq('unit_id', unitId);

  if (weekStart) {
    query = query.eq('week_start', weekStart);
  } else {
    query = query.order('week_start', { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return { release: null, briefing: null };
  }

  const release = data;
  let briefing = release.briefing_json;

  // If briefing is missing or empty, generate from aggregate snapshot and save
  if (!briefing || typeof briefing !== 'object' || !briefing.summary) {
    const snapshot = {
      unitId: release.unit_id,
      unitCode: release.unit_id,
      weekStart: release.week_start,
      indexApprox: release.index_approx,
      baselineApprox: release.baseline_approx,
      band: release.band,
      approvedMetrics: release.approved_metrics_json || {},
    };

    try {
      briefing = await generateAggregateBriefing(snapshot);
    } catch {
      briefing = getDeterministicBriefing(snapshot);
    }

    // Persist validated briefing to the release row
    try {
      await supabase
        .from('unit_week_releases')
        .update({ briefing_json: briefing })
        .eq('id', release.id);
    } catch {
      // In read-only sessions, return the generated briefing in-memory
    }
  }

  return { release, briefing };
}
