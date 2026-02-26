/**
 * Reproduction for https://github.com/mastra-ai/mastra/issues/13521
 *
 * Bug: One failing MCP server collapses tool loading for ALL servers.
 * When MCPClient is configured with a healthy + a broken server,
 * listTools() throws instead of returning tools from the healthy server.
 *
 * Run: pnpm repro
 *
 * Expected on buggy version: Test 2 FAILS — listTools() throws, 0 tools returned.
 * Expected on fixed version:  ALL PASS — healthy server tools returned despite broken server.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCPClient } from '@mastra/mcp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'servers/desktop-automation.ts');

// Healthy server — a local MCP server with 2 tools
const healthyServer = { command: 'npx', args: ['tsx', serverPath] };

// Broken server — binary doesn't exist, simulates "maestro CLI not installed"
const brokenServer = { command: 'maestro', args: ['test'] };

// -------------------------------------------------------
// Test 1: Single healthy server (baseline — should always pass)
// -------------------------------------------------------
console.log('\n--- Test 1: Single healthy server ---');

const singleMcp = new MCPClient({ id: 'single', servers: { desktop: healthyServer } });
const singleTools = await singleMcp.listTools();
await singleMcp.disconnect();

console.log('Tools:', Object.keys(singleTools));
assert(Object.keys(singleTools).length === 2, 'Expected 2 tools from healthy server');

// -------------------------------------------------------
// Test 2: Healthy + broken server (the bug)
// -------------------------------------------------------
console.log('\n--- Test 2: Healthy + broken server ---');

const mixedMcp = new MCPClient({
  id: 'mixed',
  servers: { desktop: healthyServer, maestro: brokenServer },
});

let mixedTools: Record<string, unknown>;
try {
  mixedTools = await mixedMcp.listTools();
} catch {
  await mixedMcp.disconnect();
  fail('listTools() threw instead of returning partial results');
}

console.log('Tools:', Object.keys(mixedTools));
assert(Object.keys(mixedTools).length === 2, 'Expected 2 tools from healthy server');
assert('desktop_takeScreenshot' in mixedTools, 'Missing desktop_takeScreenshot');
assert('desktop_clickElement' in mixedTools, 'Missing desktop_clickElement');

// -------------------------------------------------------
// Test 3: listToolsets() with mixed servers
// -------------------------------------------------------
console.log('\n--- Test 3: listToolsets() with mixed servers ---');

const toolsets = await mixedMcp.listToolsets();
await mixedMcp.disconnect();

console.log('Servers in toolsets:', Object.keys(toolsets));
assert('desktop' in toolsets, 'Healthy server missing from toolsets');
assert(!('maestro' in toolsets), 'Broken server should not be in toolsets');

console.log('\n--- ALL PASSED ---\n');

// -------------------------------------------------------

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
  console.log('  PASS:', message);
}

function fail(message: string): never {
  console.error('  FAIL:', message);
  process.exit(1);
}
