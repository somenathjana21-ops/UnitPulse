/**
 * frontend/src/lib/welfare/repository.js
 *
 * Data-fetching repository for Welfare Officer workflows.
 * Every function takes a scoped Supabase client (anon key + user session cookie).
 * RLS enforces that only reports assigned to auth.uid() are accessible.
 */

/**
 * Fetches all welfare reports assigned to the specified officer.
 *
 * @param {Object} supabase Scoped Supabase client
 * @param {string} officerId
 * @param {string} [statusFilter] Optional status filter
 * @returns {Promise<Object[]>}
 */
export async function fetchAssignedReports(supabase, officerId, statusFilter = null) {
  if (!supabase || !officerId) return [];

  let query = supabase
    .from('welfare_reports')
    .select('*')
    .eq('assigned_to', officerId)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

/**
 * Fetches a single welfare report by ID, scoped to the assigned officer.
 *
 * @param {Object} supabase
 * @param {string} reportId
 * @param {string} officerId
 * @returns {Promise<Object|null>}
 */
export async function fetchReportById(supabase, reportId, officerId) {
  if (!supabase || !reportId || !officerId) return null;

  const { data, error } = await supabase
    .from('welfare_reports')
    .select('*')
    .eq('id', reportId)
    .eq('assigned_to', officerId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Updates a welfare report's status and lifecycle fields.
 *
 * @param {Object} supabase
 * @param {string} reportId
 * @param {string} officerId
 * @param {Object} updates
 * @param {string} updates.status
 * @param {string} [updates.acknowledged_at]
 * @param {string} [updates.follow_up_on]
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
export async function updateReportWorkflow(supabase, reportId, officerId, updates) {
  if (!supabase || !reportId || !officerId) {
    return { data: null, error: { message: 'Missing required parameters' } };
  }

  const { data, error } = await supabase
    .from('welfare_reports')
    .update(updates)
    .eq('id', reportId)
    .eq('assigned_to', officerId)
    .select()
    .maybeSingle();

  return { data, error };
}
