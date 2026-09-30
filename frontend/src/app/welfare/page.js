import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../lib/supabase/server.js';
import { fetchUserContext } from '../../lib/commander/repository.js';
import { fetchAssignedReports } from '../../lib/welfare/repository.js';
import { buildReportInboxViewModel } from '../../lib/welfare/view-model.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Welfare Officer Inbox — Unit Pulse 2.0 (Synthetic Demo)',
  description: 'Assigned confidential unit welfare reports and follow-up tracking.',
};

export default async function WelfareInboxPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card">
        <h1 className="card-title">Backend not configured</h1>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          This environment has no Supabase project connected yet (NEXT_PUBLIC_SUPABASE_URL /
          NEXT_PUBLIC_SUPABASE_ANON_KEY are unset). The welfare portal requires an authenticated
          welfare officer session.
        </p>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'welfare_officer') {
    redirect('/login');
  }

  const rawReports = await fetchAssignedReports(supabase, user.id);
  const inbox = buildReportInboxViewModel(rawReports);

  return (
    <div>
      {/* Synthetic Demo Banner */}
      <div className="alert-banner alert-warning">
        <div>
          <strong>CONFIDENTIAL WELFARE INBOX (SYNTHETIC DEMO):</strong> This view contains triggered
          occupational welfare reports assigned to your account. Commander accounts cannot access this portal.
          Case details are never transmitted via email.
        </div>
      </div>

      {/* In-App Notifications (Replaces Email Dispatch) */}
      {inbox.notifications.map((notif, idx) => (
        <div
          key={idx}
          className={`alert-banner ${notif.type === 'warning' ? 'alert-warning' : 'alert-info'}`}
          style={{ borderColor: notif.type === 'warning' ? 'var(--accent-red)' : undefined }}
        >
          <div>
            <strong>{notif.title}:</strong> {notif.message}
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '0.25rem' }}>
              🔒 Confined to secure in-app inbox. Email notifications with case details are disabled in accordance with the privacy specification.
            </div>
          </div>
        </div>
      ))}

      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="section-title">Assigned Welfare Reports</h1>
          <p className="section-subtitle">
            Unit Load &amp; Recovery Index alerts triggered by deterministic spike or sustained-high conditions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="hero-badge">Active: {inbox.stats.activeCount}</span>
          {inbox.stats.overdueCount > 0 && (
            <span className="status-pill status-elevated" style={{ fontWeight: 700 }}>
              ⚠️ Overdue: {inbox.stats.overdueCount}
            </span>
          )}
          <span className="hero-badge">Closed: {inbox.stats.closedCount}</span>
          <Link href="/welfare/audit" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
            📋 Access Audit Trail
          </Link>
        </div>
      </div>

      {inbox.reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h3 className="card-title" style={{ justifyContent: 'center' }}>No Reports in Inbox</h3>
          <p className="card-desc">
            All units currently assigned to your care have stable recovery conditions or active cases are closed.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table card" style={{ padding: 0 }}>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Week Completed</th>
                <th>Status</th>
                <th>Review Milestones</th>
                <th>Trigger Rule</th>
                <th>Index (Approx)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {inbox.reports.map((report) => (
                <tr key={report.id} style={{ background: report.isOverdue ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                  <td>
                    <strong>{report.unitId}</strong>
                  </td>
                  <td>{report.weekStart}</td>
                  <td>
                    <span className={`status-pill ${report.badgeClass}`}>
                      {report.statusLabel}
                    </span>
                  </td>
                  <td>
                    {report.isOverdue && (
                      <div style={{ marginBottom: '0.25rem' }}>
                        <span
                          className="status-pill status-elevated"
                          style={{ fontSize: '0.7rem', display: 'inline-block' }}
                        >
                          ⚠️ Overdue Review
                        </span>
                      </div>
                    )}
                    {report.followUpOn && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Follow-up: {report.followUpOn}
                      </span>
                    )}
                    {!report.followUpOn && report.status === 'new' && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Needs Acknowledgment
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{report.triggerRuleLabel}</span>
                  </td>
                  <td>
                    <strong>{report.index}</strong>
                    {report.baseline !== '—' && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {' '}(base: {report.baseline})
                      </span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/welfare/reports/${encodeURIComponent(report.id)}`}
                      className="nav-btn"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Open Case &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="safety-box" style={{ marginTop: '2.5rem' }}>
        <strong>Welfare Practice Notice:</strong> The Unit Load &amp; Recovery Index is an operational
        welfare planning indicator reflecting recorded duty, leave, and deployment patterns. It is not a
        clinical, psychological, or medical diagnosis, and must never be cited in disciplinary or promotional assessments.
      </div>
    </div>
  );
}
