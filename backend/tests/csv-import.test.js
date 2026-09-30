/**
 * backend/tests/csv-import.test.js
 *
 * Tests for restricted synthetic-CSV ingestion, schema validation, relationship checks,
 * duplicate detection, formula injection protection, transactional atomicity, safe error summaries,
 * and RBAC import access.
 * Specifications: docs/06-data-specification.md, docs/10-security-privacy.md,
 *                 docs/11-testing-plan.md, docs/14-risk-register.md
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  isFormulaInjection,
  isValidIsoDate,
  validateDatasetRows,
  InMemoryImportStore,
  canAccessImport,
  MAX_ROWS,
} from '../src/index.js';

describe('Phase 7 — Safe RFC-4180 CSV Parser', () => {
  it('correctly parses comma-separated rows with whitespace trimming', () => {
    const csv = `id, display_code, name, active\nUNIT-A, UNIT-A, Alpha Detachment, true\nUNIT-B, UNIT-B, Bravo Outpost, false`;
    const res = parseCsv(csv);
    assert.strictEqual(res.rowCount, 2);
    assert.deepStrictEqual(res.headers, ['id', 'display_code', 'name', 'active']);
    assert.strictEqual(res.rows[0].id, 'UNIT-A');
    assert.strictEqual(res.rows[0].display_code, 'UNIT-A');
    assert.strictEqual(res.rows[0].name, 'Alpha Detachment');
    assert.strictEqual(res.rows[0].active, 'true');
    assert.strictEqual(res.rows[1].id, 'UNIT-B');
    assert.strictEqual(res.rows[1].active, 'false');
  });

  it('handles CRLF line breaks and trailing newlines gracefully', () => {
    const csv = "id,unit_id,active,history_start_on\r\nPER-A-001,UNIT-A,true,2025-01-01\r\nPER-A-002,UNIT-A,true,2025-01-01\r\n";
    const res = parseCsv(csv);
    assert.strictEqual(res.rowCount, 2);
    assert.strictEqual(res.rows[0].id, 'PER-A-001');
    assert.strictEqual(res.rows[1].id, 'PER-A-002');
  });

  it('handles quotes containing embedded commas and escaped quotes', () => {
    const csv = 'id,display_code,name,active\nUNIT-A,UNIT-A,"Alpha, 1st Detachment ""Special""",true';
    const res = parseCsv(csv);
    assert.strictEqual(res.rowCount, 1);
    assert.strictEqual(res.rows[0].name, 'Alpha, 1st Detachment "Special"');
  });

  it('rejects malformed CSV with unclosed quotation marks', () => {
    const csv = 'id,display_code,name,active\nUNIT-A,UNIT-A,"Unclosed string,true';
    assert.throws(() => parseCsv(csv), /Malformed CSV: Unclosed quotation mark/);
  });
});

describe('Phase 7 — Formula Injection Protection (CSV Injection)', () => {
  it('detects formula characters =, +, -, @, tab, cr at start of cells', () => {
    assert.strictEqual(isFormulaInjection('=1+1'), true);
    assert.strictEqual(isFormulaInjection('=SUM(A1:A10)'), true);
    assert.strictEqual(isFormulaInjection('+cmd|" /C calc"!A0'), true);
    assert.strictEqual(isFormulaInjection('-123'), true);
    assert.strictEqual(isFormulaInjection('@IMPORT'), true);
    assert.strictEqual(isFormulaInjection('\tcalc'), true);
    assert.strictEqual(isFormulaInjection('\rpayload'), true);
  });

  it('allows normal synthetic alphanumeric strings and standard dates', () => {
    assert.strictEqual(isFormulaInjection('UNIT-A'), false);
    assert.strictEqual(isFormulaInjection('PER-A-001'), false);
    assert.strictEqual(isFormulaInjection('2026-06-15'), false);
    assert.strictEqual(isFormulaInjection('day'), false);
    assert.strictEqual(isFormulaInjection('8.0'), false);
  });

  it('flags validation error on rows containing formula injection', () => {
    const rows = [
      { id: '=CMD|calc!A0', display_code: 'UNIT-A', name: 'Alpha', active: 'true' },
    ];
    const res = validateDatasetRows('units', rows);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors.length > 0, true);
    assert.strictEqual(res.errors[0].column, 'id');
    assert.match(res.errors[0].message, /Formula injection detected/);
  });
});

describe('Phase 7 — Calendar Date & Plausible Bounds Validation', () => {
  it('accepts valid ISO calendar dates', () => {
    assert.strictEqual(isValidIsoDate('2026-06-15'), true);
    assert.strictEqual(isValidIsoDate('2026-01-31'), true);
    assert.strictEqual(isValidIsoDate('2026-02-28'), true); // 2026 is non-leap
    assert.strictEqual(isValidIsoDate('2024-02-29'), true); // 2024 is leap
  });

  it('rejects impossible calendar dates and bad formats', () => {
    assert.strictEqual(isValidIsoDate('2026-02-31'), false); // Feb 31 does not exist
    assert.strictEqual(isValidIsoDate('2026-04-31'), false); // April has 30 days
    assert.strictEqual(isValidIsoDate('2026-02-29'), false); // 2026 non-leap
    assert.strictEqual(isValidIsoDate('2026-13-01'), false); // month 13
    assert.strictEqual(isValidIsoDate('2026-00-10'), false); // month 0
    assert.strictEqual(isValidIsoDate('2026/06/15'), false); // wrong delimiter
    assert.strictEqual(isValidIsoDate('15-06-2026'), false); // non-ISO
    assert.strictEqual(isValidIsoDate('invalid-date'), false);
  });

  it('enforces duty hours bounds between 0.0 and 24.0', () => {
    const validRows = [
      { personnel_id: 'PER-A-001', duty_date: '2026-06-01', shift_type: 'day', hours: '8.0' },
      { personnel_id: 'PER-A-001', duty_date: '2026-06-02', shift_type: 'night', hours: '12.0' },
    ];
    const validRes = validateDatasetRows('duty_records', validRows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(validRes.valid, true);
    assert.strictEqual(validRes.validRecords.length, 2);

    const invalidHoursRows = [
      { personnel_id: 'PER-A-001', duty_date: '2026-06-01', shift_type: 'day', hours: '25.0' }, // > 24
      { personnel_id: 'PER-A-001', duty_date: '2026-06-02', shift_type: 'day', hours: 'invalid' },
    ];
    const invalidRes = validateDatasetRows('duty_records', invalidHoursRows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(invalidRes.valid, false);
    assert.strictEqual(invalidRes.errors.some((e) => e.column === 'hours'), true);
  });

  it('enforces leave date order (end_on >= start_on)', () => {
    const invertedRows = [
      {
        id: 'LR-001',
        personnel_id: 'PER-A-001',
        status: 'approved',
        start_on: '2026-06-20',
        end_on: '2026-06-10', // inverted!
        qualifying: 'true',
        decided_on: '2026-06-01',
      },
    ];
    const res = validateDatasetRows('leave_records', invertedRows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors[0].column, 'end_on');
    assert.match(res.errors[0].message, /cannot be earlier than start date/);
  });

  it('enforces decided_on requirement when status is approved, denied, or taken', () => {
    const missingDecisionRows = [
      {
        id: 'LR-001',
        personnel_id: 'PER-A-001',
        status: 'approved',
        start_on: '2026-06-01',
        end_on: '2026-06-05',
        qualifying: 'true',
        decided_on: '', // missing for approved!
      },
    ];
    const res = validateDatasetRows('leave_records', missingDecisionRows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors[0].column, 'decided_on');
    assert.match(res.errors[0].message, /requires a valid decision date/);
  });
});

describe('Phase 7 — Duplicate & Overlap Detection', () => {
  it('detects duplicate primary keys within uploaded batch', () => {
    const duplicateUnitRows = [
      { id: 'UNIT-X', display_code: 'UNIT-X', name: 'X-Ray Unit 1', active: 'true' },
      { id: 'UNIT-X', display_code: 'UNIT-X-DUP', name: 'X-Ray Unit 2', active: 'true' },
    ];
    const res = validateDatasetRows('units', duplicateUnitRows);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors.some((e) => e.message.includes('Duplicate unit ID')), true);
  });

  it('detects duplicate duty records for same person on same date', () => {
    const dupDutyRows = [
      { personnel_id: 'PER-A-001', duty_date: '2026-06-01', shift_type: 'day', hours: '8.0' },
      { personnel_id: 'PER-A-001', duty_date: '2026-06-01', shift_type: 'night', hours: '8.0' },
    ];
    const res = validateDatasetRows('duty_records', dupDutyRows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors[0].column, 'duty_date');
    assert.match(res.errors[0].message, /Duplicate duty record/);
  });

  it('detects overlapping leave periods for the same person', () => {
    const overlappingLeaveRows = [
      {
        id: 'LR-001',
        personnel_id: 'PER-A-001',
        status: 'approved',
        start_on: '2026-06-01',
        end_on: '2026-06-10',
        qualifying: 'true',
        decided_on: '2026-05-25',
      },
      {
        id: 'LR-002',
        personnel_id: 'PER-A-001',
        status: 'taken',
        start_on: '2026-06-08', // overlaps with LR-001!
        end_on: '2026-06-15',
        qualifying: 'true',
        decided_on: '2026-05-25',
      },
    ];
    const res = validateDatasetRows('leave_records', overlappingLeaveRows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors.some((e) => e.message.includes('Overlapping leave period detected')), true);
  });
});

describe('Phase 7 — Relationship & Foreign Key Validation', () => {
  it('rejects personnel records referencing non-existent unit ID', () => {
    const rows = [
      { id: 'PER-Z-001', unit_id: 'UNIT-NONEXISTENT', active: 'true', history_start_on: '2025-01-01' },
    ];
    const res = validateDatasetRows('personnel', rows, { knownUnitIds: ['UNIT-A', 'UNIT-B'] });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors[0].column, 'unit_id');
    assert.match(res.errors[0].message, /Referenced unit ID does not exist/);
  });

  it('rejects operational rows referencing non-existent personnel ID', () => {
    const rows = [
      { id: 'DEP-001', personnel_id: 'PER-GHOST', start_on: '2026-06-01', end_on: '2026-08-01', verified: 'true' },
    ];
    const res = validateDatasetRows('deployments', rows, { knownPersonnelIds: ['PER-A-001'] });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errors[0].column, 'personnel_id');
    assert.match(res.errors[0].message, /Referenced personnel ID does not exist/);
  });
});

describe('Phase 7 — Transactional Import & Rollback', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryImportStore();
  });

  it('imports valid batch atomically into table', () => {
    const records = [
      { id: 'UNIT-T1', display_code: 'UNIT-T1', name: 'Test 1', active: true },
      { id: 'UNIT-T2', display_code: 'UNIT-T2', name: 'Test 2', active: true },
    ];
    const result = store.importRecordsTransactional('units', records);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.importedCount, 2);
    assert.strictEqual(store.tables.units.has('UNIT-T1'), true);
    assert.strictEqual(store.tables.units.has('UNIT-T2'), true);
  });

  it('rolls back entire batch if a duplicate collision occurs midway (bad CSV creates 0 hidden records)', () => {
    // Pre-insert UNIT-EXISTING
    store.tables.units.set('UNIT-EXISTING', { id: 'UNIT-EXISTING', display_code: 'E', name: 'Existing', active: true });

    const batch = [
      { id: 'UNIT-NEW-1', display_code: 'N1', name: 'New 1', active: true },
      { id: 'UNIT-EXISTING', display_code: 'E', name: 'Collide', active: true }, // collision!
      { id: 'UNIT-NEW-2', display_code: 'N2', name: 'New 2', active: true },
    ];

    assert.throws(() => {
      store.importRecordsTransactional('units', batch);
    }, /Unique constraint violation/);

    // Verify atomic rollback: UNIT-NEW-1 must NOT exist in store
    assert.strictEqual(store.tables.units.has('UNIT-NEW-1'), false);
    assert.strictEqual(store.tables.units.has('UNIT-NEW-2'), false);
    assert.strictEqual(store.tables.units.size, 1); // only the pre-existing row remains
  });
});

describe('Phase 7 — Safe Error Summaries (Zero Raw Row Logging)', () => {
  it('produces safe error summaries containing only row, column, and rule message', () => {
    const badRows = [
      { id: 'PER-001', unit_id: 'UNIT-A', active: 'true', history_start_on: '2026-02-31' }, // bad date
    ];
    const res = validateDatasetRows('personnel', badRows, { knownUnitIds: ['UNIT-A'] });
    assert.strictEqual(res.valid, false);
    const err = res.errors[0];
    assert.strictEqual(err.row, 2);
    assert.strictEqual(err.column, 'history_start_on');
    assert.strictEqual(typeof err.message, 'string');
    // Verify no raw row values or full payloads are attached to the error object
    assert.strictEqual('rawRow' in err, false);
    assert.strictEqual('fullPayload' in err, false);
  });
});

describe('Phase 7 — RBAC Access Control for Restricted /admin/import Flow', () => {
  it('allows hr_uploader and system_admin', () => {
    assert.strictEqual(canAccessImport({ user: { id: 'u-1', role: 'hr_uploader' } }).allowed, true);
    assert.strictEqual(canAccessImport({ user: { id: 'u-2', role: 'system_admin' } }).allowed, true);
  });

  it('denies commander, welfare_officer, and unauthenticated callers', () => {
    const unauth = canAccessImport({ user: null });
    assert.strictEqual(unauth.allowed, false);
    assert.strictEqual(unauth.reason, 'unauthenticated');

    const cmd = canAccessImport({ user: { id: 'u-3', role: 'commander' } });
    assert.strictEqual(cmd.allowed, false);
    assert.strictEqual(cmd.reason, 'role_not_hr_uploader');

    const wel = canAccessImport({ user: { id: 'u-4', role: 'welfare_officer' } });
    assert.strictEqual(wel.allowed, false);
    assert.strictEqual(wel.reason, 'role_not_hr_uploader');
  });
});
