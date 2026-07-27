import { tasks } from "@trigger.dev/sdk/v3";

async function main() {
  const handle = await tasks.trigger("audit-business", {
    accountId: 1,
    auditId: 3,
    name: "Floyd's 99 Barbershop",
    website: null,
  });
  console.log(JSON.stringify(handle));
}

main();
