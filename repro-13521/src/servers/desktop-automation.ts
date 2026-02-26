import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'desktop-automation', version: '1.0.0' });

server.tool('takeScreenshot', 'Takes a screenshot of the current screen', {}, async () => ({
  content: [{ type: 'text', text: 'Screenshot captured: screen_001.png' }],
}));

server.tool('clickElement', 'Clicks an element at given coordinates', { x: z.number(), y: z.number() }, async ({ x, y }) => ({
  content: [{ type: 'text', text: `Clicked at (${x}, ${y})` }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
