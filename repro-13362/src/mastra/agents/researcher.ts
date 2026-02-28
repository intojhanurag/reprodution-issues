import { Agent } from "@mastra/core/agent";

export const researcher = new Agent({
  id: "researcher",
  name: "Researcher",
  description: "An agent that researches topics and provides concise summaries.",
  instructions:
    "You are a research expert. When given a topic, provide a brief 2-3 sentence summary with key facts.",
  model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
});
