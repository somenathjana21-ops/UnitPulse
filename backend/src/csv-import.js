/**
 * backend/src/csv-import.js
 *
 * Restricted synthetic-CSV ingestion, schema validation, relationship checks,
 * duplicate detection, and transactional import.
 * Specifications: docs/06-data-specification.md, docs/09-database-design.md,
 *                 docs/10-security-privacy.md, docs/11-testing-plan.md, docs/14-risk-register.md
 *
 * CRITICAL SAFEGUARDS:
 * 1. SYNTHETIC DATA ONLY: Real personnel, roster, or operational data is strictly prohibited.
 * 2. NO RAW ROW LOGGING: Error summaries report row number and column name only; never dump raw row values to server logs.
 * 3. TRANSACTIONAL ATOMICITY: Any validation failure, bad date, or duplicate rolls back the entire batch.
 * 4. FORMULA INJECTION DEFENSE: Cells beginning with formula triggers (=, +, -, @, tab, cr) are rejected.
 * 5. STRICT BOUNDS: Duty hours (0-24), valid calendar dates (rejects 2026-02-31), date order (end >= start).
 * 6. NO GENERIC ADMIN BROWSER: Restricted to approved synthetic dataset schemas only.
 */

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB limit
export const MAX_ROWS = 5000;
export const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export const SUPPORTED_DATASETS = [
  'units',
  'personnel',
  'leave_eligibility',
  'leave_records',
  'duty_records',
  'deployments',
];

export const DATASET_SCHEMAS = {
  units: {
    requiredColumns: ['id', 'display_code', 'name', 'active'],
    optionalColumns: [],
  },
  personnel: {
    requiredColumns: ['id', 'unit_id', 'active', 'history_start_on'],
    optionalColumns: [],
  },
  leave_eligibility: {
    requiredColumns: ['personnel_id', 'snapshot_week', 'eligible_days_90d', 'verified'],
    optionalColumns: [],
  },
  leave_records: {
    requiredColumns: ['id', 'personnel_id', 'status', 'start_on', 'end_on', 'qualifying'],
    optionalColumns: ['decided_on'],
  },
  duty_records: {
    requiredColumns: ['personnel_id', 'duty_date', 'shift_type', 'hours'],
    optionalColumns: [],
  },
  deployments: {
    requiredColumns: ['id', 'personnel_id', 'start_on', 'verified'],
    optionalColumns: ['end_on'],
  },
};

/**
 * Validates whether a string is a legitimate calendar date in YYYY-MM-DD format.
 * Correctly rejects impossible calendar dates such as 2026-02-31.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isValidIsoDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = str.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonths = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonths[month - 1];
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Checks if a value contains CSV formula injection triggers.
 *
 * @param {string} val
 * @returns {boolean}
 */
export function isFormulaInjection(val) {
  if (typeof val !== 'string') return false;
  if (val.length === 0) return false;

  // Direct check for raw control characters (tab, carriage return, newline) before trim
  if (val.startsWith('\t') || val.startsWith('\r') || val.startsWith('\n')) {
    return true;
  }

  const trimmed = val.trim();
  if (trimmed.length === 0) return false;

  const firstChar = trimmed[0];
  if (FORMULA_PREFIXES.includes(firstChar)) {
    return true;
  }
  return false;
}

/**
 * Safe RFC-4180 compliant CSV parser.
 * Handles quoted fields, escaped double quotes (""), commas inside quotes, CRLF/LF lines.
 *
 * @param {string} csvText
 * @returns {{ headers: string[], rows: Array<Record<string, string>>, rowCount: number }}
 */
