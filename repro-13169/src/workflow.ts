import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { memory } from './memory.js';

const subAgent = new Agent({
  id: 'sub-agent',
  name: 'Sub Agent',
  instructions: 'You are a helpful sub-agent. Summarize the given text in one sentence.',
  model: 'groq/llama-3.3-70b-versatile',
  memory,
});

const summarizeStep = createStep({
  id: 'summarize-step',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async ({ inputData, requestContext }) => {
    // Sub-agent uses its OWN thread. In real apps, sub-agents have their own threads.
    // The bug: requestContext carries the parent's MastraMemory, and the sub-agent's
    // prepare-memory-step overwrites it with the sub-agent's thread.
    const subThreadId = randomUUID();

    const result = await subAgent.generate(inputData.text, {
      memory: { thread: subThreadId, resource: 'sub-agent-resource' },
      requestContext,
      maxSteps: 1,
    });
    return { summary: result.text };
  },
});

export const summarizeWorkflow = createWorkflow({
  id: 'summarize-workflow',
  description: 'Takes text and returns a summary using a sub-agent',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
})
  .then(summarizeStep)
  .commit();
