/**
 * frontend/src/lib/commander/repository.js
 *
 * Thin data-fetching layer for the commander dashboard. Every function takes
 * an already-constructed Supabase client (real, from lib/supabase/server.js,
 * or a fake one in tests) so this module has no dependency on Next.js
 * request context and can be unit tested without a live database.
 *
 * Only ever queries public.user_roles, public.unit_assignments, and
 * public.unit_week_releases -- all RLS-protected, never a private.* table.
 */

/**
 * Resolves the current session into { id, role, assignedUnitIds }, or null
 * if there is no authenticated session.
 *
 * @param {Object} supabase
 * @returns {Promise<{id: string, role: string|null, assignedUnitIds: string[]}|null>}
 */
export async function fetchUserContext(supabase) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return null;
  }
  const userId = authData.user.id;

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: assignmentRows } = await supabase
    .from('unit_assignments')
    .select('unit_id')
    .eq('user_id', userId);

  return {
    id: userId,
    role: roleRow?.role ?? null,
    assignedUnitIds: (assignmentRows ?? []).map((row) => row.unit_id),
  };
}

/**
 * Fetches the single most recent published release for each of the given
 * unit IDs. Never accepts unit IDs from client input directly -- callers
 * must pass `user.assignedUnitIds`.
 *
 * @param {Object} supabase
 * @param {string[]} unitIds
 * @returns {Promise<Object[]>} One release row per unit (unit_id, week_start desc first occurrence)
 */
export async function fetchLatestReleasesForUnits(supabase, unitIds) {
  if (!unitIds || unitIds.length === 0) return [];

  const { data, error } = await supabase
    .from('unit_week_releases')
    .select('*')
    .in('unit_id', unitIds)
    .order('week_start', { ascending: false });

  if (error || !data) return [];

  const latestByUnit = new Map();
  for (const row of data) {
    if (!latestByUnit.has(row.unit_id)) {
      latestByUnit.set(row.unit_id, row);
    }
  }
  // Preserve the caller's unit ordering.
  return unitIds.map((id) => latestByUnit.get(id)).filter(Boolean);
}

/**
 * Fetches recent release history for one unit, oldest first (chart order).
 *
 * @param {Object} supabase
 * @param {string} unitId
 * @param {number} [weeks=8]
 * @returns {Promise<Object[]>}
 */
export async function fetchReleaseHistory(supabase, unitId, weeks = 8) {
  const { data, error } = await supabase
    .from('unit_week_releases')
    .select('*')
    .eq('unit_id', unitId)
    .order('week_start', { ascending: false })
    .limit(weeks);

  if (error || !data) return [];
  return [...data].reverse();
}
