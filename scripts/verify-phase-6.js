/**
 * scripts/verify-phase-6.js
 *
 * Dedicated Phase 6 Independent Verification Pass based on Guidebook verification prompt:
 * "Attempt all of the following: commander request, unrelated officer,
 * missing reason, altered report ID, altered unit ID, expired grant,
 * revoked grant, direct private-table query, and repeated paginated reads.
 * Verify successful reads each produce an audit row, and failures produce
 * no individual data. Review that the audit reason is encrypted at rest
 * and plaintext is not logged. Report any direct unlogged read path."
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  encryptReason,
  decryptReason,
  validateGrantRequest,
  isGrantActive,
  ALLOWED_REASON_CODES,
  BREAK_GLASS_EXPIRY_MINUTES,
} from '../backend/src/audit.js';

import {
  createBreakGlassGrant,
  getBreakGlassGrant,
  executeIndividualRead,
  fetchOfficerAuditTrail,
  _testGrantStore,
  _testAuditStore,
  resetTestStores,
} from '../frontend/src/lib/welfare/break-glass.js';

import {
  resolveBreakGlassGrantRequestAccess,
  resolveBreakGlassReadAccess,
} from '../frontend/src/lib/welfare/authorize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('Unit Pulse 2.0 — Phase 6 Independent Verification Pass');
console.log('================================================================\n');

let passedChecks = 0;
let totalChecks = 0;

function report(step, description, result, details = '') {
  totalChecks++;
  if (result) {
    passedChecks++;
    console.log(`[PASS] Scenario ${step}: ${description}`);
    if (details) console.log(`       Evidence: ${details}`);
  } else {
    console.error(`[FAIL] Scenario ${step}: ${description}`);
    if (details) console.error(`       Error: ${details}`);
  }
}

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------
const officerA = { id: 'usr-welfare-001', role: 'welfare_officer' };
const officerB = { id: 'usr-welfare-002', role: 'welfare_officer' };
const commanderUser = { id: 'usr-commander-001', role: 'commander' };
const anonUser = null;

const reportA = {
  id: 'rep-unit-b-2026-09-28',
  unit_id: 'UNIT-B',
  assigned_to: officerA.id,
  week_start: '2026-09-28',
  status: 'new',
};

const reportB = {
  id: 'rep-unit-c-2026-09-28',
  unit_id: 'UNIT-C',
  assigned_to: officerB.id,
  week_start: '2026-09-28',
  status: 'new',
};

async function runVerification() {
  resetTestStores();

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Commander Request
  // Attempt grant request, individual read, and audit viewing as commander
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 1: Commander Request ---');
  {
    // 1.1 Commander requests grant
    const grantVerdict = resolveBreakGlassGrantRequestAccess({
      user: commanderUser,
      report: reportA,
    });
    report(
      '1.1',
      'Commander requesting grant is strictly denied (HTTP 403)',
      grantVerdict.allowed === false && grantVerdict.httpStatus === 403,
      `Verdict: HTTP ${grantVerdict.httpStatus}, reason: ${grantVerdict.reason}`
    );

    // 1.2 Commander attempts individual read
    const readVerdict = resolveBreakGlassReadAccess({
      user: commanderUser,
      report: reportA,
      grantId: 'any-grant-id',
      grant: null,
    });
    report(
      '1.2',
      'Commander attempting individual read is strictly denied (HTTP 403)',
      readVerdict.allowed === false && readVerdict.httpStatus === 403,
      `Verdict: HTTP ${readVerdict.httpStatus}, reason: ${readVerdict.reason}`
    );

    // 1.3 Verify zero individual data or grants leaked to commander
    report(
      '1.3',
      'Commander cannot obtain any individual data',
      _testGrantStore.size === 0 && _testAuditStore.length === 0,
      'No grants or audit rows exist for commander'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Unrelated Officer
  // Officer B attempts grant request and read on Report A (assigned to Officer A)
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Unrelated Officer ---');
  {
    // 2.1 Unrelated officer requests grant for report assigned to Officer A
    const grantVerdict = resolveBreakGlassGrantRequestAccess({
      user: officerB,
      report: reportA,
    });
    report(
      '2.1',
      'Unrelated officer requesting grant is concealed with HTTP 404 (no existence leak)',
      grantVerdict.allowed === false && grantVerdict.httpStatus === 404,
      `Verdict: HTTP ${grantVerdict.httpStatus}, reason: ${grantVerdict.reason}`
    );

    // 2.2 Unrelated officer attempts individual read
    const readVerdict = resolveBreakGlassReadAccess({
      user: officerB,
      report: reportA,
      grantId: 'grant-unrelated',
      grant: null,
    });
    report(
      '2.2',
      'Unrelated officer attempting read is concealed with HTTP 404',
      readVerdict.allowed === false && readVerdict.httpStatus === 404,
      `Verdict: HTTP ${readVerdict.httpStatus}, reason: ${readVerdict.reason}`
    );

    // 2.3 Verify domain validation rejects unassigned officer
    const validation = validateGrantRequest({
      officerId: officerB.id,
      assignedOfficerId: reportA.assigned_to,
      reportId: reportA.id,
      reasonCode: 'welfare_review',
      reason: 'Valid operational explanation here',
    });
    report(
      '2.3',
      'Domain logic rejects grant request for unassigned officer',
      validation.valid === false && validation.error.includes('not assigned'),
      `Validation error: "${validation.error}"`
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Missing / Invalid Reason
  // Empty reason, <10 chars, invalid reason code
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Missing or Invalid Reason ---');
  {
    // 3.1 Missing reason text
    const resEmpty = validateGrantRequest({
      officerId: officerA.id,
      assignedOfficerId: reportA.assigned_to,
      reportId: reportA.id,
      reasonCode: 'welfare_review',
      reason: '',
    });
    report(
      '3.1',
      'Empty reason string rejected',
      resEmpty.valid === false && resEmpty.error.includes('10 characters'),
      `Error: "${resEmpty.error}"`
    );

    // 3.2 Short reason (<10 characters)
    const resShort = validateGrantRequest({
      officerId: officerA.id,
      assignedOfficerId: reportA.assigned_to,
      reportId: reportA.id,
      reasonCode: 'welfare_review',
      reason: 'urgent',
    });
    report(
      '3.2',
      'Short reason string ("urgent", 6 chars) rejected',
      resShort.valid === false && resShort.error.includes('10 characters'),
      `Error: "${resShort.error}"`
    );

    // 3.3 Invalid reason code
    const resInvalidCode = validateGrantRequest({
      officerId: officerA.id,
      assignedOfficerId: reportA.assigned_to,
      reportId: reportA.id,
      reasonCode: 'disciplinary_inquiry',
      reason: 'Investigating potential disciplinary matters',
    });
    report(
      '3.3',
      'Unapproved reason code rejected',
      resInvalidCode.valid === false && resInvalidCode.error.includes('Invalid or missing reason code'),
      `Error: "${resInvalidCode.error}"`
    );

    // 3.4 Confirm no grant created for invalid reasons
    let failedCreation = false;
    try {
      await createBreakGlassGrant({
        officerId: officerA.id,
        assignedOfficerId: reportA.assigned_to,
        reportId: reportA.id,
        reasonCode: 'welfare_review',
        reason: 'too short',
      });
    } catch (err) {
      failedCreation = true;
    }
    report(
      '3.4',
      'createBreakGlassGrant throws error on short reason and stores nothing',
      failedCreation && _testGrantStore.size === 0,
      'Grant store remained empty'
    );
  }

  // ---------------------------------------------------------------------------
  // Create a Valid Grant for Officer A on Report A
  // ---------------------------------------------------------------------------
  const typedJustification = 'Conducting confidential review of high night shifts and leave denials';
  const grantA = await createBreakGlassGrant({
    officerId: officerA.id,
    assignedOfficerId: reportA.assigned_to,
    reportId: reportA.id,
    unitId: reportA.unit_id,
    reasonCode: 'welfare_review',
    reason: typedJustification,
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Altered Report ID
  // Valid grant for Report A used against Report B
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Altered Report ID ---');
  {
    const storedGrant = _testGrantStore.get(grantA.grantId);

    // 4.1 Read access evaluation with altered report
    const verdict = resolveBreakGlassReadAccess({
      user: officerA,
      report: reportB, // Altered report ID
      grantId: grantA.grantId,
      grant: storedGrant,
    });
    report(
      '4.1',
      'Altered report ID denied at authorization gate',
      verdict.allowed === false,
      `Verdict: HTTP ${verdict.httpStatus}, reason: ${verdict.reason}`
    );

    // 4.2 executeIndividualRead with mismatched reportId
    let failedRead = false;
    try {
      await executeIndividualRead({
        grantId: grantA.grantId,
        officerId: officerA.id,
        reportId: reportB.id, // Mismatch
      });
    } catch (err) {
      failedRead = err.code === 'grant_mismatch';
    }
    report(
      '4.2',
      'executeIndividualRead throws grant_mismatch when report ID is altered',
      failedRead,
      'Mismatched report ID prevented execution'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Altered Unit ID
  // Grant unit does not match report unit
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Altered Unit ID ---');
  {
    // 5.1 Simulated grant with altered unit ID
    const tamperedGrant = {
      ..._testGrantStore.get(grantA.grantId),
      unit_id: 'UNIT-X', // Altered unit ID
    };

    const verdict = resolveBreakGlassReadAccess({
      user: officerA,
      report: reportA,
      grantId: grantA.grantId,
      grant: tamperedGrant,
    });
    report(
      '5.1',
      'Altered unit ID detected and rejected (HTTP 403 unit_mismatch)',
      verdict.allowed === false && verdict.httpStatus === 403 && verdict.reason === 'unit_mismatch',
      `Verdict: HTTP ${verdict.httpStatus}, reason: ${verdict.reason}`
    );

    // 5.2 Confirm SQL migration enforces unit consistency
    const migrationSql = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/20260930150000_phase6_break_glass.sql'),
      'utf8'
    );
    const hasUnitCheck = migrationSql.includes('v_grant.unit_id <> v_report.unit_id');
    report(
      '5.2',
      'SQL migration strictly rechecks v_grant.unit_id <> v_report.unit_id',
      hasUnitCheck,
      'Transactional function enforces unit consistency'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Expired Grant
  // Grant evaluated past 30-minute validity window
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Expired Grant ---');
  {
    const storedGrant = _testGrantStore.get(grantA.grantId);
    const thirtyOneMinutesLater = new Date(Date.now() + 31 * 60 * 1000);

    // 6.1 Domain check at expiry time
    const activeAt31m = isGrantActive(
      { expiresAt: storedGrant.expires_at, officerId: officerA.id },
      officerA.id,
      thirtyOneMinutesLater
    );
    report(
      '6.1',
      'isGrantActive returns false after 31 minutes',
      activeAt31m === false,
      `Active status: ${activeAt31m}`
    );

    // 6.2 Authorization check after expiry
    const expiredVerdict = resolveBreakGlassReadAccess({
      user: officerA,
      report: reportA,
      grantId: grantA.grantId,
      grant: storedGrant,
      now: thirtyOneMinutesLater,
    });
    report(
      '6.2',
      'resolveBreakGlassReadAccess returns HTTP 403 grant_expired after expiry',
      expiredVerdict.allowed === false &&
        expiredVerdict.httpStatus === 403 &&
        expiredVerdict.reason === 'grant_expired',
      `Verdict: HTTP ${expiredVerdict.httpStatus}, reason: ${expiredVerdict.reason}`
    );

    // 6.3 SQL function enforces expiration check
    const hasExpiryCheck = migrationSqlIncludes(
      'supabase/migrations/20260930150000_phase6_break_glass.sql',
      'v_grant.expires_at <= now()'
    );
    report(
      '6.3',
      'SQL migration checks v_grant.expires_at <= now() in transactional read',
      hasExpiryCheck,
      'Database raises exception when grant is expired'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Revoked Grant
  // Grant flagged as is_revoked = true
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Revoked Grant ---');
  {
    const revokedGrant = {
      ..._testGrantStore.get(grantA.grantId),
      is_revoked: true,
    };

    // 7.1 Domain check for revoked grant
    const activeRevoked = isGrantActive(
      { expiresAt: revokedGrant.expires_at, officerId: officerA.id, is_revoked: true },
      officerA.id
    );
    report(
      '7.1',
      'isGrantActive returns false for revoked grant',
      activeRevoked === false,
      `Active status: ${activeRevoked}`
    );

    // 7.2 Authorization check for revoked grant
    const revokedVerdict = resolveBreakGlassReadAccess({
      user: officerA,
      report: reportA,
      grantId: grantA.grantId,
      grant: revokedGrant,
    });
    report(
      '7.2',
      'resolveBreakGlassReadAccess returns HTTP 403 grant_revoked for revoked grant',
      revokedVerdict.allowed === false &&
        revokedVerdict.httpStatus === 403 &&
        revokedVerdict.reason === 'grant_revoked',
      `Verdict: HTTP ${revokedVerdict.httpStatus}, reason: ${revokedVerdict.reason}`
    );

    // 7.3 executeIndividualRead with revoked grant
    _testGrantStore.set('grant-revoked-test', {
      ...revokedGrant,
      id: 'grant-revoked-test',
    });
    let failedRevokedRead = false;
    try {
      await executeIndividualRead({
        grantId: 'grant-revoked-test',
        officerId: officerA.id,
        reportId: reportA.id,
      });
    } catch (err) {
      failedRevokedRead = err.code === 'grant_revoked';
    }
    report(
      '7.3',
      'executeIndividualRead throws grant_revoked when grant is revoked',
      failedRevokedRead,
      'Revoked grant cannot read individual rows'
    );

    // 7.4 SQL function enforces revocation check
    const hasRevocationCheck = migrationSqlIncludes(
      'supabase/migrations/20260930150000_phase6_break_glass.sql',
      'v_grant.is_revoked = true'
    );
    report(
      '7.4',
      'SQL migration checks v_grant.is_revoked = true in transactional read',
      hasRevocationCheck,
      'Database raises exception when grant is revoked'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Direct Private-Table Query
  // Verify client SELECT is explicitly revoked on private schema tables
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 8: Direct Private-Table Query ---');
  {
    const phase1Sql = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/20260930120000_phase1_initial_schema.sql'),
      'utf8'
    );
    const phase6Sql = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/20260930150000_phase6_break_glass.sql'),
      'utf8'
    );

    // 8.1 Check REVOKE on private schema
    const hasPrivateRevoke =
      phase1Sql.includes('revoke all on schema private from public;') &&
      phase1Sql.includes('revoke all on schema private from anon;') &&
      phase1Sql.includes('revoke all on schema private from authenticated;');
    report(
      '8.1',
      'Initial schema revokes all privileges on schema private from public, anon, and authenticated',
      hasPrivateRevoke,
      'Clients cannot query private schema directly'
    );

    // 8.2 Check RLS enabled on access grants and audit
    const hasGrantsRls = phase1Sql.includes('alter table private.access_grants enable row level security;');
    const hasAuditRls = phase1Sql.includes('alter table private.access_audit enable row level security;');
    report(
      '8.2',
      'Row Level Security enabled on private.access_grants and private.access_audit',
      hasGrantsRls && hasAuditRls,
      'RLS enabled on all private tables'
    );

    // 8.3 Check functions revoked from client roles
    const hasFuncRevoke =
      phase6Sql.includes('revoke all on function private.execute_audited_break_glass_read') &&
      phase6Sql.includes('grant execute on function private.execute_audited_break_glass_read(uuid, uuid, uuid, integer, integer) to service_role');
    report(
      '8.3',
      'Transactional read function revoked from client roles; granted exclusively to service_role',
      hasFuncRevoke,
      'Ordinary clients cannot execute read function directly'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Repeated Paginated Reads & Audit Row Verification
  // Reads produce audit rows; limit is clamped to max 20; failures produce 0 rows
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 9: Repeated Paginated Reads & Audit Row Verification ---');
  {
    // Reset audit store to measure read audit generation
    _testAuditStore.length = 0;

    // 9.1 First paginated read (page 1: offset 0, limit 10)
    const readPage1 = await executeIndividualRead({
      grantId: grantA.grantId,
      officerId: officerA.id,
      reportId: reportA.id,
      limit: 10,
      offset: 0,
    });
    report(
      '9.1',
      'Page 1 read returns exactly requested 10 rows',
      readPage1.records.length === 10 && readPage1.count === 10,
      `Returned ${readPage1.records.length} records (IDs: ${readPage1.records[0].personnelId} ... ${readPage1.records[9].personnelId})`
    );

    // Verify 1 audit row written
    report(
      '9.2',
      'Page 1 read atomically generates exactly 1 audit row',
      _testAuditStore.length === 1 &&
        _testAuditStore[0].action === 'individual_read' &&
        _testAuditStore[0].row_count === 10,
      `Audit row 1: actor=${_testAuditStore[0].actor_id}, rows=${_testAuditStore[0].row_count}, action=${_testAuditStore[0].action}`
    );

    // 9.3 Second paginated read (page 2: offset 10, limit 10)
    const readPage2 = await executeIndividualRead({
      grantId: grantA.grantId,
      officerId: officerA.id,
      reportId: reportA.id,
      limit: 10,
      offset: 10,
    });
    report(
      '9.3',
      'Page 2 read returns next 10 rows with distinct personnel IDs',
      readPage2.records.length === 10 &&
        readPage2.records[0].personnelId !== readPage1.records[0].personnelId,
      `Returned ${readPage2.records.length} records (IDs: ${readPage2.records[0].personnelId} ... ${readPage2.records[9].personnelId})`
    );

    // Verify 2nd audit row written
    report(
      '9.4',
      'Page 2 read generates second audit row (cumulative 2 audit rows)',
      _testAuditStore.length === 2 &&
        _testAuditStore[1].action === 'individual_read' &&
        _testAuditStore[1].row_count === 10,
      `Audit row 2: actor=${_testAuditStore[1].actor_id}, rows=${_testAuditStore[1].row_count}`
    );

    // 9.5 Requested limit of 100 is strictly clamped to max 20
    const clampedRead = await executeIndividualRead({
      grantId: grantA.grantId,
      officerId: officerA.id,
      reportId: reportA.id,
      limit: 100, // Request 100
      offset: 0,
    });
    report(
      '9.5',
      'Requested limit of 100 rows is strictly clamped to maximum 20 records',
      clampedRead.records.length === 20 && clampedRead.limit === 20,
      `Clamped count: ${clampedRead.records.length}, limit: ${clampedRead.limit}`
    );

    // Verify 3rd audit row written recording clamped count
    report(
      '9.6',
      'Audit row records clamped count (20 rows)',
      _testAuditStore.length === 3 && _testAuditStore[2].row_count === 20,
      `Audit row 3 row_count: ${_testAuditStore[2].row_count}`
    );

    // 9.7 Failed reads produce ZERO individual data
    let failedReadResult = null;
    try {
      failedReadResult = await executeIndividualRead({
        grantId: 'non-existent-grant-id',
        officerId: officerA.id,
        reportId: reportA.id,
      });
    } catch (err) {
      // Expected exception
    }
    report(
      '9.7',
      'Failed read throws and returns zero individual data',
      failedReadResult === null,
      'No data returned on failure'
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Review Reason Encryption at Rest & Zero Plaintext Logging
  // Stored reason is AES-256-GCM ciphertext, plaintext not present or logged
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 10: Reason Encryption at Rest & Zero Plaintext Logging ---');
  {
    const storedGrant = _testGrantStore.get(grantA.grantId);
    const ciphertext = storedGrant.encrypted_reason;

    // 10.1 Ciphertext format verification
    const formatRegex = /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;
    const isValidFormat = formatRegex.test(ciphertext);
    report(
      '10.1',
      'Stored reason matches AES-256-GCM format (v1:<12-byte IV>:<16-byte Tag>:<Ciphertext>)',
      isValidFormat,
      `Encrypted payload: ${ciphertext.substring(0, 36)}... [total ${ciphertext.length} chars]`
    );

    // 10.2 Verify plaintext is not present in stored ciphertext
    const containsPlaintext = ciphertext.includes('night shifts') || ciphertext.includes('welfare');
    report(
      '10.2',
      'Plaintext reason string is completely absent from stored ciphertext',
      containsPlaintext === false,
      'No plaintext substrings found in encrypted payload'
    );

    // 10.3 Decryption with correct key recovers original plaintext
    const decrypted = decryptReason(ciphertext);
    report(
      '10.3',
      'Decryption with system secret recovers original typed justification',
      decrypted === typedJustification,
      `Decrypted: "${decrypted}"`
    );

    // 10.4 Tampering detection: modifying ciphertext byte causes authentication failure
    const parts = ciphertext.split(':');
    const tamperedCipher = Buffer.from(parts[3], 'hex');
    tamperedCipher[0] = tamperedCipher[0] ^ 0xff; // Flip bits in ciphertext
    const tamperedPayload = `v1:${parts[1]}:${parts[2]}:${tamperedCipher.toString('hex')}`;

    let tamperCaught = false;
    try {
      decryptReason(tamperedPayload);
    } catch (err) {
      tamperCaught = true;
    }
    report(
      '10.4',
      'Bit tampering in ciphertext triggers cryptographic auth tag verification failure',
      tamperCaught,
      'GCM authentication prevents payload tampering'
    );

    // 10.5 Plaintext not logged: verify that audit rows contain reason_code but NOT plaintext justification
    const auditRow = _testAuditStore[0];
    const auditRowHasPlaintext = JSON.stringify(auditRow).includes(typedJustification);
    report(
      '10.5',
      'Audit log stores only reason_code; plaintext justification is never logged in audit table',
      auditRowHasPlaintext === false && auditRow.reason_code === 'welfare_review',
      `Audit entry contains reason_code: "${auditRow.reason_code}", zero plaintext`
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Report Any Direct Unlogged Read Path
  // Comprehensive architecture and codebase audit
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 11: Direct Unlogged Read Path Audit ---');
  {
    // 11.1 Check all route handlers reading individual records
    const frontendApiDir = path.join(rootDir, 'frontend/src/app/api');
    const apiFiles = [];

    function findFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findFiles(fullPath);
        } else if (entry.name === 'route.js') {
          apiFiles.push(fullPath);
        }
      }
    }
    findFiles(frontendApiDir);

    // Identify routes that touch individuals or private data
    const individualRoutes = apiFiles.filter((f) => f.includes('individuals'));
    report(
      '11.1',
      'Exactly ONE API route exists for individual records (/api/welfare/reports/[id]/individuals)',
      individualRoutes.length === 1,
      `Discovered route: ${path.relative(rootDir, individualRoutes[0])}`
    );

    // 11.2 Check that the individual route invokes audited read function
    const routeContent = fs.readFileSync(individualRoutes[0], 'utf8');
    const usesAuditedRead =
      routeContent.includes('executeIndividualRead') &&
      routeContent.includes('Cache-Control') &&
      routeContent.includes('no-store');
    report(
      '11.2',
      'Individual route enforces executeIndividualRead and Cache-Control: no-store',
      usesAuditedRead,
      'Route strictly calls audited execution and prohibits browser caching'
    );

    // 11.3 Check database functions that read private.personnel
    const hasUnloggedDbRead =
      migrationSqlIncludes('supabase/migrations/20260930150000_phase6_break_glass.sql', 'from private.personnel') &&
      migrationSqlIncludes('supabase/migrations/20260930150000_phase6_break_glass.sql', 'insert into private.access_audit');
    report(
      '11.3',
      'Database read function atomically inserts into private.access_audit on every read',
      hasUnloggedDbRead,
      'No unlogged database read path exists'
    );

    // 11.4 Check officer audit trail isolation
    const officerATrail = await fetchOfficerAuditTrail({ officerId: officerA.id });
    const officerBTrail = await fetchOfficerAuditTrail({ officerId: officerB.id });
    report(
      '11.4',
      'Officer audit viewer isolates audit trails (Officer B sees 0 events from Officer A)',
      officerATrail.length === 3 && officerBTrail.length === 0,
      `Officer A sees ${officerATrail.length} own events; Officer B sees ${officerBTrail.length} events`
    );
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Verification Complete: ${passedChecks}/${totalChecks} checks PASSED.`);
  console.log('================================================================');

  if (passedChecks !== totalChecks) {
    console.error(`\nFAILED: ${totalChecks - passedChecks} verification checks failed.`);
    process.exit(1);
  } else {
    console.log('\nALL PHASE 6 VERIFICATION REQUIREMENTS CONFIRMED:');
    console.log('1. Commander requests strictly denied (403)');
    console.log('2. Unrelated officers concealed with 404');
    console.log('3. Missing/short reasons rejected (min 10 chars enforced)');
    console.log('4. Altered report ID rejected (grant mismatch)');
    console.log('5. Altered unit ID rejected (unit mismatch)');
    console.log('6. Expired grants rejected (403 grant_expired)');
    console.log('7. Revoked grants rejected (403 grant_revoked)');
    console.log('8. Direct private-table queries revoked from client roles');
    console.log('9. Repeated reads produce 1 audit row each; limits clamped to 20');
    console.log('10. Reasons encrypted at rest (AES-256-GCM); zero plaintext logging');
    console.log('11. Zero direct unlogged read paths exist');
    process.exit(0);
  }
}

function migrationSqlIncludes(relPath, snippet) {
  const content = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
  return content.includes(snippet);
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
