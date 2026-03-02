// Case 2: Cookie-only auth — signed vs unsigned vs none
import { startServer } from '../shared/server.js';
import { signupAndGetToken, printResult } from '../shared/helpers.js';

const PORT = 4202;

async function run() {
  console.log('\n=== CASE 2: Cookie-only authentication ===\n');

  const { httpServer } = await startServer({ port: PORT });
  const { signedToken, rawToken } = await signupAndGetToken(PORT);

  const signedRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Cookie: `better-auth.session_token=${signedToken}` },
  });
  printResult('Signed session cookie', signedRes.status, await signedRes.json(), 'pass');

  const rawRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Cookie: `better-auth.session_token=${rawToken}` },
  });
  printResult('Raw/unsigned token as cookie', rawRes.status, await rawRes.json(), 'fail');

  const emptyRes = await fetch(`http://localhost:${PORT}/api/agents`);
  printResult('No cookie at all', emptyRes.status, await emptyRes.json(), 'fail');

  httpServer.close();
  console.log('');
}

run().catch(console.error);
