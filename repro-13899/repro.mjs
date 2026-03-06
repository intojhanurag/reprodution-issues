/**
 * Reproduction script for https://github.com/mastra-ai/mastra/issues/13899
 *
 * FetchServerResponse._toFetchResponse: ReadableStream controller.close()
 * crashes with ERR_INVALID_STATE when client disconnects mid-stream.
 *
 * The race condition:
 * 1. Server creates a streaming response via fetch-to-node's toReqRes/toFetchResponse
 *    (same code path as Mastra's MCP HTTP transport in @mastra/hono adapter)
 * 2. Client starts reading the stream
 * 3. Client disconnects → ReadableStream body gets cancelled (reader.cancel())
 * 4. Server doesn't know, calls res.end() → "finish" event fires
 * 5. "finish" handler calls controller.close() on already-cancelled controller → CRASH
 *
 * Usage:
 *   node repro.mjs          # Run with currently installed fetch-to-node
 *   node repro.mjs --before # Run with unpatched fetch-to-node (to confirm crash)
 */

import http from 'node:http';
import { toReqRes, toFetchResponse } from 'fetch-to-node';

const PORT = 4111;
const TOTAL_CLIENTS = 10;
let crashCount = 0;
let completions = 0;

// Catch uncaught exceptions (this is what kills Node.js in production)
process.on('uncaughtException', (err) => {
  crashCount++;
  console.error(`  [CRASH #${crashCount}] ${err.message}`);
});

const server = http.createServer(async (nodeReq, nodeRes) => {
  const url = new URL(nodeReq.url, `http://localhost:${PORT}`);
  const fetchRequest = new Request(url.toString(), {
    method: nodeReq.method,
    headers: nodeReq.headers,
  });

  // === This is the same code path as Mastra's MCP HTTP transport ===
  // See: server-adapters/hono/src/index.ts lines 292-322
  const { req, res } = toReqRes(fetchRequest);

  // Write headers + first chunk immediately so client receives data
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Transfer-Encoding': 'chunked',
  });
  res.write('data: {"type":"hello"}\n\n');

  // Get the fetch Response (creates the ReadableStream with the buggy controller handlers)
  const fetchResponse = await toFetchResponse(res);

  // Pipe to the real HTTP client (like @hono/node-server does)
  nodeRes.writeHead(fetchResponse.status, Object.fromEntries(fetchResponse.headers));

  const reader = fetchResponse.body.getReader();

  // When client disconnects, cancel the reader
  // This is what @hono/node-server does when the HTTP connection drops
  nodeReq.on('close', () => {
    // THIS causes the ReadableStream controller to enter "closed" state
    reader.cancel('client disconnected').catch(() => {});
  });

  // Pipe chunks to client in background
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!nodeRes.destroyed) nodeRes.write(value);
      }
      if (!nodeRes.destroyed) nodeRes.end();
    } catch {
      // Expected when stream is cancelled
    }
  })();

  // Server keeps writing data over time (simulates LLM streaming tokens / MCP tool responses)
  // The client will disconnect after the first chunk, but the server doesn't know
  setTimeout(() => res.write('data: {"type":"chunk2"}\n\n'), 150);
  setTimeout(() => res.write('data: {"type":"chunk3"}\n\n'), 200);

  // Server finishes AFTER client has disconnected
  // This fires "finish" event → controller.close() on cancelled stream → CRASH
  setTimeout(() => {
    res.end();
    completions++;
  }, 300);
});

server.listen(PORT, async () => {
  console.log(`\n=== Issue #13899 Reproduction ===`);
  console.log(`fetch-to-node location: ${import.meta.resolve('fetch-to-node')}`);
  console.log(`Sending ${TOTAL_CLIENTS} concurrent streaming requests...\n`);

  // Send concurrent requests that disconnect mid-stream
  const promises = [];
  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    promises.push(
      new Promise((resolve) => {
        const req = http.get(`http://localhost:${PORT}/stream`, (res) => {
          res.once('data', () => {
            console.log(`  Client #${i}: Received data, disconnecting...`);
            req.destroy(); // Simulate closing browser tab
            resolve();
          });
          res.on('error', () => resolve());
          res.on('end', () => resolve());
        });
        req.on('error', () => resolve());
        setTimeout(() => { req.destroy(); resolve(); }, 5000);
      })
    );
  }

  await Promise.allSettled(promises);
  console.log(`\n  All clients disconnected. Waiting for server-side "finish" events...\n`);

  // Wait for all server-side finish events to fire
  await new Promise(r => setTimeout(r, 2000));

  console.log(`=== Results ===`);
  console.log(`  Server-side completions: ${completions}`);
  console.log(`  Crashes (ERR_INVALID_STATE): ${crashCount}`);

  if (crashCount > 0) {
    console.log(`\n  FAIL — Issue #13899 reproduced: server crashes when clients disconnect mid-stream`);
  } else {
    console.log(`\n  PASS — No crashes, bug is fixed`);
  }

  server.close();
  process.exit(crashCount > 0 ? 1 : 0);
});
