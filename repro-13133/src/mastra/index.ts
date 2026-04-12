import { Mastra } from '@mastra/core/mastra';
import { supportAgent } from './agents/index.js';

export const mastra = new Mastra({
  agents: {
    supportAgent,
  },
});
