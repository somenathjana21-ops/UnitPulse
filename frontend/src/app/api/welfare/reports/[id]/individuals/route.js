/**
 * frontend/src/app/api/welfare/reports/[id]/individuals/route.js
 *
 * GET /api/welfare/reports/:id/individuals?grantId=...&offset=...&limit=...
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md,
 *                 docs/11-testing-plan.md (T-02, T-06, T-08, T-09)
 *
 * Rules:
 * - Only the assigned Welfare Officer with an active, unexpired grant can read records.
 * - Access by commanders returns 403 (T-02).
 * - Access by unassigned officers returns 404 (T-06, no existence oracle).
 * - Expired grants or wrong grant IDs return 403 (T-08).
 * - Narrow transactional database read function executes the query, inserts an audit log row,
 *   and returns at most 20 pseudonymous records (T-09).
 * - Cache-Control: no-store.
 * - No export or download of individual rows.
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerSupabaseClient } from '../../../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../../../lib/commander/repository.js';
import { fetchReportById } from '../../../../../../lib/welfare/repository.js';
import { executeIndividualRead, getBreakGlassGrant } from '../../../../../../lib/welfare/break-glass.js';
import { getServiceRoleClient } from '@unitpulse/backend';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = params;
  const { searchParams } = new URL(request.url);

  const grantId = searchParams.get('grantId');
  const offsetParam = parseInt(searchParams.get('offset') || searchParams.get('cursor') || '0', 10);
  const limitParam = parseInt(searchParams.get('limit') || '20', 10);

  let user = null;
  let report = null;
  let serviceSupabase = null;

  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    user = await fetchUserContext(supabase);
    serviceSupabase = getServiceRoleClient();
  } else {
    user = global.__MOCK_AUTH_USER__ || null;
  }

  // 1. Authentication check
  if (!user || !user.id) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Role check (Commanders are strictly forbidden: T-02)
  if (user.role !== 'welfare_officer') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Individual-level access is restricted to authorized welfare officers.' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 3. Assignment check & existence concealment (T-06)
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
    // Deliberately concealed 404 for unassigned officers per docs/08
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Report not found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 4. Validate grantId parameter
  if (!grantId) {
    return NextResponse.json(
      { error: { code: 'missing_grant_id', message: 'An active grantId is required for individual access.' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 5. Verify grant status and expiration (T-08)
  const grantStatus = await getBreakGlassGrant({
    grantId,
    officerId: user.id,
    reportId: id,
    serviceSupabase,
  });

  if (!grantStatus.grant) {
    return NextResponse.json(
      { error: { code: 'invalid_grant', message: 'Specified access grant was not found or is unauthorized.' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!grantStatus.active) {
    return NextResponse.json(
      {
        error: {
          code: 'grant_expired',
          message: 'Access grant has expired. Please request a new reasoned grant.',
        },
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 6. Execute transactional read with database audit logging (T-09)
  try {
    const result = await executeIndividualRead({
      grantId,
      officerId: user.id,
      reportId: id,
      limit: limitParam,
      offset: offsetParam,
      serviceSupabase,
    });

    return NextResponse.json(
      {
        records: result.records,
        count: result.count,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.hasMore,
        grantExpiresAt: grantStatus.grant.expires_at,
        remainingMinutes: grantStatus.remainingMinutes,
        unitId: report.unit_id,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    const status = err.code === 'grant_expired' || err.code === 'grant_mismatch' ? 403 : 500;
    return NextResponse.json(
      {
        error: {
          code: err.code || 'read_failed',
          message: err.message || 'Failed to execute audited read',
        },
      },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
