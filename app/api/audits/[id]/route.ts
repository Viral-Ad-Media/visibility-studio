import { z } from "zod";
import {
  apiRoute,
  parseBody,
  parseId,
  auditInput,
  positiveId,
  idList,
} from "@/lib/api";
import { NextResponse } from "next/server";
import db, { Audit, serviceDb } from "@/lib/db";
import { enqueueJob, isInsufficientCredits } from "@/lib/jobs";

// Requeue an audit (e.g. after an error, or to top up businesses). The
// insert below fires a Postgres trigger (pg_net) that POSTs to
// /api/engine/run instantly — no application-side call needed.
async function POSTHandler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  const audit = await db
    .prepare("SELECT id FROM vis_audits WHERE id = ?")
    .get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });

  const open = await db
    .prepare(
      `SELECT id FROM vis_jobs
       WHERE type='run_audit' AND status IN ('pending','running')
         AND (payload::json->>'audit_id')::bigint = ?`,
    )
    .get(id);
  if (open) return NextResponse.json({ ok: true, already_queued: true });

  try {
    await db.transaction(async (tx) => {
      await enqueueJob(tx, "run_audit", id);
    });
  } catch (err) {
    if (isInsufficientCredits(err)) {
      return NextResponse.json(
        {
          error:
            "Your credit balance is $0 — add credits in Billing before re-running this audit.",
        },
        { status: 402 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}

// Edit a queued (or errored) audit before the engine picks it up.
async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  const audit = (await db
    .prepare("SELECT * FROM vis_audits WHERE id = ?")
    .get(id)) as Audit | undefined;
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (audit.status === "running" || audit.status === "queued") {
    return NextResponse.json(
      {
        error:
          "audit is queued or running — wait for the engine to finish first",
      },
      { status: 409 },
    );
  }

  const body = await parseBody(req, auditInput.partial());
  const category = String(body.category ?? audit.category).trim();
  const location = String(body.location ?? audit.location).trim();
  if (!category || !location) {
    return NextResponse.json(
      { error: "category and location are required" },
      { status: 400 },
    );
  }
  const target = Math.min(
    Math.max(Number(body.target_count) || audit.target_count, 1),
    50,
  );
  const notes =
    body.notes === undefined ? audit.notes : body.notes?.trim() || null;

  const updated = await db
    .prepare(
      `UPDATE vis_audits SET
         query=?, category=?, location=?, target_count=?, notes=?, updated_at=now()::text
       WHERE id=? AND status NOT IN ('queued','running')`,
    )
    .run(`${category} in ${location}`, category, location, target, notes, id);
  if (!updated.changes)
    return NextResponse.json(
      { error: "Audit was queued concurrently" },
      { status: 409 },
    );
  return NextResponse.json({ ok: true });
}

// Delete an audit along with its businesses, campaigns, and any of its jobs.
async function DELETEHandler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  // Impersonated read = RLS-backed ownership check. vis_jobs is SELECT-only
  // for clients, so the delete runs on serviceDb, scoped to that account_id.
  const audit = await db
    .prepare("SELECT id, account_id FROM vis_audits WHERE id = ?")
    .get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });
  const accountId = audit.account_id as number;

  await serviceDb.transaction(async (tx) => {
    await tx
      .prepare(
        "DELETE FROM vis_jobs WHERE account_id = ? AND (payload::json->>'audit_id')::bigint = ?",
      )
      .run(accountId, id);
    await tx
      .prepare(
        "DELETE FROM vis_campaign_businesses WHERE account_id = ? AND campaign_id IN (SELECT id FROM vis_campaigns WHERE audit_id = ?)",
      )
      .run(accountId, id);
    await tx
      .prepare(
        "DELETE FROM vis_campaigns WHERE account_id = ? AND audit_id = ?",
      )
      .run(accountId, id);
    await tx
      .prepare(
        "DELETE FROM vis_businesses WHERE account_id = ? AND audit_id = ?",
      )
      .run(accountId, id);
    await tx
      .prepare("DELETE FROM vis_audits WHERE account_id = ? AND id = ?")
      .run(accountId, id);
  });
  return NextResponse.json({ ok: true });
}

export const POST = apiRoute(POSTHandler, true);
export const PATCH = apiRoute(PATCHHandler, true);
export const DELETE = apiRoute(DELETEHandler, true);
