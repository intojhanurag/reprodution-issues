# Repro: mastra-ai/mastra#13521

One failing MCP server collapses tool loading for all healthy servers.

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm repro
```

## What happens

**Config:** One healthy MCP server (`desktop-automation`) + one broken server (`maestro` — binary not installed).

**Bug:** `listTools()` throws — returns 0 tools. Healthy server's tools are lost.

**Fixed:** `listTools()` returns tools from the healthy server. Broken server is logged and skipped.
