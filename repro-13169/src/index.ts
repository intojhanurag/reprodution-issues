import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mastra/core/request-context';
import { mastra } from './mastra.js';

async function main() {
  const agent = mastra.getAgent('parentAgent');
  const memory = await agent.getMemory();

  if (!memory) {
    console.error('Memory not configured on agent');
    process.exit(1);
  }

  const parentThreadId = randomUUID();
  const resourceId = 'test-user';

  await memory.createThread({ threadId: parentThreadId, resourceId });
  console.log(`Parent thread: ${parentThreadId}\n`);

  // Use an explicit requestContext so we can inspect it after the run
  const requestContext = new RequestContext();

  console.log('=== Streaming parent agent ===\n');

  const stream = await agent.stream(
    'Summarize: "The quick brown fox jumps over the lazy dog. This pangram is used in typography testing."',
    {
      memory: { thread: parentThreadId, resource: resourceId },
      requestContext,
      maxSteps: 3,
    },
  );

  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta' && chunk.payload.delta) {
      process.stdout.write(chunk.payload.delta);
    } else if (chunk.type === 'tool-call') {
      console.log(`\n  [TOOL CALL] ${chunk.payload.toolName}`);
    } else if (chunk.type === 'tool-result') {
      const preview = JSON.stringify(chunk.payload.result).slice(0, 200);
      console.log(`  [TOOL RESULT] ${preview}`);
    }
  }

  console.log('\n');

  // === The real check: inspect MastraMemory on requestContext ===
  // After the workflow tool runs, MastraMemory should still point to the parent thread.
  // WITHOUT the fix, it gets overwritten to the sub-agent's thread.

  const mastraMemory = requestContext.get('MastraMemory') as any;
  console.log('=== MastraMemory on requestContext after stream ===\n');

  if (mastraMemory) {
    const threadOnContext = mastraMemory.thread?.id;
    console.log(`  MastraMemory.thread.id : ${threadOnContext}`);
    console.log(`  Expected (parent)      : ${parentThreadId}`);
    console.log(`  MastraMemory.resourceId: ${mastraMemory.resourceId}`);

    if (threadOnContext === parentThreadId) {
      console.log('\n  CORRECT: MastraMemory still points to the parent thread.');
    } else {
      console.log(
        `\n  *** BUG: MastraMemory was overwritten to a different thread! ***` +
          `\n  The sub-agent inside the workflow corrupted the parent's memory context.` +
          `\n  Parent's output processors will save messages to the wrong thread.`,
      );
    }
  } else {
    console.log('  MastraMemory is not set (agent may not have reached output processing).');
  }

  // Also show what's in the parent thread
  console.log('\n=== Messages in parent thread ===\n');

  const { messages } = await memory.recall({ threadId: parentThreadId, resourceId });

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    let preview = '';

    if (typeof msg.content === 'string') {
      preview = msg.content.slice(0, 150);
    } else if (msg.content && typeof msg.content === 'object' && 'parts' in msg.content) {
      const parts = (msg.content as any).parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (p.type === 'text') preview += (p.text || '').slice(0, 150);
          else if (p.type === 'tool-invocation') preview += `[tool: ${p.toolInvocation?.toolName || '?'}] `;
        }
      }
    }

    console.log(`  ${i + 1}. [${msg.role}] ${preview || '(empty)'}`);
  }

  console.log(`\n  Total: ${messages.length} message(s)`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
