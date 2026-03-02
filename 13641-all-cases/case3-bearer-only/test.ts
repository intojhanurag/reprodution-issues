// Case 3: Bearer-only auth — signed vs unsigned vs invalid
import { startServer } from '../shared/server.js';
import { signupAndGetToken, printResult } from '../shared/helpers.js';

const PORT = 4203;

async function run() {
  console.log('\n=== CASE 3: Bearer-only authentication ===\n');

  const { httpServer } = await startServer({ port: PORT });
  const { signedToken, rawToken } = await signupAndGetToken(PORT);

  const signedRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Authorization: `Bearer ${signedToken}` },
  });
  printResult('Signed token as Bearer', signedRes.status, await signedRes.json(), 'pass');

  const rawRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Authorization: `Bearer ${rawToken}` },
  });
  printResult('Raw/unsigned token as Bearer', rawRes.status, await rawRes.json(), 'fail');

  const garbageRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Authorization: 'Bearer totally-invalid-token' },
  });
  printResult('Invalid token as Bearer', garbageRes.status, await garbageRes.json(), 'fail');

  httpServer.close();
  console.log('');
}

run().catch(console.error);
