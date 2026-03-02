// Case 1: Reporter's exact scenario — cookie-only and bearer-only were both 401 before fix
import { startServer } from '../shared/server.js';
import { signupAndGetToken, printResult } from '../shared/helpers.js';

const PORT = 4201;

async function run() {
  console.log('\n=== CASE 1: Reporter\'s scenario (was broken before fix) ===\n');

  const { httpServer } = await startServer({ port: PORT });
  const { signedToken } = await signupAndGetToken(PORT);

  const cookieRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Cookie: `better-auth.session_token=${signedToken}` },
  });
  printResult('Cookie only (credentials:"include")', cookieRes.status, await cookieRes.json(), 'pass');

  const bearerRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Authorization: `Bearer ${signedToken}` },
  });
  printResult('Bearer only (Authorization header)', bearerRes.status, await bearerRes.json(), 'pass');

  const noAuthRes = await fetch(`http://localhost:${PORT}/api/agents`);
  printResult('No credentials (should reject)', noAuthRes.status, await noAuthRes.json(), 'fail');

  httpServer.close();
  console.log('');
}

run().catch(console.error);
