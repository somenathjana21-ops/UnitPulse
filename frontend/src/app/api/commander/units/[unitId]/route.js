import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../../lib/supabase/server.js';
import { fetchUserContext, fetchReleaseHistory } from '../../../../../lib/commander/repository.js';
import { resolveCommanderUnitAccess } from '../../../../../lib/commander/authorize.js';
import { buildApiUnitPayload } from '../../../../../lib/commander/view-model.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: { code: 'backend_not_configured', message: 'No Supabase project is connected in this environment.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  const access = resolveCommanderUnitAccess({ user, unitId: params.unitId });
  if (!access.allowed) {
    // 404 for a wrong/guessed unit conceals whether it exists at all (docs/08).
    const message = access.httpStatus === 401 ? 'Sign in required.' : 'Not found.';
    return NextResponse.json(
      { error: { code: access.reason, message } },
      { status: access.httpStatus, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const history = await fetchReleaseHistory(supabase, params.unitId, 8);
  const latest = history[history.length - 1] ?? null;
  const payload = buildApiUnitPayload(params.unitId, latest);

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
