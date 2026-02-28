import { orchestrator } from "./mastra/index";
import { z } from "zod";

const OutputSchema = z.object({
  summary: z.string().describe("A polished summary of the topic"),
  keyFacts: z.array(z.string()).describe("Key facts discovered"),
});

async function main() {
  console.log("Starting network execution...\n");

  const stream = await orchestrator.network(
    "Research quantum computing and write a summary about its current state.",
    {
      structuredOutput: { schema: OutputSchema },
      onStepFinish: (event) => {
        console.log(
          `[onStepFinish] finishReason=${event.finishReason}, tokens=${JSON.stringify(event.usage)}`
        );
      },
      onError: ({ error }) => {
        console.error(`[onError] ${error}`);
      },
      memory: {
        thread: "demo-thread",
        resource: "demo-user",
      },
    }
  );

  // Stream chunks to see network activity
  for await (const chunk of stream) {
    if (chunk.type === "routing-agent-text-delta") {
      process.stdout.write(chunk.payload?.text || "");
    }
    if (chunk.type === "agent-execution-event-text-delta") {
      process.stdout.write(chunk.payload?.delta || "");
    }
  }

  console.log("\n\nStructured output:");
  const result = await stream.object;
  console.log(JSON.stringify(result, null, 2));

  console.log("\nToken usage:");
  const usage = await stream.usage;
  console.log(JSON.stringify(usage, null, 2));
}

main().catch(console.error);
