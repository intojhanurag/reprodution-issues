/**
 * Reproduction for: https://github.com/mastra-ai/mastra/issues/13089
 * Related PR: https://github.com/mastra-ai/mastra/pull/13130
 *
 * Bug: When Observational Memory async buffering is active, user messages are
 * saved to the database multiple times with different IDs but identical content.
 *
 * Root cause (confirmed by issue reporter delphux):
 *   1. User message is saved and sealed (sealedAt metadata + sealedIds Set)
 *      when async buffering triggers in runAsyncBufferedObservation()
 *   2. On subsequent agent steps, saveMessagesWithSealedIdTracking() finds the
 *      ID in sealedIds, regenerates it with crypto.randomUUID(), and re-saves
 *   3. This creates duplicate rows with identical content but different IDs
 *
 * How this reproduction works:
 *   - Sets observation.messageTokens LOW (50) so bufferTokens = 10 tokens
 *   - This forces async buffering to trigger on any real message
 *   - Triggers the exact same code path as a production app with 6,000+ tokens
 *     of accumulated conversation history (the default bufferTokens threshold)
 *   - The mechanism is identical regardless of threshold value
 *
 * Run:
 *   GROQ_API_KEY=... npx tsx src/reproduce.ts
 */

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { createClient } from "@libsql/client";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. Storage
// ---------------------------------------------------------------------------
const client = createClient({ url: "file:./repro.db" });
const store = new LibSQLStore({ id: "repro-storage", client });

// ---------------------------------------------------------------------------
// 2. Memory config matching issue reporter's setup, with low messageTokens
//    to force async buffering (same code path as high-token production threads)
//
//    Reporter's config:
//      observationalMemory: { enabled: true, scope: "thread", model: ... }
//    Our config:
//      Same, but messageTokens: 50 to trigger buffering immediately
//      (in production, buffering triggers when thread history > 6,000 tokens)
// ---------------------------------------------------------------------------
const memory = new Memory({
  storage: store,
  options: {
    lastMessages: 20,
    observationalMemory: {
      enabled: true,
      scope: "thread",
      model: "groq/llama-3.3-70b-versatile",
      observation: {
        messageTokens: 50, // Low threshold to trigger async buffering
        // bufferTokens defaults to 0.2 * 50 = 10 tokens
      },
      reflection: {
        observationTokens: 200_000,
      },
    },
  },
});

// ---------------------------------------------------------------------------
// 3. Tools that force sequential multi-step execution
//    (each tool output feeds into the next tool's input)
// ---------------------------------------------------------------------------
let stepCounter = 0;

const lookupCityIdTool = createTool({
  id: "lookup-city-id",
  description: "Step 1: Look up the internal city ID. Must be called FIRST.",
  inputSchema: z.object({ cityName: z.string() }),
  outputSchema: z.object({ cityId: z.string(), cityName: z.string() }),
  execute: async (input) => {
    stepCounter++;
    console.log(`  [step ${stepCounter}] lookup-city-id → ${input.cityName}`);
    return { cityId: "NYC-001", cityName: input.cityName };
  },
});

const getCityDetailsTool = createTool({
  id: "get-city-details",
  description:
    "Step 2: Get city details using cityId from step 1. Returns a detailToken.",
  inputSchema: z.object({ cityId: z.string() }),
  outputSchema: z.object({
    population: z.number(),
    area: z.string(),
    detailToken: z.string(),
  }),
  execute: async (input) => {
    stepCounter++;
    console.log(`  [step ${stepCounter}] get-city-details → cityId=${input.cityId}`);
    return { population: 8_336_817, area: "302.6 sq mi", detailToken: "DTK-abc123" };
  },
});

const generateReportTool = createTool({
  id: "generate-report",
  description:
    "Step 3: Generate final report using detailToken from step 2. Must be called LAST.",
  inputSchema: z.object({ detailToken: z.string(), cityName: z.string() }),
  outputSchema: z.object({ report: z.string() }),
  execute: async (input) => {
    stepCounter++;
    console.log(`  [step ${stepCounter}] generate-report → token=${input.detailToken}`);
    return {
      report: `Report for ${input.cityName}: Population 8,336,817, Area 302.6 sq mi.`,
    };
  },
});

// ---------------------------------------------------------------------------
// 4. Agent (mirrors reporter's setup: agent with tools + memory)
// ---------------------------------------------------------------------------
const agent = new Agent({
  name: "city-info-agent",
  instructions: `You are a city info assistant. Follow these steps IN ORDER:
1. Call lookup-city-id with the city name
2. Call get-city-details with the cityId from step 1
3. Call generate-report with the detailToken from step 2 and the city name
Call ONE tool at a time. Wait for each result before calling the next.`,
  model: "groq/llama-3.3-70b-versatile",
  memory,
  tools: {
    "lookup-city-id": lookupCityIdTool,
    "get-city-details": getCityDetailsTool,
    "generate-report": generateReportTool,
  },
});

