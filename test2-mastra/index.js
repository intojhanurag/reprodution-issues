// TEST 2: Mastra + AI SDK
// Tests if tool calling works when using Mastra Agent with Ollama.
// Compare results with Test 1.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent, createTool } from "@mastra/core";
import { z } from "zod";

// Connect to Ollama (same setup as Test 1)
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
});

const model = ollama.chatModel("llama3.2:1b");

// Same weather tool but using Mastra's createTool format
const weatherTool = createTool({
  id: "weather",
  description: "Get the current weather for a given city",
  inputSchema: z.object({
    city: z.string().describe("The city to get weather for"),
  }),
  outputSchema: z.object({
    city: z.string(),
    temperature: z.string(),
    condition: z.string(),
  }),
  execute: async ({ context }) => {
    console.log(`\n[TOOL EXECUTED] weather tool called with city: "${context.city}"`);
    return { city: context.city, temperature: "25C", condition: "Sunny" };
  },
});

// Create a Mastra Agent with the weather tool
const agent = new Agent({
  name: "Weather Agent",
  instructions: "You are a helpful weather assistant. Use the weather tool to answer weather questions.",
  model,
  tools: { weather: weatherTool },
});

async function main() {
  console.log("TEST 2: Mastra + AI SDK");
  console.log("Model: llama3.2:1b via Ollama");
  console.log("Prompt: What is the weather in Delhi?\n");

  try {
    const result = await agent.generate("What is the weather in Delhi?", {
      maxSteps: 3,
    });

    const toolCalls = result.steps?.flatMap((step) => step.toolCalls || []) || [];
    const toolResults = result.steps?.flatMap((step) => step.toolResults || []) || [];

    console.log("\n--- RESULTS ---");

    if (toolCalls.length > 0) {
      console.log(`Tool calls: ${toolCalls.length}`);
      console.log("Tool calls detail:", JSON.stringify(toolCalls, null, 2));
      console.log("Tool results:", JSON.stringify(toolResults, null, 2));
    } else {
      console.log("Tool calls: 0 (agent did NOT call the tool)");
    }

    console.log("\nAgent response text:");
    console.log(result.text);

    console.log("\n--- VERDICT ---");
    console.log(toolCalls.length > 0
      ? "PASS - Tool calling works with Mastra + Ollama"
      : "FAIL - Tool calling broken with Mastra + Ollama"
    );
  } catch (error) {
    console.error("ERROR:", error.message);
    if (error.cause) console.error("Cause:", error.cause);
  }
}

main();
