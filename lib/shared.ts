// Types and constants shared with client components — must stay free of Node/DB imports.

export type Audit = {
  id: number;
  query: string;
  category: string;
  location: string;
  target_count: number;
  notes: string | null;
  status: "queued" | "running" | "ready" | "error";
  summary_md: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: number;
  audit_id: number;
  name: string;
  category: string | null;
  location: string | null;
  website: string | null;
  maps_url: string | null;
  phone: string | null;
  email: string | null;
  rating: string | null;
  review_count: string | null;
  source_urls_json: string | null;
  homepage_headline: string | null;
  main_cta: string | null;
  seo_score: number | null;
  conversion_score: number | null;
  trust_score: number | null;
  opportunity_score: number | null;
  priority: "High" | "Medium" | "Low" | null;
  visibility_issues: string | null;
  website_improvements: string | null;
  local_seo_opportunities: string | null;
  content_opportunities: string | null;
  outreach_angle: string | null;
  outreach_subject: string | null;
  outreach_email: string | null;
  audit_notes: string | null;
  crm_status: string;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: number;
  type: "run_audit" | "audit_business" | "build_redesign" | "create_booking_link";
  payload: string;
  status: "pending" | "running" | "done" | "error";
  result: string | null;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: number;
  audit_id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

// redesign_html is intentionally omitted here — never select it in list/aggregate
// queries, only in the dedicated .../redesign route (it can be tens of KB of HTML).
export type CampaignBusiness = {
  id: number;
  campaign_id: number;
  business_id: number;
  stage: string;
  redesign_status: "pending" | "running" | "ready" | "error";
  redesign_error: string | null;
  booking_status: "pending" | "running" | "ready" | "error";
  booking_link: string | null;
  booking_event_type: string | null;
  booking_error: string | null;
  created_at: string;
  updated_at: string;
};

// Joined shape for the campaign detail page — campaign_businesses row plus the
// business fields needed to render/copy the outreach draft. Deliberately omits
// redesign_html (see the /redesign route for that).
export type CampaignBusinessRow = CampaignBusiness & {
  name: string;
  category: string | null;
  location: string | null;
  website: string | null;
  maps_url: string | null;
  phone: string | null;
  email: string | null;
  priority: "High" | "Medium" | "Low" | null;
  outreach_subject: string | null;
  outreach_email: string | null;
};

export const CRM_STATUSES = [
  "New",
  "Contacted",
  "Replied",
  "Won",
  "Not Fit",
  "Follow Up",
] as const;

export const CAMPAIGN_STAGES = [
  "Selected",
  "Ready to Send",
  "Sent",
  "Replied",
  "Booked",
  "Won",
  "Lost",
] as const;

export const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export type Account = {
  id: number;
  name: string;
  access_granted: boolean;
  trial_ends_at: string | null;
};

export function hasAppAccess(
  account: Pick<Account, "access_granted" | "trial_ends_at"> | null | undefined
): boolean {
  if (!account) return false;
  if (account.access_granted) return true;
  return !!account.trial_ends_at && new Date(account.trial_ends_at) > new Date();
}
