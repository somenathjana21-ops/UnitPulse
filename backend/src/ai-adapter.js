/**
 * backend/src/ai-adapter.js
 *
 * Server-only OpenAI-compatible provider adapter for aggregate unit briefings.
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md, docs/10-security-privacy.md
 *
 * CRITICAL SECURITY & PRIVACY INVARIANTS:
 * 1. SERVER-ONLY: AI_API_KEY is strictly server-only. Never expose to client or log.
 * 2. PRIVACY-PRESERVING: Model receives ONLY released aggregate snapshots and allowed evidence/action codes.
 *    NEVER send personnel IDs, names, raw duty/leave rows, exact locations, or typed welfare reasons.
 * 3. EXPLAINABILITY CONTRACT: Model explains approved aggregate observations and suggests bounded, supportive actions.
 *    Code computes index/baseline/trigger; model NEVER calculates scores.
 * 4. STRICT VALIDATION: Output must conform to schema, cite only allowed keys, contain no diagnoses,
 *    no punitive suggestions, no unsupported causal claims, and no invented metrics.
 * 5. SERVER-SIDE ASSEMBLY: Numerical statements are assembled server-side from approved release values.
 * 6. DETERMINISTIC SAFE FALLBACK: In NO_LLM_MODE or on any provider failure, timeout, 429, or rejection,
 *    produce deterministic approved explanations using the safety templates.
 */

export const ALLOWED_EVIDENCE_KEYS = [
  'leave_recovery',
  'night_duty',
  'continuous_deployment',
  'weekly_hours',
  'leave_utilization',
];

export const ALLOWED_ACTION_CATEGORIES = [
  'review_leave_queue',
  'rebalance_roster',
  'plan_recovery',
  'offer_welfare_review',
  'verify_data',
];

export const OFFICIAL_SAFETY_DISCLAIMER =
  'The Unit Load & Recovery Index is an operational welfare planning indicator. It is NOT a medical diagnosis and must never be used as evidence of individual psychological fitness, misconduct, or eligibility for promotion or deployment.';

// Forbidden terms: clinical diagnoses
const FORBIDDEN_DIAGNOSES = [
  /\bdepress(ed|ion|ive)?\b/i,
  /\bburnout\b/i,
  /\bmental(ly)?\s+(health\s+disorder|ill(ness)?|condition|breakdown|pathology)\b/i,
  /\bptsd\b/i,
  /\btrauma(tic)?\b/i,
  /\bpsychological\s+fitness\b/i,
  /\bdiagnos(is|ed|tic)\b/i,
  /\bpatholog(y|ical)\b/i,
  /\bpsychiatr(y|ic)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bclinical(ly)?\b/i,
  /\banxiety\s+disorder\b/i,
];

// Forbidden terms: punitive, coercive, or disciplinary suggestions
const FORBIDDEN_PUNITIVE_TERMS = [
  /\bpunish(ment|ed|ing|ive)?\b/i,
  /\bdiscipline\b/i,
  /\bdisciplin(ary|ed)\b/i,
  /\breprimand(ed|ing)?\b/i,
  /\bcourt\s+martial\b/i,
  /\bmisconduct\b/i,
  /\bsanction(s|ed|ing)?\b/i,
  /\bdemot(e|ed|ion)\b/i,
  /\bterminat(e|ed|ion)\b/i,
  /\binterrogat(e|ed|ion)\b/i,
  /\bpenalty\b/i,
  /\bpenaliz(e|ed|ing)\b/i,
  /\bcharge\s+with\b/i,
];

// Forbidden terms: definite causal claims
const FORBIDDEN_CAUSAL_TERMS = [
  /\bcaused\s+by\b/i,
  /\bcauses\b/i,
  /\bis\s+caused\s+by\b/i,
  /\bthe\s+cause\s+of\b/i,
  /\bdefinitely\s+due\s+to\b/i,
];

/**
 * Asserts that an outbound payload contains zero restricted, personal, or unreleased data.
 * Throws an error immediately if any privacy violation is found.
 *
 * @param {Object} payload
 * @throws {Error} If restricted data is detected
 */
