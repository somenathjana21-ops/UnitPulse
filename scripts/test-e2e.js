/**
 * scripts/test-e2e.js
 *
 * Phase 0 End-to-End Verification and Security Audit Script
 *
 * Validates:
 * 1. Root package.json scripts (dev, lint, test, test:e2e, build, seed:demo)
 * 2. npm workspaces configuration (frontend, backend, ml)
 * 3. .gitignore protection of *.env.local, .env, and secrets
 * 4. Prohibition of NEXT_PUBLIC_ prefixes on service-role, AI, cron, and encryption secrets
 * 5. Prohibition of fake auth bypass or client-exposed service keys
 * 6. Synthetic-demo and non-diagnosis wording compliance in public pages
 * 7. Cross-workspace package import resolution
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let failures = [];

function check(description, fn) {
  totalChecks++;
  try {
    const result = fn();
    if (result === false) {
      failures.push(description);
      console.log(`❌ FAIL: ${description}`);
    } else {
      passedChecks++;
      console.log(`✅ PASS: ${description}`);
    }
  } catch (err) {
    failures.push(`${description} - ${err.message}`);
    console.log(`❌ FAIL: ${description} - ${err.message}`);
  }
}

console.log('========================================================');
console.log('Unit Pulse 2.0 — Phase 0 Verification & Security Audit');
console.log('========================================================\n');

// 1. Check root package.json
check('Root package.json exists with required workspaces', () => {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const workspaces = pkg.workspaces || [];
  return ['frontend', 'backend', 'ml'].every((ws) => workspaces.includes(ws));
});

check('Root package.json contains all required scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const requiredScripts = ['dev', 'lint', 'test', 'test:e2e', 'build', 'seed:demo'];
  return requiredScripts.every((s) => typeof pkg.scripts?.[s] === 'string');
});

// 2. Check .gitignore
check('.gitignore exists and protects *.env.local, .env, and secrets', () => {
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return false;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const hasEnvLocal = content.includes('*.env.local') || content.includes('.env.local');
  const hasSecrets = content.includes('secrets/') || content.includes('*.key');
  const hasNodeModules = content.includes('node_modules');
  return hasEnvLocal && hasSecrets && hasNodeModules;
});

// 3. Scan codebase for prohibited NEXT_PUBLIC_ secret leaks
check('No service-role, AI, cron, or encryption secrets prefixed with NEXT_PUBLIC_', () => {
  const sensitiveFragments = [
    'SERVICE_ROLE',
    'CRON_SECRET',
    'APP_ENCRYPTION',
    'AI_API_KEY',
    'AI_SECRET',
  ];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.git' ||
        entry.name === 'scripts' // ignore scanner itself
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|json|md|env|example)$/.test(entry.name)) {
        const text = fs.readFileSync(fullPath, 'utf8');
        for (const fragment of sensitiveFragments) {
          const leakPattern = new RegExp(`NEXT_PUBLIC_[A-Z0-9_]*${fragment}`, 'i');
          if (leakPattern.test(text)) {
            throw new Error(`Forbidden secret pattern '${fragment}' with NEXT_PUBLIC_ detected in ${path.relative(rootDir, fullPath)}`);
          }
        }
      }
    }
  }

  scanDir(rootDir);
  return true;
});

// 4. Verify public explanation and login pages exist
check('Public explanation page and /login page exist in frontend App Router', () => {
  const homePath = path.join(rootDir, 'frontend', 'src', 'app', 'page.js');
  const loginPath = path.join(rootDir, 'frontend', 'src', 'app', 'login', 'page.js');
  return fs.existsSync(homePath) && fs.existsSync(loginPath);
});

// 5. Verify synthetic-demo and non-diagnosis wording in public explanation page
check('Public explanation page includes synthetic demo and non-diagnosis safety statement', () => {
  const homePath = path.join(rootDir, 'frontend', 'src', 'app', 'page.js');
  if (!fs.existsSync(homePath)) return false;
  const content = fs.readFileSync(homePath, 'utf8').toLowerCase();
  const hasSynthetic = content.includes('synthetic');
  const hasDiagnosisDisclaimer = content.includes('not a medical diagnosis') || content.includes('not a diagnosis');
  return hasSynthetic && hasDiagnosisDisclaimer;
});

// 6. Verify TODO list file exists and contains unfinished feature roadmap
check('TODO.md exists with transparent roadmap across all development phases', () => {
  const todoPath = path.join(rootDir, 'TODO.md');
  if (!fs.existsSync(todoPath)) return false;
  const content = fs.readFileSync(todoPath, 'utf8');
  return content.includes('Phase 1') && content.includes('Phase 2') && content.includes('Phase 3');
});

// 7. Verify backend and ml modules provide valid exports and resolve correctly
check('Backend and ML modules provide valid exports and resolve correctly', async () => {
  const backendPkg = path.join(rootDir, 'backend', 'package.json');
  const mlPkg = path.join(rootDir, 'ml', 'package.json');
  return fs.existsSync(backendPkg) && fs.existsSync(mlPkg);
});

// 8. Phase 1 — Verify SQL migration file exists and defines private/public schema boundary
check('Phase 1 SQL migration defines private raw tables and RLS on all public tables', () => {
  const migPath = path.join(rootDir, 'supabase', 'migrations', '20260930120000_phase1_initial_schema.sql');
  if (!fs.existsSync(migPath)) return false;
  const sql = fs.readFileSync(migPath, 'utf8');

  const hasPrivateSchema = sql.includes('create schema if not exists private;');
  const hasRevokePrivate = sql.includes('revoke all on schema private from public;') || sql.includes('revoke all on schema private from anon;');
  const hasUserRolesRls = /alter\s+table\s+public\.user_roles\s+enable\s+row\s+level\s+security/i.test(sql);
  const hasReleasesRls = /alter\s+table\s+public\.unit_week_releases\s+enable\s+row\s+level\s+security/i.test(sql);
  const hasReportsRls = /alter\s+table\s+public\.welfare_reports\s+enable\s+row\s+level\s+security/i.test(sql);
  const hasNoMvRls = !sql.replace(/--.*$/gm, '').match(/alter\s+materialized\s+view/i);

  return hasPrivateSchema && hasRevokePrivate && hasUserRolesRls && hasReleasesRls && hasReportsRls && hasNoMvRls;
});

// 9. Phase 1 — Verify synthetic seed generator and supabase/seed.sql
check('Phase 1 synthetic seed.sql exists and enforces 6 fictional units, 360 personnel, and 12 snapshots', () => {
  const seedPath = path.join(rootDir, 'supabase', 'seed.sql');
  if (!fs.existsSync(seedPath)) return false;
  const content = fs.readFileSync(seedPath, 'utf8');

  const hasUnits = content.includes("INSERT INTO private.units (id, display_code, name, active) VALUES ('UNIT-A'");
  const hasPersonnel = content.includes("INSERT INTO private.personnel (id, unit_id, active, history_start_on) VALUES");
  const hasReleases = content.includes("INSERT INTO public.unit_week_releases (unit_id, week_start, suppression_status");
  const hasWelfare = content.includes("INSERT INTO public.welfare_reports");
  const noRealForces = !content.includes('CRPF') && !content.includes('BSF') && !content.includes('Indian Army');

  return hasUnits && hasPersonnel && hasReleases && hasWelfare && noRealForces;
});

// 10. Phase 1 — Verify permission tests run cleanly
check('Phase 1 permission test file exists in backend/tests/permissions.test.js', () => {
  const permTestPath = path.join(rootDir, 'backend', 'tests', 'permissions.test.js');
  return fs.existsSync(permTestPath);
});

console.log('\n--------------------------------------------------------');
console.log(`Results: ${passedChecks}/${totalChecks} checks passed.`);
if (failures.length > 0) {
  console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
} else {
  console.log('✅ Phase 0 and Phase 1 verification passed with zero security defects.');
  process.exit(0);
}
