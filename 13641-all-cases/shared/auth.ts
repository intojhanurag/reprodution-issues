import { betterAuth } from 'better-auth';
import { getDb } from './db.js';

export function createAuth(trustedOrigins: string[] = []) {
  return betterAuth({
    database: getDb(),
    emailAndPassword: { enabled: true },
    trustedOrigins,
  });
}
