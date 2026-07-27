import defaultDb, { type Db } from "./db";

// Shared by scripts/engine.ts (CLI context, pass `serviceDb` explicitly) and
// trigger/auditBusiness.ts (background task, also `serviceDb`) so the field
// list and dedupe logic only live in one place.
export const BUSINESS_FIELDS = [
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

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url || url === "not found") return null;
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export async function upsertBusiness(
  auditId: number,
  meta: Record<string, unknown>,
  database: Db = defaultDb
): Promise<{ id: number; created: boolean }> {
  if (!meta.name) {
    throw new Error("business meta must include at least {name}");
  }
  const rows = (await database
    .prepare("SELECT id, name, location, website FROM vis_businesses WHERE audit_id = ?")
    .all(auditId)) as any[];
  const site = normalizeWebsite(meta.website as string | undefined);
  const existing = rows.find((r) =>
    site
      ? normalizeWebsite(r.website) === site
      : r.name?.toLowerCase() === (meta.name as string).toLowerCase() &&
        (r.location ?? "").toLowerCase() === ((meta.location as string) ?? "").toLowerCase()
  );

  const values: Record<string, unknown> = {};
  for (const f of BUSINESS_FIELDS) values[f] = meta[f] ?? null;

  if (existing) {
    const sets = BUSINESS_FIELDS.map((f) => `${f}=COALESCE(@${f}, ${f})`).join(", ");
    await database
      .prepare(`UPDATE vis_businesses SET ${sets}, updated_at=now()::text WHERE id=@id`)
      .run({ ...values, id: existing.id });
    return { id: existing.id, created: false };
  }
  const cols = ["audit_id", ...BUSINESS_FIELDS].join(", ");
  const params = ["@audit_id", ...BUSINESS_FIELDS.map((f) => `@${f}`)].join(", ");
  const info = await database
    .prepare(`INSERT INTO vis_businesses (${cols}) VALUES (${params})`)
    .run({ ...values, audit_id: auditId });
  return { id: info.lastInsertRowid as number, created: true };
}
