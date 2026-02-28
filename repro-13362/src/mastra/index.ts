import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { InMemoryStore } from "@mastra/core/storage";
import { researcher } from "./agents/researcher";
import { writer } from "./agents/writer";

const storage = new InMemoryStore();
const memory = new Memory({ storage });

export const orchestrator = new Agent({
  id: "orchestrator",
  name: "Orchestrator",
  instructions:
    "You coordinate between researcher and writer agents. First delegate research, then delegate writing based on the research output.",
  model: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
  agents: { researcher, writer },
  memory,
});
