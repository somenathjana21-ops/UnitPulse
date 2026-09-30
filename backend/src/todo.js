/**
 * backend/src/todo.js
 *
 * Explicit roadmap of server-only domain tasks pending for subsequent phases.
 */

export const BACKEND_ROADMAP_TODOS = [
  {
    phase: 'Phase 1',
    task: 'Create Supabase SQL migrations for private source tables and public release/report tables',
    status: 'pending_phase_1',
  },
  {
    phase: 'Phase 1',
    task: 'Enable strict RLS policies ensuring commanders cannot query raw personnel or unassigned units',
    status: 'pending_phase_1',
  },
  {
    phase: 'Phase 1',
    task: 'Implement transactional break-glass audit function logging individual reads',
    status: 'pending_phase_1',
  },
  {
    phase: 'Phase 2',
    task: 'Implement private-to-public weekly release publisher with Laplace noise and small-cell suppression',
    status: 'pending_phase_2',
  },
  {
    phase: 'Phase 4',
    task: 'Implement idempotent weekly worker route (/api/internal/weekly-run) guarded by CRON_SECRET',
    status: 'pending_phase_4',
  },
  {
    phase: 'Phase 5',
    task: 'Implement OpenAI-compatible provider adapter with NO_LLM_MODE fallback',
    status: 'pending_phase_5',
  },
];
