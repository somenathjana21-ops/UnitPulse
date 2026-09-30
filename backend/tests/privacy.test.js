import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkGroupSuppression,
  checkCellSuppression,
  validatePublicReleasePayload,
  MIN_GROUP_SIZE,
} from '../src/privacy.js';

test('checkGroupSuppression suppresses groups smaller than MIN_GROUP_SIZE (5)', () => {
  assert.equal(MIN_GROUP_SIZE, 5);

  const suppressed4 = checkGroupSuppression(4);
  assert.equal(suppressed4.suppressed, true);
  assert.equal(suppressed4.reason, 'k_anonymity_group_too_small');

  const suppressed0 = checkGroupSuppression(0);
  assert.equal(suppressed0.suppressed, true);

  const allowed5 = checkGroupSuppression(5);
  assert.equal(allowed5.suppressed, false);

  const allowed60 = checkGroupSuppression(60);
  assert.equal(allowed60.suppressed, false);
});

test('checkCellSuppression suppresses small cells (<5) and revealing complements', () => {
  // Small cell: 2 out of 50
  const smallCell = checkCellSuppression(2, 50);
  assert.equal(smallCell.suppressed, true);
  assert.equal(smallCell.reason, 'small_cell_revealing');

  // Revealing complement: 48 out of 50 (leaving 2)
  const complement = checkCellSuppression(48, 50);
  assert.equal(complement.suppressed, true);
  assert.equal(complement.reason, 'complement_revealing');

  // Safe distribution: 20 out of 50
  const safe = checkCellSuppression(20, 50);
  assert.equal(safe.suppressed, false);
});

test('validatePublicReleasePayload throws error if personal or unreleased fields are present', () => {
  const safePayload = {
    unitCode: 'UNIT-A',
    weekStart: '2026-08-03',
    status: 'elevated',
    indexApprox: 75,
  };
  assert.doesNotThrow(() => validatePublicReleasePayload(safePayload));

  const leakedPayload = {
    ...safePayload,
    personnel_id: 'p-12345',
  };
  assert.throws(() => validatePublicReleasePayload(leakedPayload), /PRIVACY VIOLATION/);
});