export function assertOutboundPayloadSafety(payload) {
  if (!payload || typeof payload !== 'object') return;

  const forbiddenKeyPatterns = [
    /personnel/i,
    /roster/i,
    /location/i,
    /latitude/i,
    /longitude/i,
    /coordinate/i,
    /reason/i, // typed welfare reasons
    /encrypted/i,
    /notes/i,
    /grant/i,
    /audit/i,
    /raw/i,
    /_exact$/i, // exact unreleased metrics
  ];

  function inspect(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      for (const pattern of forbiddenKeyPatterns) {
        if (pattern.test(key)) {
          // Allow triggerReason if it's high-level string
          if (key === 'triggerReason' && typeof value === 'string' && !value.includes('PER-')) {
            continue;
          }
          throw new Error(
            `PRIVACY VIOLATION: Restricted key '${key}' detected in outbound provider payload at path '${currentPath}'`
          );
        }
      }

      if (typeof value === 'string') {
        // Detect personnel ID patterns e.g. PER-A-001 or standard UUIDs
        if (/\bPER-[A-Z0-9-]+\b/i.test(value)) {
          throw new Error(
            `PRIVACY VIOLATION: Personnel identifier detected in outbound payload value: '${value}'`
          );
        }
        // Detect exact location keywords
        if (/\b(latitude|longitude|coordinates|base\s+camp\s+\d+|grid\s+ref)\b/i.test(value)) {
          throw new Error(`PRIVACY VIOLATION: Location data detected in payload: '${value}'`);
        }
      } else if (typeof value === 'object' && value !== null) {
        inspect(value, currentPath);
      }
    }
  }

  inspect(payload);
}

/**
 * Assembles a standardized prompt using ONLY released aggregate data and allowed keys.
 *
 * @param {Object} snapshot
 * @returns {Array<{ role: string, content: string }>} OpenAI-compatible messages array
 */
