/**
 * frontend/src/app/api/briefings/[unitId]/route.js
 *
 * GET /api/briefings/:unitId?week=YYYY-MM-DD
 * Returns the stored, validated aggregate briefing for an assigned unit.
 *
 * Access: Authorized role (commander, welfare_officer, system_admin) assigned to unit.
 * Headers: Cache-Control: no-store
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md, docs/10-security-privacy.md
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../lib/commander/repository.js';
import { resolveCommanderUnitAccess } from '../../../../lib/commander/authorize.js';
import { fetchUnitReleaseWithBriefing } from '../../../../lib/briefings/repository.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: { code: 'backend_not_configured', message: 'No Supabase project is connected in this environment.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { unitId } = params;
  const url = new URL(request.url);
  const weekStart = url.searchParams.get('week');

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  // 1. Authorization check: must be authenticated and assigned to unit
  const access = resolveCommanderUnitAccess({ user, unitId });
  if (!access.allowed) {
    const message = access.httpStatus === 401 ? 'Sign in required.' : 'Not found.';
    return NextResponse.json(
      { error: { code: access.reason, message } },
      { status: access.httpStatus, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Fetch stored release and validated briefing
  const { release, briefing } = await fetchUnitReleaseWithBriefing(supabase, unitId, weekStart);

  if (!release) {
    return NextResponse.json(
      { error: { code: 'release_not_found', message: `No weekly release found for unit ${unitId}.` } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 3. Check suppression status
  if (release.suppression_status && release.suppression_status !== 'published') {
    return NextResponse.json(
      {
        unitCode: unitId,
        weekStart: release.week_start,
        suppressionStatus: release.suppression_status,
        suppressed: true,
        message: 'Aggregate briefing suppressed due to small group size (<5) or insufficient coverage.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 4. Return validated aggregate briefing
  return NextResponse.json(
    {
      unitCode: unitId,
      weekStart: release.week_start,
      status: release.band || 'normal',
      band: release.band || 'normal',
      indexApprox: release.index_approx,
      baselineApprox: release.baseline_approx,
      suppressed: false,
      briefing,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
