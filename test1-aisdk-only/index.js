// TEST 1: AI SDK Only (No Mastra)
// Tests if tool calling works with Ollama via AI SDK directly.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, tool } from "ai";
import { z } from "zod";

// Connect to Ollama (no API key needed, runs locally)
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
});

const model = ollama.chatModel("llama3.2:1b");

// Simple weather tool that returns hardcoded data.
// We only care whether the model actually CALLS it vs describing it as text.
const weatherTool = tool({
  description: "Get the current weather for a given city",
  parameters: z.object({
    city: z.string().describe("The city to get weather for"),
  }),
  execute: async ({ city }) => {
    console.log(`\n[TOOL EXECUTED] weather tool called with city: "${city}"`);
    return { city, temperature: "25C", condition: "Sunny" };
  },
});

async function main() {
  console.log("TEST 1: AI SDK Only (No Mastra)");
  console.log("Model: llama3.2:1b via Ollama");
  console.log("Prompt: What is the weather in Delhi?\n");

  try {
    const result = await generateText({
      model,
      tools: { weather: weatherTool },
      maxSteps: 3,
      prompt: "What is the weather in Delhi?",
    });

    const toolCalls = result.steps.flatMap((step) => step.toolCalls || []);
    const toolResults = result.steps.flatMap((step) => step.toolResults || []);

    console.log("\n--- RESULTS ---");

    if (toolCalls.length > 0) {
      console.log(`Tool calls: ${toolCalls.length}`);
      console.log("Tool calls detail:", JSON.stringify(toolCalls, null, 2));
      console.log("Tool results:", JSON.stringify(toolResults, null, 2));
    } else {
      console.log("Tool calls: 0 (model did NOT call the tool)");
    }

    console.log("\nModel response text:");
    console.log(result.text);

    console.log("\n--- VERDICT ---");
    console.log(toolCalls.length > 0
      ? "PASS - Tool calling works with AI SDK + Ollama"
      : "FAIL - Tool calling broken with AI SDK + Ollama"
    );
  } catch (error) {
    console.error("ERROR:", error.message);
    if (error.cause) console.error("Cause:", error.cause);
  }
}

main();
