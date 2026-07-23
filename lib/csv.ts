import db from "./db";
import type { Audit, Business } from "./shared";
import { PRIORITY_ORDER } from "./shared";

// Column order matches the business-visibility-auditor Google Sheets schema exactly,
// so the file imports cleanly into an existing master sheet.
export const CSV_HEADERS = [
  "Audit Date",
  "Search Query",
  "Business Name",
  "Category",
  "Location",
  "Website URL",
  "Google Maps URL",
  "Phone",
  "Email",
  "Rating",
  "Review Count",
  "Source URLs",
  "Homepage Headline",
  "Main CTA",
  "SEO Visibility Score",
  "Website Conversion Score",
  "Local Trust Score",
  "Opportunity Score",
  "Priority Level",
  "Current Visibility Issues",
  "Website Improvement Options",
  "Local SEO Opportunities",
  "Content Opportunities",
  "Recommended Outreach Angle",
  "Outreach Email",
  "Notes",
  "Status",
];

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Shared by app/api/audits/[id]/csv/route.ts (browser download) and
// scripts/engine.ts (Drive backup) so the schema only lives in one place.
export function buildAuditCsv(auditId: number): { csv: string; audit: Audit } | null {
  const audit = db.prepare("SELECT * FROM audits WHERE id = ?").get(auditId) as
    | Audit
    | undefined;
  if (!audit) return null;

  const businesses = db
    .prepare("SELECT * FROM businesses WHERE audit_id = ? ORDER BY id")
    .all(auditId) as Business[];
  businesses.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority ?? ""] ?? 3) - (PRIORITY_ORDER[b.priority ?? ""] ?? 3) ||
      (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0)
  );

  const rows = businesses.map((b) => {
    let sources = "";
    try {
      const parsed = JSON.parse(b.source_urls_json ?? "[]");
      sources = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
    } catch {
      sources = b.source_urls_json ?? "";
    }
    return [
      audit.created_at.slice(0, 10),
      audit.query,
      b.name,
      b.category ?? audit.category,
      b.location ?? audit.location,
      b.website,
      b.maps_url,
      b.phone,
      b.email,
      b.rating,
      b.review_count,
      sources,
      b.homepage_headline,
      b.main_cta,
      b.seo_score,
      b.conversion_score,
      b.trust_score,
      b.opportunity_score,
      b.priority,
      b.visibility_issues,
      b.website_improvements,
      b.local_seo_opportunities,
      b.content_opportunities,
      b.outreach_angle,
      b.outreach_email,
      b.audit_notes,
      b.crm_status,
    ]
      .map(cell)
      .join(",");
  });

  return { csv: [CSV_HEADERS.join(","), ...rows].join("\n"), audit };
}

export function auditCsvFilename(audit: Audit): string {
  const date = audit.created_at.slice(0, 10);
  const slug = `Business Visibility Audit - ${audit.category} - ${audit.location} - ${date}`;
  return `${slug.replace(/[^\w\- .]/g, "")}.csv`;
}
