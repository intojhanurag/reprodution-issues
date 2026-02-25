/**
 * E2E Test for: https://github.com/mastra-ai/mastra/issues/12260
 * PR: https://github.com/mastra-ai/mastra/pull/12359
 *
 * Tests metadata filtering for listMessages via two paths documented at:
 *   - docs/memory/message-history  → memoryStore.listMessages({ filter: { metadata } })
 *   - docs/reference/memory/recall → memory.recall({ filter: { metadata } })
 *
 * Prerequisites:
 *   - PostgreSQL running (default: localhost:5432)
 *   - Set DATABASE_URL env var or use defaults (postgres:postgres@localhost:5432/mastra)
 *
 * Run:
 *   pnpm test
 */

import { PostgresStore } from "@mastra/pg";
import { Memory } from "@mastra/memory";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/mastra";

// Unique per run to avoid collisions
const RUN_ID = Date.now().toString(36);
const THREAD_ID = `thread-meta-${RUN_ID}`;
const RESOURCE_ID = `user-meta-${RUN_ID}`;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function check(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function makeMessage(
  id: string,
  role: "user" | "assistant",
  text: string,
  metadata?: Record<string, unknown>,
  createdAt?: Date,
) {
  return {
    id: `${id}-${RUN_ID}`,
    role,
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    createdAt: createdAt ?? new Date(),
    type: "text" as const,
    content: {
      format: 2 as const,
      parts: [{ type: "text" as const, text }],
      ...(metadata ? { metadata } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("===========================================================");
  console.log("  Issue #12260 — Metadata Filtering for listMessages");
  console.log("  PR #12359");
  console.log("===========================================================\n");

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------
  console.log("--- Setup ---\n");
  console.log(`  Database : ${DATABASE_URL}`);
  console.log(`  Thread   : ${THREAD_ID}`);
  console.log(`  Resource : ${RESOURCE_ID}\n`);

  const store = new PostgresStore({ id: "repro-store", connectionString: DATABASE_URL });
  await store.init();

  // Get the memory store (docs: storage.getStore('memory'))
  const memoryStore = await store.getStore("memory");
  if (!memoryStore) throw new Error("Failed to get memory store");

  // Create Memory instance (docs: new Memory({ storage }))
  const memory = new Memory({ storage: store });

  // Create thread
  await memoryStore.saveThread({
    thread: {
      id: THREAD_ID,
      resourceId: RESOURCE_ID,
      title: "Metadata Filtering Test",
      createdAt: new Date("2025-06-01T10:00:00Z"),
      updatedAt: new Date("2025-06-01T10:00:00Z"),
    },
  });

  // Save messages with staggered timestamps and varied metadata
  //
  //  msg-1  user       10:00  { traceId: "abc-123", department: "sales" }
  //  msg-2  assistant  10:01  { traceId: "abc-123", department: "engineering" }
  //  msg-3  user       10:02  { traceId: "def-456", department: "sales", region: "us" }
  //  msg-4  assistant  10:03  { nested: { key: "value", deep: { level: 2 } } }
  //  msg-5  user       10:04  (no metadata)
  //  msg-6  assistant  10:05  { department: "sales", region: "us" }
  //
  const messages = [
    makeMessage(
      "msg-1",
      "user",
      "Hello from sales",
      { traceId: "abc-123", department: "sales" },
      new Date("2025-06-01T10:00:00Z"),
    ),
    makeMessage(
      "msg-2",
      "assistant",
      "Hi! How can I help?",
      { traceId: "abc-123", department: "engineering" },
      new Date("2025-06-01T10:01:00Z"),
    ),
    makeMessage(
      "msg-3",
      "user",
      "US sales question",
      { traceId: "def-456", department: "sales", region: "us" },
      new Date("2025-06-01T10:02:00Z"),
    ),
    makeMessage(
      "msg-4",
      "assistant",
      "Here are nested details",
      { nested: { key: "value", deep: { level: 2 } } },
      new Date("2025-06-01T10:03:00Z"),
    ),
    makeMessage(
      "msg-5",
      "user",
      "No metadata here",
      undefined,
      new Date("2025-06-01T10:04:00Z"),
    ),
    makeMessage(
      "msg-6",
      "assistant",
      "US sales response",
      { department: "sales", region: "us" },
      new Date("2025-06-01T10:05:00Z"),
    ),
  ];

  await memoryStore.saveMessages({ messages: messages as any });
  console.log(`  Saved ${messages.length} messages\n`);

  // -----------------------------------------------------------------------
  // Path 1: memoryStore.listMessages() — direct storage
  // (docs: docs/memory/message-history#filtering-by-metadata)
  // -----------------------------------------------------------------------
  console.log("--- memoryStore.listMessages() ---\n");

  // 1. Single metadata key match
  {
    const result = await memoryStore.listMessages({
      threadId: THREAD_ID,
      filter: { metadata: { traceId: "abc-123" } },
      perPage: 100,
    });
    check(
      result.messages.length === 2,
      "Single key: traceId='abc-123' returns 2 messages",
      `got ${result.messages.length}`,
    );
  }

  // 2. Multiple metadata keys — AND logic
  {
    const result = await memoryStore.listMessages({
      threadId: THREAD_ID,
      filter: { metadata: { department: "sales", region: "us" } },
      perPage: 100,
    });
    check(
      result.messages.length === 2,
      "Multi-key AND: department='sales' AND region='us' returns 2",
      `got ${result.messages.length}`,
    );
  }

  // 3. No match returns empty
  {
    const result = await memoryStore.listMessages({
      threadId: THREAD_ID,
      filter: { metadata: { nonexistent: "foo" } },
      perPage: 100,
    });
    check(
      result.messages.length === 0,
      "No match: nonexistent='foo' returns 0",
      `got ${result.messages.length}`,
    );
  }

  // 4. Empty metadata filter returns all messages
  {
    const result = await memoryStore.listMessages({
      threadId: THREAD_ID,
      filter: { metadata: {} },
      perPage: 100,
    });
    check(
      result.messages.length === 6,
      "Empty metadata filter returns all 6 messages",
      `got ${result.messages.length}`,
    );
  }

  // 5. Combined metadata + dateRange
  //    department='sales' AND after 10:01:30 → msg-3 (10:02) + msg-6 (10:05)
  {
    const result = await memoryStore.listMessages({
      threadId: THREAD_ID,
      filter: {
        metadata: { department: "sales" },
        dateRange: { start: new Date("2025-06-01T10:01:30Z") },
      },
      perPage: 100,
    });
    check(
      result.messages.length === 2,
      "Metadata + dateRange: department='sales' after 10:01:30 returns 2",
      `got ${result.messages.length}`,
    );
  }

  // 6. Non-primitive metadata values (nested object match)
  {
    const result = await memoryStore.listMessages({
      threadId: THREAD_ID,
      filter: {
        metadata: { nested: { key: "value", deep: { level: 2 } } },
      },
      perPage: 100,
    });
    check(
      result.messages.length === 1,
      "Non-primitive: nested object match returns 1",
      `got ${result.messages.length}`,
    );
  }

  // 7. Invalid metadata key rejected
  {
    let threw = false;
    try {
      await memoryStore.listMessages({
        threadId: THREAD_ID,
        filter: { metadata: { "invalid-key!": "value" } },
        perPage: 100,
      });
    } catch {
      threw = true;
    }
    check(threw, "Invalid key 'invalid-key!' throws validation error");
  }

  // -----------------------------------------------------------------------
  // Path 2: memory.recall() — Memory abstraction
  // (docs: reference/memory/recall)
  // -----------------------------------------------------------------------
  console.log("\n--- memory.recall() ---\n");

  // 8. Single key match via recall
  {
    const result = await memory.recall({
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      filter: { metadata: { traceId: "abc-123" } },
      perPage: 100,
    });
    check(
      result.messages.length === 2,
      "recall(): traceId='abc-123' returns 2",
      `got ${result.messages.length}`,
    );
  }

  // 9. Multi-key AND via recall
  {
    const result = await memory.recall({
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      filter: { metadata: { department: "sales", region: "us" } },
      perPage: 100,
    });
    check(
      result.messages.length === 2,
      "recall(): department='sales' AND region='us' returns 2",
      `got ${result.messages.length}`,
    );
  }

  // 10. Non-primitive via recall
  {
    const result = await memory.recall({
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      filter: {
        metadata: { nested: { key: "value", deep: { level: 2 } } },
      },
      perPage: 100,
    });
    check(
      result.messages.length === 1,
      "recall(): nested object match returns 1",
      `got ${result.messages.length}`,
    );
  }

  // 11. Combined metadata + dateRange via recall
  //     traceId='abc-123' AND before 10:00:30 → msg-1 only
  {
    const result = await memory.recall({
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      filter: {
        metadata: { traceId: "abc-123" },
        dateRange: { end: new Date("2025-06-01T10:00:30Z") },
      },
      perPage: 100,
    });
    check(
      result.messages.length === 1,
      "recall(): traceId='abc-123' before 10:00:30 returns 1 (msg-1)",
      `got ${result.messages.length}`,
    );
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log("\n--- Summary ---\n");
  console.log(`  Total  : ${passed + failed}`);
  console.log(`  Passed : ${passed}`);
  console.log(`  Failed : ${failed}`);

  if (failed === 0) {
    console.log("\n  All tests passed — metadata filtering works end-to-end!\n");
  } else {
    console.log(`\n  ${failed} test(s) failed.\n`);
  }

  await store.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
