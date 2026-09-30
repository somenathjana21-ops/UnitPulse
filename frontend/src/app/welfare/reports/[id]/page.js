import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../lib/commander/repository.js';
import { fetchReportById } from '../../../../lib/welfare/repository.js';
import { buildReportDetailViewModel } from '../../../../lib/welfare/view-model.js';
import ReportWorkflowForm from './ReportWorkflowForm.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  return {
    title: `Welfare Report ${params.id} — Unit Pulse 2.0 (Synthetic Demo)`,
    description: 'Confidential unit welfare case review and follow-up.',
  };
}

export default async function WelfareReportDetailPage({ params }) {
  const { id } = params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="card">
        <h1 className="card-title">Backend not configured</h1>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          This environment has no Supabase project connected yet. The welfare report detail
          requires an authenticated welfare officer session.
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

  // Scoped to assigned officer only -- unassigned returns null -> notFound()
  const rawReport = await fetchReportById(supabase, id, user.id);
  if (!rawReport) {
    notFound();
  }

  const report = buildReportDetailViewModel(rawReport);

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        <Link href="/welfare" style={{ color: 'var(--text-muted)' }}>
          &larr; Back to Welfare Inbox
        </Link>
      </div>

      {/* Overdue Review Banner */}
      {report.isOverdue && (
        <div
          className="alert-banner alert-warning"
          style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-bg)', color: '#fee2e2' }}
        >
          <div>
            <strong>⚠️ REVIEW OVERDUE:</strong> {report.overdueMessage}
            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.25rem' }}>
              Please review current unit conditions and advance the workflow status below.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 className="section-title" style={{ margin: 0 }}>Report: {report.unitId}</h1>
            <span className={`status-pill ${report.badgeClass}`}>
              {report.statusLabel}
            </span>
          </div>
          <p className="section-subtitle">
            Completed Week of <strong>{report.weekStart}</strong> &middot; Case ID: <code style={{ fontSize: '0.8rem' }}>{report.id.slice(0, 8)}</code>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Created: {new Date(report.createdAt).toLocaleDateString()}
          </div>
          {report.acknowledgedAt && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Acknowledged: {new Date(report.acknowledgedAt).toLocaleDateString()}
            </div>
          )}
          {report.followUpOn && (
            <div style={{ fontSize: '0.85rem', color: report.isOverdue ? 'var(--accent-red)' : 'var(--accent-amber)', fontWeight: 600 }}>
              Follow-Up Scheduled: {report.followUpOn}
            </div>
          )}
        </div>
      </div>

      {/* Aggregate Overview Card */}
      <div className="grid-2">
        <div className="card">
          <h2 className="card-title">Trigger Reason &amp; Rules</h2>
          <div style={{ marginBottom: '1rem' }}>
            <span className="hero-badge" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
              {report.triggerRuleLabel}
            </span>
            <p className="card-desc" style={{ color: 'var(--text-main)' }}>
              {report.triggerReason}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Unit Load &amp; Recovery Index
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-red)' }}>
                {report.index} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ 100</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Rolling Baseline
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
                {report.baseline} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>({report.comparableWeeksCount} wks)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Contributing Operational Indicators</h2>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            {report.contributingFactors.map((factor, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-main)' }}>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Suggested Supportive Actions */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="card-title">Suggested Supportive Actions</h2>
        <p className="card-desc">
          Operational adjustments to consider in consultation with unit leadership. Bounded and non-disciplinary.
        </p>

        <div className="grid-3" style={{ marginBottom: 0 }}>
          {report.suggestedActions.map((act, idx) => (
            <div key={idx} className="card" style={{ background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '0.4rem' }}>
                {act.category.replace(/_/g, ' ')}
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>
                {act.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Workflow Form */}
      <div style={{ marginBottom: '2rem' }}>
        <ReportWorkflowForm
          reportId={report.id}
          currentStatus={report.status}
          allowedNextStatuses={report.allowedNextStatuses}
          initialFollowUpOn={report.followUpOn}
        />
      </div>

      {/* Exceptional Access Notice */}
      <details className="card" style={{ marginBottom: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#fff' }}>
          Exceptional Individual Access (Break-Glass Protocol)
        </summary>
        <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7 }}>
          <p style={{ marginBottom: '0.75rem' }}>
            Unit Pulse 2.0 operates strictly aggregate-first. If individual leave or roster verification is
            genuinely required for follow-up intervention, an audited break-glass request must be submitted.
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
            <li>Requires documented operational justification.</li>
            <li>Restricted to 30-minute auto-expiring window.</li>
            <li>Limited to max 20 pseudonymous personnel records per page.</li>
            <li>Every individual row read is recorded in an immutable database audit log.</li>
          </ul>
        </div>
      </details>

      {/* Safety Notice */}
      <div className="safety-box">
        <strong>Non-Diagnostic Disclaimer:</strong> {report.disclaimer}
      </div>
    </div>
  );
}
