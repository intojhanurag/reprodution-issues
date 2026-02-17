# Reproduction: mastra-ai/mastra#13089

**Bug:** When Observational Memory is enabled, user messages are saved to the
database **multiple times** with different IDs but identical content and
`createdAt` timestamps. The number of duplicates equals the number of agent
steps (maxSteps).

## Versions

| Package          | Version |
| ---------------- | ------- |
| `@mastra/memory` | 1.3.0   |
| `@mastra/core`   | 1.4.0   |
| `@mastra/libsql` | 1.4.0   |

## Setup

```bash
npm install
```

Add your OpenAI API key to `.env`:

```
OPENAI_API_KEY=sk-...
```

## Run

```bash
npm run repro
```

## What happens

1. An agent with 3 tools (weather, population, timezone) and observational
   memory enabled receives a single user message.
2. The agent calls each tool in separate steps (3+ steps).
3. After streaming completes, the script queries the database.
4. **Expected:** 1 user message in the `mastra_messages` table.
5. **Actual:** The same user message appears N times (N = number of agent
   steps), each with a different `id` but identical `content`, `role`, and
   `createdAt`.

## Relevant issue

https://github.com/mastra-ai/mastra/issues/13089
