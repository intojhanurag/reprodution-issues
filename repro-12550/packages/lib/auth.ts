import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    type: "sqlite",
  },
});
