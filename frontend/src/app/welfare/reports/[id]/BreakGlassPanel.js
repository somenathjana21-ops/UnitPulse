'use client';

/**
 * frontend/src/app/welfare/reports/[id]/BreakGlassPanel.js
 *
 * Exceptional individual-read workflow component (Break-Glass Protocol).
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md,
 *                 docs/11-testing-plan.md
 *
 * Rules:
 * - Compulsory reason code and typed justification (min 10 characters).
 * - Server-enforced 30-minute expiry with active countdown.
 * - Max 20 pseudonymous records per page (paginated).
 * - Every individual read is logged to the database audit trail.
 * - Cache-Control: no-store and NO download/export buttons.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BreakGlassPanel({ reportId, unitId }) {
  const [grant, setGrant] = useState(null);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [reasonCode, setReasonCode] = useState('welfare_review');
  const [reasonText, setReasonText] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordError, setRecordError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Timer countdown effect for active grant
  useEffect(() => {
    if (!grant || !grant.expiresAt) return;

    function updateRemaining() {
      const remainingMs = new Date(grant.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setGrant(null);
        setRecords([]);
        setRemainingMinutes(0);
        setRequestError('Access grant has expired. Please submit a new reasoned request if review is still necessary.');
      } else {
        setRemainingMinutes(Math.ceil(remainingMs / (60 * 1000)));
      }
    }

    updateRemaining();
    const interval = setInterval(updateRemaining, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [grant]);

  // Request new grant
  async function handleRequestGrant(e) {
    e.preventDefault();
    if (reasonText.trim().length < 10) {
      setRequestError('Operational justification must be at least 10 characters.');
      return;
    }

    setRequesting(true);
    setRequestError(null);

    try {
      const res = await fetch(`/api/welfare/reports/${reportId}/access-grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode,
          reason: reasonText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to request break-glass access grant');
      }

      setGrant(data);
      setRemainingMinutes(data.expiryMinutes || 30);
      setReasonText('');
      setOffset(0);

      // Immediately fetch first page of individual records
      await fetchRecords(data.grantId, 0);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequesting(false);
    }
  }

  // Fetch paginated pseudonymous individual records
  async function fetchRecords(grantId, newOffset) {
    setLoadingRecords(true);
    setRecordError(null);

    try {
      const res = await fetch(
        `/api/welfare/reports/${reportId}/individuals?grantId=${encodeURIComponent(grantId)}&offset=${newOffset}&limit=20`,
        {
          headers: { 'Cache-Control': 'no-store' },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.error?.code === 'grant_expired') {
          setGrant(null);
          setRecords([]);
          throw new Error('Access grant has expired. Please request a new reasoned grant.');
        }
        throw new Error(data.error?.message || 'Failed to fetch individual records');
      }

      setRecords(data.records || []);
      setOffset(newOffset);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setRecordError(err.message);
    } finally {
      setLoadingRecords(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--accent-amber)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className="card-title" style={{ margin: 0, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🛡️ Exceptional Individual Access</span>
          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', fontWeight: 600 }}>
            Break-Glass Protocol
          </span>
        </h2>
        <Link href="/welfare/audit" style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', textDecoration: 'none' }}>
          📋 View My Access Audit Trail &rarr;
        </Link>
      </div>

      <p className="card-desc" style={{ marginBottom: '1.25rem' }}>
        Unit Pulse 2.0 operates <strong>aggregate-first</strong>. Individual leave and roster records are exceptional,
        require documented operational justification, expire after <strong>30 minutes</strong>, and are restricted to at most 20 pseudonymous rows.
        <strong> Every read is permanently recorded in your officer audit trail.</strong>
      </p>

      {/* Grant Request Form (When no active grant) */}
      {!grant && (
        <form onSubmit={handleRequestGrant} style={{ background: 'var(--bg-card-subtle)', padding: '1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: '0.75rem' }}>
            Request Limited 30-Minute Individual View
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="reasonCodeSelect" style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Reason Code <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <select
                id="reasonCodeSelect"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }}
                disabled={requesting}
              >
                <option value="welfare_review">Welfare Review — Supportive follow-up check-in</option>
                <option value="roster_audit">Roster Audit — Night shift and recovery interval inspection</option>
                <option value="safety_check">Safety Check — Operational health & fatigue inspection</option>
                <option value="leave_rebalancing_assessment">Leave Rebalancing — Extended recovery gap evaluation</option>
                <option value="emergency_support">Emergency Support — Urgent operational welfare support</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="reasonTextarea" style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Operational Justification (min 10 characters) <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <textarea
              id="reasonTextarea"
              rows={2}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="State the specific operational welfare purpose requiring individual roster/leave verification..."
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', resize: 'vertical' }}
              disabled={requesting}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Stored justifications are encrypted server-side with AES-256-GCM. Plaintext is never logged.
            </div>
          </div>

          {requestError && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              ⚠️ {requestError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ background: 'var(--accent-amber)', borderColor: 'var(--accent-amber)', color: '#000', fontWeight: 600 }}
            disabled={requesting || reasonText.trim().length < 10}
          >
            {requesting ? 'Granting Access...' : 'Request 30-Minute Grant & View Records'}
          </button>
        </form>
      )}

      {/* Active Grant Banner & Records View */}
      {grant && (
        <div>
          {/* Active Grant Status Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--accent-amber)',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--accent-amber)', marginRight: '0.75rem' }}>
                ⏱️ Active Grant: ~{remainingMinutes}m remaining
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                (Expires: {new Date(grant.expiresAt).toLocaleTimeString()}) &middot; Reason: <code>{grant.reasonCode}</code>
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 Audited Read: queries permanently logged
            </div>
          </div>

          {recordError && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              ⚠️ {recordError}
            </div>
          )}

          {/* Pseudonymous Individual Records Table */}
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Personnel ID</th>
                  <th style={{ padding: '8px 10px' }}>Unit</th>
                  <th style={{ padding: '8px 10px' }}>History Start</th>
                  <th style={{ padding: '8px 10px' }}>Recent Leave Status</th>
                  <th style={{ padding: '8px 10px' }}>28d Night Shifts</th>
                  <th style={{ padding: '8px 10px' }}>7d Duty Hours</th>
                </tr>
              </thead>
              <tbody>
                {loadingRecords ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading audited pseudonymous records...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No records returned for this unit.
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-blue)' }}>
                        {r.personnelId}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                        {r.unitId}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                        {r.historyStartOn}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: r.recentLeaveStatus === 'taken' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: r.recentLeaveStatus === 'taken' ? '#10b981' : '#fff',
                        }}>
                          {r.recentLeaveStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: r.nightShiftsCount > 10 ? 'var(--accent-red)' : '#fff' }}>
                        {r.nightShiftsCount} shifts
                      </td>
                      <td style={{ padding: '8px 10px', color: r.recordedDutyHours > 52 ? 'var(--accent-red)' : '#fff' }}>
                        {r.recordedDutyHours} hrs
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div>
              Showing {records.length > 0 ? offset + 1 : 0}–{offset + records.length} records (max 20/page)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                disabled={offset === 0 || loadingRecords}
                onClick={() => fetchRecords(grant.grantId, Math.max(0, offset - 20))}
              >
                &larr; Previous 20
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                disabled={!hasMore || loadingRecords}
                onClick={() => fetchRecords(grant.grantId, offset + 20)}
              >
                Next 20 &rarr;
              </button>
            </div>
          </div>

          {/* Safeguard Notice: Download / Export avoidance */}
          <div style={{ marginTop: '1rem', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ⚠️ <strong>Data Safeguard:</strong> In accordance with docs/10-security-privacy.md, bulk export and download of individual rows are prohibited.
            Data is strictly no-store and ephemeral.
          </div>
        </div>
      )}
    </div>
  );
}
