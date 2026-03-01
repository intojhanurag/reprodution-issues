import "dotenv/config";
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

async function testBug() {
  const memory = await store.getStore("memory");
  if (!memory) {
    console.error("Failed to get memory storage domain");
    process.exit(1);
  }

  const { threads } = await memory.listThreads({ perPage: 5 });

  if (threads.length === 0) {
    console.error("No threads found. Run 'npm run seed' first.");
    process.exit(1);
  }

  const targetThread = threads[0]!;
  console.log(`Found ${threads.length} threads. Testing with: ${targetThread.id}`);
  console.log();

  // This call triggers queryTable on mastra_messages with thread_id filter.
  // WITHOUT the fix: full table scan of ALL messages, then filter by thread_id in JS.
  // WITH the fix: indexed query using by_thread or by_thread_created index.
  console.log("Calling listMessages (this triggers queryTable)...");

  const start = performance.now();
  try {
    const { messages, total } = await memory.listMessages({
      threadId: targetThread.id,
    });
    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`  OK: ${messages.length} messages returned (total: ${total}) in ${elapsed}ms`);
  } catch (err: any) {
    const elapsed = (performance.now() - start).toFixed(0);
    console.error(`  FAILED after ${elapsed}ms:`);
    console.error(`  ${err.message}`);
    if (err.message.includes("Too many bytes read")) {
      console.error();
      console.error("  >>> BUG CONFIRMED: queryTable did a full table scan and hit the 16MB limit.");
    }
    process.exit(1);
  }

  // Also test listThreads with resourceId filter (same full-scan issue)
  console.log();
  console.log("Calling listThreads with resourceId filter...");
  const start2 = performance.now();
  try {
    const { threads: filteredThreads, total } = await memory.listThreads({
      filter: { resourceId: "user-repro" },
    });
    const elapsed = (performance.now() - start2).toFixed(0);
    console.log(`  OK: ${filteredThreads.length} threads returned (total: ${total}) in ${elapsed}ms`);
  } catch (err: any) {
    const elapsed = (performance.now() - start2).toFixed(0);
    console.error(`  FAILED after ${elapsed}ms:`);
    console.error(`  ${err.message}`);
  }

  console.log();
  console.log("Test complete.");
}

testBug().catch(console.error);
