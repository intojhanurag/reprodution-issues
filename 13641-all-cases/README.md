# Better Auth Integration — Test Cases (PR #13641)

Tests for [#13639](https://github.com/mastra-ai/mastra/issues/13639) fix across 5 auth scenarios.

## Setup

```bash
cd ~/repro-issues/13641-all-cases
pnpm install --ignore-workspace
```

## Run all cases

```bash
npx tsx run-all.ts
```

## Run individual cases

```bash
npx tsx case1-old-broken/test.ts       # Reporter's scenario (cookie/bearer were both 401)
npx tsx case2-cookie-only/test.ts      # Cookie-only: signed vs unsigned vs none
npx tsx case3-bearer-only/test.ts      # Bearer-only: signed vs unsigned vs garbage
npx tsx case4-cookie-and-bearer/test.ts  # Both present: cookie priority, bearer fallback
npx tsx case5-cross-origin-cookie/test.ts  # Cross-origin (Next.js :3000 → Mastra :4205)
```

## What each case tests

| Case | Scenario | Tests |
|------|----------|-------|
| 1 | Reporter's exact setup | Cookie only → 200, Bearer only → 200, No auth → 401 |
| 2 | Cookie-only auth | Signed cookie → 200, Unsigned cookie → 401, No cookie → 401 |
| 3 | Bearer-only auth | Signed Bearer → 200, Unsigned Bearer → 401, Invalid Bearer → 401 |
| 4 | Cookie + Bearer | Both valid → 200, Valid cookie + bad Bearer → 200 (cookie wins), Non-session cookie + valid Bearer → 200 |
| 5 | Cross-origin | Cookie with Origin → 200, No cookie → 401, Bearer with Origin → 200 |

## What the fix changed

**Before (broken):**
- Middleware rejected requests with no `Authorization` header — even if cookies were present
- `authenticateToken()` forwarded Bearer token as `Authorization` header, but better-auth only reads `Cookie`

**After (fixed):**
- Middleware allows requests through if cookies are present (no `Authorization` header needed)
- Bearer tokens are converted into `better-auth.session_token` cookie so better-auth can verify them
- `checkRouteAuth` in server-adapter passes a request shim to `authenticateToken` so cookie headers are accessible

## Key insight: signed vs unsigned tokens

better-auth signs session tokens with HMAC: `rawToken.hmacSignature`

- **Signed** (from `Set-Cookie`): `QmBgDMjgt92iR4cA.PNFoCvkSsls84yOy...` → accepted
- **Unsigned** (from `session.token`): `QmBgDMjgt92iR4cA` → rejected
