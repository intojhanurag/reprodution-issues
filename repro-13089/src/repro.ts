/**
 * Reproduction for https://github.com/mastra-ai/mastra/issues/13089
 *
 * Bug: When Observational Memory is enabled, user messages are saved to the
 * database multiple times with different IDs but identical content and
 * `createdAt` timestamps. The number of duplicates equals the number of
 * agent steps (maxSteps).
 *
 * Steps:
 *   1. Configure Memory with observationalMemory: { enabled: true }
 *   2. Call agent.stream() with maxSteps and memory (resource + thread)
 *   3. Ensure the agent performs multiple tool calls (multiple steps)
 *   4. Query messages for the thread — the same user message appears N times
 *      (N = number of agent steps), each with a different id but identical
 *      content, role, and createdAt.
 *
 * Versions:
 *   @mastra/memory: 1.3.0
 *   @mastra/core:   1.4.0
 *   @mastra/libsql: 1.4.0
 */

import "dotenv/config";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { z } from "zod";

// ── Storage ────────────────────────────────────────────────────────────────
const storage = new LibSQLStore({
  id: "repro-storage",
  url: "file:./repro-memory.db",
});

// ── Memory with Observational Memory enabled ───────────────────────────────
const memory = new Memory({
  storage,
  options: {
    lastMessages: 20,
    observationalMemory: {
      enabled: true,
      scope: "thread",
      model: "groq/llama-3.3-70b-versatile",
    },
  },
});

// ── Chained tools that force SEQUENTIAL multi-step execution ───────────────
// Each tool returns a "code" that the next tool requires, so the LLM must
// call them one at a time across separate steps.

let stepCounter = 0;

const stepOneTool = createTool({
  id: "step-one-lookup",
  description:
    "Step 1: Look up the city ID. MUST be called first. Returns a cityCode needed by step-two-details.",
  inputSchema: z.object({
    city: z.string().describe("The city name to look up"),
  }),
  outputSchema: z.object({
    cityCode: z.string(),
    message: z.string(),
  }),
  execute: async ({ city }) => {
    stepCounter++;
    console.log(`  [tool] step-one-lookup called (step ${stepCounter}) for "${city}"`);
    return {
      cityCode: "NYC-42",
      message: `City code for ${city} is NYC-42. Now call step-two-details with this cityCode.`,
    };
  },
});

const stepTwoTool = createTool({
  id: "step-two-details",
  description:
    "Step 2: Fetch city details using the cityCode from step-one-lookup. Returns a detailsToken needed by step-three-summary.",
  inputSchema: z.object({
    cityCode: z
      .string()
      .describe("The cityCode returned by step-one-lookup"),
  }),
  outputSchema: z.object({
    population: z.number(),
    temperature: z.number(),
    detailsToken: z.string(),
    message: z.string(),
  }),
  execute: async ({ cityCode }) => {
    stepCounter++;
    console.log(`  [tool] step-two-details called (step ${stepCounter}) with code "${cityCode}"`);
    return {
      population: 8_400_000,
      temperature: 22,
      detailsToken: "DTK-99",
      message: `Details fetched for ${cityCode}. Now call step-three-summary with detailsToken DTK-99.`,
    };
  },
});

const stepThreeTool = createTool({
  id: "step-three-summary",
  description:
    "Step 3: Generate a final summary using the detailsToken from step-two-details. Call this last.",
  inputSchema: z.object({
    detailsToken: z
      .string()
      .describe("The detailsToken returned by step-two-details"),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ detailsToken }) => {
    stepCounter++;
    console.log(`  [tool] step-three-summary called (step ${stepCounter}) with token "${detailsToken}"`);
    return {
      summary: `New York City: population 8.4M, temperature 22°C, timezone America/New_York.`,
    };
  },
});

