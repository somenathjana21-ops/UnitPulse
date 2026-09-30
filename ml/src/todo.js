/**
 * ml/src/todo.js
 *
 * Explicit roadmap of analytics tasks pending for subsequent phases.
 */

export const ML_ROADMAP_TODOS = [
  {
    phase: 'Phase 2',
    task: 'Connect scoring and baseline logic to private-to-public weekly release database pipeline',
    status: 'pending_phase_2',
  },
  {
    phase: 'Phase 2',
    task: 'Implement historical metric coverage aggregator across leave, duty, and deployment tables',
    status: 'pending_phase_2',
  },
  {
    phase: 'Phase 2',
    task: 'Add deterministic test fixtures for 4-person units, revealing 1-person breakouts, and sustained-high weeks',
    status: 'pending_phase_2',
  },
  {
    phase: 'Phase 5',
    task: 'Implement structured AI prompt builder grounding only on approved aggregate release metrics',
    status: 'pending_phase_5',
  },
  {
    phase: 'Phase 5',
    task: 'Implement deterministic explanation template fallback when AI provider is offline or returns invalid output',
    status: 'pending_phase_5',
  },
];
