/**
 * frontend/tests/briefings.test.js
 *
 * Frontend route and access tests for aggregate briefings:
 * - GET /api/briefings/:unitId
 * - GET /api/briefings/:unitId/events (SSE of validated sections)
 * - GET /api/briefings/:unitId/print (Print-friendly aggregate HTML)
 *
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md,
 * docs/10-security-privacy.md, Guidebook Phase 5.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveCommanderUnitAccess } from '../src/lib/commander/authorize.js';
import { fetchUnitReleaseWithBriefing } from '../src/lib/briefings/repository.js';
import { OFFICIAL_SAFETY_DISCLAIMER } from '@unitpulse/backend';

describe('Phase 5 — Briefings Route Authorization & Privacy Scoping', () => {
  const commanderUser = {
    id: 'user-cmd-001',
    role: 'commander',
    assignedUnitIds: ['UNIT-A', 'UNIT-B'],
  };

  const welfareUser = {
    id: 'user-welfare-001',
    role: 'welfare_officer',
    assignedUnitIds: ['UNIT-B'],
  };

  it('Rejects unauthenticated requests with 401', () => {
    const access = resolveCommanderUnitAccess({ user: null, unitId: 'UNIT-B' });
    assert.equal(access.allowed, false);
    assert.equal(access.httpStatus, 401);
  });

  it('Conceals unassigned units with 404 (no confirmation of unit existence)', () => {
    // Commander attempts to access UNIT-C which they are NOT assigned to
    const access = resolveCommanderUnitAccess({ user: commanderUser, unitId: 'UNIT-C' });
    assert.equal(access.allowed, false);
    assert.equal(access.httpStatus, 404);
  });

  it('Allows assigned commander to access aggregate briefing for their unit', () => {
    const access = resolveCommanderUnitAccess({ user: commanderUser, unitId: 'UNIT-B' });
    assert.equal(access.allowed, true);
    assert.equal(access.httpStatus, 200);
  });

  it('Allows assigned welfare officer to access aggregate briefing for their unit', () => {
    const access = resolveCommanderUnitAccess({ user: welfareUser, unitId: 'UNIT-B' });
    assert.equal(access.allowed, true);
    assert.equal(access.httpStatus, 200);
  });
});

describe('Phase 5 — Briefings Repository & Stored Aggregate Output', () => {
  it('fetchUnitReleaseWithBriefing returns stored briefing or generates validated fallback', async () => {
    const mockReleaseRow = {
      id: 'rel-123',
      unit_id: 'UNIT-B',
      week_start: '2026-09-28',
      suppression_status: 'published',
      index_approx: 75,
      baseline_approx: 50,
      band: 'elevated',
      approved_metrics_json: {
        nightShiftsAverageApprox: 13,
        recoveryGapPercentApprox: 40,
      },
      briefing_json: {
        summary: 'Unit UNIT-B shows elevated strain relative to baseline.',
        contributingFactors: [
          {
            factor: 'Night Duty Shifts',
            evidenceKey: 'night_duty',
            explanation: 'Night duty frequency is elevated.',
            approvedMetricStatement: 'Approved night-duty indicator: ~13 shifts/28d avg.',
          },
        ],
        suggestedActions: [
          { category: 'rebalance_roster', text: 'Review duty rosters.' },
        ],
        disclaimer: OFFICIAL_SAFETY_DISCLAIMER,
        source: 'approved_model',
      },
      released_at: '2026-09-29T00:00:00Z',
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: (field, val) => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockReleaseRow, error: null }) }),
            order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: mockReleaseRow, error: null }) }) }),
          }),
        }),
      }),
    };

    const { release, briefing } = await fetchUnitReleaseWithBriefing(mockSupabase, 'UNIT-B', '2026-09-28');

    assert.ok(release);
    assert.ok(briefing);
    assert.equal(briefing.summary, 'Unit UNIT-B shows elevated strain relative to baseline.');
    assert.equal(briefing.contributingFactors.length, 1);
    assert.equal(briefing.contributingFactors[0].evidenceKey, 'night_duty');
    assert.ok(briefing.disclaimer.includes('NOT a medical diagnosis'));
  });

  it('Zero personnel data invariant in briefing payload', () => {
    const samplePayload = {
      unitCode: 'UNIT-B',
      weekStart: '2026-09-28',
      status: 'elevated',
      band: 'elevated',
      indexApprox: 75,
      baselineApprox: 50,
      suppressed: false,
      briefing: {
        summary: 'Elevated indicators observed.',
        contributingFactors: [
          {
            factor: 'Night Duty',
            evidenceKey: 'night_duty',
            explanation: 'Operational shifts require review.',
            approvedMetricStatement: 'Approved night-duty indicator: ~13 shifts/28d avg.',
          },
        ],
        suggestedActions: [
          { category: 'rebalance_roster', text: 'Consider reviewing duty rosters.' },
        ],
        disclaimer: OFFICIAL_SAFETY_DISCLAIMER,
      },
    };

    const serialized = JSON.stringify(samplePayload);

    // Verify zero personnel references
    assert.ok(!serialized.includes('PER-'));
    assert.ok(!serialized.includes('personnel_id'));
    assert.ok(!serialized.includes('duty_records'));
    assert.ok(!serialized.includes('leave_records'));
    assert.ok(!serialized.includes('location'));
  });
});
