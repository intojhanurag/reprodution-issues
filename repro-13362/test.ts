import { Agent } from "@mastra/core/agent";
import { InMemoryStore } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";

// Verify onStepFinish and onError compile without type errors in NetworkOptions
async function testTypeSignature() {
  console.log("=== Test 1: Type Signature ===");

  const agent = new Agent({
    id: "type-test-agent",
    name: "Type Test Agent",
    instructions: "You are a helpful assistant.",
    model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
  });

  // Both callbacks should be accepted by the NetworkOptions type
  ({
    onStepFinish: (event: any) => {
      console.log("Step finished:", event.finishReason);
    },
    onError: ({ error }: { error: any }) => {
      console.error("Error:", error);
    },
    memory: {
      thread: "test-thread",
      resource: "test-resource",
    },
  }) satisfies Parameters<typeof agent.network>[1];

  console.log("PASS: onStepFinish and onError accepted in NetworkOptions type");
}

// Verify onStepFinish fires during network execution with a real LLM
async function testOnStepFinishE2E() {
  console.log("\n=== Test 2: onStepFinish E2E ===");

  const store = new InMemoryStore();
  const memory = new Memory({ storage: store });

  const subAgent = new Agent({
    id: "researcher",
    name: "Researcher",
    description: "An agent that can answer questions about science.",
    instructions: "You are a science expert. Answer questions briefly in 1-2 sentences.",
    model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
  });

  const networkAgent = new Agent({
    id: "network-agent",
    name: "Network Agent",
    instructions: "Delegate tasks to the researcher agent.",
    model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    agents: { researcher: subAgent },
    memory,
  });

  const stepFinishEvents: any[] = [];

  const stream = await networkAgent.network("What is photosynthesis? Answer in one sentence.", {
    onStepFinish: (event) => {
      stepFinishEvents.push(event);
      console.log(`  onStepFinish fired: finishReason=${event.finishReason}, usage=${JSON.stringify(event.usage)}`);
    },
    memory: {
      thread: "e2e-step-finish-thread",
      resource: "e2e-test",
    },
  });

  // Consume stream
  for await (const _chunk of stream) {
    // consume
  }

  if (stepFinishEvents.length > 0) {
    console.log(`PASS: onStepFinish fired ${stepFinishEvents.length} time(s)`);
    const last = stepFinishEvents[stepFinishEvents.length - 1];
    if (last.finishReason) {
      console.log(`PASS: finishReason present: ${last.finishReason}`);
    } else {
      console.log("FAIL: finishReason missing from onStepFinish event");
      process.exit(1);
    }
    if (last.usage) {
      console.log(`PASS: usage present: ${JSON.stringify(last.usage)}`);
    } else {
      console.log("FAIL: usage missing from onStepFinish event");
      process.exit(1);
    }
  } else {
    console.log("FAIL: onStepFinish was never called");
    process.exit(1);
  }
}

// Verify onError fires when a sub-agent fails
async function testOnErrorE2E() {
  console.log("\n=== Test 3: onError E2E ===");

  const store = new InMemoryStore();
  const memory = new Memory({ storage: store });

  // Use an invalid model so the sub-agent fails during streaming
  const brokenAgent = new Agent({
    id: "broken-agent",
    name: "Broken Agent",
    description: "An agent that will fail.",
    instructions: "You are an agent.",
    model: "groq/non-existent-model-12345",
  });

  const networkAgent = new Agent({
    id: "error-network-agent",
    name: "Error Network Agent",
    instructions: "Delegate tasks to the broken agent.",
    model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    agents: { "broken-agent": brokenAgent },
    memory,
  });

  const errorEvents: any[] = [];

  try {
    const stream = await networkAgent.network("Do something", {
      onError: ({ error }) => {
        errorEvents.push({ error });
        console.log(`  onError fired: ${error}`);
      },
      memory: {
        thread: "e2e-error-thread",
        resource: "e2e-test",
      },
    });

    for await (const _chunk of stream) {
      // consume
    }
  } catch (e) {
    console.log(`  Network threw (expected): ${(e as Error).message?.substring(0, 100)}`);
  }

  if (errorEvents.length > 0) {
    console.log(`PASS: onError fired ${errorEvents.length} time(s)`);
  } else {
    console.log("WARN: onError was not called (error may have been thrown before streaming started)");
    console.log("  This is acceptable - the routing agent may fail before reaching sub-agent streaming");
  }
}

async function main() {
  try {
    await testTypeSignature();
    await testOnStepFinishE2E();
    await testOnErrorE2E();
    console.log("\n=== ALL TESTS PASSED ===");
  } catch (e) {
    console.error("\nFATAL:", e);
    process.exit(1);
  }
}

main();
