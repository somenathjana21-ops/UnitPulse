import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCommanderUnitAccess } from '../src/lib/commander/authorize.js';

const commanderAlpha = { id: 'u-1', role: 'commander', assignedUnitIds: ['UNIT-A'] };

test('resolveCommanderUnitAccess: no session -> 401', () => {
  const result = resolveCommanderUnitAccess({ user: null, unitId: 'UNIT-A' });
  assert.equal(result.allowed, false);
  assert.equal(result.httpStatus, 401);
});

test('resolveCommanderUnitAccess: own assigned unit -> allowed', () => {
  const result = resolveCommanderUnitAccess({ user: commanderAlpha, unitId: 'UNIT-A' });
  assert.equal(result.allowed, true);
  assert.equal(result.httpStatus, 200);
});

test('resolveCommanderUnitAccess: guessed URL for another unit -> 404, never 403', () => {
  const result = resolveCommanderUnitAccess({ user: commanderAlpha, unitId: 'UNIT-B' });
  assert.equal(result.allowed, false);
  assert.equal(result.httpStatus, 404); // conceals whether UNIT-B even exists
});

test('resolveCommanderUnitAccess: a completely fabricated unit ID -> also 404, same shape as a real denied unit', () => {
  const guessed = resolveCommanderUnitAccess({ user: commanderAlpha, unitId: 'UNIT-DOES-NOT-EXIST' });
  const real = resolveCommanderUnitAccess({ user: commanderAlpha, unitId: 'UNIT-B' });
  assert.deepEqual(guessed, real); // identical response shape either way -- no existence oracle
});

test('resolveCommanderUnitAccess: hr_uploader role cannot read unit releases', () => {
  const uploader = { id: 'u-2', role: 'hr_uploader', assignedUnitIds: ['UNIT-A'] };
  const result = resolveCommanderUnitAccess({ user: uploader, unitId: 'UNIT-A' });
  assert.equal(result.allowed, false);
  assert.equal(result.httpStatus, 404);
});
