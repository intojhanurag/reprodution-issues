# Issue #12260 — Metadata Filtering for `listMessages`

**Issue**: https://github.com/mastra-ai/mastra/issues/12260
**PR**: https://github.com/mastra-ai/mastra/pull/12359

## What this tests

End-to-end metadata filtering via both documented API paths:

| # | Path | Test |
|---|------|------|
| 1 | `memoryStore.listMessages()` | Single metadata key match |
| 2 | `memoryStore.listMessages()` | Multi-key AND logic |
| 3 | `memoryStore.listMessages()` | No match returns empty |
| 4 | `memoryStore.listMessages()` | Empty metadata filter returns all |
| 5 | `memoryStore.listMessages()` | Combined metadata + dateRange |
| 6 | `memoryStore.listMessages()` | Non-primitive values (nested objects) |
| 7 | `memoryStore.listMessages()` | Invalid metadata key rejection |
| 8 | `memory.recall()` | Single key match |
| 9 | `memory.recall()` | Multi-key AND |
| 10 | `memory.recall()` | Nested object match |
| 11 | `memory.recall()` | Combined metadata + dateRange |

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (default: `localhost:5432`)

### Start PostgreSQL with Docker

```bash
docker run -d --name mastra-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mastra \
  -p 5432:5432 \
  postgres:15
```

## Setup

### 1. Clone the PR branch

```bash
git clone https://github.com/mastra-ai/mastra.git
cd mastra
git checkout feat/metadata-filtering-support
```

### 2. Install and build

```bash
pnpm install
pnpm build
```

### 3. Run the repro test

```bash
cd repro-issues/issue-12260
pnpm install
pnpm test
```

If your PostgreSQL is on a different host/port:

```bash
DATABASE_URL="postgresql://user:pass@host:port/dbname" pnpm test
```

## Expected output

```
===========================================================
  Issue #12260 — Metadata Filtering for listMessages
  PR #12359
===========================================================

--- memoryStore.listMessages() ---

  PASS  Single key: traceId='abc-123' returns 2 messages
  PASS  Multi-key AND: department='sales' AND region='us' returns 2
  PASS  No match: nonexistent='foo' returns 0
  PASS  Empty metadata filter returns all 6 messages
  PASS  Metadata + dateRange: department='sales' after 10:01:30 returns 2
  PASS  Non-primitive: nested object match returns 1
  PASS  Invalid key 'invalid-key!' throws validation error

--- memory.recall() ---

  PASS  recall(): traceId='abc-123' returns 2
  PASS  recall(): department='sales' AND region='us' returns 2
  PASS  recall(): nested object match returns 1
  PASS  recall(): traceId='abc-123' before 10:00:30 returns 1 (msg-1)

--- Summary ---

  Total  : 11
  Passed : 11
  Failed : 0

  All tests passed — metadata filtering works end-to-end!
```
