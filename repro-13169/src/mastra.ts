import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { parentAgent } from './agents.js';

export const mastra = new Mastra({
  agents: { parentAgent },
  storage: new InMemoryStore(),
  logger: false,
});
