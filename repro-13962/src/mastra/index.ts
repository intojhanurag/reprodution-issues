import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter } from '@mastra/observability';
import { google } from '@ai-sdk/google';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const greeterAgent = new Agent({
  id: 'greeterAgent',
  name: 'Greeter',
  instructions: 'You are a friendly greeter. Say hello and be helpful. Keep responses short.',
  model: google('gemini-2.5-flash-preview-05-20'),
});

export const mastra = new Mastra({
  agents: { greeterAgent },
  storage,
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'repro-13962',
        exporters: [new DefaultExporter()],
      },
    },
  }),
});
