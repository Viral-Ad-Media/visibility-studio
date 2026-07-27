import { task } from "@trigger.dev/sdk/v3";

// One-off plumbing check: confirms the Trigger.dev connection (project ref +
// secret key) actually works end to end before combining it with a
// multi-turn Claude tool-use loop. Safe to delete once runAudit/auditBusiness
// are verified working.
export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { message: string }) => {
    console.log("hello-world task running", payload);
    return { ok: true, echoedMessage: payload.message, ranAt: new Date().toISOString() };
  },
});
