export async function signupAndGetToken(
  port: number,
  email = 'test@example.com',
  password = 'password123',
  name = 'Test User',
): Promise<{ signedToken: string; rawToken: string }> {
  const origin = `http://localhost:${port}`;

  const signupRes = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email, password, name }),
  });

  if (!signupRes.ok) {
    const signinRes = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ email, password }),
    });
    if (!signinRes.ok) throw new Error(`Sign-in failed: ${signinRes.status}`);
    return extractTokens(signinRes);
  }

  return extractTokens(signupRes);
}

function extractTokens(res: Response): { signedToken: string; rawToken: string } {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const sessionCookie = setCookie.find((c: string) => c.includes('better-auth.session_token='));
  if (!sessionCookie) throw new Error('No session cookie in response');

  const signedToken = sessionCookie.split('better-auth.session_token=')[1].split(';')[0];
  const rawToken = signedToken.includes('.') ? signedToken.split('.')[0] : signedToken;

  return { signedToken, rawToken };
}

export function printResult(name: string, status: number, body: any, expected: 'pass' | 'fail') {
  const actual = status === 200 ? 'pass' : 'fail';
  const match = actual === expected;
  const icon = match ? '\x1b[32mCORRECT\x1b[0m' : '\x1b[31mUNEXPECTED\x1b[0m';
  console.log(`  [${icon}] ${name}`);
  console.log(`    Status: ${status} (expected ${expected === 'pass' ? '200' : '401'})`);
  if (status !== 200) console.log(`    Error: ${JSON.stringify(body)}`);
}