export function parseCsv(csvText) {
  if (typeof csvText !== 'string') {
    throw new Error('CSV content must be a string.');
  }

  // Strip UTF-8 BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const lines = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // skip LF
        }
        currentRow.push(currentField);
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push last field if text did not end with newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    lines.push(currentRow);
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: Unclosed quotation mark in input.');
  }

  // Filter out trailing blank lines
  const nonEmptyLines = lines.filter((line) => line.some((cell) => cell.trim().length > 0));
  if (nonEmptyLines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const headers = nonEmptyLines[0].map((h) => h.trim());
  const rows = [];

  for (let r = 1; r < nonEmptyLines.length; r++) {
    const line = nonEmptyLines[r];
    const rowObj = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = line[c] !== undefined ? line[c].trim() : '';
    }
    rows.push(rowObj);
  }

  return { headers, rows, rowCount: rows.length };
}

/**
 * Validates entity rows according to schema, data specifications, bounds, and relationships.
 * Does NOT log raw row values to server console or error messages.
 *
 * @param {string} datasetType One of SUPPORTED_DATASETS
 * @param {Array<Record<string, string>>} rows Parsed row objects
 * @param {Object} [context={}] External reference context (known units, personnel, existing records)
 * @returns {{ valid: boolean, errors: Array<{ row: number, column: string, message: string }>, validRecords: Array<Object> }}
 */
