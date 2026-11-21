// run-pg-harness.mjs: reproducible local PG harness for BillDost.
// Boots a fresh PGlite (WASM Postgres) database, applies stubs.sql,
// then migrations 0001..0016 in filename order, then seed.sql, then
// every assertion group in assertions.sql, and reports pass and fail
// counts per group. Any migration error aborts the run and names the
// file (ON_ERROR_STOP semantics). No repository dependency is added:
// PGlite is installed outside the repo, for example with
//   mkdir -p /tmp/pgharness && cd /tmp/pgharness && npm i @electric-sql/pglite
// and resolved from the PGLITE_PATH environment variable when set,
// otherwise from /tmp/pgharness/node_modules/@electric-sql/pglite.
// PGLITE_PATH may point at the package directory itself, at a
// node_modules directory, or at a directory containing node_modules.
//
// Extension notes: pgcrypto and pg_trgm ship in the PGlite contrib
// bundle, so the runner imports them from dist/contrib and passes
// them to the PGlite constructor. With those imports, the
// create extension lines and the gin_trgm_ops indexes in 0001 and
// 0004 apply unmodified and no in-memory stripping is needed. If the
// pg_trgm contrib import is ever unavailable, the runner falls back
// to stripping the pg_trgm extension line and the gin_trgm_ops index
// lines from 0001 and 0004 in memory only (files on disk unchanged)
// and logs that it did so.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(here, '..');
const migrationsDir = join(supabaseDir, 'migrations');

function resolvePackageDir() {
  const candidates = [];
  if (process.env.PGLITE_PATH) {
    const p = process.env.PGLITE_PATH;
    candidates.push(p);
    candidates.push(join(p, '@electric-sql', 'pglite'));
    candidates.push(join(p, 'node_modules', '@electric-sql', 'pglite'));
  }
  candidates.push('/tmp/pgharness/node_modules/@electric-sql/pglite');
  for (const c of candidates) {
    if (existsSync(join(c, 'dist', 'index.js'))) return c;
  }
  console.error('PGlite not found. Install it outside the repo:');
  console.error('  mkdir -p /tmp/pgharness && cd /tmp/pgharness && npm i @electric-sql/pglite');
  console.error('or set PGLITE_PATH to the @electric-sql/pglite package directory.');
  process.exit(2);
}

const pkgDir = resolvePackageDir();
console.log(`[harness] PGlite package: ${pkgDir}`);

const { PGlite } = await import(pathToFileURL(join(pkgDir, 'dist', 'index.js')).href);

const extensions = {};
let stripTrgm = false;
try {
  const { pgcrypto } = await import(
    pathToFileURL(join(pkgDir, 'dist', 'contrib', 'pgcrypto.js')).href
  );
  extensions.pgcrypto = pgcrypto;
  console.log('[harness] pgcrypto loaded from the PGlite contrib bundle (crypt and gen_salt available, no stub functions needed)');
} catch (e) {
  console.log(`[harness] WARNING: pgcrypto contrib import failed (${e.message}); seed.sql crypt calls will fail`);
}
try {
  const { pg_trgm } = await import(
    pathToFileURL(join(pkgDir, 'dist', 'contrib', 'pg_trgm.js')).href
  );
  extensions.pg_trgm = pg_trgm;
  console.log('[harness] pg_trgm loaded from the PGlite contrib bundle; no in-memory stripping needed');
} catch (e) {
  stripTrgm = true;
  console.log(`[harness] pg_trgm contrib import failed (${e.message}); falling back to in-memory stripping`);
}

function maybeStripTrgm(sql, fileName) {
  if (!stripTrgm) return sql;
  const lines = sql.split('\n');
  const kept = lines.filter(
    (l) => !l.includes('create extension if not exists pg_trgm;') && !l.includes('gin_trgm_ops')
  );
  const removed = lines.length - kept.length;
  if (removed > 0) {
    console.log(`[harness] stripped ${removed} pg_trgm line(s) from ${fileName} in memory only (file on disk unchanged)`);
  }
  return kept.join('\n');
}

const db = new PGlite({ extensions });
await db.waitReady;
console.log('[harness] fresh PGlite database ready');

async function applyFile(label, sql) {
  try {
    await db.exec(sql);
    console.log(`[harness] applied ${label}`);
  } catch (e) {
    console.error(`[harness] FAILED applying ${label}: ${e.message}`);
    await db.close().catch(() => {});
    process.exit(1);
  }
}

// 1. Stubs first (roles, auth, storage).
await applyFile('tests/stubs.sql', readFileSync(join(here, 'stubs.sql'), 'utf8'));

// 2. Migrations in filename order, aborting on the first error.
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
for (const f of migrationFiles) {
  const raw = readFileSync(join(migrationsDir, f), 'utf8');
  await applyFile(`migrations/${f}`, maybeStripTrgm(raw, f));
}

// 3. Seed.
await applyFile('seed.sql', readFileSync(join(supabaseDir, 'seed.sql'), 'utf8'));

// 4. Assertions, split into groups by their marker comments.
const assertionsSql = readFileSync(join(here, 'assertions.sql'), 'utf8');
const markerRe = /^-- ASSERT: (.+)$/gm;
const markers = [...assertionsSql.matchAll(markerRe)];
if (markers.length === 0) {
  console.error('[harness] no assertion groups found in assertions.sql');
  process.exit(1);
}
const preamble = assertionsSql.slice(0, markers[0].index);
await applyFile('assertions preamble (helpers)', preamble);

let passed = 0;
const failures = [];
for (let i = 0; i < markers.length; i++) {
  const name = markers[i][1].trim();
  const start = markers[i].index;
  const end = i + 1 < markers.length ? markers[i + 1].index : assertionsSql.length;
  const chunk = assertionsSql.slice(start, end);
  try {
    await db.exec(chunk);
    passed += 1;
    console.log(`[assert] PASS ${name}`);
  } catch (e) {
    failures.push({ name, error: e.message });
    console.log(`[assert] FAIL ${name}: ${e.message}`);
  } finally {
    // Never leak a test role or identity into the next group.
    try {
      await db.exec(
        "reset role; select set_config('test.uid', '', false); select set_config('test.email', '', false);"
      );
    } catch {
      // Cleanup is best effort; a failure here surfaces in later groups.
    }
  }
}

console.log('');
console.log(`[harness] assertion groups: ${markers.length} total, ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.log(`[harness] failed group: ${f.name}: ${f.error}`);
  await db.close().catch(() => {});
  process.exit(1);
}
console.log('[harness] ALL ASSERTION GROUPS PASSED');
await db.close();
