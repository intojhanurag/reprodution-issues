export const SHARED_GREETING = "Hello from shared package v3 changed";

export function getGreeting(name: string): string {
  return `${SHARED_GREETING} - Welcome, ${name}!`;
}
