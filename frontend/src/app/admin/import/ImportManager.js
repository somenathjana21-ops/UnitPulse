'use client';

/**
 * frontend/src/app/admin/import/ImportManager.js
 *
 * Client component for restricted synthetic-CSV import flow.
 * Specifications: docs/04-user-flows.md, docs/06-data-specification.md,
 *                 docs/08-api-specification.md, docs/10-security-privacy.md, docs/14-risk-register.md
 *
 * FEATURES & CONTROLS:
 * - Synthetic-only warning banner.
 * - Role-scoped to hr_uploader (no generic admin/database browser).
 * - Supported dataset type selector with column specification hints.
 * - File upload dropzone and direct CSV text editor.
 * - Max file size warning (2MB / 5,000 rows limit).
 * - Meaningful loading state with real-time status.
 * - Meaningful empty state with step-by-step guidance.
 * - Meaningful safe error summary state with row/column breakdown (zero raw row dump).
 * - Meaningful success state with transaction confirmation.
 */

import { useState } from 'react';

const DATASET_CONFIGS = {
  units: {
    label: 'Units (Synthetic Unit Definitions)',
    requiredCols: ['id', 'display_code', 'name', 'active'],
    sampleCsv: `id,display_code,name,active\nUNIT-G,UNIT-G,Golf Platoon (Synthetic),true\nUNIT-H,UNIT-H,Hotel Detachment (Synthetic),true`,
    desc: 'Synthetic unit definitions. Required columns: id, display_code, name, active.',
  },
  personnel: {
    label: 'Personnel (Pseudonymous Rosters)',
    requiredCols: ['id', 'unit_id', 'active', 'history_start_on'],
    sampleCsv: `id,unit_id,active,history_start_on\nPER-A-091,UNIT-A,true,2025-01-01\nPER-A-092,UNIT-A,true,2025-01-01`,
    desc: 'Pseudonymous personnel identifiers and history start dates. Required columns: id, unit_id, active, history_start_on.',
  },
  leave_eligibility: {
    label: 'Leave Eligibility (90-Day Verification)',
    requiredCols: ['personnel_id', 'snapshot_week', 'eligible_days_90d', 'verified'],
    sampleCsv: `personnel_id,snapshot_week,eligible_days_90d,verified\nPER-A-001,2026-08-03,15,true\nPER-A-002,2026-08-03,15,true`,
    desc: 'HR-confirmed leave eligibility snapshots. Required columns: personnel_id, snapshot_week, eligible_days_90d, verified.',
  },
  leave_records: {
    label: 'Leave Records (Requests & Taken Leave)',
    requiredCols: ['id', 'personnel_id', 'status', 'start_on', 'end_on', 'qualifying', 'decided_on'],
    sampleCsv: `id,personnel_id,status,start_on,end_on,qualifying,decided_on\nLR-IMP-001,PER-A-001,approved,2026-07-01,2026-07-07,true,2026-06-25\nLR-IMP-002,PER-A-002,taken,2026-07-10,2026-07-15,true,2026-07-01`,
    desc: 'Leave requests and taken restorative leave. Required columns: id, personnel_id, status, start_on, end_on, qualifying, decided_on.',
  },
  duty_records: {
    label: 'Duty Records (Daily Shifts & Hours)',
    requiredCols: ['personnel_id', 'duty_date', 'shift_type', 'hours'],
    sampleCsv: `personnel_id,duty_date,shift_type,hours\nPER-A-001,2026-08-01,day,8.0\nPER-A-002,2026-08-01,night,12.0`,
    desc: 'Daily duty records with hours (0-24). Required columns: personnel_id, duty_date, shift_type, hours.',
  },
  deployments: {
    label: 'Deployments (Assignment Periods)',
    requiredCols: ['id', 'personnel_id', 'start_on', 'end_on', 'verified'],
    sampleCsv: `id,personnel_id,start_on,end_on,verified\nDEP-IMP-001,PER-A-001,2026-05-01,2026-07-30,true\nDEP-IMP-002,PER-A-002,2026-06-01,,true`,
    desc: 'Continuous operational deployment intervals. Required columns: id, personnel_id, start_on, end_on, verified.',
  },
};

