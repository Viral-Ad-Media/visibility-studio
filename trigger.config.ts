import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_chjzexdxabbzcdkuzbyl",
  runtime: "node",
  logLevel: "log",
  // Generous but bounded — a business audit can involve several
  // search+fetch round trips; this is a backstop against a runaway loop
  // burning API spend, not an expected normal duration.
  maxDuration: 300,
  dirs: ["./trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
