/**
 * backend/scripts/lint.js
 *
 * Linting and security verification for @unitpulse/backend.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..', 'src');

console.log('[LINT] Checking @unitpulse/backend source files...');
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'));

let errors = 0;
for (const file of files) {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Ensure no client-visible secrets or forbidden strings (except config definition checks)
  if (file !== 'config.js' && content.includes('NEXT_PUBLIC_')) {
    console.error(`[ERROR] ${file} contains forbidden 'NEXT_PUBLIC_' prefix!`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`[LINT FAIL] Found ${errors} error(s) in @unitpulse/backend.`);
  process.exit(1);
} else {
  console.log(`[LINT OK] Verified ${files.length} files in @unitpulse/backend.`);
  process.exit(0);
}
