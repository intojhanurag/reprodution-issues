# Repro: `disableInit: true` ignored on `mastra build` — Issue #13570

https://github.com/mastra-ai/mastra/issues/13570

## Bug Summary

When `PostgresStore` is configured with `disableInit: true`, the built server
(`mastra build` → `node .mastra/output/index.mjs`) still executes **CREATE TABLE**
and **ALTER TABLE** statements on startup.

## Root Cause

`BuildBundler.getEntry()` generates an entry point that explicitly calls
`mastra.getStorage().init()`. The proxy's `init()` handler does **NOT** check
`disableInit` — it always runs the real init. Only the auto-init path
(`ensureInit()`) respects `disableInit`.

**Bug location**: `packages/cli/src/commands/build/BuildBundler.ts:87-91`

## Prerequisites

- Docker (for PostgreSQL)
- Node.js 18+
- npm or pnpm

## Reproduction Steps

### Terminal 1 — Start PostgreSQL with DDL logging

```bash
cd repro-13570
docker compose up
```

Keep this terminal open. PostgreSQL is configured with `log_statement=ddl` so you
will see all CREATE TABLE / ALTER TABLE statements in real-time.

### Terminal 2 — Install, build, and run

```bash
cd repro-13570
npm install
npx mastra build
node .mastra/output/index.mjs
```

### Observe

Go back to **Terminal 1**. You will see output like:

```
repro-13570-pg | LOG:  statement: CREATE TABLE IF NOT EXISTS ...
repro-13570-pg | LOG:  statement: ALTER TABLE ...
```

These DDL statements should NOT execute because `disableInit: true` was set.

### Verify the generated entry point

After running `mastra build`, inspect:

```bash
cat .mastra/output/index.mjs | grep -A2 'init()'
```

You will see the unconditional `.init()` call:

```javascript
if (mastra.getStorage()) {
  mastra.getStorage().init();   // ← bypasses disableInit
  ...
}
```

## DDL Statements Executed on Startup (Before Fix)

With `disableInit: true`, the server should execute **0** DDL statements.
Instead, it executed **~191** schema-modifying statements:

| DDL Type | Count |
|---|---|
| CREATE TABLE | 27 |
| ALTER TABLE (ADD COLUMN, ADD CONSTRAINT, REPLICA IDENTITY) | ~133 |
| CREATE INDEX / CREATE UNIQUE INDEX | 28 |
| CREATE OR REPLACE FUNCTION | 1 |
| DROP TRIGGER | 1 |
| CREATE TRIGGER | 1 |
| **Total** | **~191** |

## Expected vs Actual

| | Expected | Actual (Before Fix) | After Fix |
|---|---|---|---|
| DDL on startup (`disableInit: true`) | **0** | **~191** statements | **0** |
| DDL on startup (`disableInit` not set) | All tables/indexes created | All tables/indexes created | All tables/indexes created |
| Auto-init on method call | Skipped when `disableInit: true` | Skipped (works correctly) | Skipped (unchanged) |

## Cleanup

```bash
docker compose down -v
```
