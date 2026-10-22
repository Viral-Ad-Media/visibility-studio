import { randomUUID } from "node:crypto";
import type { Db } from "./db";

// Call only with a user fetched from Clerk after verifying an active session.
// Existing/imported users require an explicit migration map, never email linking.
export async function provisionNewClerkUser(db: Db, user: {
  subject: string; issuer: string; externalId: string | null;
  email: string | null; verifiedAt: string | null;
}): Promise<void> {
  await db.transaction(async tx => {
    // Serializes retries, concurrent first requests, and email collision checks.
    await tx.prepare("SELECT pg_advisory_xact_lock(704321)").get();
    const existing = await tx.prepare(
      "SELECT user_id FROM vis_private.identity_map WHERE provider = 'clerk' AND issuer = ? AND subject = ?",
    ).get(user.issuer, user.subject);
    if (existing) return;
    if (user.externalId) throw new Error("Imported identity requires migration mapping");
    if (!user.email || !user.verifiedAt) throw new Error("Verify your email before creating a workspace");
    const collision = await tx.prepare(
      "SELECT id FROM public.vis_users WHERE lower(email) = lower(?)",
    ).get(user.email);
    if (collision) throw new Error("Existing identity requires migration mapping");
    const id = randomUUID();
    await tx.prepare(
      "INSERT INTO public.vis_users (id, email, email_confirmed_at) VALUES (?, ?, ?) RETURNING id",
    ).run(id, user.email, user.verifiedAt);
    // This table has a composite key, not an id column. Explicit RETURNING
    // prevents the compatibility layer from appending RETURNING id.
    await tx.prepare(
      `INSERT INTO vis_private.identity_map (provider, issuer, subject, user_id)
       VALUES ('clerk', ?, ?, ?) RETURNING user_id`,
    ).run(user.issuer, user.subject, id);
  });
}