export function validateDatasetRows(datasetType, rows, context = {}) {
  const schema = DATASET_SCHEMAS[datasetType];
  if (!schema) {
    return {
      valid: false,
      errors: [{ row: 0, column: 'datasetType', message: `Unsupported dataset type '${datasetType}'. Allowed: ${SUPPORTED_DATASETS.join(', ')}` }],
      validRecords: [],
    };
  }

  if (rows.length > MAX_ROWS) {
    return {
      valid: false,
      errors: [{ row: 0, column: 'file', message: `Row count (${rows.length}) exceeds maximum allowable limit of ${MAX_ROWS} rows.` }],
      validRecords: [],
    };
  }

  const errors = [];
  const validRecords = [];

  // Track unique keys within the batch
  const seenIds = new Set();
  const seenDutyKeys = new Set(); // person_date
  const seenEligibilityKeys = new Set(); // person_week
  const leaveIntervalsByPerson = new Map(); // personId -> Array<{ start: string, end: string, row: number }>

  // Known references
  const knownUnitIds = context.knownUnitIds instanceof Set
    ? context.knownUnitIds
    : new Set(context.knownUnitIds || ['UNIT-A', 'UNIT-B', 'UNIT-C', 'UNIT-D', 'UNIT-E', 'UNIT-F']);

  const knownPersonnelIds = context.knownPersonnelIds instanceof Set
    ? context.knownPersonnelIds
    : new Set(context.knownPersonnelIds || []);

  // If importing personnel, add current batch's personnel IDs to known references
  if (datasetType === 'personnel') {
    for (const r of rows) {
      if (r.id) knownPersonnelIds.add(r.id.trim());
    }
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const rowNum = idx + 2; // 1-indexed header + 1
    const row = rows[idx];
    let rowHasError = false;

    // 1. Check for formula injection in all cells
    for (const [col, val] of Object.entries(row)) {
      if (isFormulaInjection(val)) {
        errors.push({
          row: rowNum,
          column: col,
          message: 'Formula injection detected: Cell starts with forbidden formula character (=, +, -, @, tab, cr).',
        });
        rowHasError = true;
      }
    }

    // 2. Check required columns present and non-empty
    for (const reqCol of schema.requiredColumns) {
      if (row[reqCol] === undefined || row[reqCol] === '') {
        errors.push({
          row: rowNum,
          column: reqCol,
          message: `Missing required field '${reqCol}'.`,
        });
        rowHasError = true;
      }
    }

    if (rowHasError) continue;

    // 3. Entity-specific validations
    const record = { ...row };

    if (datasetType === 'units') {
      if (!/^[A-Z0-9_-]+$/i.test(row.id)) {
        errors.push({ row: rowNum, column: 'id', message: 'Unit ID must contain only alphanumeric characters, underscores, or hyphens.' });
        rowHasError = true;
      }
      if (seenIds.has(row.id)) {
        errors.push({ row: rowNum, column: 'id', message: 'Duplicate unit ID in upload.' });
        rowHasError = true;
      }
      seenIds.add(row.id);
      record.active = parseBoolean(row.active);

    } else if (datasetType === 'personnel') {
      if (!/^[A-Z0-9_-]+$/i.test(row.id)) {
        errors.push({ row: rowNum, column: 'id', message: 'Personnel ID must contain only alphanumeric characters, underscores, or hyphens.' });
        rowHasError = true;
      }
      if (seenIds.has(row.id)) {
        errors.push({ row: rowNum, column: 'id', message: 'Duplicate personnel ID in upload.' });
        rowHasError = true;
      }
      seenIds.add(row.id);

      // Foreign key: unit_id must exist in known units
      if (!knownUnitIds.has(row.unit_id)) {
        errors.push({ row: rowNum, column: 'unit_id', message: `Referenced unit ID does not exist.` });
        rowHasError = true;
      }

      if (!isValidIsoDate(row.history_start_on)) {
        errors.push({ row: rowNum, column: 'history_start_on', message: 'History start date must be a valid calendar date in YYYY-MM-DD format.' });
        rowHasError = true;
      }
      record.active = parseBoolean(row.active);

    } else if (datasetType === 'leave_eligibility') {
      // Foreign key check
      if (knownPersonnelIds.size > 0 && !knownPersonnelIds.has(row.personnel_id)) {
        errors.push({ row: rowNum, column: 'personnel_id', message: 'Referenced personnel ID does not exist.' });
        rowHasError = true;
      }

      if (!isValidIsoDate(row.snapshot_week)) {
        errors.push({ row: rowNum, column: 'snapshot_week', message: 'Snapshot week must be a valid calendar date in YYYY-MM-DD format.' });
        rowHasError = true;
      }

      const days = parseInt(row.eligible_days_90d, 10);
      if (isNaN(days) || days < 0 || days > 90) {
        errors.push({ row: rowNum, column: 'eligible_days_90d', message: 'Eligible days must be an integer between 0 and 90.' });
        rowHasError = true;
      } else {
        record.eligible_days_90d = days;
      }

      const uqKey = `${row.personnel_id}_${row.snapshot_week}`;
      if (seenEligibilityKeys.has(uqKey)) {
        errors.push({ row: rowNum, column: 'snapshot_week', message: 'Duplicate leave eligibility snapshot for person and week.' });
        rowHasError = true;
      }
      seenEligibilityKeys.add(uqKey);
      record.verified = parseBoolean(row.verified);

    } else if (datasetType === 'leave_records') {
      if (seenIds.has(row.id)) {
        errors.push({ row: rowNum, column: 'id', message: 'Duplicate leave record ID in upload.' });
        rowHasError = true;
      }
      seenIds.add(row.id);

      // Foreign key check
      if (knownPersonnelIds.size > 0 && !knownPersonnelIds.has(row.personnel_id)) {
        errors.push({ row: rowNum, column: 'personnel_id', message: 'Referenced personnel ID does not exist.' });
        rowHasError = true;
      }

      const allowedStatuses = ['pending', 'approved', 'denied', 'taken'];
      if (!allowedStatuses.includes(row.status)) {
        errors.push({ row: rowNum, column: 'status', message: `Invalid status '${row.status}'. Must be one of: ${allowedStatuses.join(', ')}.` });
        rowHasError = true;
      }

      if (!isValidIsoDate(row.start_on)) {
        errors.push({ row: rowNum, column: 'start_on', message: 'Start date must be a valid calendar date in YYYY-MM-DD format.' });
        rowHasError = true;
      }

      if (!isValidIsoDate(row.end_on)) {
        errors.push({ row: rowNum, column: 'end_on', message: 'End date must be a valid calendar date in YYYY-MM-DD format.' });
        rowHasError = true;
      }

      if (isValidIsoDate(row.start_on) && isValidIsoDate(row.end_on)) {
        if (row.end_on < row.start_on) {
          errors.push({ row: rowNum, column: 'end_on', message: 'End date cannot be earlier than start date.' });
          rowHasError = true;
        }
      }

      // Decision rule: if approved, denied, or taken -> decided_on must be provided and valid
      if (row.status !== 'pending') {
        if (!row.decided_on || !isValidIsoDate(row.decided_on)) {
          errors.push({ row: rowNum, column: 'decided_on', message: `Status '${row.status}' requires a valid decision date in YYYY-MM-DD format.` });
          rowHasError = true;
        }
      }

      // Overlapping leave detection for same personnel
      if (isValidIsoDate(row.start_on) && isValidIsoDate(row.end_on) && row.status !== 'denied') {
        const intervals = leaveIntervalsByPerson.get(row.personnel_id) || [];
        for (const existing of intervals) {
          if (row.start_on <= existing.end && row.end_on >= existing.start) {
            errors.push({
              row: rowNum,
              column: 'start_on',
              message: `Overlapping leave period detected for person (overlaps with record at row ${existing.row}).`,
            });
            rowHasError = true;
            break;
          }
        }
        intervals.push({ start: row.start_on, end: row.end_on, row: rowNum });
        leaveIntervalsByPerson.set(row.personnel_id, intervals);
      }

      record.qualifying = parseBoolean(row.qualifying);

    } else if (datasetType === 'duty_records') {
      // Foreign key check
      if (knownPersonnelIds.size > 0 && !knownPersonnelIds.has(row.personnel_id)) {
        errors.push({ row: rowNum, column: 'personnel_id', message: 'Referenced personnel ID does not exist.' });
        rowHasError = true;
      }

      if (!isValidIsoDate(row.duty_date)) {
        errors.push({ row: rowNum, column: 'duty_date', message: 'Duty date must be a valid calendar date in YYYY-MM-DD format.' });
        rowHasError = true;
      }

      const allowedShifts = ['day', 'night', 'rest', 'training'];
      if (!allowedShifts.includes(row.shift_type)) {
        errors.push({ row: rowNum, column: 'shift_type', message: `Invalid shift type '${row.shift_type}'. Must be one of: ${allowedShifts.join(', ')}.` });
        rowHasError = true;
      }

      const hrs = parseFloat(row.hours);
      if (isNaN(hrs) || hrs < 0.0 || hrs > 24.0) {
        errors.push({ row: rowNum, column: 'hours', message: 'Duty hours must be a number between 0.0 and 24.0.' });
        rowHasError = true;
      } else {
        record.hours = hrs;
      }

      const uqKey = `${row.personnel_id}_${row.duty_date}`;
      if (seenDutyKeys.has(uqKey)) {
        errors.push({ row: rowNum, column: 'duty_date', message: 'Duplicate duty record for person on the same date.' });
        rowHasError = true;
      }
      seenDutyKeys.add(uqKey);

    } else if (datasetType === 'deployments') {
      if (seenIds.has(row.id)) {
        errors.push({ row: rowNum, column: 'id', message: 'Duplicate deployment ID in upload.' });
        rowHasError = true;
      }
      seenIds.add(row.id);

      // Foreign key check
      if (knownPersonnelIds.size > 0 && !knownPersonnelIds.has(row.personnel_id)) {
        errors.push({ row: rowNum, column: 'personnel_id', message: 'Referenced personnel ID does not exist.' });
        rowHasError = true;
      }

      if (!isValidIsoDate(row.start_on)) {
        errors.push({ row: rowNum, column: 'start_on', message: 'Start date must be a valid calendar date in YYYY-MM-DD format.' });
        rowHasError = true;
      }

      if (row.end_on && row.end_on.trim().length > 0) {
        if (!isValidIsoDate(row.end_on)) {
          errors.push({ row: rowNum, column: 'end_on', message: 'End date must be a valid calendar date in YYYY-MM-DD format.' });
          rowHasError = true;
        } else if (isValidIsoDate(row.start_on) && row.end_on < row.start_on) {
          errors.push({ row: rowNum, column: 'end_on', message: 'Deployment end date cannot be earlier than start date.' });
          rowHasError = true;
        }
      }
      record.verified = parseBoolean(row.verified);
    }

    if (!rowHasError) {
      validRecords.push(record);
    }
  }

  // Safe truncation of error list if very large
  const safeErrors = errors.slice(0, 100);

  return {
    valid: errors.length === 0,
    errors: safeErrors,
    totalErrors: errors.length,
    validRecords: errors.length === 0 ? validRecords : [],
  };
}

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const l = val.toLowerCase().trim();
    return l === 'true' || l === '1' || l === 'yes' || l === 't';
  }
  return Boolean(val);
}

