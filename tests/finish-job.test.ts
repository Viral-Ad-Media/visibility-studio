import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { Db } from "../lib/db";
import { finishJob } from "../lib/engine/finish-job";
import { csvCell } from "../lib/csv-cell";

let pg: PGlite;
let db: Db;
const job = { id: 1, account_id: 7, attempts: 1, type: "run_audit" };
beforeEach(async () => {
  pg = new PGlite();
  const wrap = (conn: Pick<PGlite, "query">): Db =>
    new Db(
      async (sql, args) => {
        const res = await conn.query<Record<string, any>>(sql, args);
        return {
          rows: res.rows,
          rowCount: res.affectedRows ?? res.rows.length,
        };
      },
      async (fn) =>
        pg.transaction(async (tx) => {
          const query = async (sql: string, args: unknown[]) => {
            const r = await tx.query<Record<string, any>>(sql, args);
            return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
          };
          return fn(query);
        }),
    );
  db = wrap(pg);
  await pg.exec(`CREATE TABLE vis_jobs (id serial primary key, account_id int, attempts int, type text, status text, result text, reserved_usd numeric default 1, updated_at text);
    CREATE TABLE vis_credits_ledger (id serial primary key,account_id int,delta_usd numeric,reason text);
    CREATE TABLE artifacts (id serial primary key, value text);
    INSERT INTO vis_jobs VALUES (1,7,1,'run_audit','running',null,1,null);`);
});
afterEach(async () => {
  await pg.close();
});

describe("atomic completion", () => {
  it("commits artifacts, debit and completion once on replay", async () => {
    const write = async (tx: Db) => {
      await tx.prepare("INSERT INTO artifacts (value) VALUES (?)").run("child");
    };
    expect(await finishJob(db, job, { estimated_cost_usd: 0.25 }, write)).toBe(
      true,
    );
    expect(await finishJob(db, job, { estimated_cost_usd: 0.25 }, write)).toBe(
      false,
    );
    expect((await pg.query("SELECT * FROM artifacts")).rows).toHaveLength(1);
    expect(
      (await pg.query("SELECT * FROM vis_credits_ledger")).rows,
    ).toHaveLength(1);
    expect(
      (await pg.query("SELECT status, reserved_usd FROM vis_jobs")).rows[0],
    ).toEqual({ status: "done", reserved_usd: "0" });
  });
  it("rolls back all writes if child/artifact creation fails", async () => {
    await expect(
      finishJob(db, job, { estimated_cost_usd: 0.25 }, async (tx) => {
        await tx
          .prepare("INSERT INTO artifacts (value) VALUES (?)")
          .run("child");
        throw new Error("failed fanout");
      }),
    ).rejects.toThrow("failed fanout");
    expect((await pg.query("SELECT * FROM artifacts")).rows).toHaveLength(0);
    expect(
      (await pg.query("SELECT * FROM vis_credits_ledger")).rows,
    ).toHaveLength(0);
    expect((await pg.query("SELECT status FROM vis_jobs")).rows[0]).toEqual({
      status: "running",
    });
  });
  it("fences a stale attempt before any artifact or debit", async () => {
    await pg.exec("UPDATE vis_jobs SET attempts=2");
    expect(
      await finishJob(db, job, { estimated_cost_usd: 0.25 }, async (tx) => {
        await tx
          .prepare("INSERT INTO artifacts (value) VALUES (?)")
          .run("stale");
      }),
    ).toBe(false);
    expect((await pg.query("SELECT * FROM artifacts")).rows).toHaveLength(0);
  });
  it("charges discovery with no candidates, and validates costs", async () => {
    await finishJob(db, job, { candidates: 0, estimated_cost_usd: 0.04 });
    expect(
      (await pg.query("SELECT delta_usd FROM vis_credits_ledger")).rows[0],
    ).toEqual({ delta_usd: "-0.04" });
    await expect(
      finishJob(db, job, { estimated_cost_usd: NaN }),
    ).rejects.toThrow("Invalid usage cost");
  });
});

it("escapes CSV formulas, multiline values, delimiters and quotes", () => {
  expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
  expect(csvCell(" \t+1")).toBe("' \t+1");
  expect(csvCell('hello,"world"\n')).toBe('"hello,""world""\n"');
  expect(csvCell("ordinary")).toBe("ordinary");
});

it("merges newly discovered websites into an existing name/location row", async () => {
  const { BUSINESS_FIELDS, upsertBusiness } =
    await import("../lib/business-upsert");
  await pg.exec(`CREATE TABLE vis_audits(id int primary key); INSERT INTO vis_audits VALUES(70);
    CREATE TABLE vis_businesses(id serial primary key,audit_id int,updated_at text,${BUSINESS_FIELDS.map((f) => `${f} text`).join(",")});`);
  const first = await upsertBusiness(
    70,
    { name: "Acme", location: "Austin" },
    db,
  );
  const second = await upsertBusiness(
    70,
    { name: "ACME", location: "Austin", website: "https://www.acme.com/" },
    db,
  );
  expect(second).toEqual({ id: first.id, created: false });
  const third = await upsertBusiness(
    70,
    { name: "Acme LLC", location: "Austin", website: "http://acme.com" },
    db,
  );
  expect(third.id).toBe(first.id);
  expect((await pg.query("SELECT * FROM vis_businesses")).rows).toHaveLength(1);
});
