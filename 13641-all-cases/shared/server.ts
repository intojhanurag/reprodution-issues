import { Mastra } from '@mastra/core';
import { MastraServer } from '@mastra/hono';
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createAuth } from './auth.js';
import { setupTables } from './db.js';

interface ServerOptions {
  port: number;
  corsOrigin?: string | string[];
  corsCredentials?: boolean;
}

export async function startServer(opts: ServerOptions) {
  setupTables();

  const trustedOrigins = opts.corsOrigin
    ? (Array.isArray(opts.corsOrigin) ? opts.corsOrigin : [opts.corsOrigin])
    : [];

  const auth = createAuth(trustedOrigins);
  const mastraAuth = new MastraAuthBetterAuth({ auth });

  const mastra = new Mastra({
    server: {
      auth: mastraAuth,
      cors: {
        origin: opts.corsOrigin ?? '*',
        credentials: opts.corsCredentials ?? false,
      },
    },
  });

  const app = new Hono();
  app.all('/api/auth/*', async (c) => auth.handler(c.req.raw));

  const adapter = new MastraServer({ app, mastra });
  await adapter.init();

  const httpServer = serve({ fetch: app.fetch, port: opts.port });
  return { httpServer, mastra, auth };
}
