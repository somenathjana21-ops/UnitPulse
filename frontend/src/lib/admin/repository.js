/**
 * frontend/src/lib/admin/repository.js
 *
 * Repository for executing restricted transactional CSV imports.
 * Specifications: docs/06-data-specification.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 *
 * NON-NEGOTIABLE SAFETY RULES:
 * 1. SYNTHETIC RECORDS ONLY.
 * 2. TRANSACTIONAL ATOMICITY: Batch imports must be atomic. Zero partial commits on failure.
 * 3. NO RAW ROW LOGGING: Operational records are not output to logs.
 */

import {
  getServiceRoleClient,
  defaultImportStore,
  InMemoryImportStore,
} from '@unitpulse/backend';

export { defaultImportStore, InMemoryImportStore };

/**
 * Executes an atomic transactional import of validated synthetic records.
 *
 * @param {Object} params
 * @param {string} params.datasetType
 * @param {Array<Object>} params.records
 * @param {Object} [params.store=defaultImportStore]
 * @returns {Promise<{ success: boolean, datasetType: string, importedCount: number }>}
 */
export async function executeTransactionalImport({
  datasetType,
  records,
  store = defaultImportStore,
}) {
  if (!records || records.length === 0) {
    return { success: true, datasetType, importedCount: 0 };
  }

  const serviceClient = getServiceRoleClient();

  if (serviceClient) {
    // Hosted / local live Supabase instance available
    const { data, error } = await serviceClient.rpc('execute_transactional_import', {
      p_dataset_type: datasetType,
      p_records: records,
    });

    if (error) {
      throw new Error(`Database import failed: ${error.message}`);
    }

    return {
      success: true,
      datasetType,
      importedCount: data?.inserted_count ?? records.length,
    };
  }

  // Disconnected / test fallback store
  return store.importRecordsTransactional(datasetType, records);
}
