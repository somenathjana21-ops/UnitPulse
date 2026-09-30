/**
 * frontend/src/app/api/welfare/reports/[id]/route.js
 *
 * GET /api/welfare/reports/:id
 * PATCH /api/welfare/reports/:id
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md, docs/09-database-design.md
 *
 * Rules:
 * - Only the assigned Welfare Officer can read or update the report.
 * - Access by commanders or unassigned officers returns 404 (conceals existence).
 * - Enforces valid status transitions: new -> acknowledged -> action_taken -> follow_up / closed.
 * - Closing requires documented outcome notes (min 10 characters).
 * - Cache-Control: no-store.
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerSupabaseClient } from '../../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../../lib/commander/repository.js';
import { fetchReportById, updateReportWorkflow } from '../../../../../lib/welfare/repository.js';
import { buildReportDetailViewModel } from '../../../../../lib/welfare/view-model.js';
import { validateStatusTransition } from '@unitpulse/backend';


export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: 'backend_not_configured',
          message: 'Supabase environment is not configured on this host.',
        },
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (user.role !== 'welfare_officer') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Welfare officer authorization required' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const report = await fetchReportById(supabase, id, user.id);
  if (!report) {
    // Deliberately concealed 404: never leak whether report exists to unauthorized user
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Report not found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const viewModel = buildReportDetailViewModel(report);
  return NextResponse.json(viewModel, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: 'backend_not_configured',
          message: 'Supabase environment is not configured on this host.',
        },
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (user.role !== 'welfare_officer') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Welfare officer authorization required' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const currentReport = await fetchReportById(supabase, id, user.id);
  if (!currentReport) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Report not found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Malformed JSON payload' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const targetStatus = body.status;
  if (!targetStatus) {
    return NextResponse.json(
      { error: { code: 'missing_status', message: 'Target status is required' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Validate status transition
  const validation = validateStatusTransition(currentReport.status, targetStatus, {
    notes: body.notes,
  });

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_status_transition',
          message: validation.error,
        },
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Build updates
  const updates = { status: targetStatus };

  if (targetStatus === 'acknowledged' && !currentReport.acknowledged_at) {
    updates.acknowledged_at = new Date().toISOString();
  }

  if (body.followUpOn !== undefined) {
    if (body.followUpOn && !/^\d{4}-\d{2}-\d{2}$/.test(body.followUpOn)) {
      return NextResponse.json(
        { error: { code: 'invalid_date', message: 'followUpOn must be a valid date in YYYY-MM-DD format' } },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    updates.follow_up_on = body.followUpOn;
  }

  const { data: updatedReport, error: updateError } = await updateReportWorkflow(
    supabase,
    id,
    user.id,
    updates
  );

  if (updateError || !updatedReport) {
    return NextResponse.json(
      { error: { code: 'update_failed', message: updateError?.message || 'Failed to update report' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const viewModel = buildReportDetailViewModel(updatedReport);
  return NextResponse.json(viewModel, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
