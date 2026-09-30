/**
 * frontend/tests/admin-import.test.js
 *
 * Tests for restricted /admin/import synthetic-CSV flow:
 * - RBAC authorization gates (hr_uploader only, commander/welfare denied)
 * - Size limits (413 payload too large)
 * - Schema, calendar date, and relationship validation (422)
 * - Formula injection protection (422)
 * - Duplicate detection and overlapping leave detection (422)
 * - Safe error summaries (no raw row dump)
 * - Transactional atomicity (zero partial rows committed on failure)
 * - Cache-Control: no-store enforcement
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveImportAccess } from '../src/lib/admin/authorize.js';
import {
  executeTransactionalImport,
  defaultImportStore,
  InMemoryImportStore,
} from '../src/lib/admin/repository.js';
import { handleImportRequest } from '../src/lib/admin/service.js';

describe('Phase 7 — Admin Import Authorization Gates', () => {
  it('denies unauthenticated callers with 401', () => {
    const verdict = resolveImportAccess({ user: null });
    assert.strictEqual(verdict.allowed, false);
    assert.strictEqual(verdict.httpStatus, 401);
    assert.strictEqual(verdict.reason, 'unauthenticated');

    const verdictEmpty = resolveImportAccess({ user: { id: '' } });
    assert.strictEqual(verdictEmpty.allowed, false);
    assert.strictEqual(verdictEmpty.httpStatus, 401);
  });

  it('denies commander role with 403 (commander cannot ingest data)', () => {
    const verdict = resolveImportAccess({ user: { id: 'u-cmd', role: 'commander' } });
    assert.strictEqual(verdict.allowed, false);
    assert.strictEqual(verdict.httpStatus, 403);
    assert.strictEqual(verdict.reason, 'role_not_hr_uploader');
  });

  it('denies welfare_officer role with 403 (officer cannot ingest data)', () => {
    const verdict = resolveImportAccess({ user: { id: 'u-wo', role: 'welfare_officer' } });
    assert.strictEqual(verdict.allowed, false);
    assert.strictEqual(verdict.httpStatus, 403);
    assert.strictEqual(verdict.reason, 'role_not_hr_uploader');
  });

  it('permits hr_uploader and system_admin roles with 200', () => {
    const hr = resolveImportAccess({ user: { id: 'u-hr', role: 'hr_uploader' } });
    assert.strictEqual(hr.allowed, true);
    assert.strictEqual(hr.httpStatus, 200);

    const admin = resolveImportAccess({ user: { id: 'u-adm', role: 'system_admin' } });
    assert.strictEqual(admin.allowed, true);
    assert.strictEqual(admin.httpStatus, 200);
  });
});

describe('Phase 7 — Transactional Repository & Rollback', () => {
  let testStore;

  beforeEach(() => {
    testStore = new InMemoryImportStore();
  });

  it('imports valid batch into store atomically', async () => {
    const records = [
      { id: 'UNIT-Z1', display_code: 'Z1', name: 'Zulu 1', active: true },
      { id: 'UNIT-Z2', display_code: 'Z2', name: 'Zulu 2', active: true },
    ];
    const res = await executeTransactionalImport({
      datasetType: 'units',
      records,
      store: testStore,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.importedCount, 2);
    assert.strictEqual(testStore.tables.units.has('UNIT-Z1'), true);
  });

  it('aborts and commits 0 rows if a duplicate collision occurs', async () => {
    testStore.tables.units.set('UNIT-COLLIDE', { id: 'UNIT-COLLIDE', display_code: 'C', name: 'Collide', active: true });

    const batch = [
      { id: 'UNIT-NEW', display_code: 'N', name: 'New', active: true },
      { id: 'UNIT-COLLIDE', display_code: 'C', name: 'Duplicate', active: true },
    ];

    await assert.rejects(
      async () => {
        await executeTransactionalImport({
          datasetType: 'units',
          records: batch,
          store: testStore,
        });
      },
      /Unique constraint violation/
    );

    // Verify UNIT-NEW was rolled back
    assert.strictEqual(testStore.tables.units.has('UNIT-NEW'), false);
    assert.strictEqual(testStore.tables.units.size, 1);
  });
});

describe('Phase 7 — Ingestion Request Service & Route Logic', () => {
  beforeEach(() => {
    defaultImportStore.clear();
    // Re-seed standard units into defaultImportStore
    defaultImportStore.tables.units.set('UNIT-A', { id: 'UNIT-A', display_code: 'UNIT-A', name: 'Alpha', active: true });
    defaultImportStore.tables.units.set('UNIT-B', { id: 'UNIT-B', display_code: 'UNIT-B', name: 'Bravo', active: true });
    // Seed test personnel
    defaultImportStore.tables.personnel.set('PER-A-001', { id: 'PER-A-001', unit_id: 'UNIT-A', active: true, history_start_on: '2025-01-01' });
  });

  const hrUser = { id: 'hr-001', role: 'hr_uploader' };
  const cmdUser = { id: 'cmd-001', role: 'commander' };
  const woUser = { id: 'wo-001', role: 'welfare_officer' };

  it('rejects unauthenticated requests with 401 and Cache-Control: no-store', async () => {
    const res = await handleImportRequest({
      user: null,
      datasetType: 'units',
      csvContent: 'id,display_code,name,active\nU,U,Name,true',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    assert.strictEqual(res.body.error.code, 'unauthenticated');
  });

  it('rejects commander requests with 403 (unauthorized role)', async () => {
    const res = await handleImportRequest({
      user: cmdUser,
      datasetType: 'units',
      csvContent: 'id,display_code,name,active\nU,U,Name,true',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    assert.strictEqual(res.body.error.code, 'forbidden_role');
  });

  it('rejects welfare officer requests with 403', async () => {
    const res = await handleImportRequest({
      user: woUser,
      datasetType: 'units',
      csvContent: 'id,display_code,name,active\nU,U,Name,true',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'forbidden_role');
  });

  it('rejects payload exceeding size limit (>2MB) with 413', async () => {
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'units',
      csvContent: 'large',
      contentLength: 3 * 1024 * 1024, // 3MB > 2MB
    });
    assert.strictEqual(res.status, 413);
    assert.strictEqual(res.body.error.code, 'payload_too_large');
  });

  it('rejects malformed CSV syntax with 422', async () => {
    const badCsv = 'id,display_code,name,active\nUNIT-X,UNIT-X,"Unterminated string,true';
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'units',
      csvContent: badCsv,
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'malformed_csv');
  });

  it('rejects CSV formula injection with 422 and safe error summary', async () => {
    const formulaCsv = 'id,display_code,name,active\n=SUM(A1:A10),UNIT-X,Alpha,true';
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'units',
      csvContent: formulaCsv,
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'validation_failed');
    assert.strictEqual(res.body.error.errors[0].column, 'id');
    assert.match(res.body.error.errors[0].message, /Formula injection detected/);
  });

  it('rejects invalid calendar dates (e.g. 2026-02-31) with 422', async () => {
    const badDateCsv = 'id,unit_id,active,history_start_on\nPER-A-099,UNIT-A,true,2026-02-31';
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'personnel',
      csvContent: badDateCsv,
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'validation_failed');
    assert.strictEqual(res.body.error.errors[0].column, 'history_start_on');
    assert.match(res.body.error.errors[0].message, /valid calendar date/);
  });

  it('rejects duplicate leave records and overlapping leave periods with 422', async () => {
    const overlappingCsv = `id,personnel_id,status,start_on,end_on,qualifying,decided_on\nLR-01,PER-A-001,approved,2026-06-01,2026-06-10,true,2026-05-20\nLR-02,PER-A-001,taken,2026-06-08,2026-06-15,true,2026-05-20`;
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'leave_records',
      csvContent: overlappingCsv,
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'validation_failed');
    assert.match(res.body.error.errors[0].message, /Overlapping leave period detected/);
  });

  it('rejects missing foreign key references (unknown unit ID) with 422', async () => {
    const badFkCsv = 'id,unit_id,active,history_start_on\nPER-A-099,UNIT-NONEXISTENT,true,2025-01-01';
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'personnel',
      csvContent: badFkCsv,
    });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'validation_failed');
    assert.strictEqual(res.body.error.errors[0].column, 'unit_id');
    assert.match(res.body.error.errors[0].message, /Referenced unit ID does not exist/);
  });

  it('successfully imports valid synthetic records with 200 and Cache-Control: no-store', async () => {
    const validCsv = 'id,display_code,name,active\nUNIT-VALID-1,UV1,Valid Unit 1,true\nUNIT-VALID-2,UV2,Valid Unit 2,true';
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'units',
      csvContent: validCsv,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.importedRows, 2);
    assert.strictEqual(defaultImportStore.tables.units.has('UNIT-VALID-1'), true);
  });

  it('ensures safe error summaries contain zero raw row values or full payload dumps', async () => {
    const badCsv = 'id,display_code,name,active\n=CMD,UNIT-A,Alpha,true';
    const res = await handleImportRequest({
      user: hrUser,
      datasetType: 'units',
      csvContent: badCsv,
    });
    const err = res.body.error.errors[0];
    assert.strictEqual('rawRow' in err, false);
    assert.strictEqual('fullPayload' in err, false);
    assert.strictEqual('rowData' in err, false);
  });
});
