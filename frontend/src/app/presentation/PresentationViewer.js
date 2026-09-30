'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PresentationViewer() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const SLIDES = [
    {
      id: 1,
      tag: 'PROBLEM STATEMENT 26186',
      title: 'Unit Pulse 2.0',
      subtitle: 'Privacy-First Aggregate Welfare Intelligence for Uniformed Services',
      timing: '0:00 - 0:20 (20s)',
      presenterNotes:
        'Welcome. This is Unit Pulse 2.0. Uniformed personnel face high-tempo duties, prolonged deployments, and delayed leave recovery. Existing welfare identification depends on manual observation or self-reporting, creating stigma and delayed assistance. Unit Pulse 2.0 calculates unit-level occupational load from routine operational records, compares units against their own rolling baselines, and alerts welfare officers without ever exposing individuals to commanders.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#1f2937', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Target Organization</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: '#f9fafb' }}>Ministry of Home Affairs</div>
              <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>CRPF &bull; Police II Division &bull; Theme: HealthTech / MedTech</div>
            </div>
            <div style={{ background: '#1f2937', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Core Problem</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: '#f9fafb' }}>Delayed &amp; Stigmatized Welfare Detection</div>
              <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>Individual stress profiling creates stigma, fear of career penalty, and distrust.</div>
            </div>
            <div style={{ background: '#1f2937', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Proposed Innovation</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: '#f9fafb' }}>Aggregate-First Welfare Intelligence</div>
              <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>Unit-level index (0-100), rolling baselines, confidential escalation, zero commander personnel access.</div>
            </div>
          </div>

          <div style={{ background: '#192231', border: '1px solid #374151', borderRadius: '8px', padding: '1.25rem' }}>
            <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', fontSize: '1rem' }}>Executive Solution Pitch</h4>
            <p style={{ color: '#e5e7eb', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Unit Pulse 2.0 transforms routine administrative data (leave records, duty rosters, continuous deployments) into objective unit-level load indicators. By comparing units strictly to their own rolling baseline rather than arbitrary peer comparisons, the platform flags structural fatigue early, recommends non-punitive supportive actions, and protects personnel dignity through mathematical privacy guarantees.
            </p>
          </div>

          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#fca5a5' }}>
            <strong>MANDATORY NON-CLINICAL SAFETY STATEMENT:</strong> The Unit Load &amp; Recovery Index is an operational welfare planning measure. It is NOT a medical diagnosis, psychological evaluation, or fitness assessment, and must never be used for disciplinary actions or promotion decisions.
          </div>
        </div>
      ),
    },
    {
      id: 2,
      tag: 'ARCHITECTURE & PRINCIPLES',
      title: 'Proposed Solution & System Architecture',
      subtitle: 'Strict Separation of Concerns: Deterministic Analytics & Constrained AI',
      timing: '0:20 - 0:40 (20s)',
      presenterNotes:
        'Our architecture follows five core principles: Aggregate by default, welfare never discipline, deterministic calculations, minimum necessary access, and audited exceptions. Notice our trust boundary: Core metrics, index (0-100), and trigger rules are calculated by pure deterministic code. The LLM only explains pre-approved aggregate numbers and suggests supportive options. The AI receives zero personnel identifiers.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px', borderTop: '3px solid #3b82f6' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#93c5fd' }}>1. Aggregate by Default</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Commanders see unit-level trends; zero personnel IDs in API or UI.</div>
            </div>
            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px', borderTop: '3px solid #10b981' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#6ee7b7' }}>2. Deterministic Core</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Scoring, baseline &amp; triggers computed in auditable code; not by LLM.</div>
            </div>
            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px', borderTop: '3px solid #f59e0b' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fde68a' }}>3. Welfare, Not Discipline</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Only 5 supportive categories (roster rebalance, leave priority, check-ins).</div>
            </div>
            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px', borderTop: '3px solid #8b5cf6' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c4b5fd' }}>4. Audited Break-Glass</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Time-limited (30 min) access for Welfare Officers with logged reads.</div>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.5rem' }}>DATA FLOW &amp; TRUST BOUNDARY</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '6px', flex: 1, minWidth: '120px' }}>
                <div style={{ color: '#93c5fd', fontWeight: 700 }}>Synthetic HR &amp; Duty</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Leave, Night Shifts, Deployments</div>
              </div>
              <div style={{ color: '#3b82f6', fontWeight: 700 }}>&rarr;</div>
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '6px', flex: 1, minWidth: '120px', border: '1px solid #3b82f6' }}>
                <div style={{ color: '#60a5fa', fontWeight: 700 }}>Deterministic Engine</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Index (0-100) + Rolling Baseline</div>
              </div>
              <div style={{ color: '#3b82f6', fontWeight: 700 }}>&rarr;</div>
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '6px', flex: 1, minWidth: '120px' }}>
                <div style={{ color: '#34d399', fontWeight: 700 }}>Privacy Release</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>k&ge;5 suppression + Laplace noise</div>
              </div>
              <div style={{ color: '#3b82f6', fontWeight: 700 }}>&rarr;</div>
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '6px', flex: 1, minWidth: '120px', border: '1px solid #10b981' }}>
                <div style={{ color: '#10b981', fontWeight: 700 }}>Role-Gated Portals</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Commander / Welfare / Admin</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ background: '#1f2937', padding: '0.75rem 1rem', borderRadius: '6px' }}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>Commander Portal:</span> Precomputed weekly releases, 12-week trend vs rolling baseline, objective evidence cards, no personal data.
            </div>
            <div style={{ background: '#1f2937', padding: '0.75rem 1rem', borderRadius: '6px' }}>
              <span style={{ color: '#34d399', fontWeight: 700 }}>Welfare Officer Portal:</span> Confidential triggered cases, AI aggregate briefing, 3 supportive recommendations, 30-min audited break-glass.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      tag: 'SECURITY & PRIVACY',
      title: 'Privacy Engineering & Threat Mitigations',
      subtitle: 'Rigorous Technical Enforcement Mapped to the Risk Register (docs/14)',
      timing: '0:40 - 1:00 (20s)',
      presenterNotes:
        'Privacy is not a visual afterthought—it is enforced in code and database constraints. We mitigate all 12 risks from our risk register: k-anonymity suppresses groups under 5; bounded Laplace noise protects counts; direct table SELECT on private schemas is revoked; individual reads occur strictly through a transactional function that checks officer assignment and writes an audit row in the same transaction. Raw row logging is strictly forbidden.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#111827', color: '#9ca3af', borderBottom: '2px solid #374151' }}>
                  <th style={{ padding: '0.6rem' }}>Threat / Risk</th>
                  <th style={{ padding: '0.6rem' }}>Engineered Mitigation</th>
                  <th style={{ padding: '0.6rem' }}>Verification Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f3f4f6' }}>R-01: Personal Stress Stigmatization</td>
                  <td style={{ padding: '0.6rem', color: '#d1d5db' }}>Renamed to &quot;Unit Load &amp; Recovery Index&quot;; non-diagnostic wording enforced across code and UI.</td>
                  <td style={{ padding: '0.6rem', color: '#34d399', fontWeight: 700 }}>VERIFIED (PASS)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1f2937', background: '#131b2e' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f3f4f6' }}>R-02: Small-Group Re-identification</td>
                  <td style={{ padding: '0.6rem', color: '#d1d5db' }}>Groups &lt;5 suppressed entirely; small cells (&lt;5) suppressed; Laplace noise (&epsilon;=0.2) sampled once per release.</td>
                  <td style={{ padding: '0.6rem', color: '#34d399', fontWeight: 700 }}>VERIFIED (PASS)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f3f4f6' }}>R-03 / R-04: Credential &amp; API Leaks</td>
                  <td style={{ padding: '0.6rem', color: '#d1d5db' }}>Private PostgreSQL schema; zero NEXT_PUBLIC_ server keys; Cache-Control: no-store on all role routes.</td>
                  <td style={{ padding: '0.6rem', color: '#34d399', fontWeight: 700 }}>VERIFIED (PASS)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1f2937', background: '#131b2e' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f3f4f6' }}>R-05: Unaudited Individual Read</td>
                  <td style={{ padding: '0.6rem', color: '#d1d5db' }}>Direct SELECT revoked; transactional function rechecks grant and writes immutable audit record atomically.</td>
                  <td style={{ padding: '0.6rem', color: '#34d399', fontWeight: 700 }}>VERIFIED (PASS)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f3f4f6' }}>R-06 / R-11: AI Hallucinations &amp; Outage</td>
                  <td style={{ padding: '0.6rem', color: '#d1d5db' }}>Model receives zero personnel IDs; validated output structure; deterministic fallback triggers in &lt;1ms.</td>
                  <td style={{ padding: '0.6rem', color: '#34d399', fontWeight: 700 }}>VERIFIED (PASS)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1f2937', background: '#131b2e' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f3f4f6' }}>R-09: CSV Formula Injection &amp; Bad Data</td>
                  <td style={{ padding: '0.6rem', color: '#d1d5db' }}>Detects =, +, -, @, \t, \r; validates calendar dates (rejects 2026-02-31); atomic batch rollback on error.</td>
                  <td style={{ padding: '0.6rem', color: '#34d399', fontWeight: 700 }}>VERIFIED (PASS)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem', background: '#1f2937', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#9ca3af' }}>
            <div>&bull; <strong style={{ color: '#f9fafb' }}>AES-256-GCM</strong> encryption for officer justifications at rest with 12-byte unique IVs.</div>
            <div>&bull; <strong style={{ color: '#f9fafb' }}>PostgreSQL RLS</strong> policy enforcement on all public schema tables.</div>
            <div>&bull; <strong style={{ color: '#f9fafb' }}>Safe Error Summaries</strong> report row/column only; zero raw row payloads logged.</div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      tag: 'LIVE DEMONSTRATION DATA',
      title: 'Empirical Walkthrough: Stable vs. Elevated Unit',
      subtitle: 'Real Measured Figures from the 360-Personnel Synthetic Demo Fixture (Week: 2026-09-28)',
      timing: '1:00 - 1:20 (20s)',
      presenterNotes:
        'Here is the actual data displayed in the application: Look at Unit A versus Unit B. Alpha Battery is stable with an index of 0, night shifts 2.4, recovery gap 12%, duty hours 41.5, and 0 active reports. Bravo Battalion is elevated at index 75 matching its baseline, with night shifts at 12.8, recovery gap at 48%, duty hours 55.4, and active report #11111111 triggered via sustained_high. The officer can review 3 supportive suggestions and request a 30-minute break-glass grant.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Unit A Card */}
            <div style={{ background: '#111827', border: '1px solid #10b981', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: '1rem' }}>UNIT-A &bull; Alpha Battery</span>
                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>STATUS: NORMAL</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <div>Unit Strain Index: <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>0 / 100</strong></div>
                <div>12-Wk Baseline: <strong style={{ color: '#9ca3af', fontSize: '1.1rem' }}>0 / 100</strong></div>
                <div>Night Shifts: <strong style={{ color: '#f3f4f6' }}>2.4 / 28d</strong></div>
                <div>Recovery Gap: <strong style={{ color: '#f3f4f6' }}>12%</strong> (&lt;60d)</div>
                <div>Weekly Duty Hours: <strong style={{ color: '#f3f4f6' }}>41.5 hrs/wk</strong></div>
                <div>Leave Coverage: <strong style={{ color: '#f3f4f6' }}>88%</strong></div>
                <div>Active Personnel: <strong style={{ color: '#f3f4f6' }}>~45</strong> (noised)</div>
                <div>Active Welfare Reports: <strong style={{ color: '#10b981' }}>0</strong></div>
              </div>
            </div>

            {/* Unit B Card */}
            <div style={{ background: '#111827', border: '1px solid #ef4444', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: '1rem' }}>UNIT-B &bull; Bravo Recon Bn</span>
                <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>STATUS: ELEVATED</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <div>Unit Strain Index: <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>75 / 100</strong></div>
                <div>12-Wk Baseline: <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>75 / 100</strong></div>
                <div>Night Shifts: <strong style={{ color: '#f87171' }}>12.8 / 28d</strong> (High)</div>
                <div>Recovery Gap: <strong style={{ color: '#f87171' }}>48%</strong> (&gt;60d gap)</div>
                <div>Weekly Duty Hours: <strong style={{ color: '#f87171' }}>55.4 hrs/wk</strong></div>
                <div>Leave Coverage: <strong style={{ color: '#f87171' }}>52%</strong></div>
                <div>Active Personnel: <strong style={{ color: '#f3f4f6' }}>~51</strong> (noised)</div>
                <div>Active Welfare Reports: <strong style={{ color: '#ef4444' }}>1 Assigned</strong></div>
              </div>
            </div>
          </div>

          {/* Triggered Report & Action Box */}
          <div style={{ background: '#1f2937', borderRadius: '8px', padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <span><strong style={{ color: '#f59e0b' }}>Confidential Case:</strong> Report #11111111-2222-3333-4444-555555555555</span>
              <span style={{ color: '#9ca3af' }}>Trigger: <strong>sustained_high</strong> &bull; Assigned: Welfare Officer Primary</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#d1d5db', marginBottom: '0.5rem' }}>
              <strong>AI Suggested Supportive Actions:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                <div style={{ background: '#111827', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>1. <em>Roster Rebalancing:</em> Review night shift intervals (provide 48h rest).</div>
                <div style={{ background: '#111827', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>2. <em>Leave Queue:</em> Prioritize personnel with &gt;60d recovery gap.</div>
                <div style={{ background: '#111827', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>3. <em>Welfare Review:</em> Coordinate voluntary supportive discussions.</div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', borderTop: '1px solid #374151', paddingTop: '0.4rem' }}>
              <strong>30-Minute Break-Glass Read:</strong> Requires typed justification (&gt;10 chars) &bull; Clamped to max 20 pseudonymous records &bull; AES-256-GCM encrypted reason &bull; Audit event logged.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      tag: 'BENCHMARKS & VERIFICATION',
      title: 'Performance Benchmarks & Engineering Rigor',
      subtitle: 'Empirical Verification on Host Environment (tests/results/performance-benchmarks-2026-09-30.txt)',
      timing: '1:20 - 1:40 (20s)',
      presenterNotes:
        'We never claim an unmeasured guarantee. Every performance number shown here was empirically measured on our demo fixture: The commander dashboard aggregates in 0.028 milliseconds. Weekly deterministic analytics execute in 0.039 milliseconds. The AI fallback briefing generates in 0.065 milliseconds. And synthetic CSV validation processes 134,529 rows per second. All 230 automated unit and integration tests pass with zero failures.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div style={{ background: '#111827', padding: '1rem', borderRadius: '8px', border: '1px solid #3b82f6', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>Commander Dashboard</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa', margin: '0.25rem 0' }}>0.028 ms</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>p95: 0.099 ms (Spec: &lt;200ms)</div>
            </div>
            <div style={{ background: '#111827', padding: '1rem', borderRadius: '8px', border: '1px solid #10b981', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>Deterministic Analytics</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', margin: '0.25rem 0' }}>0.039 ms</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>p95: 0.132 ms (Spec: &lt;500ms)</div>
            </div>
            <div style={{ background: '#111827', padding: '1rem', borderRadius: '8px', border: '1px solid #f59e0b', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>AI Fallback Latency</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', margin: '0.25rem 0' }}>0.065 ms</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>p95: 0.946 ms (Spec: &lt;50ms)</div>
            </div>
            <div style={{ background: '#111827', padding: '1rem', borderRadius: '8px', border: '1px solid #8b5cf6', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>CSV Validation Throughput</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc', margin: '0.25rem 0' }}>134,529 r/s</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>1,200 rows in 8.92 ms</div>
            </div>
          </div>

          <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#f9fafb', marginBottom: '0.5rem' }}>Comprehensive Test Suite Verification</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ background: '#111827', padding: '0.75rem', borderRadius: '6px' }}>
                <div style={{ color: '#3b82f6', fontWeight: 700 }}>Frontend Workspace</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f9fafb' }}>74 Tests Passed</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Authorization, UI states, charts, 413 limits, rollback</div>
              </div>
              <div style={{ background: '#111827', padding: '0.75rem', borderRadius: '6px' }}>
                <div style={{ color: '#10b981', fontWeight: 700 }}>Backend Workspace</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f9fafb' }}>139 Tests Passed</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>RLS, break-glass, CSV RFC-4180, AES-256, deduplication</div>
              </div>
              <div style={{ background: '#111827', padding: '0.75rem', borderRadius: '6px' }}>
                <div style={{ color: '#f59e0b', fontWeight: 700 }}>ML Workspace</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f9fafb' }}>17 Tests Passed</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Deterministic index (0-100), rolling baselines, triggers</div>
              </div>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
              &check; Total: 230 Passing Tests (0 Failures) &bull; E2E Script: 23/23 Checks Passing &bull; Production Build: 100% Dynamic Routes
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 6,
      tag: 'GOVERNANCE & ROADMAP',
      title: 'Conclusion, Limitations & Future Roadmap',
      subtitle: 'Clear Operational Boundaries & Responsible AI Governance',
      timing: '1:40 - 2:00 (20s)',
      presenterNotes:
        'To conclude: Unit Pulse 2.0 proves that armed forces welfare intelligence can be proactive, actionable, and mathematically privacy-preserving without compromising troop trust. We record our limitations honestly: this is an academic prototype with 100% synthetic data. It is an operational welfare planning aid—not a clinical diagnosis, and never a disciplinary tool. Live force deployments require dedicated sponsor security accreditation and governance.',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <h4 style={{ color: '#f59e0b', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Honest Prototype Limitations</h4>
              <ul style={{ fontSize: '0.8rem', color: '#d1d5db', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
                <li><strong>100% Synthetic Data</strong>: UNIT-A to UNIT-F, 360 fictional personnel; zero real rosters or force names.</li>
                <li><strong>Local Host Environment</strong>: In-memory transactional test store; degrades gracefully without live cloud DB.</li>
                <li><strong>Threshold Calibration</strong>: 40/70 thresholds are baseline estimates requiring future psychologist calibration.</li>
                <li><strong>Non-Clinical Scope</strong>: Detects workplace schedule fatigue; cannot diagnose medical psychiatric conditions.</li>
              </ul>
            </div>

            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
              <h4 style={{ color: '#3b82f6', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Post-Hackathon Pilot Roadmap</h4>
              <ul style={{ fontSize: '0.8rem', color: '#d1d5db', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
                <li><strong>Phase 9 (Air-Gapped Deployment)</strong>: Self-contained on-premise containerization for classified military intranets.</li>
                <li><strong>Phase 10 (Consented Wellness Pulse)</strong>: Optional, voluntary, end-to-end encrypted check-in surveys with differential privacy.</li>
                <li><strong>Phase 11 (Secure HRMS Connector)</strong>: Zero-knowledge automated connectors for official CAPF/CRPF ERP schemas.</li>
                <li><strong>Phase 12 (Multilingual Support)</strong>: Regional language options for unit commanders and welfare officers.</li>
              </ul>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #10b981', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ color: '#10b981', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
              Summary: Proactive Welfare Without Stigma or Surveillance
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              Aggregate by Default &bull; Welfare Never Discipline &bull; 100% Auditable Deterministic Core &bull; Verified 0.028 ms Latency
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [SLIDES.length]);

  const slide = SLIDES[currentSlide];

  return (
    <div className="presentation-wrapper" style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      {/* Presentation Header Controls (Hidden in Print) */}
      <div className="no-print" style={{ background: '#111827', borderBottom: '1px solid #374151', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: '1.05rem' }}>SIH 26186 &bull; Official Deck</span>
          <span style={{ background: '#1f2937', color: '#93c5fd', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
            Slide {currentSlide + 1} of {SLIDES.length}
          </span>
          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Timing: {slide.timing}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            style={{
              background: currentSlide === 0 ? '#1f2937' : '#374151',
              color: currentSlide === 0 ? '#6b7280' : '#f9fafb',
              border: 'none',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              cursor: currentSlide === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            &larr; Prev
          </button>

          {SLIDES.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              style={{
                background: currentSlide === idx ? '#3b82f6' : '#1f2937',
                color: currentSlide === idx ? '#ffffff' : '#9ca3af',
                border: '1px solid #374151',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              {s.id}
            </button>
          ))}

          <button
            onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1))}
            disabled={currentSlide === SLIDES.length - 1}
            style={{
              background: currentSlide === SLIDES.length - 1 ? '#1f2937' : '#374151',
              color: currentSlide === SLIDES.length - 1 ? '#6b7280' : '#f9fafb',
              border: 'none',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              cursor: currentSlide === SLIDES.length - 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Next &rarr;
          </button>

          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              background: showNotes ? '#f59e0b' : '#1f2937',
              color: showNotes ? '#000000' : '#f9fafb',
              border: '1px solid #374151',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              marginLeft: '0.5rem',
            }}
          >
            {showNotes ? 'Hide Script' : 'Presenter Script'}
          </button>

          <button
            onClick={() => window.print()}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              padding: '0.4rem 0.9rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginLeft: '0.5rem',
            }}
          >
            Export as PDF (Print)
          </button>
        </div>
      </div>

      {/* Interactive Single-Slide Presentation Display (Screen View) */}
      <div className="screen-slide-container no-print" style={{ flex: 1, padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '2rem', minHeight: '560px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
          {/* Slide Header */}
          <div style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', color: '#60a5fa', textTransform: 'uppercase' }}>
                {slide.tag}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>SLIDE {slide.id} / 6</span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>{slide.title}</h2>
            <div style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '0.2rem' }}>{slide.subtitle}</div>
          </div>

          {/* Slide Body */}
          <div style={{ flex: 1 }}>{slide.content}</div>

          {/* Slide Footer */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
            <div>Unit Pulse 2.0 &bull; Ministry of Home Affairs &bull; CRPF Police II Division</div>
            <div>Prototype Demonstration &bull; 100% Synthetic Data &bull; Non-Clinical</div>
          </div>
        </div>

        {/* Presenter Script Drawer */}
        {showNotes && (
          <div style={{ marginTop: '1rem', background: '#1c1917', border: '1px solid #78350f', borderRadius: '8px', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>Presenter Script ({slide.timing})</strong>
              <span style={{ fontSize: '0.75rem', color: '#a8a29e' }}>Use keyboard &larr; / &rarr; to advance</span>
            </div>
            <p style={{ color: '#fef3c7', fontSize: '0.9rem', lineHeight: 1.6, fontStyle: 'italic' }}>
              &ldquo;{slide.presenterNotes}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Printable All-Slides Layout (Visible ONLY during window.print()) */}
      <div className="print-only-container">
        {SLIDES.map((s) => (
          <div key={s.id} className="print-slide">
            <div className="print-slide-inner">
              <div className="print-slide-header">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10pt', fontWeight: 800, color: '#2563eb' }}>{s.tag}</span>
                  <span style={{ fontSize: '10pt', color: '#6b7280' }}>SLIDE {s.id} / 6</span>
                </div>
                <h2 style={{ fontSize: '20pt', fontWeight: 800, color: '#111827', margin: '4pt 0 2pt 0' }}>{s.title}</h2>
                <div style={{ fontSize: '12pt', color: '#4b5563' }}>{s.subtitle}</div>
              </div>

              <div className="print-slide-body">{s.content}</div>

              <div className="print-slide-footer">
                <div>Unit Pulse 2.0 &bull; Ministry of Home Affairs &bull; CRPF, Police II Division</div>
                <div>Synthetic Demo &bull; Not a Clinical Diagnosis &bull; SIH 26186</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Embedded CSS for Print & Presentation */}
      <style jsx global>{`
        .print-only-container {
          display: none;
        }

        @media print {
          @page {
            size: landscape;
            margin: 0;
          }

          body {
            background: #ffffff !important;
            color: #111827 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .site-header,
          .site-footer,
          .no-print {
            display: none !important;
          }

          .print-only-container {
            display: block !important;
          }

          .print-slide {
            page-break-after: always;
            break-after: page;
            height: 100vh;
            width: 100vw;
            box-sizing: border-box;
            padding: 2.5cm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #ffffff !important;
            color: #111827 !important;
          }

          .print-slide-inner {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .print-slide-header {
            border-bottom: 2pt solid #e5e7eb;
            padding-bottom: 12pt;
            margin-bottom: 14pt;
          }

          .print-slide-body {
            flex: 1;
          }

          .print-slide-footer {
            border-top: 1pt solid #e5e7eb;
            padding-top: 8pt;
            margin-top: 12pt;
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #6b7280;
          }

          /* Force light contrast for print */
          .print-slide * {
            background-color: transparent !important;
            color: #111827 !important;
            border-color: #d1d5db !important;
          }
        }
      `}</style>
    </div>
  );
}
