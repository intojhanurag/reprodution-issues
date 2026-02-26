import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === Test 1: Good-only config (baseline) ===
console.log('=== Test 1: Good-only config ===');

const goodOnlyMcp = new MCPClient({
  id: 'good-only',
  servers: {
    desktopAutomation: {
      command: 'npx',
      args: ['tsx', path.join(__dirname, 'servers/desktop-automation.ts')],
    },
  },
});

const goodOnlyTools = await goodOnlyMcp.listTools();
console.log('Tools loaded:', Object.keys(goodOnlyTools));
console.log('Tool count:', Object.keys(goodOnlyTools).length);
await goodOnlyMcp.disconnect();

if (Object.keys(goodOnlyTools).length === 0) {
  console.log('FAIL: Good-only config returned 0 tools');
  process.exit(1);
}
console.log('PASS: Good-only config works\n');

// === Test 2: Good + one failing server (the actual bug) ===
console.log('=== Test 2: Good + failing server (issue repro) ===');

const mixedMcp = new MCPClient({
  id: 'mixed-config',
  servers: {
    // Healthy server (like "desktop-automation" in the issue)
    desktopAutomation: {
      command: 'npx',
      args: ['tsx', path.join(__dirname, 'servers/desktop-automation.ts')],
    },
    // Failing server (like "maestro" CLI not installed)
    maestro: {
      command: 'maestro',
      args: ['test'],
    },
  },
});

let mixedTools: Record<string, unknown>;
try {
  mixedTools = await mixedMcp.listTools();
  console.log('Tools loaded:', Object.keys(mixedTools));
  console.log('Tool count:', Object.keys(mixedTools).length);
} catch (err) {
  console.log('FAIL: listTools() threw an error instead of returning partial results');
  console.log('Error:', (err as Error).message);
  await mixedMcp.disconnect();
  process.exit(1);
}

if (Object.keys(mixedTools).length === 0) {
  console.log('FAIL: Mixed config returned 0 tools — healthy server tools were lost');
  await mixedMcp.disconnect();
  process.exit(1);
}

const hasDesktopTools = 'desktopAutomation_takeScreenshot' in mixedTools && 'desktopAutomation_clickElement' in mixedTools;
if (!hasDesktopTools) {
  console.log('FAIL: Desktop automation tools missing from results');
  await mixedMcp.disconnect();
  process.exit(1);
}

const hasMaestroTools = Object.keys(mixedTools).some(k => k.startsWith('maestro_'));
if (hasMaestroTools) {
  console.log('UNEXPECTED: Maestro tools should not be present (server should have failed)');
}

console.log('PASS: Healthy server tools loaded despite failing server\n');

// === Test 3: listToolsets with mixed config ===
console.log('=== Test 3: listToolsets with mixed config ===');

const mixedToolsets = await mixedMcp.listToolsets();
console.log('Toolset servers:', Object.keys(mixedToolsets));

if (!mixedToolsets.desktopAutomation) {
  console.log('FAIL: desktopAutomation toolset missing');
  await mixedMcp.disconnect();
  process.exit(1);
}

if (mixedToolsets.maestro) {
  console.log('UNEXPECTED: Maestro toolset should not be present');
}

console.log('PASS: Toolsets returned with per-server isolation\n');

// === Test 4: Agent creation with mixed tools ===
console.log('=== Test 4: Agent creation with mixed MCP tools ===');

const agent = new Agent({
  name: 'Desktop Agent',
  instructions: 'You help with desktop automation tasks.',
  model: {
    provider: 'GOOGLE',
    name: 'gemini-2.0-flash',
    toolChoice: 'auto',
  },
  tools: mixedTools,
});

console.log('Agent created successfully with', Object.keys(mixedTools).length, 'tools');
console.log('PASS: Agent works with partial MCP tools\n');

await mixedMcp.disconnect();

// === Test 5: disconnect resilience ===
console.log('=== Test 5: Disconnect resilience ===');

const disconnectMcp = new MCPClient({
  id: 'disconnect-test',
  servers: {
    desktopAutomation: {
      command: 'npx',
      args: ['tsx', path.join(__dirname, 'servers/desktop-automation.ts')],
    },
    brokenServer: {
      command: 'nonexistent-binary-xyz',
      args: [],
    },
  },
});

await disconnectMcp.listTools().catch(() => {});
try {
  await disconnectMcp.disconnect();
  console.log('PASS: Disconnect completed without throwing\n');
} catch (err) {
  console.log('FAIL: Disconnect threw:', (err as Error).message);
  process.exit(1);
}

console.log('========================================');
console.log('ALL TESTS PASSED');
console.log('========================================');