// ── Agent ──────────────────────────────────────────────────────────────────
const agent = new Agent({
  name: "repro-agent",
  instructions:
    "You are a helpful assistant. To answer questions about cities you MUST " +
    "follow this exact sequence:\n" +
    "1. First call step-one-lookup to get the cityCode\n" +
    "2. Then call step-two-details with that cityCode to get details and a detailsToken\n" +
    "3. Then call step-three-summary with that detailsToken to get the final summary\n" +
    "4. Finally, present the summary to the user\n" +
    "You MUST call only ONE tool per step. Never call multiple tools at once.",
  model: "groq/llama-3.3-70b-versatile",
  tools: {
    "step-one-lookup": stepOneTool,
    "step-two-details": stepTwoTool,
    "step-three-summary": stepThreeTool,
  },
  memory,
});

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const resourceId = "user-repro-13089";
  const threadId = `thread-repro-${Date.now()}`;

  console.log("=== Reproduction for mastra-ai/mastra#13089 ===");
  console.log(`Resource: ${resourceId}`);
  console.log(`Thread:   ${threadId}\n`);

  const userMessage = "Tell me about New York City.";
  console.log(`User message: "${userMessage}"\n`);
  console.log("Streaming agent response (maxSteps: 12)...\n");

  const response = await agent.stream(userMessage, {
    maxSteps: 12,
    memory: {
      resource: resourceId,
      thread: threadId,
    },
  });

  // Consume the stream
  let fullText = "";
  for await (const chunk of response.textStream) {
    fullText += chunk;
  }

  console.log(`\nAgent response:\n${fullText}\n`);
  console.log(`Tool calls made across ${stepCounter} steps\n`);

  // Wait for async memory writes to settle
  console.log("Waiting 3s for async memory writes to settle...\n");
  await new Promise((r) => setTimeout(r, 3000));

  // ── Query via Memory.recall() ────────────────────────────────────────
  console.log("=== Querying via memory.recall() ===\n");

  const { messages: allMessages } = await memory.recall({
    threadId,
    resourceId,
    perPage: false,
  });

  const userMessages = (allMessages || []).filter(
    (m: any) => m.role === "user"
  );

  console.log(`Total messages (recall):       ${allMessages?.length ?? 0}`);
  console.log(`User messages (recall):        ${userMessages.length}`);
  console.log();

  if (userMessages.length > 1) {
    console.log("BUG CONFIRMED (recall): User message was duplicated!\n");
    for (const msg of userMessages) {
      console.log(`  id: ${msg.id}`);
      console.log(`  content: ${JSON.stringify(msg.content).slice(0, 100)}`);
      console.log(`  createdAt: ${msg.createdAt}`);
      console.log();
    }
  } else {
    console.log(`User messages via recall: ${userMessages.length} (expected 1)`);
  }

  // ── Direct SQLite query (bypasses all Mastra abstractions) ───────────
  console.log("\n=== Direct SQLite query on mastra_messages ===\n");
  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database("./repro-memory.db");
    const rows = db
      .prepare(
        `SELECT id, role, content, createdAt
         FROM mastra_messages
         WHERE thread_id = ?
         ORDER BY createdAt ASC`
      )
      .all(threadId) as any[];

    const userRows = rows.filter((r: any) => r.role === "user");

    console.log(`Total rows:  ${rows.length}`);
    console.log(`User rows:   ${userRows.length}`);
    console.log();

    console.log("All rows:");
    for (const row of rows) {
      const contentStr =
        typeof row.content === "string"
          ? row.content
          : JSON.stringify(row.content);
      console.log(`  id:        ${row.id}`);
      console.log(`  role:      ${row.role}`);
      console.log(`  content:   ${contentStr.slice(0, 120)}`);
      console.log(`  createdAt: ${row.createdAt}`);
      console.log();
    }

    if (userRows.length > 1) {
      console.log(
        `BUG CONFIRMED (SQLite): ${userRows.length} user rows for 1 sent message!\n`
      );
    } else {
      console.log(
        "No duplicates in raw DB — only 1 user row."
      );
    }

    db.close();
  } catch (err) {
    console.log("Could not query SQLite directly:", err);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