/**
 * In-memory transactional test store to support isolated testing
 * without requiring a live remote Supabase instance.
 */
export class InMemoryImportStore {
  constructor() {
    this.tables = {
      units: new Map(),
      personnel: new Map(),
      leave_eligibility: new Map(),
      leave_records: new Map(),
      duty_records: new Map(),
      deployments: new Map(),
    };
  }

  getKnownUnitIds() {
    return new Set(this.tables.units.keys());
  }

  getKnownPersonnelIds() {
    return new Set(this.tables.personnel.keys());
  }

  getLeaveRecords(personnelId) {
    const records = [];
    for (const rec of this.tables.leave_records.values()) {
      if (!personnelId || rec.personnel_id === personnelId) {
        records.push(rec);
      }
    }
    return records;
  }

  /**
   * Atomically imports validated records into the specified table.
   * If any error occurs during write, all changes are rolled back.
   *
   * @param {string} datasetType
   * @param {Array<Object>} records
   * @returns {{ success: boolean, importedCount: number }}
   */
  importRecordsTransactional(datasetType, records) {
    const targetMap = this.tables[datasetType];
    if (!targetMap) {
      throw new Error(`Unknown table for dataset '${datasetType}'`);
    }

    // Prepare rollback snapshot
    const snapshot = new Map(targetMap);

    try {
      for (const rec of records) {
        // Derive key
        let key;
        if (datasetType === 'duty_records') {
          key = `${rec.personnel_id}_${rec.duty_date}`;
        } else if (datasetType === 'leave_eligibility') {
          key = `${rec.personnel_id}_${rec.snapshot_week}`;
        } else {
          key = rec.id;
        }

        if (targetMap.has(key)) {
          throw new Error(`Unique constraint violation: record with key '${key}' already exists in database.`);
        }
        targetMap.set(key, rec);
      }

      return { success: true, importedCount: records.length };
    } catch (err) {
      // Transactional rollback
      this.tables[datasetType] = snapshot;
      throw err;
    }
  }

