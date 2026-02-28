import { Agent } from "@mastra/core/agent";

export const writer = new Agent({
  id: "writer",
  name: "Writer",
  description: "An agent that writes polished content based on research.",
  instructions:
    "You are a skilled writer. Take research input and turn it into a polished, engaging paragraph. Keep it under 100 words.",
  model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
});
