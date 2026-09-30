/**
 * frontend/src/app/api/briefings/[unitId]/print/route.js
 *
 * GET /api/briefings/:unitId/print?week=YYYY-MM-DD
 * Print-friendly aggregate HTML view for browser Print -> Save as PDF.
 *
 * NON-NEGOTIABLE REQUIREMENTS:
 * 1. STRICTLY AGGREGATE-ONLY: Zero personnel IDs, names, rosters, or personal notes.
 * 2. Prominent non-diagnostic safety disclaimer at top and bottom.
 * 3. Formatted specifically for clean rendering and browser Save as PDF.
 * 4. Protected by Cache-Control: no-store.
 *
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md, docs/10-security-privacy.md
 */

import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../../lib/commander/repository.js';
import { resolveCommanderUnitAccess } from '../../../../../lib/commander/authorize.js';
import { fetchUnitReleaseWithBriefing } from '../../../../../lib/briefings/repository.js';

export const dynamic = 'force-dynamic';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(request, { params }) {
  if (!isSupabaseConfigured()) {
    return new Response('<h1>Backend not configured</h1><p>Supabase connection required.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const { unitId } = params;
  const url = new URL(request.url);
  const weekStart = url.searchParams.get('week');

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  // 1. Authorization check
  const access = resolveCommanderUnitAccess({ user, unitId });
  if (!access.allowed) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Access Denied</title></head>
        <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
          <h2>Access Denied</h2>
          <p>${access.httpStatus === 401 ? 'Please sign in.' : 'Resource not found or unauthorized.'}</p>
          <a href="/login">Return to Sign In</a>
        </body>
      </html>
    `;
    return new Response(errorHtml, {
      status: access.httpStatus,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // 2. Fetch stored release and validated briefing
  const { release, briefing } = await fetchUnitReleaseWithBriefing(supabase, unitId, weekStart);

  if (!release || !briefing) {
    return new Response(
      `<!DOCTYPE html><html><body><h2>Briefing Not Available</h2><p>No published release for ${escapeHtml(unitId)}.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  const metrics = release.approved_metrics_json || {};
  const band = (release.band || 'normal').toUpperCase();
  const bandColor = band === 'HIGH' ? '#dc2626' : band === 'ELEVATED' ? '#d97706' : '#16a34a';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welfare Planning Briefing — ${escapeHtml(unitId)} — Week ${escapeHtml(release.week_start)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      font-size: 13px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .no-print-bar {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn {
      display: inline-block;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      border: 1px solid #d1d5db;
      background: #ffffff;
      color: #111827;
    }
    .btn-primary {
      background: #111827;
      color: #ffffff;
      border-color: #111827;
    }
    .header-box {
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .classification-tag {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #4b5563;
      margin-bottom: 4px;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 6px 0;
      color: #111827;
    }
    .meta-line {
      font-size: 12px;
      color: #4b5563;
    }
    .safety-warning {
      border: 2px solid #b91c1c;
      background: #fef2f2;
      color: #991b1b;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 12px;
      line-height: 1.4;
      break-inside: avoid;
    }
    .score-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
      break-inside: avoid;
    }
    .score-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 16px;
      background: #f9fafb;
    }
    .score-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .score-value {
      font-size: 24px;
      font-weight: 800;
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 9999px;
      margin-left: 8px;
      vertical-align: middle;
      color: #ffffff;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
      margin: 20px 0 12px 0;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      break-inside: avoid;
    }
    .data-table th, .data-table td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }
    .data-table th {
      background: #f9fafb;
      font-weight: 600;
      color: #4b5563;
      font-size: 12px;
    }
    .factors-list {
      margin: 0 0 20px 0;
      padding-left: 0;
      list-style: none;
    }
    .factor-item {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 10px;
      background: #ffffff;
      break-inside: avoid;
    }
    .factor-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 4px;
      color: #111827;
    }
    .factor-metric {
      font-size: 12px;
      font-weight: 600;
      color: #1d4ed8;
      margin-bottom: 4px;
    }
    .factor-desc {
      font-size: 12px;
      color: #4b5563;
      margin: 0;
    }
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
      break-inside: avoid;
    }
    .action-card {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 10px 12px;
      background: #f9fafb;
      break-inside: avoid;
    }
    .action-category {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #2563eb;
      margin-bottom: 4px;
    }
    .action-text {
      font-size: 12px;
      color: #1f2937;
      margin: 0;
      line-height: 1.4;
    }
    .footer-box {
      border-top: 1px solid #e5e7eb;
      padding-top: 14px;
      margin-top: 24px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
      break-inside: avoid;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        font-size: 11pt;
      }
      .container {
        padding: 0;
        max-width: 100%;
      }
      .score-card, .factor-item, .action-card, .data-table {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print no-print-bar">
      <div>
        <strong>Print View:</strong> Formatted for standard A4 browser <em>Print &rarr; Save as PDF</em>.
      </div>
      <div>
        <a href="/commander/units/${escapeHtml(unitId)}" class="btn" style="margin-right: 8px;">&larr; Back</a>
        <button onclick="window.print()" class="btn btn-primary">🖨️ Print / Save as PDF</button>
      </div>
    </div>

    <div class="header-box">
      <div class="classification-tag">OFFICIAL OPERATIONAL WELFARE PLANNING BRIEFING &middot; AGGREGATE ONLY</div>
      <h1 class="title">Unit Operational Briefing: ${escapeHtml(unitId)}</h1>
      <div class="meta-line">
        Target Completed Week: <strong>${escapeHtml(release.week_start)}</strong> &middot;
        Generated At: ${new Date(briefing.generatedAt || Date.now()).toLocaleDateString()} &middot;
        Source: ${escapeHtml(briefing.source || 'approved_model')}
      </div>
    </div>

    <div class="safety-warning">
      <strong>SAFETY NOTICE:</strong> ${escapeHtml(briefing.disclaimer || 'The Unit Load & Recovery Index is an operational welfare planning indicator. It is NOT a medical diagnosis and must never be used as evidence of individual psychological fitness, misconduct, or eligibility for promotion or deployment.')}
    </div>

    <div class="score-grid">
      <div class="score-card">
        <div class="score-label">Unit Load &amp; Recovery Index</div>
        <div class="score-value">
          ${release.index_approx ?? '—'} <span style="font-size: 14px; font-weight: normal; color: #6b7280;">/ 100</span>
          <span class="status-badge" style="background-color: ${bandColor};">${escapeHtml(band)}</span>
        </div>
      </div>
      <div class="score-card">
        <div class="score-label">Historical Rolling Baseline</div>
        <div class="score-value">
          ${release.baseline_approx ?? '—'} <span style="font-size: 14px; font-weight: normal; color: #6b7280;">/ 100</span>
        </div>
      </div>
    </div>

    <div class="section-title">Verified Unit-Level Indicators</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Approved Released Value</th>
          <th>Standard Reference Window</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Leave Recovery Gap</td>
          <td>${metrics.recoveryGapPercentApprox ?? metrics.recoveryGapPercent ?? '—'}%</td>
          <td>Personnel with &gt;60 days duty without qualifying leave</td>
        </tr>
        <tr>
          <td>Night Shifts (28-day average)</td>
          <td>${metrics.nightShiftsAverageApprox ?? metrics.meanNightShifts28d ?? '—'} shifts</td>
          <td>Night shifts per individual in 28-day window</td>
        </tr>
        <tr>
          <td>Leave Utilization Band</td>
          <td>${escapeHtml(metrics.leaveUtilizationBucket || 'Monitored')}</td>
          <td>Eligible leave utilization uptake in 90-day window</td>
        </tr>
        <tr>
          <td>Continuous Deployment Duration</td>
          <td>${metrics.continuousDeploymentDaysApprox ?? metrics.meanDeploymentDays ?? '—'} days</td>
          <td>Average continuous field deployment duration</td>
        </tr>
        <tr>
          <td>Weekly Duty Hours</td>
          <td>${metrics.weeklyDutyHoursApprox ?? metrics.meanWeeklyDutyHours ?? '—'} hrs/week</td>
          <td>Average total shift hours across completed 7 days</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">Contributing Operational Factors</div>
    <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px; color: #374151;">
      ${escapeHtml(briefing.summary || 'Elevated indicators relative to historical comparison baseline.')}
    </div>

    <ul class="factors-list">
      ${(briefing.contributingFactors || []).map((f) => `
        <li class="factor-item">
          <div class="factor-title">${escapeHtml(f.factor || 'Operational Indicator')}</div>
          ${f.approvedMetricStatement ? `<div class="factor-metric">${escapeHtml(f.approvedMetricStatement)}</div>` : ''}
          <p class="factor-desc">${escapeHtml(f.explanation || '')}</p>
        </li>
      `).join('')}
    </ul>

    <div class="section-title">Supportive Operational Actions to Consider</div>
    <div class="actions-grid">
      ${(briefing.suggestedActions || []).map((act, i) => `
        <div class="action-card">
          <div class="action-category">${escapeHtml((act.category || 'action').replace(/_/g, ' '))}</div>
          <p class="action-text">${escapeHtml(act.text || '')}</p>
        </div>
      `).join('')}
    </div>

    <div class="footer-box">
      <strong>Model Explainability &amp; Safety Assurance:</strong>
      <p style="margin: 4px 0;">
        The Unit Load &amp; Recovery Index is calculated deterministically by software algorithms.
        Explanations ground strictly in verified aggregate metrics. Numerical statements are assembled server-side.
        No medical diagnosis or clinical classification is applied.
      </p>
      <p style="margin: 4px 0; color: #9ca3af;">
        Unit Pulse 2.0 &middot; Confidential Welfare Intelligence &middot; Strictly Synthetic Demo Data (Problem Statement 26186).
        Contains ZERO personnel records, personal identifying information, or medical history.
      </p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
