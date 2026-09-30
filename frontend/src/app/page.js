import Link from 'next/link';

// Verify cross-workspace imports during build
import {
  MIN_GROUP_SIZE,
  SMALL_CELL_THRESHOLD,
  BREAK_GLASS_EXPIRY_MINUTES,
  REPORT_STATUSES,
} from '@unitpulse/backend';

import {
  INDEX_MAX_SCORE,
  COMPONENT_WEIGHTS,
  TRIGGER_RULES,
  NOISE_PARAMETERS,
} from '@unitpulse/ml';

export default function HomePage() {
  return (
    <div>
      {/* Synthetic Prototype Notice Banner */}
      <div className="alert-banner alert-warning">
        <div>
          <strong>PROTOTYPE NOTICE:</strong> You are viewing the public explanation page for{' '}
          <strong>Unit Pulse 2.0</strong> (Phase 0 Monorepo Scaffold). This system operates{' '}
          <strong>strictly on synthetic demo data</strong>. No real personnel records, active unit
          locations, or operational rosters are permitted in this deployment environment.
        </div>
      </div>

      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">Aggregate-First Welfare Intelligence</h1>
        <p className="hero-subtitle">
          Identifying unit-level occupational strain from leave, duty, and deployment patterns.
          Designed to explain contributing factors, recommend supportive actions, and confidentially alert
          authorized Welfare Officers without individual stigma.
        </p>

        <div className="badge-row">
          <span className="hero-badge">&bull; Problem Statement 26186</span>
          <span className="hero-badge">&bull; Operational Welfare, Never Discipline</span>
          <span className="hero-badge">&bull; Not a Medical Diagnosis</span>
          <span className="hero-badge">&bull; Synthetic Demo Only</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/login" className="nav-btn" style={{ padding: '0.65rem 1.5rem', fontSize: '1rem' }}>
            Access Role-Based Login &rarr;
          </Link>
          <a
            href="#how-it-works"
            className="nav-btn"
            style={{
              padding: '0.65rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
            }}
          >
            Learn How It Works
          </a>
        </div>
      </section>

      {/* 3 Core Questions */}
      <section id="how-it-works" style={{ marginBottom: '3rem' }}>
        <div className="section-header">
          <h2 className="section-title">The Three Core Principles</h2>
          <p className="section-subtitle">
            Unit Pulse 2.0 answers three questions in strict sequence, avoiding medicalized &ldquo;stress labels&rdquo;.
          </p>
        </div>

        <div className="grid-3">
          <div className="card">
            <h3 className="card-title">1. What changed?</h3>
            <p className="card-desc">
              The <strong>Unit Load &amp; Recovery Index</strong> (0 to 100) measures aggregate organizational conditions.
              Elevations are evaluated against the unit&apos;s own rolling baseline (median of up to 8 prior weeks)
              rather than rigid across-force quotas.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-blue)' }}>
              Spike Threshold: &ge;15 pts over baseline with index &ge;40.
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">2. What records support that observation?</h3>
            <p className="card-desc">
              Every index score is calculated deterministically from verified aggregate inputs: leave coverage,
              recovery gap (&gt;60 days without qualifying leave), 28-day night shift counts, and continuous deployment duration.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-blue)' }}>
              Deterministic scoring formula &bull; Max: {INDEX_MAX_SCORE} points.
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">3. What simple action can a person review?</h3>
            <p className="card-desc">
              AI summaries and deterministic templates translate aggregate pressures into bounded, non-disciplinary
              options: reviewing leave queues, rebalancing rosters, or scheduling recovery periods.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-blue)' }}>
              Options framed as &ldquo;consider&rdquo; and &ldquo;review&rdquo; &bull; Never automated orders.
            </div>
          </div>
        </div>
      </section>

      {/* Cross-Workspace Module Resolution Proof */}
      <section style={{ marginBottom: '3rem' }}>
        <div className="section-header">
          <h2 className="section-title">Verified Monorepo Workspace Integration</h2>
          <p className="section-subtitle">
            Values imported directly from <code>@unitpulse/backend</code> and <code>@unitpulse/ml</code> into the Next.js App Router.
          </p>
        </div>

        <div className="grid-2">
          <div className="card">
            <h3 className="card-title">
              <span className="status-pill status-ready">Server-Only Backend Domain</span>
              <code>@unitpulse/backend</code>
            </h3>
            <p className="card-desc">
              Server-only security boundaries, privacy suppression parameters, and audit safeguards.
            </p>
            <table className="data-table">
              <tbody>
                <tr>
                  <td><strong>Min Group Size (k-anonymity)</strong></td>
                  <td><code>{MIN_GROUP_SIZE} personnel</code> (groups &lt; 5 suppressed)</td>
                </tr>
                <tr>
                  <td><strong>Small Cell Suppression</strong></td>
                  <td><code>{SMALL_CELL_THRESHOLD} records</code> (cells &lt; 5 withheld)</td>
                </tr>
                <tr>
                  <td><strong>Break-Glass Grant Expiry</strong></td>
                  <td><code>{BREAK_GLASS_EXPIRY_MINUTES} minutes</code> (server-enforced)</td>
                </tr>
                <tr>
                  <td><strong>Welfare Report Lifecycle</strong></td>
                  <td><code>{REPORT_STATUSES.join(' &rarr; ')}</code></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="card-title">
              <span className="status-pill status-ready">Deterministic Analytics Engine</span>
              <code>@unitpulse/ml</code>
            </h3>
            <p className="card-desc">
              Deterministic scoring, rolling baseline medians, trigger rules, and noise parameters.
            </p>
            <table className="data-table">
              <tbody>
                <tr>
                  <td><strong>Maximum Index Score</strong></td>
                  <td><code>{INDEX_MAX_SCORE} points</code> (Leave: {COMPONENT_WEIGHTS.leave.maxPoints}, Night: {COMPONENT_WEIGHTS.nightDuty.maxPoints}, Deploy: {COMPONENT_WEIGHTS.deployment.maxPoints}, Workload: {COMPONENT_WEIGHTS.workload.maxPoints})</td>
                </tr>
                <tr>
                  <td><strong>Spike Trigger Rule</strong></td>
                  <td><code>Index &ge; {TRIGGER_RULES.spike.minCurrentIndex} &amp; &ge; Baseline + {TRIGGER_RULES.spike.minDeltaAboveBaseline}</code></td>
                </tr>
                <tr>
                  <td><strong>Sustained-High Rule</strong></td>
                  <td><code>Index &ge; {TRIGGER_RULES.sustainedHigh.threshold} for {TRIGGER_RULES.sustainedHigh.consecutiveWeeks} consecutive weeks</code></td>
                </tr>
                <tr>
                  <td><strong>Calibrated Noise Budget</strong></td>
                  <td><code>&epsilon; = {NOISE_PARAMETERS.epsilon}</code> (Laplace noise on bounded counts)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Privacy and Security Guardrails */}
      <section style={{ marginBottom: '3rem' }}>
        <div className="section-header">
          <h2 className="section-title">Privacy and Security Guardrails</h2>
          <p className="section-subtitle">
            Architectural guarantees from docs/05-system-architecture.md and docs/10-security-privacy.md.
          </p>
        </div>

        <div className="grid-3">
          <div className="card">
            <h3 className="card-title">Aggregate by Default</h3>
            <p className="card-desc">
              Commanders receive unit-level cards only. No names, personnel IDs, or individual rankings are ever delivered.
              Small cells and groups under five are withheld.
            </p>
          </div>
          <div className="card">
            <h3 className="card-title">Schema Separation &amp; RLS</h3>
            <p className="card-desc">
              Raw synthetic records reside in an unexposed private PostgreSQL schema. User-facing routes query approved
              weekly release tables protected by Row-Level Security.
            </p>
          </div>
          <div className="card">
            <h3 className="card-title">Audited Break-Glass Flow</h3>
            <p className="card-desc">
              If exceptional individual review is required, the assigned Welfare Officer must provide a documented reason,
              receive a time-limited 30-minute grant, and every record read is immutably audited.
            </p>
          </div>
        </div>
      </section>

      {/* Transparent Roadmap & TODO List */}
      <section id="roadmap" style={{ marginBottom: '3rem' }}>
        <div className="section-header">
          <h2 className="section-title">Implementation Status &amp; Roadmap (TODO List)</h2>
          <p className="section-subtitle">
            Clear tracking of completed foundational scaffold and upcoming feature phases.
          </p>
        </div>

        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Deliverables</th>
                <th>Target Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Phase 0</strong></td>
                <td>Monorepo scaffold, npm workspaces, scripts, public explanation &amp; login, security audits</td>
                <td>frontend/, backend/, ml/, scripts/</td>
                <td><span className="status-pill status-ready">COMPLETED</span></td>
              </tr>
              <tr>
                <td><strong>Phase 1</strong></td>
                <td>Supabase SQL migrations, private schema, RLS policies, synthetic seed generator (6 fictional units, 60 people each)</td>
                <td>supabase/migrations/, scripts/seed-demo.js</td>
                <td><span className="status-pill status-ready">COMPLETED</span></td>
              </tr>
              <tr>
                <td><strong>Phase 2</strong></td>
                <td>Weekly verified metrics pipeline, Laplace noise release job, k-anonymity test fixtures</td>
                <td>backend/src/release.js, ml/src/scoring.js</td>
                <td><span className="status-pill status-ready">COMPLETED</span></td>
              </tr>
              <tr>
                <td><strong>Phase 3</strong></td>
                <td>Commander dashboard (/commander, /commander/units/[id]), trend cards, accessible charts</td>
                <td>frontend/src/app/commander/</td>
                <td><span className="status-pill status-ready">COMPLETED</span></td>
              </tr>
              <tr>
                <td><strong>Phase 4</strong></td>
                <td>Welfare inbox (/welfare), report lifecycle, Vercel cron weekly worker, overdue indicators</td>
                <td>frontend/src/app/welfare/, backend/src/worker.js</td>
                <td><span className="status-pill status-pending">SCHEDULED (PHASE 4)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 5</strong></td>
                <td>OpenAI-compatible AI adapter, prompt allow-lists, deterministic fallback templates</td>
                <td>backend/src/ai-adapter.js</td>
                <td><span className="status-pill status-pending">SCHEDULED (PHASE 5)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
