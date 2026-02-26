import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'Desktop Automation Server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'takeScreenshot',
      description: 'Takes a screenshot of the current screen',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'clickElement',
      description: 'Clicks an element on screen at given coordinates',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'takeScreenshot':
      return {
        content: [{ type: 'text', text: 'Screenshot captured: screen_001.png' }],
      };
    case 'clickElement':
      return {
        content: [{ type: 'text', text: `Clicked at (${request.params.arguments?.x}, ${request.params.arguments?.y})` }],
      };
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
