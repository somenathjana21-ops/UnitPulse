/**
 * frontend/src/app/api/welfare/reports/route.js
 *
 * GET /api/welfare/reports
 * Returns paginated or filtered welfare reports assigned to the authenticated Welfare Officer.
 * Specification: docs/08-api-specification.md
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerSupabaseClient } from '../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../lib/commander/repository.js';
import { fetchAssignedReports } from '../../../../lib/welfare/repository.js';
import { buildReportInboxViewModel } from '../../../../lib/welfare/view-model.js';


export const dynamic = 'force-dynamic';

export async function GET(request) {
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

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || null;

  const rawReports = await fetchAssignedReports(supabase, user.id, statusFilter);
  const inbox = buildReportInboxViewModel(rawReports);

  return NextResponse.json(inbox, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
