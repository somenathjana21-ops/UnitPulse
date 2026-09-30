import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../lib/supabase/server.js';
import { fetchUserContext, fetchReleaseHistory } from '../../../../lib/commander/repository.js';
import { resolveCommanderUnitAccess } from '../../../../lib/commander/authorize.js';
import {
  buildUnitCardViewModel,
  buildTrendSeriesViewModel,
  buildEvidenceCards,
  buildSuggestedActions,
  mapBandToDisplayLabel,
} from '../../../../lib/commander/view-model.js';
import TrendChart from '../../TrendChart.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  return {
    title: `${params.id} — Unit Detail — Unit Pulse 2.0 (Synthetic Demo)`,
    description: 'Approved aggregate detail. Not a medical diagnosis.',
  };
}

export default async function UnitDetailPage({ params }) {
  const unitId = params.id;

  if (!isSupabaseConfigured()) {
    return (
      <div className="card">
        <h1 className="card-title">Backend not configured</h1>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          This environment has no Supabase project connected yet.
        </p>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user) {
    redirect('/login');
  }

  const access = resolveCommanderUnitAccess({ user, unitId });
  if (!access.allowed) {
    // 404, never 403 -- does not confirm whether unitId exists at all.
    notFound();
  }

  const history = await fetchReleaseHistory(supabase, unitId, 8);
  const latest = history[history.length - 1] ?? null;
  const card = buildUnitCardViewModel(unitId, latest);
  const trend = buildTrendSeriesViewModel(history);
  const evidence = buildEvidenceCards(latest);
  const actions = buildSuggestedActions(latest);

  return (
    <div>
      <Link href="/commander" className="nav-link" style={{ display: 'inline-block', marginBottom: '1.5rem' }}>
        &larr; Back to your units
      </Link>

      <div className="section-header">
        <h1 className="section-title">
          {unitId}
          {card.bandLabel && (
            <span
              className={`status-pill ${card.bandLabel === 'Elevated' ? 'status-elevated' : card.bandLabel === 'Review' ? 'status-pending' : 'status-ready'}`}
              style={{ marginLeft: '0.75rem', verticalAlign: 'middle' }}
            >
              {card.bandLabel}
            </span>
          )}
        </h1>
        <p className="section-subtitle">
          Approved aggregate detail for the most recent completed week. Possible contributing conditions, never a diagnosis.
        </p>
      </div>

      {card.isWithheld || !card.hasData ? (
        <div className="card">
          <p className="card-desc" style={{ marginBottom: 0 }}>
            {card.statusMessage ?? 'No completed weekly release yet for this unit.'}
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Weekly trend</h2>
            <TrendChart points={trend.points} hasWithheldWeeks={trend.hasWithheldWeeks} />
          </div>

          <div className="grid-2">
            <div className="card">
              <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Possible contributing conditions</h2>
              {evidence.length === 0 ? (
                <p className="card-desc">No specific indicators are published for this week beyond the overall index.</p>
              ) : (
                <table className="data-table">
                  <tbody>
                    {evidence.map((e) => (
                      <tr key={e.evidenceKey}>
                        <th scope="row" style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{e.label}</th>
                        <td>{e.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Supportive options to consider</h2>
              <ul style={{ paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {actions.map((a, i) => (
                  <li key={i}>{a.text}</li>
                ))}
              </ul>
              <p className="card-desc" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
                These are non-disciplinary options for a human to review, not automated orders.
              </p>
            </div>
          </div>
        </>
      )}

      <details className="card" style={{ marginTop: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#fff' }}>How this works</summary>
        <p className="card-desc" style={{ marginTop: '1rem', marginBottom: 0 }}>
          The Unit Load &amp; Recovery Index is a deterministic, code-computed indicator (0-100) comparing this
          unit&apos;s recent verified leave, night-duty, deployment, and workload conditions against its own
          rolling baseline. It is <strong>not</strong> a medical or psychological diagnosis and must never be
          used as evidence of individual fitness, misconduct, or eligibility for promotion or deployment.
        </p>
      </details>
    </div>
  );
}
