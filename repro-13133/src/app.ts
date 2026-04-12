/**
 * CloudDocs Interactive Demo
 *
 * Simulates a real product:
 * - Pick a role (admin / viewer / guest)
 * - Chat with the AI support agent
 * - Agent gets different file access based on your role
 *
 * Tests the dynamic filesystem feature end-to-end.
 */

import * as readline from 'node:readline';
import { RequestContext } from '@mastra/core/request-context';
import { mastra } from './mastra/index.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('   CloudDocs AI Support — Demo App');
  console.log('   (Dynamic Filesystem via requestContext)');
  console.log('========================================');
  console.log('');

  // Step 1: Pick role (simulates login/auth)
  console.log('Available roles:');
  console.log('  1. admin   — Read + write (system configs, reports)');
  console.log('  2. viewer  — Read only (knowledge base, pricing)');
  console.log('  3. guest   — Welcome page only');
  console.log('');

  const roleChoice = await ask('Pick your role (1/2/3): ');
  const roleMap: Record<string, string> = { '1': 'admin', '2': 'viewer', '3': 'guest' };
  const role = roleMap[roleChoice] || 'guest';

  const userName = await ask('Your name: ');

  console.log('');
  console.log(`--- Logged in as ${userName} (role: ${role}) ---`);
  console.log('Chat with the AI agent. Type "switch" to change role, "quit" to exit.');
  console.log('');

  let currentRole = role;
  let currentName = userName || 'User';

  const agent = mastra.getAgent('supportAgent');

  while (true) {
    const input = await ask(`[${currentRole}] You: `);

    if (input.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      break;
    }

    if (input.toLowerCase() === 'switch') {
      const newRole = await ask('New role (admin/viewer/guest): ');
      if (['admin', 'viewer', 'guest'].includes(newRole)) {
        currentRole = newRole;
        console.log(`\n--- Switched to role: ${currentRole} ---\n`);
      } else {
        console.log('Invalid role.');
      }
      continue;
    }

    if (!input) continue;

    try {
      const requestContext = new RequestContext([
        ['role', currentRole],
        ['userName', currentName],
      ]);

      console.log('');
      const result = await agent.generate(input, {
        requestContext,
        maxSteps: 5,
      });

      console.log(`Agent: ${result.text}`);
      console.log('');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      console.log('');
    }
  }

  rl.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
