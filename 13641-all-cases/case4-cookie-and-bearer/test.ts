// Case 4: Cookie + Bearer together — cookie takes priority
import { startServer } from '../shared/server.js';
import { signupAndGetToken, printResult } from '../shared/helpers.js';

const PORT = 4204;

async function run() {
  console.log('\n=== CASE 4: Cookie AND Bearer together ===\n');

  const { httpServer } = await startServer({ port: PORT });
  const { signedToken } = await signupAndGetToken(PORT);

  const bothRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: {
      Cookie: `better-auth.session_token=${signedToken}`,
      Authorization: `Bearer ${signedToken}`,
    },
  });
  printResult('Valid cookie + valid Bearer', bothRes.status, await bothRes.json(), 'pass');

  const cookieWinsRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: {
      Cookie: `better-auth.session_token=${signedToken}`,
      Authorization: 'Bearer garbage-token',
    },
  });
  printResult('Valid cookie + invalid Bearer (cookie wins)', cookieWinsRes.status, await cookieWinsRes.json(), 'pass');

  const bearerFillsRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: {
      Cookie: 'other_cookie=abc',
      Authorization: `Bearer ${signedToken}`,
    },
  });
  printResult('Non-session cookie + valid Bearer', bearerFillsRes.status, await bearerFillsRes.json(), 'pass');

  httpServer.close();
  console.log('');
}

run().catch(console.error);