export function buildOutboundPrompt(snapshot) {
  assertOutboundPayloadSafety(snapshot);

  const unitCode = snapshot.unitCode || snapshot.unitId || 'UNIT-ANONYMOUS';
  const weekStart = snapshot.weekStart || 'N/A';
  const indexApprox = snapshot.indexApprox ?? snapshot.index ?? 'N/A';
  const baselineApprox = snapshot.baselineApprox ?? snapshot.baseline ?? 'N/A';
  const band = snapshot.band || (indexApprox >= 70 ? 'high' : indexApprox >= 40 ? 'elevated' : 'normal');
  const triggerRule = snapshot.triggerRule || 'none';
  const approvedMetrics = snapshot.approvedMetrics || {};

  // Restrict evidence keys to those supported by the current released snapshot
  const availableEvidenceKeys = ALLOWED_EVIDENCE_KEYS.filter((key) => {
    if (key === 'night_duty' && (approvedMetrics.nightShiftsAverageApprox !== undefined || approvedMetrics.meanNightShifts28d !== undefined)) return true;
    if (key === 'leave_recovery' && (approvedMetrics.recoveryGapPercentApprox !== undefined || approvedMetrics.recoveryGapPercent !== undefined)) return true;
    if (key === 'weekly_hours' && (approvedMetrics.weeklyDutyHoursApprox !== undefined || approvedMetrics.meanWeeklyDutyHours !== undefined)) return true;
    if (key === 'leave_utilization' && (approvedMetrics.leaveUtilizationBucket !== undefined || approvedMetrics.leaveUtilizationPercent !== undefined)) return true;
    if (key === 'continuous_deployment' && (approvedMetrics.continuousDeploymentDaysApprox !== undefined || approvedMetrics.meanDeploymentDays !== undefined)) return true;
    return false;
  });

  const activeEvidenceKeys = availableEvidenceKeys.length > 0 ? availableEvidenceKeys : ['leave_recovery', 'night_duty'];

  const systemPrompt = `You are a server-side operational welfare planning assistant for uniformed service planners.
Your role is strictly to explain published, privacy-checked aggregate unit metrics and propose supportive, non-disciplinary operational adjustments.

NON-NEGOTIABLE SAFETY & PRIVACY RULES:
1. NEVER diagnose or infer medical, psychological, or clinical conditions.
2. NEVER use clinical terms such as 'depressed', 'depression', 'burnout', 'PTSD', 'trauma', 'mental health disorder', 'psychological fitness', or 'diagnosis'.
3. NEVER propose punitive, disciplinary, coercive, or administrative sanctions (no reprimands, punishment, demotion, or misconduct investigations).
4. NEVER assert definite causal claims (do NOT say 'caused by', 'causes', or 'because of'). Use probabilistic, supportive phrasing (e.g. 'may indicate', 'is elevated relative to the comparison period', 'consider reviewing').
5. ONLY cite evidence keys from this permitted list: ${JSON.stringify(activeEvidenceKeys)}. Do NOT invent metrics or cite absent indicators.
6. ONLY suggest actions from these permitted categories: ${JSON.stringify(ALLOWED_ACTION_CATEGORIES)}.
7. Do NOT include numbers or percentages in your explanations; all displayed numbers are assembled server-side from approved values.
8. Output MUST be valid JSON with this exact schema:
{
  "summary": "Brief aggregate operational observation (1-2 sentences)",
  "contributingFactors": [
    { "factor": "Factor Title", "evidenceKey": "<one of permitted keys>", "explanation": "Supportive operational explanation without numbers or clinical terms." }
  ],
  "suggestedActions": [
    { "category": "<one of permitted categories>", "text": "Supportive non-disciplinary operational recommendation." }
  ]
}`;

  const userPrompt = `Generate an operational aggregate briefing for:
Unit: ${unitCode}
Completed Week: ${weekStart}
Unit Load & Recovery Index (approx): ${indexApprox} / 100
Rolling Baseline (approx): ${baselineApprox} / 100
Status Band: ${band}
Trigger Rule: ${triggerRule}
Permitted Evidence Keys: ${activeEvidenceKeys.join(', ')}
Permitted Action Categories: ${ALLOWED_ACTION_CATEGORIES.join(', ')}

Return strictly valid JSON conforming to the schema.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Validates the raw text returned by the model.
 * Rejects invalid JSON, schema violations, forbidden diagnoses, punitive terms,
 * unsupported causal claims, unapproved evidence keys/action categories, and invented metrics.
 *
 * @param {string} rawText
 * @param {Object} snapshot
 * @returns {{ valid: boolean, error?: string, parsed?: Object }}
 */
export function validateModelOutput(rawText, snapshot = {}) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { valid: false, error: 'empty_response' };
  }

  // 1. Parse JSON safely, handling optional markdown code fences
  let cleanText = rawText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  } else {
    // If wrapped in surrounding prose, extract outermost JSON object
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      cleanText = cleanText.substring(startIdx, endIdx + 1);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    return { valid: false, error: 'invalid_json' };
  }

  // 2. Validate Schema Structure
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'root_must_be_object' };
  }

  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length < 5) {
    return { valid: false, error: 'invalid_summary' };
  }

  if (!Array.isArray(parsed.contributingFactors) || parsed.contributingFactors.length === 0) {
    return { valid: false, error: 'invalid_contributing_factors' };
  }

  if (!Array.isArray(parsed.suggestedActions) || parsed.suggestedActions.length === 0) {
    return { valid: false, error: 'invalid_suggested_actions' };
  }

  // 3. Scan for Forbidden Terms (Diagnoses, Punitive Actions, Definite Causal Claims)
  const allTextsToScan = [
    parsed.summary,
    ...parsed.contributingFactors.map((f) => `${f.factor || ''} ${f.explanation || ''}`),
    ...parsed.suggestedActions.map((a) => `${a.category || ''} ${a.text || ''}`),
  ].join(' ');

  for (const pattern of FORBIDDEN_DIAGNOSES) {
    if (pattern.test(allTextsToScan)) {
      return { valid: false, error: 'forbidden_diagnosis_term' };
    }
  }

  for (const pattern of FORBIDDEN_PUNITIVE_TERMS) {
    if (pattern.test(allTextsToScan)) {
      return { valid: false, error: 'forbidden_punitive_term' };
    }
  }

  for (const pattern of FORBIDDEN_CAUSAL_TERMS) {
    if (pattern.test(allTextsToScan)) {
      return { valid: false, error: 'forbidden_causal_term' };
    }
  }

  // 4. Validate Allowed Evidence Keys
  const allowedKeys = snapshot.approvedEvidenceKeys || ALLOWED_EVIDENCE_KEYS;
  for (const factor of parsed.contributingFactors) {
    if (!factor || typeof factor !== 'object') {
      return { valid: false, error: 'malformed_factor_item' };
    }
    if (!factor.evidenceKey || !allowedKeys.includes(factor.evidenceKey)) {
      return { valid: false, error: `unapproved_evidence_key: ${factor.evidenceKey}` };
    }
  }

  // 5. Validate Allowed Action Categories
  for (const action of parsed.suggestedActions) {
    if (!action || typeof action !== 'object') {
      return { valid: false, error: 'malformed_action_item' };
    }
    if (!action.category || !ALLOWED_ACTION_CATEGORIES.includes(action.category)) {
      return { valid: false, error: `unapproved_action_category: ${action.category}` };
    }
  }

  // 6. Invented Percentage / Metric Check:
  // Reject model text that includes fabricated percentages not present in approved metrics
  const approvedNumbers = [];
  const metrics = snapshot.approvedMetrics || {};
  for (const val of Object.values(metrics)) {
    if (typeof val === 'number') {
      approvedNumbers.push(val);
      approvedNumbers.push(Math.round(val));
    }
  }
  if (typeof snapshot.indexApprox === 'number') approvedNumbers.push(snapshot.indexApprox);
  if (typeof snapshot.baselineApprox === 'number') approvedNumbers.push(snapshot.baselineApprox);

  const percentageMatches = allTextsToScan.match(/\b(\d+(?:\.\d+)?)\s*%/g);
  if (percentageMatches) {
    for (const match of percentageMatches) {
      const num = parseFloat(match.replace('%', '').trim());
      // If the percentage does not closely match an approved released number, reject as invented metric
      const matchesApproved = approvedNumbers.some((app) => Math.abs(app - num) <= 1.0);
      if (!matchesApproved) {
        return { valid: false, error: `invented_percentage_detected: ${match}` };
      }
    }
  }

  return { valid: true, parsed };
}

/**
 * Builds server-side verified metric statements from released aggregate data.
 * Does not trust numerical phrasing written by the model.
 *
 * @param {string} evidenceKey
 * @param {Object} approvedMetrics
 * @returns {string} Server-verified statement
 */
export function buildApprovedMetricStatement(evidenceKey, approvedMetrics = {}) {
  switch (evidenceKey) {
    case 'night_duty': {
      const val = approvedMetrics.nightShiftsAverageApprox ?? approvedMetrics.meanNightShifts28d;
      return typeof val === 'number'
        ? `Approved night-duty indicator: ~${val} shifts/28d avg.`
        : 'Approved night-duty threshold monitored.';
    }
    case 'leave_recovery': {
      const val = approvedMetrics.recoveryGapPercentApprox ?? approvedMetrics.recoveryGapPercent;
      return typeof val === 'number'
        ? `Approved recovery gap: ~${val}%.`
        : 'Approved recovery gap threshold monitored.';
    }
    case 'leave_utilization': {
      const bucket = approvedMetrics.leaveUtilizationBucket;
      const pct = approvedMetrics.leaveUtilizationPercent;
      if (bucket) return `Approved leave utilization band: ${bucket}.`;
      if (typeof pct === 'number') return `Approved leave utilization: ~${pct}%.`;
      return 'Approved leave utilization band monitored.';
    }
    case 'weekly_hours': {
      const val = approvedMetrics.weeklyDutyHoursApprox ?? approvedMetrics.meanWeeklyDutyHours;
      return typeof val === 'number'
        ? `Approved weekly duty hours: ~${val} hrs/week avg.`
        : 'Approved duty hour threshold monitored.';
    }
    case 'continuous_deployment': {
      const val = approvedMetrics.continuousDeploymentDaysApprox ?? approvedMetrics.meanDeploymentDays;
      return typeof val === 'number'
        ? `Approved continuous deployment duration: ~${val} days avg.`
        : 'Approved deployment duration monitored.';
    }
    default:
      return 'Approved aggregate indicator verified from release.';
  }
}

/**
 * Assembles final displayed briefing server-side from approved values and validated model output.
 *
 * @param {Object} validatedData
 * @param {Object} snapshot
 * @returns {Object} Final briefing object
 */
export function assembleServerSideStatements(validatedData, snapshot) {
  const metrics = snapshot.approvedMetrics || {};

  const contributingFactors = validatedData.contributingFactors.map((f) => ({
    factor: f.factor || f.title || 'Operational Indicator',
    evidenceKey: f.evidenceKey,
    explanation: f.explanation || f.summary || 'Elevated indicator relative to comparison period.',
    approvedMetricStatement: buildApprovedMetricStatement(f.evidenceKey, metrics),
  }));

  const suggestedActions = validatedData.suggestedActions.slice(0, 3).map((a) => ({
    category: a.category,
    text: a.text,
  }));

  return {
    summary: validatedData.summary,
    contributingFactors,
    suggestedActions,
    disclaimer: OFFICIAL_SAFETY_DISCLAIMER,
    source: 'approved_model',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Pure deterministic briefing generator.
 * Produces 100% compliant, evidence-grounded aggregate explanations when NO_LLM_MODE is true
 * or whenever the external provider fails, times out, or produces unapproved text.
 *
 * @param {Object} snapshot
 * @returns {Object} Deterministic briefing object
 */
export function getDeterministicBriefing(snapshot = {}) {
  const unitId = snapshot.unitCode || snapshot.unitId || 'UNIT-ANONYMOUS';
  const weekStart = snapshot.weekStart || 'current week';
  const metrics = snapshot.approvedMetrics || {};
  const indexVal = snapshot.indexApprox ?? snapshot.index ?? 0;
  const baselineVal = snapshot.baselineApprox ?? snapshot.baseline ?? 0;

  // 1. Summary statement
  let summary = `Unit ${unitId} exhibits operational strain indicators within normal historical parameters for completed week ${weekStart}.`;
  if (snapshot.band === 'high' || indexVal >= 75) {
    summary = `Unit ${unitId} exhibits high occupational strain indicators for completed week ${weekStart}, requiring leadership attention and operational review.`;
  } else if (snapshot.band === 'elevated' || snapshot.triggerRule === 'spike' || indexVal >= 40) {
    summary = `Unit ${unitId} shows an elevated strain index relative to its historical comparison baseline for completed week ${weekStart}.`;
  }

  // 2. Contributing Factors from verified metrics
  const contributingFactors = [];

  const nightVal = metrics.nightShiftsAverageApprox ?? metrics.meanNightShifts28d;
  if (typeof nightVal === 'number' && nightVal > 8) {
    contributingFactors.push({
      factor: 'Night Duty Shifts',
      evidenceKey: 'night_duty',
      explanation: 'Night duty frequency is elevated relative to the standard operational threshold.',
      approvedMetricStatement: buildApprovedMetricStatement('night_duty', metrics),
    });
  }

  const gapVal = metrics.recoveryGapPercentApprox ?? metrics.recoveryGapPercent;
  if (typeof gapVal === 'number' && gapVal > 35) {
    contributingFactors.push({
      factor: 'Leave Recovery Gap',
      evidenceKey: 'leave_recovery',
      explanation: 'A higher proportion of personnel have exceeded the 60-day recovery window without qualifying leave.',
      approvedMetricStatement: buildApprovedMetricStatement('leave_recovery', metrics),
    });
  }

  const hoursVal = metrics.weeklyDutyHoursApprox ?? metrics.meanWeeklyDutyHours;
  if (typeof hoursVal === 'number' && hoursVal > 52) {
    contributingFactors.push({
      factor: 'Weekly Duty Hours',
      evidenceKey: 'weekly_hours',
      explanation: 'Average weekly duty hours are above the standard operational threshold.',
      approvedMetricStatement: buildApprovedMetricStatement('weekly_hours', metrics),
    });
  }

  const depVal = metrics.continuousDeploymentDaysApprox ?? metrics.meanDeploymentDays;
  if (typeof depVal === 'number' && depVal > 60) {
    contributingFactors.push({
      factor: 'Continuous Deployment',
      evidenceKey: 'continuous_deployment',
      explanation: 'Average continuous field deployment duration is elevated relative to recovery norms.',
      approvedMetricStatement: buildApprovedMetricStatement('continuous_deployment', metrics),
    });
  }

  if (metrics.leaveUtilizationBucket || (typeof metrics.leaveUtilizationPercent === 'number' && metrics.leaveUtilizationPercent < 25)) {
    contributingFactors.push({
      factor: 'Leave Utilization',
      evidenceKey: 'leave_utilization',
      explanation: 'Scheduled leave utilization is low across the current observation window.',
      approvedMetricStatement: buildApprovedMetricStatement('leave_utilization', metrics),
    });
  }

  // Fallback factor if none specifically breached thresholds
  if (contributingFactors.length === 0) {
    contributingFactors.push({
      factor: 'Unit Load & Recovery Index',
      evidenceKey: 'leave_recovery',
      explanation: 'Composite indicator reflects combined operational leave, duty, and recovery indicators.',
      approvedMetricStatement: `Approved index: ~${indexVal}, baseline: ~${baselineVal}.`,
    });
  }

  // 3. Three supportive actions from permitted categories
  const suggestedActions = [
    {
      category: 'offer_welfare_review',
      text: 'Coordinate with Unit Welfare Officer for supportive check-ins and personnel welfare assessments.',
    },
    {
      category: 'review_leave_queue',
      text: 'Prioritize pending leave requests for personnel with extended recovery intervals (>60 days since leave).',
    },
    {
      category: 'rebalance_roster',
      text: 'Review duty rosters and shift rotations to ensure sufficient rest periods between operational duties.',
    },
  ];

  return {
    summary,
    contributingFactors,
    suggestedActions,
    disclaimer: OFFICIAL_SAFETY_DISCLAIMER,
    source: 'deterministic_fallback',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Executes a network call to an OpenAI-compatible provider with capability handling,
 * timeouts, and at most one bounded retry.
 *
 * NEVER logs API keys or restricted payloads.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @param {Object} [options={}]
 * @returns {Promise<string>} Model response text
 */
export async function callOpenAiCompatibleProvider(messages, options = {}) {
  const baseUrl = (options.baseUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = options.apiKey || process.env.AI_API_KEY || '';
  const model = options.model || process.env.AI_MODEL || 'gpt-4o-mini';
  const timeoutMs = options.timeoutMs ?? parseInt(process.env.AI_TIMEOUT_MS || '12000', 10);
  const fetchFn = options.fetchFn || globalThis.fetch;
  const logger = options.logger || console;

  let jsonMode =
    options.jsonMode ??
    (process.env.AI_JSON_MODE === 'true' || process.env.AI_JSON_MODE === 'json_object');

  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const makeAttempt = async (withJsonMode) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const bodyPayload = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 800,
    };

    if (withJsonMode) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  let response;
  try {
    response = await makeAttempt(jsonMode);

    // Capability difference: if provider returns 400 Bad Request when response_format was used,
    // retry once without response_format
    if (!response.ok && response.status === 400 && jsonMode) {
      logger.log?.('[AI Adapter] Provider rejected response_format: json_object. Retrying without response_format.');
      response = await makeAttempt(false);
    }

    // Transient failure (429 or 5xx): perform at most 1 bounded retry
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      logger.log?.(`[AI Adapter] Transient error ${response.status}. Attempting bounded retry (1 of 1)...`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      response = await makeAttempt(false);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`AI provider request timed out after ${timeoutMs}ms`);
    }
    // Attempt bounded retry once on transient network error
    logger.log?.('[AI Adapter] Network error encountered. Attempting bounded retry (1 of 1)...');
    try {
      response = await makeAttempt(false);
    } catch (retryErr) {
      if (retryErr.name === 'AbortError') {
        throw new Error(`AI provider retry timed out after ${timeoutMs}ms`);
      }
      throw retryErr;
    }
  }

  if (!response.ok) {
    throw new Error(`AI provider HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('AI provider returned unexpected response structure (missing choices[0].message.content)');
  }

  return content;
}

