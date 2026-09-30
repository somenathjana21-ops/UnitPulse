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
  const bandCounts = { Normal: 0, Review: 0, Elevated: 0, Withheld: 0 };
  for (const c of unitCards) {
    if (c.isWithheld) bandCounts.Withheld++;
    else if (c.bandLabel && bandCounts[c.bandLabel] !== undefined) bandCounts[c.bandLabel]++;
  }
  const accessibleUnitSummary = `Assigned units overview: ${unitCards.length} unit(s) total (${bandCounts.Normal} Normal, ${bandCounts.Review} Review, ${bandCounts.Elevated} Elevated${bandCounts.Withheld > 0 ? `, ${bandCounts.Withheld} Withheld` : ''}).`;

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

      <div
        className="card"
        style={{
          padding: '0.6rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
        role="region"
        aria-label="Unit Status Summary"
      >
        <span style={{ fontWeight: 600, color: '#fff' }}>Overview:</span>
        <span>Total: <strong>{unitCards.length}</strong></span>
        <span>Normal: <strong style={{ color: 'var(--accent-emerald)' }}>{bandCounts.Normal}</strong></span>
        <span>Review: <strong style={{ color: 'var(--accent-amber)' }}>{bandCounts.Review}</strong></span>
        <span>Elevated: <strong style={{ color: 'var(--accent-red)' }}>{bandCounts.Elevated}</strong></span>
        {bandCounts.Withheld > 0 && <span>Withheld: <strong>{bandCounts.Withheld}</strong></span>}
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
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h2 className="card-title" style={{ justifyContent: 'center' }}>No Units Assigned</h2>
          <p className="card-desc" style={{ maxWidth: '400px', margin: '0.5rem auto 0' }}>
            No operational units are currently assigned to your commander credentials in the unit registry.
          </p>
        </div>
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
