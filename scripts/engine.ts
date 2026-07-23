/**
 * Engine CLI — how Claude Code reads and writes the jobs queue.
 *
 *   npm run engine -- pending                   list pending/running jobs with context (JSON)
 *   npm run engine -- claim <jobId>             mark a job running, print its full context (JSON)
 *   npm run engine -- add-business <auditId> --meta <file.json>
 *                                               upsert one audited business row into an audit
 *   npm run engine -- export-csv <auditId>      print that audit's CSV to stdout (for Drive backup)
 *   npm run engine -- complete <jobId> [--content <file>] [--meta <file.json>]
 *   npm run engine -- fail <jobId> --message "<why>"
 *
 * Talks to Postgres (Supabase) via lib/db.ts — set DATABASE_URL before running.
 *
 * `add-business` meta is one JSON object of business fields (see FIELDS below).
 * Dedupe: normalized website within the audit, falling back to name+location.
 *
 * `complete` semantics by job type:
 *   run_audit           — meta may set {summary_md} on the audit; marks the audit ready.
 *   audit_business       — meta is the business fields (same shape as add-business);
 *                           the row is upserted before the job is closed.
 *   build_redesign        — --content <file.html> is required (the raw mockup HTML, unescaped).
 *                           meta may optionally add {drive_url} once it's backed up to Drive.
 *   create_booking_link  — meta is {booking_link, booking_event_type}.
 *   backup_audit_csv     — meta is {drive_url} (required) once the CSV is uploaded to Drive.
 */
import fs from "fs";
import db from "../lib/db";
import { buildAuditCsv } from "../lib/csv";

