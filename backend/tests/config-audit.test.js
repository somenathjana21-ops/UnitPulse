import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironmentSecurity, isForbiddenClientSecretKey } from '../src/config.js';
import { validateGrantRequest } from '../src/audit.js';
import { validateStatusTransition } from '../src/welfare.js';

test('validateEnvironmentSecurity rejects forbidden client prefixes on server secrets', () => {
  const badServiceKeyName = ['NEXT', 'PUBLIC', 'SUPABASE_SERVICE_ROLE_KEY'].join('_');
  const badCronKeyName = ['NEXT', 'PUBLIC', 'CRON_SECRET'].join('_');

  assert.equal(isForbiddenClientSecretKey(badServiceKeyName), true);
  assert.equal(isForbiddenClientSecretKey(badCronKeyName), true);
  assert.equal(isForbiddenClientSecretKey('NEXT_PUBLIC_SUPABASE_URL'), false);

  assert.throws(
    () =>
      validateEnvironmentSecurity({
        [badServiceKeyName]: 'secret123',
      }),
    /CRITICAL SECURITY VIOLATION/
  );

  assert.throws(
    () =>
      validateEnvironmentSecurity({
        [badCronKeyName]: 'cron123',
      }),
    /CRITICAL SECURITY VIOLATION/
  );

  // Safe configuration passes without throwing
  assert.doesNotThrow(() =>
    validateEnvironmentSecurity({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon123',
      SUPABASE_SERVICE_ROLE_KEY: 'secret123', // server-only: allowed
    })
  );
});

test('validateGrantRequest verifies assigned officer and required reason length', () => {
  // Mismatched officer ID
  const mismatched = validateGrantRequest({
    officerId: 'officer-1',
    assignedOfficerId: 'officer-2',
    reportId: 'rep-1',
    reasonCode: 'welfare_review',
    reason: 'Valid operational reason for audit review',
  });
  assert.equal(mismatched.valid, false);

  // Short reason
  const shortReason = validateGrantRequest({
    officerId: 'officer-1',
    assignedOfficerId: 'officer-1',
    reportId: 'rep-1',
    reasonCode: 'welfare_review',
    reason: 'too short',
  });
  assert.equal(shortReason.valid, false);

  // Valid grant request enforces 30 min expiry
  const valid = validateGrantRequest({
    officerId: 'officer-1',
    assignedOfficerId: 'officer-1',
    reportId: 'rep-1',
    reasonCode: 'welfare_review',
    reason: 'Review leave backlog and continuous duty for welfare check-in',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.grantMetadata.expiryMinutes, 30);
});

test('validateStatusTransition enforces valid welfare lifecycle state transitions', () => {
  // Valid transition: new -> acknowledged
  const ack = validateStatusTransition('new', 'acknowledged');
  assert.equal(ack.valid, true);

  // Invalid leap: new -> closed
  const invalidLeap = validateStatusTransition('new', 'closed');
  assert.equal(invalidLeap.valid, false);

  // Closing without notes is rejected
  const closeNoNotes = validateStatusTransition('action_taken', 'closed', { notes: '' });
  assert.equal(closeNoNotes.valid, false);

  // Closing with proper outcome notes succeeds
  const closeWithNotes = validateStatusTransition('action_taken', 'closed', {
    notes: 'Unit roster rebalanced and leave dates scheduled with personnel.',
  });
  assert.equal(closeWithNotes.valid, true);
});
