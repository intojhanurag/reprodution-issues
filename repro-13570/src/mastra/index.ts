import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

/**
 * Repro for https://github.com/mastra-ai/mastra/issues/13570
 *
 * Expected: With disableInit: true, NO CREATE TABLE / ALTER TABLE
 *           statements should be executed on server startup.
 *
 * Actual:   CREATE TABLE and ALTER TABLE statements still execute
 *           because BuildBundler's entry point explicitly calls
 *           mastra.getStorage().init() bypassing the disableInit flag.
 */
const storage = new PostgresStore({
  id: "repro-storage",
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://mastra:mastra@localhost:5499/mastra",
  disableInit: true, // <-- THIS SHOULD PREVENT TABLE CREATION
});

export const mastra = new Mastra({
  storage,
});
