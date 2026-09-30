/**
 * frontend/src/lib/commander/view-model.js
 *
 * Pure transforms from a public.unit_week_releases row (or a short history
 * of them) into what the commander UI renders. No Supabase/Next.js
 * dependency -- fully unit-testable.
 *
 * Empty/error-state wording is taken verbatim from docs/04-user-flows.md
 * ("Empty and error states") so the UI never invents its own phrasing for
 * a suppressed or insufficient-data week.
 */

// docs/04-user-flows.md's Flow A describes band labels as "Normal, Review,
// or Elevated" -- a DIFFERENT vocabulary than the DB's stored band column
// ('normal'/'elevated'/'high'/'insufficient_data', see D-18). The
// thresholds are identical (40 / 70); only the mid and top labels differ.
// See decision log D-21. Never query or store using this display vocabulary.
const BAND_DISPLAY_LABELS = {
  normal: 'Normal',
  elevated: 'Review',
  high: 'Elevated',
  insufficient_data: 'Insufficient data',
};

const SUPPRESSION_MESSAGES = {
  suppressed_small_group: 'Insufficient group size to show this view.',
  insufficient_coverage: 'Not enough verified data for an index.',
  building_baseline: 'Collecting comparable weeks.',
};

export function mapBandToDisplayLabel(band) {
  return BAND_DISPLAY_LABELS[band] ?? 'Insufficient data';
}

/**
 * @param {Object|null} release A public.unit_week_releases row, or null if none exists yet.
 * @param {string} unitId
 * @returns {Object} View model for one unit card.
 */
export function buildUnitCardViewModel(unitId, release) {
  if (!release) {
    return {
      unitId,
      hasData: false,
      statusMessage: 'No completed weekly release yet for this unit.',
      band: null,
      bandLabel: null,
      indexApprox: null,
      baselineApprox: null,
      weekStart: null,
    };
  }

  const isWithheld = release.suppression_status === 'suppressed_small_group'
    || release.suppression_status === 'insufficient_coverage';

  return {
    unitId,
    hasData: true,
    weekStart: release.week_start,
    suppressionStatus: release.suppression_status,
    statusMessage: SUPPRESSION_MESSAGES[release.suppression_status] ?? null,
    band: isWithheld ? null : release.band,
    bandLabel: isWithheld ? null : mapBandToDisplayLabel(release.band),
    indexApprox: isWithheld ? null : release.index_approx,
    baselineApprox: isWithheld ? null : release.baseline_approx,
    isWithheld,
  };
}

/**
 * @param {Object[]} releaseHistory Chronological (oldest first) release rows for one unit.
 * @returns {{ points: Array<{weekStart: string, index: number|null, baseline: number|null}>, hasWithheldWeeks: boolean }}
 */
export function buildTrendSeriesViewModel(releaseHistory) {
  let hasWithheldWeeks = false;
  const points = releaseHistory.map((release) => {
    const withheld = release.suppression_status === 'suppressed_small_group'
      || release.suppression_status === 'insufficient_coverage';
    if (withheld) hasWithheldWeeks = true;
    return {
      weekStart: release.week_start,
      index: withheld ? null : release.index_approx,
      baseline: withheld ? null : release.baseline_approx,
    };
  });
  return { points, hasWithheldWeeks };
}

const EVIDENCE_LABELS = [
  { key: 'recoveryGapPercent', label: 'Recovery gap', unit: '%', evidenceKey: 'recovery_gap' },
  { key: 'meanNightShifts28d', label: 'Night duty (28d avg)', unit: ' shifts', evidenceKey: 'night_shifts' },
  { key: 'meanWeeklyDutyHours', label: 'Weekly workload', unit: ' hrs', evidenceKey: 'weekly_hours' },
  { key: 'leaveUtilizationPercent', label: 'Leave utilization', unit: '%', evidenceKey: 'leave_utilization' },
];

/**
 * Builds evidence cards strictly from the approved_metrics_json payload
 * already on the release row. Never reads any other field -- if a metric
 * was suppressed upstream, its key is simply absent here and no card is
 * shown for it.
 *
 * @param {Object|null} release
 * @returns {Array<{ evidenceKey: string, label: string, value: string }>}
 */
export function buildEvidenceCards(release) {
  const approved = release?.approved_metrics_json;
  if (!approved) return [];

  const cards = [];
  for (const { key, label, unit, evidenceKey } of EVIDENCE_LABELS) {
    const value = approved[key];
    if (value === null || value === undefined) continue;
    cards.push({ evidenceKey, label, value: `${value}${unit} (approx.)` });
  }
  return cards;
}

const ACTION_RULES = [
  {
    test: (m) => typeof m.recoveryGapPercent === 'number' && m.recoveryGapPercent > 35,
    category: 'plan_recovery',
    text: 'Recovery gap is above the policy threshold. Consider planning recovery periods for affected personnel, subject to operational cover.',
  },
  {
    test: (m) => typeof m.meanNightShifts28d === 'number' && m.meanNightShifts28d > 8,
    category: 'rebalance_roster',
    text: 'The unit has a higher night-duty indicator than typical. Consider reviewing roster distribution, subject to operational cover.',
  },
  {
    test: (m) => typeof m.meanWeeklyDutyHours === 'number' && m.meanWeeklyDutyHours > 52,
    category: 'review_leave_queue',
    text: 'Recorded weekly workload is elevated. Consider reviewing the leave queue for this unit.',
  },
];

/**
 * Deterministic, non-AI suggested actions (docs/07's fallback-template
 * style, offered ahead of the Phase 5 AI adapter). Uses only the exact
 * permitted action categories from docs/07-ml-specification.md and only
 * "consider"/"review" framing per docs/02-prd.md's product rules.
 *
 * @param {Object|null} release
 * @returns {Array<{ category: string, text: string }>}
 */
/**
 * Shapes the JSON response for GET /api/commander/units[/:unitId], matching
 * the example in docs/08-api-specification.md exactly (unitCode, weekStart,
 * status, indexApprox, baselineApprox, metrics, suppressed, approximate).
 * `status` intentionally uses the DB band vocabulary (docs/08's own
 * example), not the UI display label from mapBandToDisplayLabel().
 *
 * @param {string} unitId
 * @param {Object|null} release
 * @returns {Object}
 */
export function buildApiUnitPayload(unitId, release) {
  const card = buildUnitCardViewModel(unitId, release);
  const evidence = buildEvidenceCards(release);
  const metrics = {};
  for (const e of evidence) metrics[e.evidenceKey] = e.value;

  return {
    unitCode: unitId,
    weekStart: card.weekStart,
    status: card.band,
    indexApprox: card.indexApprox,
    baselineApprox: card.baselineApprox,
    metrics,
    suppressed: card.isWithheld,
    approximate: card.hasData && !card.isWithheld,
  };
}

export function buildSuggestedActions(release) {
  if (!release || release.suppression_status !== 'published') {
    return [{ category: 'verify_data', text: 'Not enough verified or published data for this unit this week.' }];
  }
  const approved = release.approved_metrics_json ?? {};
  const actions = ACTION_RULES.filter((rule) => rule.test(approved)).map(({ category, text }) => ({ category, text }));
  if (actions.length === 0) {
    return [{ category: 'offer_welfare_review', text: 'No elevated indicators this week. Routine check-ins remain a supportive option.' }];
  }
  return actions;
}
