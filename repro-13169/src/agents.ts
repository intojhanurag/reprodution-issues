import { Agent } from '@mastra/core/agent';
import { memory } from './memory.js';
import { summarizeWorkflow } from './workflow.js';

export const parentAgent = new Agent({
  id: 'parent-agent',
  name: 'Parent Agent',
  instructions: `You are a coordinator. When the user asks you to summarize something,
call the workflow-summarizeWorkflow tool exactly once with the text, then return the result to the user.
Never call the tool more than once.`,
  model: 'groq/llama-3.3-70b-versatile',
  memory,
  workflows: { summarizeWorkflow },
});
