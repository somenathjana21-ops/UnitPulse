import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicReleasePayload } from '@unitpulse/backend';
import {
  mapBandToDisplayLabel,
  buildUnitCardViewModel,
  buildTrendSeriesViewModel,
  buildEvidenceCards,
  buildSuggestedActions,
  buildApiUnitPayload,
} from '../src/lib/commander/view-model.js';

test('mapBandToDisplayLabel follows docs/04\'s UI vocabulary, not the DB vocabulary', () => {
  assert.equal(mapBandToDisplayLabel('normal'), 'Normal');
  assert.equal(mapBandToDisplayLabel('elevated'), 'Review');
  assert.equal(mapBandToDisplayLabel('high'), 'Elevated');
  assert.equal(mapBandToDisplayLabel('insufficient_data'), 'Insufficient data');
});

test('buildUnitCardViewModel: no release yet', () => {
  const vm = buildUnitCardViewModel('UNIT-Z', null);
  assert.equal(vm.hasData, false);
  assert.equal(vm.indexApprox, null);
});

test('buildUnitCardViewModel: suppressed small group shows no figures, only the docs/04 message', () => {
  const vm = buildUnitCardViewModel('UNIT-Z', {
    week_start: '2026-09-07',
    suppression_status: 'suppressed_small_group',
    index_approx: null,
    baseline_approx: null,
    band: null,
    approved_metrics_json: {},
  });
  assert.equal(vm.isWithheld, true);
  assert.equal(vm.statusMessage, 'Insufficient group size to show this view.');
  assert.equal(vm.indexApprox, null);
  assert.equal(vm.band, null);
});

test('buildUnitCardViewModel: insufficient coverage shows "not enough verified data", never a zero', () => {
  const vm = buildUnitCardViewModel('UNIT-Z', {
    week_start: '2026-09-07',
    suppression_status: 'insufficient_coverage',
    index_approx: null,
    baseline_approx: null,
    band: 'insufficient_data',
    approved_metrics_json: {},
  });
  assert.equal(vm.statusMessage, 'Not enough verified data for an index.');
  assert.notEqual(vm.indexApprox, 0);
  assert.equal(vm.indexApprox, null);
});

test('buildUnitCardViewModel: published week shows the index and mapped band label', () => {
  const vm = buildUnitCardViewModel('UNIT-B', {
    week_start: '2026-09-07',
    suppression_status: 'published',
    index_approx: 82,
    baseline_approx: 60,
    band: 'high',
    approved_metrics_json: { recoveryGapPercent: 50 },
  });
  assert.equal(vm.isWithheld, false);
  assert.equal(vm.indexApprox, 82);
  assert.equal(vm.bandLabel, 'Elevated'); // DB 'high' -> UI 'Elevated'
});

test('buildTrendSeriesViewModel nulls out withheld weeks but keeps the week present in the series', () => {
  const history = [
    { week_start: '2026-08-24', suppression_status: 'published', index_approx: 30, baseline_approx: 20 },
    { week_start: '2026-08-31', suppression_status: 'suppressed_small_group', index_approx: null, baseline_approx: null },
    { week_start: '2026-09-07', suppression_status: 'published', index_approx: 45, baseline_approx: 25 },
  ];
  const { points, hasWithheldWeeks } = buildTrendSeriesViewModel(history);
  assert.equal(points.length, 3);
  assert.equal(points[1].index, null);
  assert.equal(hasWithheldWeeks, true);
});

test('buildEvidenceCards only surfaces fields actually present in approved_metrics_json', () => {
  const cards = buildEvidenceCards({
    approved_metrics_json: { recoveryGapPercent: 40, meanNightShifts28d: 13 },
  });
  const keys = cards.map((c) => c.evidenceKey);
  assert.ok(keys.includes('recovery_gap'));
  assert.ok(keys.includes('night_shifts'));
  assert.equal(keys.includes('weekly_hours'), false); // never fabricated for a missing/suppressed field
});

test('buildEvidenceCards returns nothing for a suppressed release', () => {
  assert.deepEqual(buildEvidenceCards({ approved_metrics_json: {} }), []);
  assert.deepEqual(buildEvidenceCards(null), []);
});

test('buildSuggestedActions uses only permitted categories and "consider/review" framing', () => {
  const actions = buildSuggestedActions({
    suppression_status: 'published',
    approved_metrics_json: { recoveryGapPercent: 50, meanNightShifts28d: 13 },
  });
  const categories = actions.map((a) => a.category);
  assert.ok(categories.includes('plan_recovery'));
  assert.ok(categories.includes('rebalance_roster'));
  for (const a of actions) {
    assert.ok(/consider|review/i.test(a.text));
    assert.doesNotMatch(a.text, /diagnos|stress|depress/i);
  }
});

test('buildSuggestedActions falls back to verify_data for a non-published release', () => {
  const actions = buildSuggestedActions({ suppression_status: 'insufficient_coverage', approved_metrics_json: {} });
  assert.equal(actions[0].category, 'verify_data');
});

test('buildApiUnitPayload matches the docs/08 response shape and passes the privacy field validator', () => {
  const payload = buildApiUnitPayload('UNIT-B', {
    week_start: '2026-08-03',
    suppression_status: 'published',
    index_approx: 75,
    baseline_approx: 50,
    band: 'high',
    approved_metrics_json: { recoveryGapPercent: 40, meanNightShifts28d: 13 },
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'approximate', 'baselineApprox', 'indexApprox', 'metrics', 'status', 'suppressed', 'unitCode', 'weekStart',
  ].sort());
  assert.equal(payload.unitCode, 'UNIT-B');
  assert.equal(payload.status, 'high'); // DB vocabulary, matches docs/08's own example
  assert.doesNotThrow(() => validatePublicReleasePayload(payload));
  assert.doesNotThrow(() => validatePublicReleasePayload(payload.metrics));
});

test('buildApiUnitPayload never leaks an unexpected field even if the source row has one', () => {
  const maliciousRelease = {
    week_start: '2026-08-03',
    suppression_status: 'published',
    index_approx: 10,
    baseline_approx: 5,
    band: 'normal',
    approved_metrics_json: {},
    // Simulates an accidental upstream leak -- buildApiUnitPayload must not pass this through,
    // because it only ever reads named fields, never spreads the input.
    personnel_id: 'PER-A-001',
    raw_metrics: { secret: true },
  };
  const payload = buildApiUnitPayload('UNIT-A', maliciousRelease);
  assert.equal('personnel_id' in payload, false);
  assert.equal('raw_metrics' in payload, false);
  assert.doesNotThrow(() => validatePublicReleasePayload(payload));
});

test('buildApiUnitPayload for a suppressed unit exposes zero figures and empty metrics', () => {
  const payload = buildApiUnitPayload('UNIT-SMALL', {
    week_start: '2026-08-03',
    suppression_status: 'suppressed_small_group',
    index_approx: null,
    baseline_approx: null,
    band: null,
    approved_metrics_json: {},
  });
  assert.equal(payload.suppressed, true);
  assert.equal(payload.indexApprox, null);
  assert.deepEqual(payload.metrics, {});
});
