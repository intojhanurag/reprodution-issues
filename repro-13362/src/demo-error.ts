import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { InMemoryStore } from "@mastra/core/storage";

const storage = new InMemoryStore();
const memory = new Memory({ storage });

// Sub-agent with a non-existent model to force an error
const brokenAgent = new Agent({
  id: "broken-agent",
  name: "Broken Agent",
  description: "An agent that handles tasks.",
  instructions: "You are an agent.",
  model: "groq/non-existent-model-12345",
});

const orchestrator = new Agent({
  id: "orchestrator",
  name: "Orchestrator",
  instructions: "Delegate tasks to the broken-agent.",
  model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
  agents: { "broken-agent": brokenAgent },
  memory,
});

async function main() {
  console.log("Starting network execution (expecting onError to fire)...\n");

  try {
    const stream = await orchestrator.network("Do something", {
      onStepFinish: (event) => {
        console.log(
          `[onStepFinish] finishReason=${event.finishReason}, tokens=${JSON.stringify(event.usage)}`
        );
      },
      onError: ({ error }) => {
        console.error(`[onError] ${error}`);
      },
      memory: {
        thread: "error-demo-thread",
        resource: "demo-user",
      },
    });

    for await (const chunk of stream) {
      // consume
    }
  } catch (e) {
    console.log(`\nNetwork threw (expected): ${(e as Error).message?.substring(0, 120)}`);
  }
}

main().catch(console.error);
