import "dotenv/config";
import crypto from "node:crypto";
import { ConvexStore } from "@mastra/convex";

const CONVEX_URL = process.env.CONVEX_URL!;
const CONVEX_ADMIN_KEY = process.env.CONVEX_ADMIN_KEY!;

if (!CONVEX_URL || !CONVEX_ADMIN_KEY) {
  console.error("Missing CONVEX_URL or CONVEX_ADMIN_KEY in .env");
  process.exit(1);
}

const store = new ConvexStore({
  id: "repro-store",
  deploymentUrl: CONVEX_URL,
  adminAuthToken: CONVEX_ADMIN_KEY,
});

const THREAD_COUNT = 20;
const MESSAGES_PER_THREAD = 30;

async function seed() {
  const memory = await store.getStore("memory");
  if (!memory) {
    console.error("Failed to get memory storage domain");
    process.exit(1);
  }

  console.log(
    `Seeding ${THREAD_COUNT} threads x ${MESSAGES_PER_THREAD} messages = ${THREAD_COUNT * MESSAGES_PER_THREAD} total messages...`
  );

  for (let t = 0; t < THREAD_COUNT; t++) {
    const threadId = `thread-${t}-${Date.now()}`;
    const resourceId = "user-repro";

    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: `Thread ${t}`,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const messages = [];
    for (let m = 0; m < MESSAGES_PER_THREAD; m++) {
      const role = m % 2 === 0 ? "user" : "assistant";
      messages.push({
        id: crypto.randomUUID(),
        threadId,
        resourceId,
        role: role as "user" | "assistant",
        type: "v2",
        content: {
          content: `Message ${m} in thread ${t}. ${"x".repeat(200)}`,
          metadata: {},
        },
        createdAt: new Date(Date.now() + m * 1000),
      });
    }

    await memory.saveMessages({ messages });
    console.log(`  Thread ${t + 1}/${THREAD_COUNT} seeded (${threadId})`);
  }

  console.log("\nDone seeding. Total messages:", THREAD_COUNT * MESSAGES_PER_THREAD);
}

seed().catch(console.error);