export default function ImportManager() {
  const [datasetType, setDatasetType] = useState('leave_records');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);
  const [successInfo, setSuccessInfo] = useState(null);

  const activeConfig = DATASET_CONFIGS[datasetType] || DATASET_CONFIGS.leave_records;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatus('error');
      setStatusMessage('File size exceeds the 2MB limit. Please split the dataset into smaller batches.');
      setErrorDetails([{ row: 0, column: 'file', message: `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds 2MB limit.` }]);
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result || '');
      setStatus('idle');
      setStatusMessage('');
      setErrorDetails([]);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setCsvContent(activeConfig.sampleCsv);
    setFileName(`sample_${datasetType}.csv`);
    setStatus('idle');
    setStatusMessage('');
    setErrorDetails([]);
    setSuccessInfo(null);
  };

  const handleClear = () => {
    setCsvContent('');
    setFileName('');
    setStatus('idle');
    setStatusMessage('');
    setErrorDetails([]);
    setSuccessInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!csvContent || csvContent.trim().length === 0) {
      setStatus('error');
      setStatusMessage('Please select a CSV file or enter CSV data before importing.');
      setErrorDetails([{ row: 0, column: 'csvContent', message: 'No CSV content provided.' }]);
      return;
    }

    setStatus('loading');
    setStatusMessage('Validating schema, dates, relationships, and duplicate rules...');
    setErrorDetails([]);
    setSuccessInfo(null);

    try {
      const response = await fetch('/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-role': 'hr_uploader', // test client header
        },
        body: JSON.stringify({
          datasetType,
          csvContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setStatusMessage(data.error?.message || 'Import failed validation.');
        setErrorDetails(data.error?.errors || []);
        return;
      }

      setStatus('success');
      setStatusMessage(data.message || `Successfully imported ${data.importedRows} records.`);
      setSuccessInfo({
        datasetType: data.datasetType,
        importedRows: data.importedRows,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setStatus('error');
      setStatusMessage(err.message || 'Network error occurred while connecting to import API.');
      setErrorDetails([{ row: 0, column: 'network', message: 'Unable to reach import endpoint.' }]);
    }
  };

  return (
    <div>
      {/* Synthetic Dataset Policy Alert */}
      <div className="alert-banner alert-warning" role="alert">
        <div>
          <strong>SYNTHETIC DATA INGESTION ONLY:</strong> This endpoint is strictly restricted to
          the <strong>HR Uploader</strong> role. Never upload real personnel records, actual force
          identifiers, or genuine operational deployment data. This environment is an unclassified
          synthetic demonstration prototype.
        </div>
      </div>

      {/* Dataset Specification & Selector Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          Select Synthetic Dataset Schema
        </h2>
        <p className="card-desc">
          Ingestion is strictly constrained to approved operational tables. Direct SQL access or generic
          database table browsing is disabled in accordance with the security specification.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label htmlFor="dataset-select" className="form-label" style={{ fontWeight: 600 }}>
              Target Dataset:
            </label>
            <select
              id="dataset-select"
              className="form-input"
              value={datasetType}
              onChange={(e) => {
                setDatasetType(e.target.value);
                setStatus('idle');
                setErrorDetails([]);
                setSuccessInfo(null);
              }}
            >
              {Object.entries(DATASET_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Schema Constraints:
            </label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              <div><strong>Required Headers:</strong> {activeConfig.requiredCols.join(', ')}</div>
              <div><strong>Max Size:</strong> 2 MB &middot; <strong>Max Rows:</strong> 5,000</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload and Content Area */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.1rem', margin: 0 }}>
            Upload CSV File or Paste Data
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLoadSample}
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            >
              Load Valid Sample CSV
            </button>
            {csvContent && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClear}
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="csv-file-input" className="form-label">
            Choose CSV File from Disk:
          </label>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="form-input"
            style={{ padding: '0.4rem' }}
          />
          {fileName && (
            <p className="card-desc" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Selected file: <strong>{fileName}</strong>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="csv-text-editor" className="form-label">
            CSV Content (RFC-4180):
          </label>
          <textarea
            id="csv-text-editor"
            rows={8}
            className="form-input"
            placeholder={activeConfig.sampleCsv}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.4 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            <span>Lines: {csvContent ? csvContent.split('\n').filter((l) => l.trim().length > 0).length : 0}</span>
            <span>Bytes: {new Blob([csvContent]).size} / 2,097,152</span>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={status === 'loading'}
            style={{ minWidth: '160px' }}
          >
            {status === 'loading' ? 'Validating Batch...' : 'Validate & Import Batch'}
          </button>
          {status === 'loading' && (
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-blue)' }}>
              ⏳ Processing atomic transaction...
            </span>
          )}
        </div>
      </div>

      {/* Meaningful Loading State */}
      {status === 'loading' && (
        <div className="card" role="status" style={{ textAlign: 'center', padding: '2rem', border: '1px solid var(--accent-blue)' }}>
          <h3 className="card-title" style={{ justifyContent: 'center', color: 'var(--accent-blue)' }}>
            Validation &amp; Ingestion in Progress
          </h3>
          <p className="card-desc" style={{ maxWidth: '500px', margin: '0.5rem auto' }}>
            {statusMessage}
          </p>
        </div>
      )}

      {/* Meaningful Success State */}
      {status === 'success' && successInfo && (
        <div className="card" role="region" aria-label="Import Success" style={{ border: '1px solid var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.05)' }}>
          <h3 className="card-title" style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}>
            ✅ Ingestion Complete &amp; Committed
          </h3>
          <p className="card-desc" style={{ color: '#fff', marginBottom: '0.75rem' }}>
            {statusMessage}
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div><strong>Dataset:</strong> {successInfo.datasetType}</div>
            <div><strong>Rows Committed:</strong> {successInfo.importedRows}</div>
            <div><strong>Committed At:</strong> {successInfo.timestamp}</div>
            <div><strong>Status:</strong> Atomic Transaction Committed (All or Nothing)</div>
          </div>
          <p className="card-desc" style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.8rem' }}>
            ℹ️ Weekly metrics and baseline calculations will be refreshed on the next scheduled worker run.
          </p>
        </div>
      )}

      {/* Meaningful Error State with Safe Error Summaries (Zero Raw Row Logging) */}
      {status === 'error' && (
        <div className="card" role="alert" style={{ border: '1px solid var(--accent-red)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 className="card-title" style={{ color: 'var(--accent-red)', marginBottom: '0.5rem' }}>
            ❌ Import Rejected — Zero Records Committed
          </h3>
          <p className="card-desc" style={{ color: '#fff', marginBottom: '1rem' }}>
            {statusMessage}
          </p>

          {errorDetails.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                Safe Error Breakdown (Row &amp; Column Diagnostics):
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '80px' }}>Row #</th>
                      <th scope="col" style={{ width: '160px' }}>Field / Column</th>
                      <th scope="col">Validation Rule Violated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorDetails.map((err, i) => (
                      <tr key={i}>
                        <td><strong>{err.row === 0 ? 'File' : `Row ${err.row}`}</strong></td>
                        <td><code>{err.column}</code></td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="card-desc" style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                🛡️ Safe error logging enforced: Raw personal values and record contents are deliberately omitted to preserve data protection boundaries.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Meaningful Empty State */}
      {status === 'idle' && !csvContent && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--text-muted)' }}>
          <h3 className="card-title" style={{ justifyContent: 'center' }}>
            No Dataset Loaded
          </h3>
          <p className="card-desc" style={{ maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
            Select a dataset type above and upload a synthetic CSV file or click <strong>Load Valid Sample CSV</strong> to preview the ingestion format.
          </p>
          <div style={{ display: 'inline-flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleLoadSample}>
              Load Sample CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
