/**
 * frontend/src/lib/admin/service.js
 *
 * Core service logic for restricted synthetic-CSV import.
 * Specifications: docs/04-user-flows.md, docs/06-data-specification.md,
 *                 docs/08-api-specification.md, docs/10-security-privacy.md, docs/11-testing-plan.md
 *
 * ENFORCES:
 * 1. Role verification: hr_uploader (or system_admin) only; denies commanders and welfare officers.
 * 2. Payload size limit: 2MB.
 * 3. Safe RFC-4180 parsing, formula injection detection, schema and relationship checks.
 * 4. Transactional atomicity: batch import committed all-or-nothing.
 * 5. Safe error summaries: row and column only; zero raw row logging.
 * 6. Cache-Control: no-store header.
 */

import {
  parseCsv,
  validateDatasetRows,
  SUPPORTED_DATASETS,
  MAX_FILE_SIZE_BYTES,
  defaultImportStore,
} from '@unitpulse/backend';
import { resolveImportAccess } from './authorize.js';
import { executeTransactionalImport } from './repository.js';

/**
 * Handles an ingestion request for synthetic CSV datasets.
 *
 * @param {Object} params
 * @param {Object|null} params.user Authenticated user context ({ id, role })
 * @param {string} [params.datasetType] Target dataset name
 * @param {string} [params.csvContent] Raw CSV text
 * @param {number|null} [params.contentLength] Request content-length in bytes
 * @param {Object} [params.store=defaultImportStore] Storage engine
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: Object }>}
 */
export async function handleImportRequest({
  user = null,
  datasetType = '',
  csvContent = '',
  contentLength = null,
  store = defaultImportStore,
}) {
  const headers = { 'Cache-Control': 'no-store' };

  // 1. Enforce payload size limit
  if (contentLength && contentLength > MAX_FILE_SIZE_BYTES) {
    return {
      status: 413,
      headers,
      body: {
        error: {
          code: 'payload_too_large',
          message: 'Payload exceeds maximum allowable size of 2MB.',
        },
      },
    };
  }

  // 2. Authentication and role check
  const access = resolveImportAccess({ user });
  if (!access.allowed) {
    return {
      status: access.httpStatus,
      headers,
      body: {
        error: {
          code: access.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden_role',
          message:
            access.reason === 'unauthenticated'
              ? 'Authentication required to access data import.'
              : 'Access restricted strictly to the HR Uploader role.',
        },
      },
    };
  }

  // 3. Validate dataset type
  if (!datasetType || !SUPPORTED_DATASETS.includes(datasetType)) {
    return {
      status: 422,
      headers,
      body: {
        error: {
          code: 'invalid_dataset_type',
          message: `Invalid or missing datasetType. Supported datasets: ${SUPPORTED_DATASETS.join(', ')}.`,
        },
      },
    };
  }

  // 4. Validate non-empty CSV
  if (!csvContent || csvContent.trim().length === 0) {
    return {
      status: 422,
      headers,
      body: {
        error: {
          code: 'empty_csv',
          message: 'The uploaded CSV file is empty.',
        },
      },
    };
  }

  // 5. Check CSV string byte length
  if (Buffer.byteLength(csvContent, 'utf8') > MAX_FILE_SIZE_BYTES) {
    return {
      status: 413,
      headers,
      body: {
        error: {
          code: 'payload_too_large',
          message: 'CSV content exceeds maximum allowable size of 2MB.',
        },
      },
    };
  }

  // 6. Safe CSV parsing
  let parsed;
  try {
    parsed = parseCsv(csvContent);
  } catch (parseErr) {
    return {
      status: 422,
      headers,
      body: {
        error: {
          code: 'malformed_csv',
          message: parseErr.message || 'Malformed CSV format.',
        },
      },
    };
  }

  if (parsed.rowCount === 0) {
    return {
      status: 422,
      headers,
      body: {
        error: {
          code: 'empty_data',
          message: 'The uploaded CSV contains a header but no data rows.',
        },
      },
    };
  }

  // 7. Schema, relationship, bounds, formula injection, and duplicate validation
  const validationResult = validateDatasetRows(datasetType, parsed.rows, {
    knownUnitIds: store.getKnownUnitIds(),
    knownPersonnelIds: store.getKnownPersonnelIds(),
  });

  if (!validationResult.valid) {
    // Return safe error summary with row and column only; zero raw row logging
    return {
      status: 422,
      headers,
      body: {
        error: {
          code: 'validation_failed',
          message: `Validation failed with ${validationResult.totalErrors} error(s). Batch was not imported.`,
          errors: validationResult.errors,
          totalErrors: validationResult.totalErrors,
        },
      },
    };
  }

  // 8. Transactional import execution
  try {
    const importResult = await executeTransactionalImport({
      datasetType,
      records: validationResult.validRecords,
      store,
    });

    return {
      status: 200,
      headers,
      body: {
        success: true,
        datasetType,
        importedRows: importResult.importedCount,
        message: `Successfully imported ${importResult.importedCount} synthetic records into ${datasetType}.`,
      },
    };
  } catch (importErr) {
    return {
      status: 422,
      headers,
      body: {
        error: {
          code: 'import_failed',
          message: importErr.message || 'Transactional import failed and was rolled back.',
        },
      },
    };
  }
}