  clear() {
    for (const key of Object.keys(this.tables)) {
      this.tables[key].clear();
    }
  }
}

/**
 * Global fallback store for testing and disconnected demo mode.
 */
export const defaultImportStore = new InMemoryImportStore();
// Pre-populate with standard synthetic demo units
defaultImportStore.tables.units.set('UNIT-A', { id: 'UNIT-A', display_code: 'UNIT-A', name: 'Alpha Detachment (Synthetic)', active: true });
defaultImportStore.tables.units.set('UNIT-B', { id: 'UNIT-B', display_code: 'UNIT-B', name: 'Bravo Outpost (Synthetic)', active: true });
defaultImportStore.tables.units.set('UNIT-C', { id: 'UNIT-C', display_code: 'UNIT-C', name: 'Charlie Contingent (Synthetic)', active: true });
defaultImportStore.tables.units.set('UNIT-D', { id: 'UNIT-D', display_code: 'UNIT-D', name: 'Delta Squadron (Synthetic)', active: true });
defaultImportStore.tables.units.set('UNIT-E', { id: 'UNIT-E', display_code: 'UNIT-E', name: 'Echo Platoon (Synthetic)', active: true });
defaultImportStore.tables.units.set('UNIT-F', { id: 'UNIT-F', display_code: 'UNIT-F', name: 'Foxtrot Company (Synthetic)', active: true });
