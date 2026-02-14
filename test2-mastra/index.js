// =============================================================
// TEST 2: MASTRA + AI SDK
// Purpose: Test if tool calling works when using Mastra's Agent
//          with Ollama. Compare results to Test 1.
// =============================================================

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent, createTool } from "@mastra/core";
import { z } from "zod";

// ---- Step 1: Connect to Ollama (same as Test 1) ----
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
});

const model = ollama.chatModel("llama3.2:1b");

// ---- Step 2: Define the SAME weather tool, but using Mastra's format ----
// Mastra uses `createTool()` instead of AI SDK's `tool()`.
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
    // This is fake data — we just want to know if this function runs
    console.log(`\n✅ TOOL WAS CALLED! Mastra agent invoked the weather tool for city: "${context.city}"`);
    return {
      city: context.city,
      temperature: "25°C",
      condition: "Sunny",
    };
  },
});

// ---- Step 3: Create a Mastra Agent ----
const agent = new Agent({
  name: "Weather Agent",
  instructions: "You are a helpful weather assistant. Use the weather tool to answer weather questions.",
  model: model,
  tools: { weather: weatherTool },
});

// ---- Step 4: Send a message and see what happens ----
async function main() {
  console.log("=".repeat(60));
  console.log("TEST 2: Mastra + AI SDK");
  console.log("Model: llama3.2:1b via Ollama");
  console.log("=".repeat(60));
  console.log("\nSending message: 'What is the weather in Delhi?'");
  console.log("Waiting for response...\n");

  try {
    const result = await agent.generate("What is the weather in Delhi?", {
      maxSteps: 3,
    });

    // ---- Step 5: Analyze the result ----
    console.log("\n" + "-".repeat(60));
    console.log("RESULT ANALYSIS:");
    console.log("-".repeat(60));

    // Check if any tool was called by looking at the steps
    const toolCalls = result.steps?.flatMap((step) => step.toolCalls || []) || [];
    const toolResults = result.steps?.flatMap((step) => step.toolResults || []) || [];

    if (toolCalls.length > 0) {
      console.log(`\n✅ SUCCESS: The Mastra agent made ${toolCalls.length} tool call(s)!`);
      console.log("Tool calls:", JSON.stringify(toolCalls, null, 2));
      console.log("Tool results:", JSON.stringify(toolResults, null, 2));
    } else {
      console.log("\n❌ FAILURE: The Mastra agent did NOT call any tools.");
      console.log("   It probably just described the tool in plain text instead.");
    }

    console.log("\nFinal text response from agent:");
    console.log(`"${result.text}"`);

    // Summary
    console.log("\n" + "=".repeat(60));
    if (toolCalls.length > 0) {
      console.log("VERDICT: ✅ Tool calling WORKS with Mastra + Ollama");
    } else {
      console.log("VERDICT: ❌ Tool calling BROKEN with Mastra + Ollama");
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n💥 ERROR:", error.message);
    if (error.cause) {
      console.error("Cause:", error.cause);
    }
    console.log("\nMake sure Ollama is running: ollama serve");
  }
}

main();
