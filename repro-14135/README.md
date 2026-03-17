# Reproduction: PostHog Tools tab empty (mastra-ai/mastra#14135)

## Problem

When using `@mastra/posthog` as the trace exporter, PostHog's LLM Analytics **Tools tab** remains empty because generation span outputs don't include tool call data.

### Root cause

1. **`@mastra/core`** — `MastraLLMV1.__text()` and `__stream()` end the `MODEL_GENERATION` span without including `result.toolCalls` in the output
2. **`@mastra/posthog`** — `PosthogExporter.formatMessages()` receives the span output as a plain object `{ text: "" }`, falls through to `JSON.stringify`, producing a text blob that PostHog's ingestion pipeline cannot parse for tool extraction

### What PostHog expects

PostHog's ingestion extracts tool names from `$ai_output_choices` when content blocks have `type: "tool-call"`:

```json
[{
  "role": "assistant",
  "content": [{
    "type": "tool-call",
    "id": "call_abc",
    "function": { "name": "get_weather", "arguments": { "city": "Paris" } }
  }]
}]
```

### What the unfixed exporter sends

```json
[{
  "role": "assistant",
  "content": [{
    "type": "text",
    "text": "{\"text\":\"\"}"
  }]
}]
```

A stringified JSON blob — PostHog finds no tool-call blocks, so `$ai_tools_called` stays empty.

## Reproducing

### Setup

```bash
npm install
export POSTHOG_API_KEY=phc_your_key_here
# Optional: export POSTHOG_HOST=https://eu.i.posthog.com
```

### Run before (broken)

```bash
node before.cjs
```

Check PostHog → LLM Analytics → Tools tab. Nothing appears.

### Run after (fixed)

```bash
node after.cjs
```

Check PostHog → LLM Analytics → Tools tab. `get_weather` appears.

## Fix

PR: https://github.com/mastra-ai/mastra/pull/XXXX

1. **`packages/core/src/llm/model/model.ts`** — Added `toolCalls` to span output in both `__text()` and `__stream()` paths
2. **`observability/posthog/src/tracing.ts`** — Added `isSpanOutputWithToolCalls()` detection and formatting of AI SDK tool calls into PostHog's expected `tool-call` content block format
