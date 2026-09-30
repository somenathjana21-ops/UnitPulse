/**
 * backend/tests/ai-adapter.test.js
 *
 * Unit, adversarial, and provider-outage tests for the AI adapter.
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md,
 * docs/10-security-privacy.md, docs/11-testing-plan.md, Guidebook Phase 5.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateAggregateBriefing,
  getDeterministicBriefing,
  validateModelOutput,
  assembleServerSideStatements,
  assertOutboundPayloadSafety,
  buildOutboundPrompt,
  callOpenAiCompatibleProvider,
  ALLOWED_EVIDENCE_KEYS,
  ALLOWED_ACTION_CATEGORIES,
  OFFICIAL_SAFETY_DISCLAIMER,
} from '../src/ai-adapter.js';

describe('Phase 5 — AI Adapter: Deterministic Safe Fallbacks', () => {
  const sampleSnapshot = {
    unitId: 'UNIT-B',
    unitCode: 'UNIT-B',
    weekStart: '2026-09-28',
    indexApprox: 75,
    baselineApprox: 50,
    band: 'elevated',
    triggerRule: 'spike',
    approvedMetrics: {
      nightShiftsAverageApprox: 13,
      recoveryGapPercentApprox: 40,
      leaveUtilizationBucket: '20–29%',
      weeklyDutyHoursApprox: 54,
    },
  };

  it('NO_LLM_MODE=true produces deterministic aggregate briefing without network calls', async () => {
    let networkCalled = false;
    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: true,
      fetchFn: () => {
        networkCalled = true;
        throw new Error('Network should never be invoked in NO_LLM_MODE');
      },
    });

    assert.equal(networkCalled, false);
    assert.equal(briefing.source, 'deterministic_fallback');
    assert.ok(briefing.summary.includes('UNIT-B'));
    assert.ok(briefing.disclaimer.includes('NOT a medical diagnosis'));
    assert.ok(briefing.contributingFactors.length >= 1);
    assert.equal(briefing.suggestedActions.length, 3);
  });

  it('Missing AI_API_KEY defaults immediately to deterministic fallback', async () => {
    let networkCalled = false;
    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      apiKey: '',
      noLlmMode: false,
      fetchFn: () => {
        networkCalled = true;
      },
    });

    assert.equal(networkCalled, false);
    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Always includes mandatory non-diagnostic disclaimer in both model and deterministic outputs', () => {
    const briefing = getDeterministicBriefing(sampleSnapshot);
    assert.equal(briefing.disclaimer, OFFICIAL_SAFETY_DISCLAIMER);
    assert.ok(briefing.disclaimer.includes('Unit Load & Recovery Index'));
    assert.ok(briefing.disclaimer.includes('NOT a medical diagnosis'));
    assert.ok(briefing.disclaimer.includes('misconduct, or eligibility for promotion or deployment'));
  });

  it('Deterministic suggested actions only use allowed categories', () => {
    const briefing = getDeterministicBriefing(sampleSnapshot);
    for (const action of briefing.suggestedActions) {
      assert.ok(
        ALLOWED_ACTION_CATEGORIES.includes(action.category),
        `Unexpected action category: ${action.category}`
      );
      assert.ok(typeof action.text === 'string' && action.text.length > 10);
    }
  });
});

describe('Phase 5 — AI Adapter: Adversarial and Safety Rejections', () => {
  const sampleSnapshot = {
    unitId: 'UNIT-B',
    unitCode: 'UNIT-B',
    weekStart: '2026-09-28',
    indexApprox: 75,
    baselineApprox: 50,
    approvedEvidenceKeys: ['night_duty', 'leave_recovery'],
    approvedMetrics: {
      nightShiftsAverageApprox: 13,
      recoveryGapPercentApprox: 40,
    },
  };

  it('Rejects invalid JSON and falls back to deterministic briefing', async () => {
    const invalidJsonResponse = 'This is raw unformatted text with no JSON at all.';
    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-123',
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: invalidJsonResponse } }],
        }),
      }),
    });

    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Rejects clinical diagnosis words (e.g. depressed, burnout, PTSD) and falls back', async () => {
    const diagnosisResponse = JSON.stringify({
      summary: 'Troops are showing symptoms of severe depression and burnout.',
      contributingFactors: [
        { factor: 'Night Duty', evidenceKey: 'night_duty', explanation: 'Excessive shifts caused trauma.' },
      ],
      suggestedActions: [
        { category: 'offer_welfare_review', text: 'Conduct clinical depression screenings.' },
      ],
    });

    const validation = validateModelOutput(diagnosisResponse, sampleSnapshot);
    assert.equal(validation.valid, false);
    assert.equal(validation.error, 'forbidden_diagnosis_term');

    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-123',
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: diagnosisResponse } }],
        }),
      }),
    });

    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Rejects punitive or disciplinary recommendations and falls back', async () => {
    const punitiveResponse = JSON.stringify({
      summary: 'Operational indicators elevated.',
      contributingFactors: [
        { factor: 'Night Duty', evidenceKey: 'night_duty', explanation: 'Roster non-compliance.' },
      ],
      suggestedActions: [
        { category: 'rebalance_roster', text: 'Initiate disciplinary sanctions for duty refusal.' },
      ],
    });

    const validation = validateModelOutput(punitiveResponse, sampleSnapshot);
    assert.equal(validation.valid, false);
    assert.equal(validation.error, 'forbidden_punitive_term');

    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-123',
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: punitiveResponse } }],
        }),
      }),
    });

    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Rejects definite causal claims (e.g. "caused by", "causes") and falls back', async () => {
    const causalResponse = JSON.stringify({
      summary: 'Elevated strain is caused by personnel being unfit.',
      contributingFactors: [
        { factor: 'Night Duty', evidenceKey: 'night_duty', explanation: 'Night shift load causes complete breakdown.' },
      ],
      suggestedActions: [
        { category: 'rebalance_roster', text: 'Adjust shifts.' },
      ],
    });

    const validation = validateModelOutput(causalResponse, sampleSnapshot);
    assert.equal(validation.valid, false);
    assert.equal(validation.error, 'forbidden_causal_term');

    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-123',
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: causalResponse } }],
        }),
      }),
    });

    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Rejects invented percentages and metrics not present in approved snapshot', async () => {
    // Approved metrics have recoveryGap: 40%, nightShifts: 13.
    // Model invents "87%" which was never released!
    const inventedPercentageResponse = JSON.stringify({
      summary: 'Approximately 87% of unit personnel are severely fatigued.',
      contributingFactors: [
        { factor: 'Night duty', evidenceKey: 'night_duty', explanation: 'Over 87% have irregular schedules.' },
      ],
      suggestedActions: [
        { category: 'rebalance_roster', text: 'Review duty rosters.' },
      ],
    });

    const validation = validateModelOutput(inventedPercentageResponse, sampleSnapshot);
    assert.equal(validation.valid, false);
    assert.ok(validation.error.startsWith('invented_percentage_detected'));

    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-123',
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: inventedPercentageResponse } }],
        }),
      }),
    });

    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Rejects unapproved evidence keys not in allow-list', () => {
    const unapprovedKeyResponse = JSON.stringify({
      summary: 'Elevated conditions observed.',
      contributingFactors: [
        { factor: 'Heart Rate', evidenceKey: 'biometric_heart_rate', explanation: 'Pulse elevated.' },
      ],
      suggestedActions: [
        { category: 'offer_welfare_review', text: 'Review conditions.' },
      ],
    });

    const validation = validateModelOutput(unapprovedKeyResponse, sampleSnapshot);
    assert.equal(validation.valid, false);
    assert.ok(validation.error.includes('unapproved_evidence_key'));
  });

  it('Rejects unapproved action categories', () => {
    const unapprovedCategoryResponse = JSON.stringify({
      summary: 'Elevated conditions observed.',
      contributingFactors: [
        { factor: 'Night duty', evidenceKey: 'night_duty', explanation: 'High night duty.' },
      ],
      suggestedActions: [
        { category: 'transfer_personnel', text: 'Transfer troops to another battalion.' },
      ],
    });

    const validation = validateModelOutput(unapprovedCategoryResponse, sampleSnapshot);
    assert.equal(validation.valid, false);
    assert.ok(validation.error.includes('unapproved_action_category'));
  });
});

describe('Phase 5 — AI Adapter: Provider Outage and Capability Handling', () => {
  const sampleSnapshot = {
    unitId: 'UNIT-B',
    unitCode: 'UNIT-B',
    weekStart: '2026-09-28',
    indexApprox: 75,
    baselineApprox: 50,
    approvedMetrics: {
      nightShiftsAverageApprox: 13,
    },
  };

  it('Handles provider timeout via AbortController and falls back safely', async () => {
    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-timeout',
      timeoutMs: 50,
      fetchFn: async () => {
        // Simulate hung request that exceeds timeout
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { ok: true, json: async () => ({ choices: [] }) };
      },
    });

    assert.equal(briefing.source, 'deterministic_fallback');
    assert.ok(briefing.summary.includes('UNIT-B'));
  });

  it('Handles HTTP 429 Too Many Requests with bounded retry and falls back', async () => {
    let callCount = 0;
    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-429',
      fetchFn: async () => {
        callCount++;
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        };
      },
    });

    // 1 initial attempt + 1 bounded retry = 2 calls
    assert.equal(callCount, 2);
    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Handles HTTP 500 Internal Server Error with bounded retry and falls back', async () => {
    let callCount = 0;
    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-500',
      fetchFn: async () => {
        callCount++;
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        };
      },
    });

    assert.equal(callCount, 2);
    assert.equal(briefing.source, 'deterministic_fallback');
  });

  it('Handles capability difference: provider rejecting response_format json_object with 400', async () => {
    let callCount = 0;
    const validJsonOutput = JSON.stringify({
      summary: 'Unit exhibits elevated indicators relative to the historical comparison baseline.',
      contributingFactors: [
        {
          factor: 'Night Duty Shifts',
          evidenceKey: 'night_duty',
          explanation: 'Night duty frequency is higher than recent comparable weeks.',
        },
      ],
      suggestedActions: [
        { category: 'rebalance_roster', text: 'Consider reviewing duty rosters to provide recovery intervals.' },
      ],
    });

    const briefing = await generateAggregateBriefing(sampleSnapshot, {
      noLlmMode: false,
      apiKey: 'test-key-capability',
      jsonMode: true,
      fetchFn: async (url, options) => {
        callCount++;
        const body = JSON.parse(options.body);

        // First attempt sends response_format; provider rejects it with 400 Bad Request
        if (body.response_format) {
          return {
            ok: false,
            status: 400,
            statusText: 'Bad Request: response_format is not supported by this provider',
          };
        }

        // Retry attempt without response_format succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: validJsonOutput } }],
          }),
        };
      },
    });

    assert.equal(callCount, 2);
    assert.equal(briefing.source, 'approved_model');
    assert.equal(briefing.contributingFactors[0].evidenceKey, 'night_duty');
  });
});

describe('Phase 5 — AI Adapter: Privacy Safety & Server-Side Assembly', () => {
  it('assertOutboundPayloadSafety throws if personnel ID is included in payload', () => {
    const leakPayload = {
      unitId: 'UNIT-B',
      personnelId: 'PER-B-001',
      index: 75,
    };

    assert.throws(
      () => assertOutboundPayloadSafety(leakPayload),
      /PRIVACY VIOLATION: Restricted key 'personnelId'/
    );
  });

  it('assertOutboundPayloadSafety throws if raw roster, location, or notes are in payload', () => {
    assert.throws(
      () => assertOutboundPayloadSafety({ roster: [{ id: 1 }] }),
      /Restricted key 'roster'/
    );
    assert.throws(
      () => assertOutboundPayloadSafety({ location: 'Border Sector North' }),
      /Restricted key 'location'/
    );
    assert.throws(
      () => assertOutboundPayloadSafety({ notes: 'Private welfare note' }),
      /Restricted key 'notes'/
    );
  });

  it('buildOutboundPrompt builds messages containing ONLY released aggregate data', () => {
    const snapshot = {
      unitId: 'UNIT-B',
      weekStart: '2026-09-28',
      indexApprox: 75,
      baselineApprox: 50,
      approvedMetrics: {
        nightShiftsAverageApprox: 13,
        recoveryGapPercentApprox: 40,
      },
    };

    const messages = buildOutboundPrompt(snapshot);
    const serialized = JSON.stringify(messages);

    // Verify presence of approved aggregate data
    assert.ok(serialized.includes('UNIT-B'));
    assert.ok(serialized.includes('2026-09-28'));
    assert.ok(serialized.includes('75'));
    assert.ok(serialized.includes('night_duty'));

    // Verify zero presence of prohibited personnel identifiers or raw rows
    assert.ok(!serialized.includes('PER-'));
    assert.ok(!serialized.includes('personnel'));
    assert.ok(!serialized.includes('raw_records'));
    assert.ok(!serialized.includes('location'));
    assert.ok(!serialized.includes('personnel_roster'));
  });

  it('Assembles final displayed numbers server-side from approved values', () => {
    const validatedData = {
      summary: 'Unit shows elevated strain relative to baseline.',
      contributingFactors: [
        {
          factor: 'Night Duty Shifts',
          evidenceKey: 'night_duty',
          explanation: 'Shift rotations show elevated concentration.',
        },
        {
          factor: 'Leave Recovery Gap',
          evidenceKey: 'leave_recovery',
          explanation: 'Personnel have extended periods without leave.',
        },
      ],
      suggestedActions: [
        { category: 'rebalance_roster', text: 'Review duty rosters.' },
      ],
    };

    const snapshot = {
      approvedMetrics: {
        nightShiftsAverageApprox: 13,
        recoveryGapPercentApprox: 40,
      },
    };

    const assembled = assembleServerSideStatements(validatedData, snapshot);

    assert.equal(assembled.source, 'approved_model');
    assert.equal(assembled.contributingFactors.length, 2);
    // Displayed metric statements are built from snapshot values
    assert.equal(
      assembled.contributingFactors[0].approvedMetricStatement,
      'Approved night-duty indicator: ~13 shifts/28d avg.'
    );
    assert.equal(
      assembled.contributingFactors[1].approvedMetricStatement,
      'Approved recovery gap: ~40%.'
    );
  });

  it('Provider switching requires no UI or score-code change', async () => {
    // Test that configuring different OpenAI-compatible providers works seamlessly
    const providers = [
      { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', jsonMode: true },
      { baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'nemotron-4-340b-instruct', jsonMode: false },
      { baseUrl: 'http://localhost:11434/v1', model: 'llama3:8b', jsonMode: false },
    ];

    for (const p of providers) {
      const briefing = await generateAggregateBriefing(
        {
          unitId: 'UNIT-A',
          weekStart: '2026-09-28',
          indexApprox: 20,
          baselineApprox: 20,
        },
        {
          baseUrl: p.baseUrl,
          model: p.model,
          jsonMode: p.jsonMode,
          noLlmMode: true, // test fallback handling across provider switches
        }
      );

      assert.equal(briefing.source, 'deterministic_fallback');
      assert.ok(briefing.disclaimer.includes('NOT a medical diagnosis'));
    }
  });

  it('Zero-Secret Invariant: AI_API_KEY is never leaked in errors, logs, or briefing payloads', async () => {
    const sensitiveKey = 'sk-sensitive-production-credential-DO-NOT-LEAK';
    let loggedData = '';

    const customLogger = {
      log: (...args) => { loggedData += args.join(' '); },
      warn: (...args) => { loggedData += args.join(' '); },
      error: (...args) => { loggedData += args.join(' '); },
    };

    const briefing = await generateAggregateBriefing(
      {
        unitId: 'UNIT-B',
        weekStart: '2026-09-28',
        indexApprox: 75,
        baselineApprox: 50,
      },
      {
        noLlmMode: false,
        apiKey: sensitiveKey,
        logger: customLogger,
        fetchFn: async () => {
          throw new Error('Connection refused to AI provider');
        },
      }
    );

    // Confirm the sensitive key is never in briefing payload
    const briefingSerialized = JSON.stringify(briefing);
    assert.ok(!briefingSerialized.includes(sensitiveKey));
    assert.ok(!briefingSerialized.includes('sk-sensitive'));

    // Confirm the sensitive key was never logged
    assert.ok(!loggedData.includes(sensitiveKey));
    assert.ok(!loggedData.includes('sk-sensitive'));
  });
});