// ---------------------------------------------------------------------------
// 5. Run and check for duplicates
// ---------------------------------------------------------------------------
async function main() {
  const RESOURCE_ID = "user-repro-123";
  const THREAD_ID = `thread-repro-${Date.now()}`;
  const USER_MESSAGE =
    "Help me debug a distributed system issue involving multiple microservices communicating over gRPC. I need a full city report for New York City.";

  console.log("=== Issue #13089 Reproduction ===");
  console.log("=== Observational Memory Duplicate Messages Bug ===\n");
  console.log(`Resource      : ${RESOURCE_ID}`);
  console.log(`Thread        : ${THREAD_ID}`);
  console.log(`Message       : "${USER_MESSAGE}"`);
  console.log(`maxSteps      : 12`);
  console.log(`messageTokens : 50 (forces async buffering — same code path as`);
  console.log(`                production threads with >6,000 tokens of history)\n`);

  // --- Stream the agent (triggers multi-step tool calls) ---
  console.log("--- Streaming agent response ---\n");

  const response = await agent.stream(USER_MESSAGE, {
    maxSteps: 12,
    memory: { resource: RESOURCE_ID, thread: THREAD_ID },
  });

  let fullText = "";
  for await (const chunk of response.textStream) {
    fullText += chunk;
  }
  console.log(`\nAgent response: ${fullText.slice(0, 200)}...`);
  console.log(`Tool steps executed: ${stepCounter}\n`);

  // Wait for async buffering/DB writes
  console.log("Waiting 5s for async operations...\n");
  await new Promise((r) => setTimeout(r, 5000));

  // --- Check database ---
  console.log("--- Checking database for duplicate user messages ---\n");

  const userMsgs = await client.execute({
    sql: `SELECT id, role, content, createdAt FROM mastra_messages
          WHERE thread_id = ? AND role = 'user'
          ORDER BY createdAt ASC`,
    args: [THREAD_ID],
  });

  console.log(`User messages in DB: ${userMsgs.rows.length}`);
  console.log(`Expected           : 1\n`);

  if (userMsgs.rows.length > 1) {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  BUG CONFIRMED: User message was DUPLICATED!            ║");
    console.log("║                                                         ║");
    console.log("║  Root cause: saveMessagesWithSealedIdTracking() re-saves║");
    console.log("║  sealed messages with regenerated crypto.randomUUID()   ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    console.log(
      `Expected: 1 user message\nActual  : ${userMsgs.rows.length} user messages (duplicated via sealed ID regeneration)\n`,
    );

    for (const row of userMsgs.rows) {
      console.log(`  id        : ${row.id}`);
      const content = String(row.content).slice(0, 100);
      console.log(`  content   : ${content}...`);
      console.log(`  createdAt : ${row.createdAt}`);
      console.log();
    }
  } else if (userMsgs.rows.length === 1) {
    console.log("No duplicates — if you're testing the PR fix, it's working correctly.");
  } else {
    console.log("No user messages found — something may be wrong.");
  }

  // --- Check assistant messages for duplicates too ---
  console.log("--- Checking database for assistant messages ---\n");

  const assistantMsgs = await client.execute({
    sql: `SELECT id, role, content, createdAt FROM mastra_messages
          WHERE thread_id = ? AND role = 'assistant'
          ORDER BY createdAt ASC`,
    args: [THREAD_ID],
  });

  console.log(`Assistant messages in DB: ${assistantMsgs.rows.length}\n`);

  for (const row of assistantMsgs.rows) {
    console.log(`  id        : ${row.id}`);
    const content = String(row.content).slice(0, 120);
    console.log(`  content   : ${content}...`);
    console.log(`  createdAt : ${row.createdAt}`);
    console.log();
  }

  // Check for assistant duplicates (same content + same createdAt)
  const assistantDupes = new Map<string, typeof assistantMsgs.rows>();
  for (const row of assistantMsgs.rows) {
    const key = `${String(row.content).slice(0, 200)}|${row.createdAt}`;
    if (!assistantDupes.has(key)) {
      assistantDupes.set(key, []);
    }
    assistantDupes.get(key)!.push(row);
  }

  let assistantDuplicateCount = 0;
  for (const [, group] of assistantDupes) {
    if (group.length > 1) {
      assistantDuplicateCount += group.length - 1;
      console.log(`  DUPLICATE ASSISTANT GROUP (${group.length} copies):`);
      for (const row of group) {
        console.log(`    id: ${row.id} | createdAt: ${row.createdAt}`);
      }
      console.log();
    }
  }

  if (assistantDuplicateCount > 0) {
    console.log(`  Assistant duplicates found: ${assistantDuplicateCount}\n`);
  } else {
    console.log(`  No assistant duplicates found.\n`);
  }

  // --- Summary ---
  const counts = await client.execute({
    sql: `SELECT role, COUNT(*) as count FROM mastra_messages
          WHERE thread_id = ? GROUP BY role`,
    args: [THREAD_ID],
  });

  console.log("--- Message counts by role ---");
  for (const row of counts.rows) {
    console.log(`  ${row.role}: ${row.count}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