/**
 * Main entry point: Generates a validated aggregate briefing.
 * In NO_LLM_MODE or on any provider failure, times out, invalid JSON, or safety rejection,
 * seamlessly produces deterministic approved explanations.
 *
 * @param {Object} snapshot Aggregate unit snapshot
 * @param {Object} [options={}]
 * @returns {Promise<Object>} Validated briefing JSON
 */
export async function generateAggregateBriefing(snapshot, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.AI_API_KEY;
  const isNoLlm =
    options.noLlmMode === true ||
    process.env.NO_LLM_MODE === 'true' ||
    !apiKey ||
    typeof apiKey !== 'string' ||
    apiKey.trim() === '';

  // 1. Immediately return deterministic briefing if in NO_LLM_MODE or AI_API_KEY is unset
  if (isNoLlm) {
    return getDeterministicBriefing(snapshot);
  }

  // 2. Outbound privacy check
  try {
    assertOutboundPayloadSafety(snapshot);
  } catch (safetyErr) {
    options.logger?.error?.(`[AI Adapter] Safety invariant failed: ${safetyErr.message}`);
    return getDeterministicBriefing(snapshot);
  }

  // 3. Build outbound prompt
  const messages = buildOutboundPrompt(snapshot);

  // 4. Call provider with bounded retry and timeout
  try {
    const rawText = await callOpenAiCompatibleProvider(messages, options);

    // 5. Validate model structured output
    const validation = validateModelOutput(rawText, snapshot);
    if (!validation.valid) {
      options.logger?.warn?.(
        `[AI Adapter] Model output rejected (${validation.error}). Falling back to deterministic briefing.`
      );
      return getDeterministicBriefing(snapshot);
    }

    // 6. Assemble final numbers server-side from approved release values
    return assembleServerSideStatements(validation.parsed, snapshot);
  } catch (providerErr) {
    options.logger?.warn?.(
      `[AI Adapter] Provider call failed (${providerErr.message}). Falling back to deterministic briefing.`
    );
    return getDeterministicBriefing(snapshot);
  }
}
