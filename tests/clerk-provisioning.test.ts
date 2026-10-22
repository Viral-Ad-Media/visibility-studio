import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { Db } from "../lib/db";
import { provisionNewClerkUser } from "../lib/clerk-provisioning";

it("provisions composite-key mappings atomically, retries safely, and refuses email/import linking", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(readFileSync("neon/001_visibility_schema.sql", "utf8"));
    const query = async (sql: string, values: unknown[]) => {
      // PGlite has no concurrent clients; advisory locks are unnecessary here.
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 0 };
      const result = await pg.query(sql, values);
      return { rows: result.rows as any[], rowCount: result.affectedRows ?? 0 };
    };
    const db = new Db(query, async fn => {
      await pg.exec("BEGIN");
      try { const result = await fn(query); await pg.exec("COMMIT"); return result; }
      catch (err) { await pg.exec("ROLLBACK"); throw err; }
    });
    const user = { issuer: "https://clerk.example.com", subject: "user_new", externalId: null,
      email: "new@example.invalid", verifiedAt: new Date().toISOString() };
    await provisionNewClerkUser(db, user);
    await provisionNewClerkUser(db, user);
    expect((await pg.query("SELECT * FROM vis_private.identity_map")).rows).toHaveLength(1);
    expect((await pg.query("SELECT * FROM vis_users")).rows).toHaveLength(1);
    await expect(provisionNewClerkUser(db, { ...user, subject: "user_collision" })).rejects.toThrow("migration mapping");
    await expect(provisionNewClerkUser(db, { ...user, subject: "user_imported", externalId: "legacy-id" })).rejects.toThrow("migration mapping");
    await expect(provisionNewClerkUser(db, { ...user, subject: "user_unverified", verifiedAt: null })).rejects.toThrow("Verify your email");
    expect((await pg.query("SELECT * FROM vis_users")).rows).toHaveLength(1);
  } finally { await pg.close(); }
});
