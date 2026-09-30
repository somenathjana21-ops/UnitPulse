/**
 * backend/tests/break-glass.test.js
 *
 * Comprehensive tests for exceptional break-glass individual read domain logic:
 * - Server-side AES-256-GCM encryption and decryption with nonce + auth tag
 * - Reason length validation (min 10 chars)
 * - Reason code allow-list enforcement
 * - Server-enforced 30-minute expiry
 * - Officer assignment validation
 * - Grant active status & expiry checks
 * - Tampering detection and key rotation
 *
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 * docs/09-database-design.md, docs/10-security-privacy.md, docs/11-testing-plan.md
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptReason,
  decryptReason,
  validateGrantRequest,
  isGrantActive,
  deriveEncryptionKey,
  BREAK_GLASS_EXPIRY_MINUTES,
  ALLOWED_REASON_CODES,
  AUDIT_EVENT_TYPES,
} from '../src/audit.js';

describe('Phase 6 — AES-256-GCM Encryption & Decryption', () => {
  const sampleReason = 'Review leave utilization and duty shifts for welfare check-in.';

  it('Successfully encrypts and decrypts a valid operational justification', () => {
    const encrypted = encryptReason(sampleReason);
    assert.ok(encrypted.startsWith('v1:'));
    const parts = encrypted.split(':');
    assert.equal(parts.length, 4); // v1, iv, tag, ciphertext
    assert.ok(parts[1].length === 24); // 12-byte IV in hex = 24 chars
    assert.ok(parts[2].length === 32); // 16-byte auth tag in hex = 32 chars
    assert.ok(parts[3].length > 0);

    const decrypted = decryptReason(encrypted);
    assert.equal(decrypted, sampleReason);
  });

  it('Uses unique nonces for repeated encryptions of identical plaintext', () => {
    const enc1 = encryptReason(sampleReason);
    const enc2 = encryptReason(sampleReason);
    assert.notEqual(enc1, enc2);

    const iv1 = enc1.split(':')[1];
    const iv2 = enc2.split(':')[1];
    assert.notEqual(iv1, iv2);

    // Both decrypt to original text
    assert.equal(decryptReason(enc1), sampleReason);
    assert.equal(decryptReason(enc2), sampleReason);
  });

  it('Rejects short reasons (< 10 characters) before encryption', () => {
    assert.throws(
      () => encryptReason('too short'),
      /Reason must be at least 10 characters/
    );
    assert.throws(
      () => encryptReason(''),
      /Reason must be at least 10 characters/
    );
    assert.throws(
      () => encryptReason(null),
      /Reason must be at least 10 characters/
    );
  });

  it('Fails decryption if ciphertext or auth tag is tampered with', () => {
    const encrypted = encryptReason(sampleReason);
    const parts = encrypted.split(':');

    // Tamper ciphertext (flip last byte)
    const lastByte = parts[3].slice(-2);
    const flippedByte = lastByte === '00' ? 'ff' : '00';
    const tamperedCipher = parts[3].slice(0, -2) + flippedByte;
    const tamperedPayload = [parts[0], parts[1], parts[2], tamperedCipher].join(':');

    assert.throws(
      () => decryptReason(tamperedPayload),
      /Unsupported state or unable to authenticate data|bad decrypt/
    );

    // Tamper auth tag (replace with all zeros)
    const tamperedTag = '00'.repeat(16);
    const tamperedTagPayload = [parts[0], parts[1], tamperedTag, parts[3]].join(':');

    assert.throws(
      () => decryptReason(tamperedTagPayload),
      /Unsupported state or unable to authenticate data|bad decrypt/
    );
  });

  it('Supports custom secret keys and isolates keys from one another', () => {
    const secretA = 'secret-key-alpha-32-bytes-long!';
    const secretB = 'secret-key-bravo-32-bytes-long!';

    const encA = encryptReason(sampleReason, secretA);
    const decA = decryptReason(encA, secretA);
    assert.equal(decA, sampleReason);

    // Decrypting with wrong key fails authentication
    assert.throws(
      () => decryptReason(encA, secretB),
      /Unsupported state or unable to authenticate data|bad decrypt/
    );
  });
});

describe('Phase 6 — Break-Glass Grant Validation', () => {
  const officerOne = '00000000-0000-0000-0000-000000000003';
  const officerTwo = '00000000-0000-0000-0000-000000000004';
  const reportId = '11111111-1111-1111-1111-111111111111';

  it('Approves valid grant request and enforces server-side 30-minute expiry', () => {
    const req = {
      officerId: officerOne,
      assignedOfficerId: officerOne,
      reportId,
      reasonCode: 'welfare_review',
      reason: 'Review leave records and roster distribution for welfare assessment.',
    };

    const res = validateGrantRequest(req);
    assert.equal(res.valid, true);
    assert.ok(res.grantMetadata);
    assert.equal(res.grantMetadata.officerId, officerOne);
    assert.equal(res.grantMetadata.reportId, reportId);
    assert.equal(res.grantMetadata.reasonCode, 'welfare_review');
    assert.equal(res.grantMetadata.expiryMinutes, BREAK_GLASS_EXPIRY_MINUTES);
    assert.equal(res.grantMetadata.expiryMinutes, 30);

    const created = new Date(res.grantMetadata.createdAt).getTime();
    const expires = new Date(res.grantMetadata.expiresAt).getTime();
    const durationMinutes = (expires - created) / (60 * 1000);
    assert.equal(Math.round(durationMinutes), 30);
  });

  it('Rejects request if requesting officer does not match report assignment', () => {
    const req = {
      officerId: officerTwo,
      assignedOfficerId: officerOne,
      reportId,
      reasonCode: 'welfare_review',
      reason: 'Review leave records and roster distribution.',
    };

    const res = validateGrantRequest(req);
    assert.equal(res.valid, false);
    assert.equal(res.error, 'Officer is not assigned to this report');
  });

  it('Rejects invalid or unapproved reason codes', () => {
    const req = {
      officerId: officerOne,
      assignedOfficerId: officerOne,
      reportId,
      reasonCode: 'curiosity', // Unapproved
      reason: 'Review leave records and roster distribution.',
    };

    const res = validateGrantRequest(req);
    assert.equal(res.valid, false);
    assert.ok(res.error.includes('Invalid or missing reason code'));
  });

  it('Permits all allowed reason codes from specification', () => {
    for (const code of ALLOWED_REASON_CODES) {
      const res = validateGrantRequest({
        officerId: officerOne,
        assignedOfficerId: officerOne,
        reportId,
        reasonCode: code,
        reason: 'Review leave records and roster distribution.',
      });
      assert.equal(res.valid, true, `Expected ${code} to be allowed`);
    }
  });

  it('Rejects empty or short justification (< 10 chars)', () => {
    const res = validateGrantRequest({
      officerId: officerOne,
      assignedOfficerId: officerOne,
      reportId,
      reasonCode: 'welfare_review',
      reason: 'Review',
    });
    assert.equal(res.valid, false);
    assert.ok(res.error.includes('Reason must be at least 10 characters'));
  });
});

describe('Phase 6 — Grant Active Check & Expiry Enforcement', () => {
  const officerId = '00000000-0000-0000-0000-000000000003';

  it('Returns true for active grant before expiration', () => {
    const grant = {
      officerId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins left
    };
    assert.equal(isGrantActive(grant, officerId), true);
  });

  it('Returns false when grant has expired', () => {
    const grant = {
      officerId,
      expiresAt: new Date(Date.now() - 5 * 1000).toISOString(), // 5s ago
    };
    assert.equal(isGrantActive(grant, officerId), false);
  });

  it('Returns false if grant belongs to another officer', () => {
    const grant = {
      officerId: 'another-officer',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    assert.equal(isGrantActive(grant, officerId), false);
  });

  it('Returns false for null or malformed grant', () => {
    assert.equal(isGrantActive(null, officerId), false);
    assert.equal(isGrantActive({}, officerId), false);
    assert.equal(isGrantActive({ officerId }, officerId), false);
  });
});
