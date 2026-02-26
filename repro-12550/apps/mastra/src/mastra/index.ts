import { Mastra } from "@mastra/core/mastra";
import { auth } from "@lib/auth";

export const mastra = new Mastra({});

// Use the auth import so it's not tree-shaken
console.log("\n✅ SUCCESS: better-auth resolved via tsconfig path alias!");
console.log("   Auth type:", typeof auth);
console.log("   This proves issue #12550 is fixed.\n");
process.exit(0);
