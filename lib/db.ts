import fs from "fs";
import path from "path";
import { Pool, types, type PoolClient } from "pg";

// Next.js auto-loads .env.local for `next dev`/`build`/`start`, but the
// standalone `tsx scripts/engine.ts` CLI has no such magic — load it here,
// once, without overwriting anything a real environment (e.g. Vercel, or
// Next's own loader) already set.
(function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

// pg returns BIGINT/COUNT/SUM results as strings by default (to avoid silent
// precision loss past Number.MAX_SAFE_INTEGER) — none of this app's counts
// get remotely close to that, so parse them as numbers like better-sqlite3
// always did. OID 20 = int8/bigint, the type COUNT(*)/SUM(int) come back as.
types.setTypeParser(20, (val) => parseInt(val, 10));

/**
 * Postgres-backed replacement for the old local better-sqlite3 file. Table
 * names are prefixed `vis_` (this app shares a Supabase project with other
 * unrelated apps — see CLAUDE.md). Schema lives in Supabase migrations, not
 * here; there is no local schema-bootstrap step anymore.
 *
 * This is a thin compatibility layer over `pg` that keeps the same
 * `db.prepare(sql).get/.all/.run(...)` shape the rest of the app already
 * uses (ported from better-sqlite3) — every call site just needed `await`
 * added, not a full query rewrite. It supports the same two parameter
 * styles the app's SQL already uses:
 *   - positional `?` placeholders, args passed positionally: `.get(id)`
 *   - named `@word` placeholders, args passed as one object: `.run({id, name})`
 * (never mixed within one query — the app doesn't do that.)
 *
 * `run()` on an INSERT without an explicit RETURNING clause has one auto
 * behind the scenes: `RETURNING id` is appended so `.lastInsertRowid` keeps
 * working the same way it did with better-sqlite3.
 */

// `max` is deliberately small: DATABASE_URL currently points at Supabase's
// direct connection (port 5432), not the pgbouncer/Supavisor pooler (6543)
// — that pooler wasn't reachable when this was set up (see CLAUDE.md). A
// direct connection has a real, much lower ceiling on total concurrent
// connections than a pooled one, and Vercel can run many function instances
// at once, each with their own Pool — keeping `max` low here bounds how much
// of that ceiling any single instance can claim. Safe to raise once/if the
// app is pointed back at the pooler.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

type Row = Record<string, any>;
type RunResult = { changes: number; lastInsertRowid: number | undefined };

function toPositional(sql: string): { text: string; kind: "named" | "positional" | "none" } {
  if (/@[a-zA-Z_]\w*/.test(sql)) return { text: sql, kind: "named" };
  if (sql.includes("?")) return { text: sql, kind: "positional" };
  return { text: sql, kind: "none" };
}

function compileNamed(sql: string): { text: string; names: string[] } {
  const names: string[] = [];
  const text = sql.replace(/@([a-zA-Z_]\w*)/g, (_m, name) => {
    names.push(name);
    return `$${names.length}`;
  });
  return { text, names };
}

function compilePositional(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function maybeAddReturningId(sql: string): { text: string; addedReturning: boolean } {
  const isInsert = /^\s*insert/i.test(sql);
  const hasReturning = /returning/i.test(sql);
  if (isInsert && !hasReturning) {
    return { text: `${sql.replace(/;\s*$/, "")} RETURNING id`, addedReturning: true };
  }
  return { text: sql, addedReturning: false };
}

function bindArgs(sql: string, args: unknown[]): { text: string; values: unknown[] } {
  const { kind } = toPositional(sql);
  if (kind === "named") {
    const obj = (args[0] ?? {}) as Record<string, unknown>;
    const { text, names } = compileNamed(sql);
    return { text, values: names.map((n) => obj[n]) };
  }
  if (kind === "positional") {
    const values = args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
    return { text: compilePositional(sql), values };
  }
  return { text: sql, values: [] };
}

class Stmt {
  constructor(private sql: string, private runner: Pool | PoolClient) {}

  async get(...args: unknown[]): Promise<Row | undefined> {
    const { text, values } = bindArgs(this.sql, args);
    const res = await this.runner.query(text, values);
    return res.rows[0];
  }

  async all(...args: unknown[]): Promise<Row[]> {
    const { text, values } = bindArgs(this.sql, args);
    const res = await this.runner.query(text, values);
    return res.rows;
  }

  async run(...args: unknown[]): Promise<RunResult> {
    const { text, values } = bindArgs(this.sql, args);
    const { text: finalText } = maybeAddReturningId(text);
    const res = await this.runner.query(finalText, values);
    return { changes: res.rowCount ?? 0, lastInsertRowid: res.rows[0]?.id };
  }
}

class Db {
  constructor(private runner: Pool | PoolClient) {}

  prepare(sql: string): Stmt {
    return new Stmt(sql, this.runner);
  }

  async exec(sql: string): Promise<void> {
    await this.runner.query(sql);
  }

  // Mirrors better-sqlite3's db.transaction(fn) shape closely enough for
  // this app's two call sites: pass an async callback that receives a
  // transaction-scoped `db`-like object (same .prepare().get/all/run API,
  // all queries share one connection/transaction).
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = new Db(client);
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

const db = new Db(pool);

export default db;

export * from "./shared";
