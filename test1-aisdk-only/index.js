// =============================================================
// TEST 1: AI SDK ONLY (No Mastra)
// Purpose: Test if tool calling works with Ollama via AI SDK
//          directly, WITHOUT Mastra in the picture.
// =============================================================

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, tool } from "ai";
import { z } from "zod";

// ---- Step 1: Connect to Ollama ----
// Ollama exposes an OpenAI-compatible API at this URL.
// No API key needed — it runs 100% locally on your machine.
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
  // No apiKey needed for local Ollama
});

// Pick the model you have pulled in Ollama
const model = ollama.chatModel("llama3.2:1b");

// ---- Step 2: Define a simple weather tool ----
// This tool returns FAKE hardcoded data.
// We just want to see if the AI CALLS it or just DESCRIBES it.
const weatherTool = tool({
  description: "Get the current weather for a given city",
  parameters: z.object({
    city: z.string().describe("The city to get weather for"),
  }),
  execute: async ({ city }) => {
    // This is fake data — we just want to know if this function runs
    console.log(`\n✅ TOOL WAS CALLED! The AI actually invoked the weather tool for city: "${city}"`);
    return {
      city: city,
      temperature: "25°C",
      condition: "Sunny",
    };
  },
});

// ---- Step 3: Send a message and see what happens ----
async function main() {
  console.log("=".repeat(60));
  console.log("TEST 1: AI SDK Only (No Mastra)");
  console.log("Model: llama3.2:1b via Ollama");
  console.log("=".repeat(60));
  console.log("\nSending message: 'What is the weather in Delhi?'");
  console.log("Waiting for response...\n");

  try {
    const result = await generateText({
      model: model,
      tools: { weather: weatherTool },
      // Allow the AI to call tools automatically
      maxSteps: 3,
      prompt: "What is the weather in Delhi?",
    });

    // ---- Step 4: Analyze the result ----
    console.log("\n" + "-".repeat(60));
    console.log("RESULT ANALYSIS:");
    console.log("-".repeat(60));

    // Check if any tool was called
    const toolCalls = result.steps.flatMap((step) => step.toolCalls || []);
    const toolResults = result.steps.flatMap((step) => step.toolResults || []);

    if (toolCalls.length > 0) {
      console.log(`\n✅ SUCCESS: The AI made ${toolCalls.length} tool call(s)!`);
      console.log("Tool calls:", JSON.stringify(toolCalls, null, 2));
      console.log("Tool results:", JSON.stringify(toolResults, null, 2));
    } else {
      console.log("\n❌ FAILURE: The AI did NOT call any tools.");
      console.log("   It probably just described the tool in plain text instead.");
    }

    console.log("\nFinal text response from AI:");
    console.log(`"${result.text}"`);

    // Summary
    console.log("\n" + "=".repeat(60));
    if (toolCalls.length > 0) {
      console.log("VERDICT: ✅ Tool calling WORKS with AI SDK + Ollama");
    } else {
      console.log("VERDICT: ❌ Tool calling BROKEN with AI SDK + Ollama");
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
