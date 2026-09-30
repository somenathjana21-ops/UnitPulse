import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../lib/supabase/server.js';
import { fetchUserContext, fetchLatestReleasesForUnits } from '../../../../lib/commander/repository.js';
import { buildApiUnitPayload } from '../../../../lib/commander/view-model.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: { code: 'backend_not_configured', message: 'No Supabase project is connected in this environment.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  if (!user || user.role !== 'commander') {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Sign in as a commander to view units.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const releases = await fetchLatestReleasesForUnits(supabase, user.assignedUnitIds);
  const releaseByUnit = new Map(releases.map((r) => [r.unit_id, r]));
  const units = user.assignedUnitIds.map((unitId) => buildApiUnitPayload(unitId, releaseByUnit.get(unitId) ?? null));

  return NextResponse.json({ units }, { headers: { 'Cache-Control': 'no-store' } });
}
