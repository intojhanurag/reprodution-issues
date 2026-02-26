# Reproduction: Issue #12550

**`mastra dev` fails to resolve cross-package npm dependencies when using tsconfig path aliases in a monorepo.**

- Issue: https://github.com/mastra-ai/mastra/issues/12550
- Fix PR: https://github.com/mastra-ai/mastra/pull/12803

## Monorepo Structure

```
repro-12550/
├── apps/
│   └── mastra/
│       ├── src/mastra/index.ts      # entry — imports @lib/auth via tsconfig alias
│       └── tsconfig.json            # paths: { "@lib/*": ["../../packages/lib/*"] }
├── packages/
│   └── lib/
│       ├── auth.ts                  # imports "better-auth" (npm dep)
│       └── node_modules/
│           └── better-auth/         # installed HERE only
```

The bug: `mastra dev` bundles the code into `.mastra/output/index.mjs`. The tsconfig alias `@lib/auth` resolves fine, but `better-auth` (imported inside `packages/lib/auth.ts`) ends up as a bare `import 'better-auth'` in the output. At runtime, Node can't find it from `.mastra/output/` because `better-auth` only exists in `packages/lib/node_modules/`.

## How to Reproduce

### Prerequisites

1. Clone the mastra repo and build the deployer package:
   ```bash
   git clone https://github.com/mastra-ai/mastra.git
   cd mastra
   git checkout fix/monorepo-tsconfig-path-aliases-12550
   pnpm install && pnpm build
   ```

2. Install dependencies for this repro:
   ```bash
   cd apps/mastra && pnpm install --ignore-workspace
   cd ../../packages/lib && pnpm install --ignore-workspace
   cd ../..
   ```

### Step 1: See the bug (without fix)

No extra steps needed — the npm-installed `@mastra/deployer` does NOT have the fix.

```bash
cd apps/mastra
npx mastra dev
```

**Expected output:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'better-auth'
    imported from .../apps/mastra/.mastra/output/index.mjs
```

### Step 2: Apply the fix

The fix lives in the `tsconfig-paths` plugin inside the deployer package. On npm, it's bundled into a chunk file. We need to replace that chunk with the one built from the PR branch.

1. Find the chunk containing `tsConfigPaths` in both locations:

   ```bash
   # Find the chunk in your local mastra build (has the fix)
   grep -rl "createRequire" /path/to/mastra/packages/deployer/dist/
   # Example output: .../dist/chunk-NDPO75I7.js

   # Find the chunk in the repro's node_modules (no fix)
   grep -rl "tsConfigPaths" apps/mastra/node_modules/@mastra/deployer/dist/ | head -2
   # Look for the one that EXPORTS tsConfigPaths (not the one that imports it)
   grep -l "export.*tsConfigPaths" apps/mastra/node_modules/@mastra/deployer/dist/chunk-*.js
   # Example output: .../dist/chunk-AMZJCH64.js
   ```

2. Replace the npm chunk with the fixed one:

   ```bash
   # Clean previous output
   rm -rf apps/mastra/.mastra

   # Patch the fix in
   cp /path/to/mastra/packages/deployer/dist/chunk-NDPO75I7.js \
      apps/mastra/node_modules/@mastra/deployer/dist/chunk-AMZJCH64.js
   ```

   > **Note:** The chunk filenames (like `chunk-NDPO75I7.js`) change between builds.
   > Use the `grep` commands above to find the correct filenames on your machine.

3. Run again:

   ```bash
   cd apps/mastra
   npx mastra dev
   ```

**Expected output:**
```
✅ SUCCESS: better-auth resolved via tsconfig path alias!
   Auth type: object
   This proves issue #12550 is fixed.
```

### What the fix does

You can verify the difference by checking the bundled output:

```bash
grep "better-auth" apps/mastra/.mastra/output/index.mjs
```

- **Without fix:** `import { betterAuth } from 'better-auth'` — bare specifier, Node can't find it
- **With fix:** `import { betterAuth } from '/absolute/path/to/packages/lib/node_modules/better-auth/dist/index.mjs'` — absolute path, works

The fix adds a `createRequire(importer).resolve()` fallback in the `tsconfig-paths` Rollup plugin. When a file resolved via tsconfig alias imports an npm dep that Rollup can't find (because `node-resolve` is removed in dev mode), it resolves the dep from the importer's location instead of the bundler root.

## Note on zod error

If you see a zod `TypeError: Cannot read properties of undefined (reading 'def')` after the success message, that's a **version mismatch** in the test setup (zod 3 vs zod 4 between `@mastra/core` and `@mastra/deployer` from npm). It is completely unrelated to this fix. In a real project with matching `@mastra/*` versions, this doesn't happen.
