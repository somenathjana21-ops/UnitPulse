/**
 * frontend/src/app/welfare/audit/page.js
 *
 * Officer Access Audit Viewer.
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 *
 * Rules:
 * - Scoped strictly to the authenticated Welfare Officer's own events.
 * - Non-welfare users cannot access this page.
 * - Shows who/when/which report/action/row_count/reason.
 * - Cache-Control: no-store enforced.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../lib/commander/repository.js';
import { fetchOfficerAuditTrail } from '../../../lib/welfare/break-glass.js';
import { getServiceRoleClient } from '@unitpulse/backend';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Access Audit Log — Unit Pulse 2.0 (Synthetic Demo)',
    description: 'Officer access audit trail for exceptional break-glass reads.',
  };
}

export default async function OfficerAuditPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card">
        <h1 className="card-title">Backend not configured</h1>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          This environment has no Supabase project connected yet. The welfare audit log
          requires an authenticated welfare officer session.
        </p>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user || user.role !== 'welfare_officer') {
    redirect('/login');
  }

  const serviceSupabase = getServiceRoleClient();
  const events = await fetchOfficerAuditTrail({
    officerId: user.id,
    limit: 100,
    serviceSupabase,
  });

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        <Link href="/welfare" style={{ color: 'var(--text-muted)' }}>
          &larr; Back to Welfare Inbox
        </Link>
      </div>

      {/* Header */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="section-title">Officer Access Audit Trail</h1>
        <p className="section-subtitle">
          Immutable log of all break-glass grants and individual record reads performed under your officer credentials.
        </p>
      </div>

      {/* Security Context Banner */}
      <div
        className="card"
        style={{
          background: 'var(--bg-card-subtle)',
          borderLeft: '4px solid var(--accent-blue)',
          marginBottom: '2rem',
        }}
      >
        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
          <strong>🛡️ Transparency &amp; Non-Surveillance Policy:</strong> Every query for individual-level records is transactionally recorded
          in the database before data is returned. This audit log cannot be modified, cleared, or suppressed.
          Commanders do not have access to individual records or this audit trail.
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Access History ({events.length} events)</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            Officer ID: <code>{user.id.slice(0, 8)}</code>
          </span>
        </h2>

        {events.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No exceptional access events recorded yet. Access grants and individual record reads will appear here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Timestamp (UTC)</th>
                  <th style={{ padding: '10px' }}>Action</th>
                  <th style={{ padding: '10px' }}>Unit</th>
                  <th style={{ padding: '10px' }}>Linked Report</th>
                  <th style={{ padding: '10px' }}>Rows Read</th>
                  <th style={{ padding: '10px' }}>Reason Code</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                      {new Date(evt.occurredAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: evt.action === 'individual_read' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: evt.action === 'individual_read' ? 'var(--accent-blue)' : 'var(--accent-amber)',
                      }}>
                        {evt.action === 'individual_read' ? '📖 Individual Read' : '🔑 Grant Requested'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>
                      {evt.unitId}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <Link href={`/welfare/reports/${evt.reportId}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                        <code>{evt.reportId ? evt.reportId.slice(0, 8) : 'N/A'}</code>
                      </Link>
                    </td>
                    <td style={{ padding: '10px', color: evt.rowCount > 0 ? '#fff' : 'var(--text-muted)' }}>
                      {evt.rowCount > 0 ? `${evt.rowCount} records` : '—'}
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {evt.reasonCode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="safety-box">
        <strong>Non-Diagnostic Disclaimer:</strong> The Unit Load &amp; Recovery Index is an operational welfare planning indicator.
        It is NOT a medical diagnosis and must never be used as evidence of individual psychological fitness, misconduct, or eligibility for promotion or deployment.
      </div>
    </div>
  );
}
