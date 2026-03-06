# Reproduction: Issue #13899

**FetchServerResponse._toFetchResponse: ReadableStream controller.close() crashes with ERR_INVALID_STATE**

- Issue: https://github.com/mastra-ai/mastra/issues/13899
- Fix: `pnpm patch` on `fetch-to-node@2.1.0` (see `patches/fetch-to-node@2.1.0.patch`)

## What is the bug

When a Mastra app serves streaming responses via `fetch-to-node` (used in the MCP HTTP transport path at `server-adapters/hono/src/index.ts:308`), and a client disconnects mid-stream, the Node.js process crashes with:

```
TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed
```

The root cause is in `fetch-to-node@2.1.0`'s `FetchServerResponse._toFetchResponse()`. It creates a `ReadableStream` without guarding `controller.close()` and `controller.enqueue()` against the stream already being cancelled by a client disconnect.

## How to verify

### Step 1: Confirm the crash (BEFORE fix)

```bash
cd repro-issues/13899
npm install
node repro.mjs
```

You should see 30 crashes:

```
  Client #0: Received data, disconnecting...
  ...
  Client #9: Received data, disconnecting...

  [CRASH #1] Invalid state: Controller is already closed
  [CRASH #2] Invalid state: Controller is already closed
  ...
  [CRASH #30] Invalid state: Controller is already closed

  FAIL — Issue #13899 reproduced: server crashes when clients disconnect mid-stream
```

### Step 2: Apply the patch (the fix)

```bash
cd node_modules/fetch-to-node
patch -p1 < ../../../../patches/fetch-to-node@2.1.0.patch
cd ../..
```

You should see:

```
patching file dist/fetch-to-node/http-server.js
```

### Step 3: Confirm no crash (AFTER fix)

```bash
node repro.mjs
```

You should see 0 crashes:

```
  Client #0: Received data, disconnecting...
  ...
  Client #9: Received data, disconnecting...

  PASS — No crashes, bug is fixed
```

### Step 4: Clean up

```bash
rm -rf node_modules package-lock.json
```

## What the patch changes

The patch (`patches/fetch-to-node@2.1.0.patch`) makes 3 changes to `_toFetchResponse()` in `fetch-to-node`:

1. **Adds a `cancel()` callback** to the `ReadableStream` — sets a `cancelled` flag when the consumer cancels (client disconnect)
2. **Guards the `finish` event handler** — skips `controller.close()` if already cancelled, wraps in try-catch
3. **Guards the `_dataWritten` event handler** — skips `controller.enqueue()` if already cancelled, wraps in try-catch

## How repro.mjs maps to production

```
Production:
  HTTP Client -> Docker -> @hono/node-server -> Hono adapter
    -> toReqRes() -> MCP server writes to res -> toFetchResponse()
    -> Client disconnects -> reader.cancel() -> res.end() fires "finish"
    -> controller.close() on closed controller -> CRASH

repro.mjs:
  HTTP Client -> Node.js http server
    -> toReqRes() -> server writes to res -> toFetchResponse()
    -> Client disconnects -> reader.cancel() -> res.end() fires "finish"
    -> controller.close() on closed controller -> CRASH
```

Both paths call the same `toReqRes()` and `toFetchResponse()` from `fetch-to-node@2.1.0`. The crash is in `fetch-to-node`'s internal `_toFetchResponse()` method, which is identical in both cases.
