import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchUserContext,
  fetchLatestReleasesForUnits,
  fetchReleaseHistory,
} from '../src/lib/commander/repository.js';

/**
 * Minimal fake of the supabase-js chainable query builder, just enough to
 * exercise repository.js without a live database. Every `.from(table)...`
 * chain resolves via `then()`, mirroring the real PostgrestFilterBuilder.
 */
function makeFakeSupabase({ user = null, roleRow = null, assignmentRows = [], releaseRows = [] } = {}) {
  function makeQuery(resolveFn) {
    const state = { filters: {} };
    const builder = {
      select() { return builder; },
      eq(col, val) { state.filters[col] = val; return builder; },
      in(col, vals) { state.filters[col] = vals; return builder; },
      order(col, opts) { state.order = { col, ascending: !!opts?.ascending }; return builder; },
      limit(n) { state.limit = n; return builder; },
      async maybeSingle() {
        const rows = resolveFn(state);
        return { data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null };
      },
      then(onResolve, onReject) {
        const data = resolveFn(state);
        return Promise.resolve({ data, error: null }).then(onResolve, onReject);
      },
    };
    return builder;
  }

  return {
    auth: {
      async getUser() {
        return { data: { user }, error: user ? null : new Error('no session') };
      },
    },
    from(table) {
      if (table === 'user_roles') {
        return makeQuery((state) => (roleRow?.user_id === state.filters.user_id ? roleRow : null));
      }
      if (table === 'unit_assignments') {
        return makeQuery((state) => assignmentRows.filter((r) => r.user_id === state.filters.user_id));
      }
      if (table === 'unit_week_releases') {
        return makeQuery((state) => {
          let rows = releaseRows;
          const unitFilter = state.filters.unit_id;
          if (Array.isArray(unitFilter)) rows = rows.filter((r) => unitFilter.includes(r.unit_id));
          else if (unitFilter) rows = rows.filter((r) => r.unit_id === unitFilter);
          if (state.order) {
            rows = [...rows].sort((a, b) => {
              const cmp = a[state.order.col] < b[state.order.col] ? -1 : a[state.order.col] > b[state.order.col] ? 1 : 0;
              return state.order.ascending ? cmp : -cmp;
            });
          }
          if (state.limit) rows = rows.slice(0, state.limit);
          return rows;
        });
      }
      throw new Error(`unmocked table: ${table}`);
    },
  };
}

test('fetchUserContext returns null for no session', async () => {
  const supabase = makeFakeSupabase({ user: null });
  const ctx = await fetchUserContext(supabase);
  assert.equal(ctx, null);
});

test('fetchUserContext resolves role and assigned units for a real session', async () => {
  const supabase = makeFakeSupabase({
    user: { id: 'u-1' },
    roleRow: { user_id: 'u-1', role: 'commander' },
    assignmentRows: [{ user_id: 'u-1', unit_id: 'UNIT-A' }, { user_id: 'u-1', unit_id: 'UNIT-C' }],
  });
  const ctx = await fetchUserContext(supabase);
  assert.deepEqual(ctx, { id: 'u-1', role: 'commander', assignedUnitIds: ['UNIT-A', 'UNIT-C'] });
});

test('fetchLatestReleasesForUnits never queries or returns units outside the requested list', async () => {
  const supabase = makeFakeSupabase({
    releaseRows: [
      { unit_id: 'UNIT-A', week_start: '2026-09-07', index_approx: 10 },
      { unit_id: 'UNIT-B', week_start: '2026-09-07', index_approx: 90 }, // not requested -- must not leak in
      { unit_id: 'UNIT-A', week_start: '2026-08-31', index_approx: 5 },
    ],
  });
  const releases = await fetchLatestReleasesForUnits(supabase, ['UNIT-A']);
  assert.equal(releases.length, 1);
  assert.equal(releases[0].unit_id, 'UNIT-A');
  assert.equal(releases[0].week_start, '2026-09-07'); // the latest of the two UNIT-A rows
});

test('fetchLatestReleasesForUnits returns [] for an empty unit list without querying', async () => {
  const supabase = makeFakeSupabase({ releaseRows: [{ unit_id: 'UNIT-A', week_start: '2026-09-07' }] });
  assert.deepEqual(await fetchLatestReleasesForUnits(supabase, []), []);
});

test('fetchReleaseHistory returns rows oldest-first for charting, scoped to one unit', async () => {
  const supabase = makeFakeSupabase({
    releaseRows: [
      { unit_id: 'UNIT-A', week_start: '2026-08-24', index_approx: 10 },
      { unit_id: 'UNIT-B', week_start: '2026-08-24', index_approx: 99 }, // different unit -- must not appear
      { unit_id: 'UNIT-A', week_start: '2026-09-07', index_approx: 30 },
      { unit_id: 'UNIT-A', week_start: '2026-08-31', index_approx: 20 },
    ],
  });
  const history = await fetchReleaseHistory(supabase, 'UNIT-A', 8);
  assert.equal(history.length, 3);
  assert.deepEqual(history.map((r) => r.week_start), ['2026-08-24', '2026-08-31', '2026-09-07']);
});
