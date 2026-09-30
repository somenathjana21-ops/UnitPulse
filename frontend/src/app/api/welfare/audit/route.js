/**
 * frontend/src/app/api/welfare/audit/route.js
 *
 * GET /api/welfare/audit
 * Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
 *                 docs/09-database-design.md, docs/10-security-privacy.md
 *
 * Rules:
 * - Only authenticated Welfare Officers can access their own audit history.
 * - Non-welfare roles (commanders, public) return 403.
 * - Returns immutable access log rows for auth.uid() only (who/when/which report/action).
 * - Cache-Control: no-store.
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerSupabaseClient } from '../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../lib/commander/repository.js';
import { fetchOfficerAuditTrail } from '../../../../lib/welfare/break-glass.js';
import { getServiceRoleClient } from '@unitpulse/backend';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let user = null;
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

  // 2. Role check
  if (user.role !== 'welfare_officer') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Welfare officer authorization required' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 3. Query limit
  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);

  // 4. Fetch officer's own events only
  try {
    const events = await fetchOfficerAuditTrail({
      officerId: user.id,
      limit: limitParam,
      serviceSupabase,
    });

    return NextResponse.json(
      { events },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'audit_fetch_failed',
          message: err.message || 'Failed to fetch officer audit trail',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
