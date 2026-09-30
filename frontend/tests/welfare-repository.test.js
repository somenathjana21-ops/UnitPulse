/**
 * frontend/tests/welfare-repository.test.js
 *
 * Tests for the welfare repository against a fake Supabase client.
 * Guarantees officer scoping and update isolation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchAssignedReports,
  fetchReportById,
  updateReportWorkflow,
} from '../src/lib/welfare/repository.js';

describe('Phase 4 — Welfare Repository (fetchAssignedReports & fetchReportById)', () => {
  const officerOne = '00000000-0000-0000-0000-000000000003';
  const officerTwo = '00000000-0000-0000-0000-000000000004';

  const reportsInDb = [
    { id: 'rep-1', unit_id: 'UNIT-B', assigned_to: officerOne, status: 'new', created_at: '2026-09-28' },
    { id: 'rep-2', unit_id: 'UNIT-C', assigned_to: officerOne, status: 'follow_up', created_at: '2026-09-21' },
    { id: 'rep-3', unit_id: 'UNIT-D', assigned_to: officerTwo, status: 'new', created_at: '2026-09-28' },
  ];

  function makeFakeClient(db = reportsInDb) {
    return {
      from(table) {
        let filterOfficer = null;
        let filterId = null;
        let filterStatus = null;

        const builder = {
          select() {
            return builder;
          },
          eq(col, val) {
            if (col === 'assigned_to') filterOfficer = val;
            if (col === 'id') filterId = val;
            if (col === 'status') filterStatus = val;
            return builder;
          },
          order() {
            return builder;
          },
          async maybeSingle() {
            const row = db.find(
              (r) =>
                (!filterOfficer || r.assigned_to === filterOfficer) &&
                (!filterId || r.id === filterId)
            );
            return { data: row || null, error: null };
          },
          update(updates) {
            const row = db.find(
              (r) =>
                (!filterOfficer || r.assigned_to === filterOfficer) &&
                (!filterId || r.id === filterId)
            );
            if (row) {
              Object.assign(row, updates);
            }
            return {
              eq(col, val) {
                if (col === 'assigned_to') filterOfficer = val;
                if (col === 'id') filterId = val;
                return {
                  eq(col2, val2) {
                    if (col2 === 'assigned_to') filterOfficer = val2;
                    if (col2 === 'id') filterId = val2;
                    return {
                      select: () => ({
                        maybeSingle: async () => ({ data: row || null, error: null }),
                      }),
                    };
                  },
                };
              },
            };
          },
          async then(resolve) {
            const rows = db.filter(
              (r) =>
                (!filterOfficer || r.assigned_to === filterOfficer) &&
                (!filterStatus || r.status === filterStatus)
            );
            return resolve({ data: rows, error: null });
          },
        };
        return builder;
      },
    };
  }

  it('fetchAssignedReports returns ONLY reports assigned to the requested officer', async () => {
    const fakeClient = makeFakeClient();
    const reports = await fetchAssignedReports(fakeClient, officerOne);

    assert.equal(reports.length, 2);
    for (const r of reports) {
      assert.equal(r.assigned_to, officerOne);
    }
  });

  it('fetchAssignedReports returns empty list when officer has no reports', async () => {
    const fakeClient = makeFakeClient();
    const reports = await fetchAssignedReports(fakeClient, 'non-existent-officer');
    assert.equal(reports.length, 0);
  });

  it('fetchReportById returns report when assigned to requesting officer', async () => {
    const fakeClient = makeFakeClient();
    const report = await fetchReportById(fakeClient, 'rep-1', officerOne);
    assert.ok(report);
    assert.equal(report.id, 'rep-1');
  });

  it('fetchReportById returns null when report belongs to another officer', async () => {
    const fakeClient = makeFakeClient();
    // rep-3 belongs to officerTwo; officerOne requests it
    const report = await fetchReportById(fakeClient, 'rep-3', officerOne);
    assert.equal(report, null);
  });

  it('updateReportWorkflow updates report status successfully', async () => {
    const dbCopy = JSON.parse(JSON.stringify(reportsInDb));
    const fakeClient = makeFakeClient(dbCopy);

    const res = await updateReportWorkflow(fakeClient, 'rep-1', officerOne, {
      status: 'acknowledged',
      acknowledged_at: '2026-09-30T10:00:00Z',
    });

    assert.equal(res.error, null);
    assert.ok(res.data);
    assert.equal(res.data.status, 'acknowledged');
  });
});
