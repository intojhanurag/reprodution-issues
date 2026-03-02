// Case 5: Cross-origin cookie auth — simulates Next.js on :3000, Mastra on :4205
import { startServer } from '../shared/server.js';
import { signupAndGetToken, printResult } from '../shared/helpers.js';

const PORT = 4205;
const FRONTEND_ORIGIN = 'http://localhost:3000';

async function run() {
  console.log('\n=== CASE 5: Cross-origin cookie auth (Next.js + Mastra) ===\n');

  const { httpServer } = await startServer({
    port: PORT,
    corsOrigin: FRONTEND_ORIGIN,
    corsCredentials: true,
  });

  const { signedToken } = await signupAndGetToken(PORT);

  const crossRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: {
      Cookie: `better-auth.session_token=${signedToken}`,
      Origin: FRONTEND_ORIGIN,
    },
  });
  printResult('Cross-origin cookie', crossRes.status, await crossRes.json(), 'pass');

  const noAuthRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  printResult('Cross-origin without cookie', noAuthRes.status, await noAuthRes.json(), 'fail');

  const bearerRes = await fetch(`http://localhost:${PORT}/api/agents`, {
    headers: {
      Authorization: `Bearer ${signedToken}`,
      Origin: FRONTEND_ORIGIN,
    },
  });
  printResult('Cross-origin Bearer token', bearerRes.status, await bearerRes.json(), 'pass');

  httpServer.close();
  console.log('');
}

run().catch(console.error);
