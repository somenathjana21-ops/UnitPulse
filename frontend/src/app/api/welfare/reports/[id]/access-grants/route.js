/**
 * frontend/src/app/api/welfare/reports/[id]/access-grants/route.js
 *
 * POST /api/welfare/reports/:id/access-grants
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 *
 * Rules:
 * - Only the assigned Welfare Officer can request a break-glass grant.
 * - Access by commanders returns 403; unassigned officers return 404 (conceals existence).
 * - Requires reasonCode and typed justification (minimum 10 characters).
 * - Enforces strict server-side 30-minute expiry; client cannot specify duration.
 * - Stored justification is encrypted server-side with AES-256-GCM.
 * - Response includes: { grantId, reportId, reasonCode, expiresAt, expiryMinutes: 30 }.
 * - Cache-Control: no-store.
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerSupabaseClient } from '../../../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../../../lib/commander/repository.js';
import { fetchReportById } from '../../../../../../lib/welfare/repository.js';
import { createBreakGlassGrant } from '../../../../../../lib/welfare/break-glass.js';
import { ALLOWED_REASON_CODES, getServiceRoleClient } from '@unitpulse/backend';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { id } = params;

  let user = null;
  let report = null;
  let serviceSupabase = null;

  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    user = await fetchUserContext(supabase);
    serviceSupabase = getServiceRoleClient();
  } else {
    // In test/mock mode without live Supabase
    user = global.__MOCK_AUTH_USER__ || null;
  }

  // 1. Authentication check
  if (!user || !user.id) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Role check
  if (user.role !== 'welfare_officer') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Welfare officer authorization required' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 3. Assignment check & existence concealment
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    report = await fetchReportById(supabase, id, user.id);
  } else {
    report = global.__MOCK_REPORTS__?.[id] || { id, unit_id: 'UNIT-B', assigned_to: user.id };
    if (report.assigned_to !== user.id) {
      report = null;
    }
  }

  if (!report) {
    // Deliberately concealed 404: never leak whether report exists to unauthorized user
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Report not found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 4. Request payload parsing
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Malformed JSON payload' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { reasonCode, reason } = body;

  // 5. Reason validation
  if (!reasonCode || !ALLOWED_REASON_CODES.includes(reasonCode)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_reason_code',
          message: `Invalid or missing reason code. Must be one of: ${ALLOWED_REASON_CODES.join(', ')}`,
        },
      },
      { status: 422, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_reason_text',
          message: 'Reason must be at least 10 characters explaining operational welfare purpose',
        },
      },
      { status: 422, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 6. Create grant (encrypts reason server-side and enforces 30-min window)
  try {
    const grant = await createBreakGlassGrant({
      officerId: user.id,
      assignedOfficerId: report.assigned_to,
      reportId: id,
      unitId: report.unit_id,
      reasonCode,
      reason: reason.trim(),
      serviceSupabase,
    });

    return NextResponse.json(grant, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: err.code || 'grant_request_failed',
          message: err.message || 'Failed to create access grant',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
