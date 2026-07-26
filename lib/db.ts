import fs from "fs";
import path from "path";
import { cache } from "react";
import { Pool, types } from "pg";
import { supabaseServerClient } from "./supabase-server";

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
 *
 * ## Multi-tenancy: real RLS, not just app-level filtering
 *
 * The default export (`db`) impersonates the current logged-in user on
 * every query: it resolves the request's Supabase session, then runs
 * `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated`
 * inside the same transaction as the actual query, so Postgres RLS policies
 * (`auth.uid()`) genuinely scope every read/write to that user's account —
 * this is what Supabase's own PostgREST does internally, just done by hand
 * here since the app talks to Postgres directly via `pg`, not the Supabase
 * client SDK. `SET LOCAL` (not `SET ROLE`) is deliberate: its scope is
 * exactly one transaction, which is what keeps this safe if `DATABASE_URL`
 * ever moves onto a transaction-mode pooler.
 *
 * `serviceDb` is the escape hatch for contexts with no browser session to
 * impersonate (`scripts/engine.ts`, background jobs) — it runs as the raw,
 * full-privilege connection and bypasses RLS entirely, same as a
 * `service_role` key would. Callers of `serviceDb` are responsible for
 * their own tenant scoping (e.g. `WHERE account_id = ?`) — RLS doesn't
 * apply here by design, not by accident. Never import this into code that
 * serves a browser request.
 */

// `max` is deliberately small: DATABASE_URL currently points at Supabase's
// direct connection (port 5432), not the pgbouncer/Supavisor pooler (6543)
// — the pooler is still unreachable from this machine as of the multi-
// tenant conversion (re-tested, still ENOTFOUND). A direct connection has a
// real, much lower ceiling on total concurrent connections than a pooled
// one, and every impersonated query now holds a client for a whole
// mini-transaction (BEGIN..COMMIT) instead of one bare pool.query() call —
// more reason to keep this conservative. Safe to raise once/if the app is
// pointed back at the pooler.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

type Row = Record<string, any>;
type RunResult = { changes: number; lastInsertRowid: number | undefined };
type QueryResult = { rows: Row[]; rowCount: number | null };
type QueryFn = (text: string, values: unknown[]) => Promise<QueryResult>;
type BeginTx = <T>(fn: (txQuery: QueryFn) => Promise<T>) => Promise<T>;

export class UnauthenticatedDbAccessError extends Error {
  constructor() {
    super("db: no authenticated Supabase session for this request");
    this.name = "UnauthenticatedDbAccessError";
  }
}

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
  constructor(private sql: string, private query: QueryFn) {}

  async get(...args: unknown[]): Promise<Row | undefined> {
    const { text, values } = bindArgs(this.sql, args);
    const res = await this.query(text, values);
    return res.rows[0];
  }

  async all(...args: unknown[]): Promise<Row[]> {
    const { text, values } = bindArgs(this.sql, args);
    const res = await this.query(text, values);
    return res.rows;
  }

  async run(...args: unknown[]): Promise<RunResult> {
    const { text, values } = bindArgs(this.sql, args);
    const { text: finalText } = maybeAddReturningId(text);
    const res = await this.query(finalText, values);
    return { changes: res.rowCount ?? 0, lastInsertRowid: res.rows[0]?.id };
  }
}

export class Db {
  constructor(private query: QueryFn, private beginTx: BeginTx) {}

  prepare(sql: string): Stmt {
    return new Stmt(sql, this.query);
  }

  async exec(sql: string): Promise<void> {
    await this.query(sql, []);
  }

  // Mirrors better-sqlite3's db.transaction(fn) shape closely enough for
  // this app's call sites: pass an async callback that receives a
  // transaction-scoped `db`-like object (same .prepare().get/all/run API,
  // all queries share one connection/transaction/impersonation setup).
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.beginTx(async (txQuery) => {
      const noNestedTx: BeginTx = async () => {
        throw new Error("db: nested transactions are not supported");
      };
      return fn(new Db(txQuery, noNestedTx));
    });
  }
}

// --- Impersonated (default export): every query runs as the current
// logged-in user, RLS-scoped for real. ---

const getRequestUserId = cache(async (): Promise<string> => {
  const { data, error } = await supabaseServerClient().auth.getUser();
  if (error || !data.user) throw new UnauthenticatedDbAccessError();
  return data.user.id;
});

async function setImpersonation(client: { query: (text: string, values?: unknown[]) => Promise<any> }) {
  const userId = await getRequestUserId();
  await client.query(
    "SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)",
    [userId]
  );
  await client.query("SET LOCAL ROLE authenticated");
}

const impersonatedQuery: QueryFn = async (text, values) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setImpersonation(client);
    const res = await client.query(text, values);
    await client.query("COMMIT");
    return res;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

const impersonatedBeginTx: BeginTx = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setImpersonation(client);
    const txQuery: QueryFn = (text, values) => client.query(text, values);
    const result = await fn(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

const db = new Db(impersonatedQuery, impersonatedBeginTx);

export default db;

// --- Service (no impersonation): raw full-privilege connection, for
// contexts with no browser session (background jobs, the local engine CLI).
// Callers own their own tenant scoping. ---

const serviceQuery: QueryFn = (text, values) => pool.query(text, values);

const serviceBeginTx: BeginTx = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txQuery: QueryFn = (text, values) => client.query(text, values);
    const result = await fn(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const serviceDb = new Db(serviceQuery, serviceBeginTx);

// Most tables derive account_id automatically (via a DB trigger, from their
// parent row) so callers never need to think about it. vis_settings has no
// parent row to derive from, so routes that touch it need the current
// user's account_id explicitly — this is RLS-scoped like any other query,
// so it can only ever return the caller's own account.
export async function getCurrentAccountId(): Promise<number> {
  const row = await db.prepare("SELECT account_id FROM vis_account_users LIMIT 1").get();
  if (!row) throw new Error("getCurrentAccountId: no account membership for current user");
  return row.account_id;
}

export * from "./shared";
