import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../lib/supabase/server.js';
import { fetchUserContext, fetchLatestReleasesForUnits } from '../../lib/commander/repository.js';
import { buildUnitCardViewModel } from '../../lib/commander/view-model.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Commander Dashboard — Unit Pulse 2.0 (Synthetic Demo)',
  description: 'Assigned unit cards, aggregate only. Not a medical diagnosis.',
};

const BAND_PILL_CLASS = {
  Normal: 'status-ready',
  Review: 'status-pending',
  Elevated: 'status-elevated',
};

export default async function CommanderPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card">
        <h1 className="card-title">Backend not configured</h1>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          This environment has no Supabase project connected yet (NEXT_PUBLIC_SUPABASE_URL /
          NEXT_PUBLIC_SUPABASE_ANON_KEY are unset). Nothing here is a fake or bypassed sign-in --
          the dashboard simply has no backend to authenticate against in this environment.
        </p>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user) {
    redirect('/login');
  }
  if (user.role !== 'commander') {
    // Not a role/unit-scope violation to reveal -- just the wrong portal for this account.
    redirect('/login');
  }

  const releases = await fetchLatestReleasesForUnits(supabase, user.assignedUnitIds);
  const releaseByUnit = new Map(releases.map((r) => [r.unit_id, r]));
  const unitCards = user.assignedUnitIds.map((unitId) => buildUnitCardViewModel(unitId, releaseByUnit.get(unitId) ?? null));

  return (
    <div>
      <div className="alert-banner alert-warning">
        <div>
          <strong>SYNTHETIC DEMO:</strong> All units and figures below are fictional. This dashboard shows
          only approved, unit-level aggregates for units assigned to your account.
        </div>
      </div>

      <div className="section-header">
        <h1 className="section-title">Your Units</h1>
        <p className="section-subtitle">
          Possible contributing conditions, never a diagnosis. Small groups and revealing details are withheld.
        </p>
      </div>

      <details className="card" style={{ marginBottom: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#fff' }}>How this works</summary>
        <ol style={{ marginTop: '1rem', paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <li><strong>See unit health</strong> — each card shows the Unit Load &amp; Recovery Index against its own rolling baseline.</li>
          <li><strong>Understand possible contributors</strong> — open a unit to see which verified indicators (leave, night duty, workload) are elevated.</li>
          <li><strong>Consider supportive actions</strong> — suggested options are framed as things to review or consider, never automatic orders.</li>
        </ol>
      </details>

      {unitCards.length === 0 ? (
        <p className="card-desc">No units are currently assigned to your account.</p>
      ) : (
        <div className="grid-3">
          {unitCards.map((card) => (
            <Link
              key={card.unitId}
              href={`/commander/units/${encodeURIComponent(card.unitId)}`}
              className="card"
              style={{ display: 'block', color: 'inherit' }}
            >
              <h3 className="card-title">
                {card.unitId}
                {card.bandLabel && (
                  <span className={`status-pill ${BAND_PILL_CLASS[card.bandLabel] ?? 'status-pending'}`}>
                    {card.bandLabel}
                  </span>
                )}
              </h3>
              {card.hasData ? (
                card.isWithheld ? (
                  <p className="card-desc">{card.statusMessage}</p>
                ) : (
                  <>
                    <p className="card-desc">
                      Index (approx.): <strong>{card.indexApprox ?? '—'}</strong>
                      {card.baselineApprox !== null && <> &middot; Baseline: {card.baselineApprox}</>}
                    </p>
                    <p className="card-desc" style={{ fontSize: '0.8rem', marginBottom: 0 }}>Week of {card.weekStart}</p>
                  </>
                )
              ) : (
                <p className="card-desc">{card.statusMessage}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