const FIELDS = [
  "name",
  "category",
  "location",
  "website",
  "maps_url",
  "phone",
  "email",
  "rating",
  "review_count",
  "source_urls_json",
  "homepage_headline",
  "main_cta",
  "seo_score",
  "conversion_score",
  "trust_score",
  "opportunity_score",
  "priority",
  "visibility_issues",
  "website_improvements",
  "local_seo_opportunities",
  "content_opportunities",
  "outreach_angle",
  "outreach_subject",
  "outreach_email",
  "audit_notes",
] as const;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function out(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

function readMeta(required = false): any {
  const metaPath = arg("--meta");
  if (!metaPath) {
    if (required) {
      console.error("--meta <file.json> is required");
      process.exit(1);
    }
    return {};
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (Array.isArray(meta.source_urls) && !meta.source_urls_json) {
    meta.source_urls_json = JSON.stringify(meta.source_urls);
  }
  return meta;
}

function readContent(required = false): string | null {
  const contentPath = arg("--content");
  if (!contentPath) {
    if (required) {
      console.error("--content <file> is required");
      process.exit(1);
    }
    return null;
  }
  return fs.readFileSync(contentPath, "utf8");
}

function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url || url === "not found") return null;
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

async function upsertBusiness(auditId: number, meta: any) {
  if (!meta.name) {
    console.error("business meta must include at least {name}");
    process.exit(1);
  }
  const rows = (await db
    .prepare("SELECT id, name, location, website FROM vis_businesses WHERE audit_id = ?")
    .all(auditId)) as any[];
  const site = normalizeWebsite(meta.website);
  const existing = rows.find((r) =>
    site
      ? normalizeWebsite(r.website) === site
      : r.name?.toLowerCase() === meta.name.toLowerCase() &&
        (r.location ?? "").toLowerCase() === (meta.location ?? "").toLowerCase()
  );

  const values: Record<string, unknown> = {};
  for (const f of FIELDS) values[f] = meta[f] ?? null;

  if (existing) {
    const sets = FIELDS.map((f) => `${f}=COALESCE(@${f}, ${f})`).join(", ");
    await db
      .prepare(`UPDATE vis_businesses SET ${sets}, updated_at=now()::text WHERE id=@id`)
      .run({ ...values, id: existing.id });
    out({ ok: true, business_id: existing.id, updated: true });
    return existing.id;
  }
  const cols = ["audit_id", ...FIELDS].join(", ");
  const params = ["@audit_id", ...FIELDS.map((f) => `@${f}`)].join(", ");
  const info = await db
    .prepare(`INSERT INTO vis_businesses (${cols}) VALUES (${params})`)
    .run({ ...values, audit_id: auditId });
  out({ ok: true, business_id: info.lastInsertRowid, created: true });
  return info.lastInsertRowid;
}

async function jobContext(job: any) {
  const payload = JSON.parse(job.payload || "{}");
  const ctx: any = { job: { ...job, payload } };
  if (payload.audit_id) {
    ctx.audit = await db.prepare("SELECT * FROM vis_audits WHERE id = ?").get(payload.audit_id);
    ctx.existing_businesses = await db
      .prepare(
        "SELECT id, name, website, priority, crm_status FROM vis_businesses WHERE audit_id = ? ORDER BY id"
      )
      .all(payload.audit_id);
  }
  if (payload.business_id) {
    ctx.business = await db
      .prepare("SELECT * FROM vis_businesses WHERE id = ?")
      .get(payload.business_id);
  }
  if (payload.campaign_business_id) {
    ctx.campaign_business = await db
      .prepare(
        "SELECT id, campaign_id, business_id, stage, redesign_status, booking_status, booking_link, booking_event_type FROM vis_campaign_businesses WHERE id = ?"
      )
      .get(payload.campaign_business_id);
  }
  return ctx;
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === "pending") {
    const jobs = await db
      .prepare("SELECT * FROM vis_jobs WHERE status IN ('pending','running') ORDER BY id")
      .all();
    out(await Promise.all(jobs.map(jobContext)));
  } else if (cmd === "claim") {
    const id = Number(process.argv[3]);
    const job = (await db.prepare("SELECT * FROM vis_jobs WHERE id = ?").get(id)) as any;
    if (!job) {
      console.error(`No job ${id}`);
      process.exit(1);
    }
    await db
      .prepare("UPDATE vis_jobs SET status='running', updated_at=now()::text WHERE id = ?")
      .run(id);
    const payload = JSON.parse(job.payload || "{}");
    if (payload.audit_id && (job.type === "run_audit" || job.type === "audit_business")) {
      await db
        .prepare(
          "UPDATE vis_audits SET status='running', error=NULL, updated_at=now()::text WHERE id = ?"
        )
        .run(payload.audit_id);
    }
    if (payload.campaign_business_id && job.type === "build_redesign") {
      await db
        .prepare(
          "UPDATE vis_campaign_businesses SET redesign_status='running', redesign_error=NULL, updated_at=now()::text WHERE id = ?"
        )
        .run(payload.campaign_business_id);
    }
    if (payload.campaign_business_id && job.type === "create_booking_link") {
      await db
        .prepare(
          "UPDATE vis_campaign_businesses SET booking_status='running', booking_error=NULL, updated_at=now()::text WHERE id = ?"
        )
        .run(payload.campaign_business_id);
    }
    out(await jobContext({ ...job, status: "running" }));
  } else if (cmd === "add-business") {
    const auditId = Number(process.argv[3]);
    const audit = await db.prepare("SELECT id FROM vis_audits WHERE id = ?").get(auditId);
    if (!audit) {
      console.error(`No audit ${auditId}`);
      process.exit(1);
    }
    await upsertBusiness(auditId, readMeta(true));
  } else if (cmd === "export-csv") {
    const auditId = Number(process.argv[3]);
    const result = await buildAuditCsv(auditId);
    if (!result) {
      console.error(`No audit ${auditId}`);
      process.exit(1);
    }
    process.stdout.write(result.csv);
  } else if (cmd === "complete") {
    const id = Number(process.argv[3]);
    const job = (await db.prepare("SELECT * FROM vis_jobs WHERE id = ?").get(id)) as any;
    if (!job) {
      console.error(`No job ${id}`);
      process.exit(1);
    }
    const payload = JSON.parse(job.payload || "{}");
    const meta = readMeta(
      job.type === "audit_business" ||
        job.type === "create_booking_link" ||
        job.type === "backup_audit_csv"
    );

    if (job.type === "run_audit") {
      await db
        .prepare(
          `UPDATE vis_audits SET
             status='ready', error=NULL,
             summary_md=COALESCE(@summary_md, summary_md),
             updated_at=now()::text
           WHERE id=@id`
        )
        .run({ id: payload.audit_id, summary_md: meta.summary_md ?? null });
    } else if (job.type === "audit_business") {
      await upsertBusiness(payload.audit_id, meta);
    } else if (job.type === "build_redesign") {
      const html = readContent(true);
      await db
        .prepare(
          `UPDATE vis_campaign_businesses SET
             redesign_status='ready', redesign_error=NULL, redesign_html=@html,
             redesign_drive_url=COALESCE(@drive_url, redesign_drive_url),
             updated_at=now()::text
           WHERE id=@id`
        )
        .run({ id: payload.campaign_business_id, html, drive_url: meta.drive_url ?? null });
    } else if (job.type === "backup_audit_csv") {
      if (!meta.drive_url) {
        console.error("--meta with at least {drive_url} is required for backup_audit_csv jobs");
        process.exit(1);
      }
      await db
        .prepare(
          `UPDATE vis_audits SET
             csv_drive_url=@drive_url, csv_drive_backed_up_at=now()::text,
             updated_at=now()::text
           WHERE id=@id`
        )
        .run({ id: payload.audit_id, drive_url: meta.drive_url });
    } else if (job.type === "create_booking_link") {
      if (!meta.booking_link) {
        console.error(
          "--meta with at least {booking_link} is required for create_booking_link jobs"
        );
        process.exit(1);
      }
      await db
        .prepare(
          `UPDATE vis_campaign_businesses SET
             booking_status='ready', booking_error=NULL,
             booking_link=@booking_link, booking_event_type=COALESCE(@booking_event_type, booking_event_type),
             updated_at=now()::text
           WHERE id=@id`
        )
        .run({
          id: payload.campaign_business_id,
          booking_link: meta.booking_link,
          booking_event_type: meta.booking_event_type ?? null,
        });
    }

    await db
      .prepare("UPDATE vis_jobs SET status='done', result=?, updated_at=now()::text WHERE id = ?")
      .run(meta.result ?? "ok", id);
    out({ ok: true, job_id: id });
  } else if (cmd === "fail") {
    const id = Number(process.argv[3]);
    const message = arg("--message") ?? "unknown error";
    const job = (await db.prepare("SELECT * FROM vis_jobs WHERE id = ?").get(id)) as any;
    if (!job) {
      console.error(`No job ${id}`);
      process.exit(1);
    }
    const payload = JSON.parse(job.payload || "{}");
    await db
      .prepare(
        "UPDATE vis_jobs SET status='error', result=?, updated_at=now()::text WHERE id = ?"
      )
      .run(message, id);
    if (payload.audit_id && job.type === "run_audit") {
      await db
        .prepare(
          "UPDATE vis_audits SET status='error', error=?, updated_at=now()::text WHERE id = ?"
        )
        .run(message, payload.audit_id);
    }
    if (payload.campaign_business_id && job.type === "build_redesign") {
      await db
        .prepare(
          "UPDATE vis_campaign_businesses SET redesign_status='error', redesign_error=?, updated_at=now()::text WHERE id = ?"
        )
        .run(message, payload.campaign_business_id);
    }
    if (payload.campaign_business_id && job.type === "create_booking_link") {
      await db
        .prepare(
          "UPDATE vis_campaign_businesses SET booking_status='error', booking_error=?, updated_at=now()::text WHERE id = ?"
        )
        .run(message, payload.campaign_business_id);
    }
    out({ ok: true, job_id: id, failed: true });
  } else {
    console.error("Usage: npm run engine -- <pending|claim|add-business|complete|fail> [args]");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
