import { Mastra } from "@mastra/core";
import { SHARED_GREETING, getGreeting } from "@repro/shared";

console.log("[mastra] Shared greeting:", SHARED_GREETING);
console.log("[mastra] Personalized:", getGreeting("Developer"));

export const mastra = new Mastra({});
