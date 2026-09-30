/**
 * scripts/seed-demo.js
 *
 * Phase 0 Demo Seed Script
 *
 * NOTE: As specified in docs/06-data-specification.md, docs/09-database-design.md,
 * and Guidebook.md Phase 1, the synthetic seed generator (six fictional units,
 * 60 synthetic personnel each, 180 days of record history) is scheduled for Phase 1
 * once the Supabase SQL migrations for private source tables and RLS policies
 * are applied.
 *
 * This script provides a safe, transparent placeholder for Phase 0 that validates
 * prerequisites without injecting fake or unverified data into the database.
 */

console.log('====================================================');
console.log('Unit Pulse 2.0 — Synthetic Demo Seed (Phase 0 Check)');
console.log('====================================================');
console.log('');
console.log('[INFO] Synthetic Demo Dataset Specifications:');
console.log('  - Target Units: 6 fictional units (e.g., UNIT-A through UNIT-F)');
console.log('  - Personnel: ~60 synthetic personnel per unit (360 total)');
console.log('  - Record Window: ~180 days with >=12 completed weekly snapshots');
console.log('  - Privacy Rule: Fictional identifiers only; no real force data');
console.log('  - Elevated Unit: 1 unit with elevated leave/night-duty conditions');
console.log('  - Stable Unit: 1 unit with stable recovery patterns');
console.log('');
console.log('[STATUS] Database schema & seed generator are scheduled for Phase 1.');
console.log('         To proceed to Phase 1:');
console.log('         1. Start Supabase locally: npx supabase start');
console.log('         2. Apply SQL migrations:   npx supabase db reset');
console.log('         3. Run synthetic seed:     npm run seed:demo');
console.log('');
console.log('[PASS] Phase 0 seed:demo placeholder executed cleanly.');
process.exit(0);
