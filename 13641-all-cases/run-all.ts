import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'test.db');

const cases = [
  'case1-old-broken',
  'case2-cookie-only',
  'case3-bearer-only',
  'case4-cookie-and-bearer',
  'case5-cross-origin-cookie',
];

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Better Auth — All Test Cases (PR #13641)               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

for (const c of cases) {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  try {
    execSync(`npx tsx ${path.join(__dirname, c, 'test.ts')}`, {
      stdio: 'inherit',
      cwd: __dirname,
      env: { ...process.env },
    });
  } catch {
    console.error(`\x1b[31m${c} crashed!\x1b[0m`);
  }
}

console.log('Done.\n');
