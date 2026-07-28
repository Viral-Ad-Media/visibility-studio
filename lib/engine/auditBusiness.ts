import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, ENGINE_MODEL, RESEARCH_TOOLS, countSearchCalls } from "./anthropic";
import { serviceDb as db } from "../db";
import { upsertBusiness } from "../business-upsert";

// Ported verbatim (methodology only, CLI mechanics stripped) from
// .claude/skills/run-audits/SKILL.md — this is the same rubric a human-run
// Claude Code session follows, now hosted as a system prompt instead.
const SYSTEM_PROMPT = `You are auditing one business's website and online visibility on behalf of an
outreach/marketing agency, using live web research.

**Evidence standards — never fabricate.** Never invent emails, phone numbers, ratings, review
counts, rankings, or site facts. If a field can't be verified, omit it or write "not found"
(for email) and note the attempt in audit_notes. Record only publicly visible emails, in this
priority order: contact/about/team/footer pages, then homepage scan, then web search
("[name]" "[city]" email), then directory listings. Prefer contact/info/hello@ addresses over
personal ones. Never guess or construct an address; never take one from behind a login wall,
CAPTCHA, or paid tool. Cite every URL you actually used.

**Website audit** — check only visible signals: title/headline clarity; local SEO (city/service
terms, service+location pages, schema clues, Google Business Profile consistency); conversion
elements (CTAs, phone buttons, forms, booking); credibility (reviews, certifications, team/about);
UX (mobile, navigation, popups, broken pages); technical basics (HTTPS, headings, meta
description, thin pages).

**Scoring** — integers 1-5 for seo_score, conversion_score, trust_score, opportunity_score.
Priority: High = meaningful revenue potential + obvious gaps; Medium = moderate impact or fit;
Low = already strong, or the available data is too thin to say much.

**Recommendations** — specific and practical ("create a [service] + [city] page", "add a sticky
call button on mobile"), never generic. No guarantees of ranking or revenue outcomes — frame as
likely improvements.

**Outreach** (only for High and Medium priority): subject under 9 words, specific to the observed
gap. Body 4-6 short paragraphs: hook, specific problem, value, soft call-to-action, sign-off. Must
reference a concrete finding — never a generic "I noticed your website could be improved." No
promises of rankings, revenue, or guaranteed results. For regulated industries (healthcare, legal,
finance), use compliant, outcome-free language. If you found a real contact email, address the
email to that contact; otherwise use a "[Contact Name]" placeholder.

Research using web_search and web_fetch until you have enough evidence to score the business and,
if High/Medium priority, draft outreach. Then stop researching — you will be asked to submit your
findings via a tool call in a follow-up turn.`;

const SUBMIT_BUSINESS_TOOL: Anthropic.Messages.Tool = {
  name: "submit_business",
  description:
    "Submit the final audit findings for this business. Call this exactly once, after research is complete. Omit any field you couldn't verify rather than guessing.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Business name" },
      category: { type: "string" },
      location: { type: "string" },
      website: { type: "string", description: "Official website URL, or omit if none found" },
      maps_url: { type: "string" },
      phone: { type: "string" },
      email: { type: "string", description: 'A publicly visible email, or the literal string "not found"' },
      rating: { type: "string" },
      review_count: { type: "string" },
      source_urls: {
        type: "array",
        items: { type: "string" },
        description: "Every URL actually used as evidence — required, never empty",
      },
      homepage_headline: { type: "string" },
      main_cta: { type: "string", description: "e.g. call | book | quote form | none visible" },
      seo_score: { type: "integer", description: "1-5" },
      conversion_score: { type: "integer", description: "1-5" },
      trust_score: { type: "integer", description: "1-5" },
      opportunity_score: { type: "integer", description: "1-5" },
      priority: { type: "string", enum: ["High", "Medium", "Low"] },
      visibility_issues: { type: "string" },
      website_improvements: { type: "string" },
      local_seo_opportunities: { type: "string" },
      content_opportunities: { type: "string" },
      outreach_angle: { type: "string" },
      outreach_subject: { type: "string" },
      outreach_email: { type: "string" },
      audit_notes: { type: "string", description: "Caveats, blocked pages, assumptions" },
    },
    required: ["name", "source_urls"],
    additionalProperties: false,
  },
  strict: true,
};

const BusinessSubmission = z.object({
  name: z.string(),
  category: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  maps_url: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  rating: z.string().optional(),
  review_count: z.string().optional(),
  source_urls: z.array(z.string()).min(1),
  homepage_headline: z.string().optional(),
  main_cta: z.string().optional(),
  seo_score: z.number().int().min(1).max(5).optional(),
  conversion_score: z.number().int().min(1).max(5).optional(),
  trust_score: z.number().int().min(1).max(5).optional(),
  opportunity_score: z.number().int().min(1).max(5).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  visibility_issues: z.string().optional(),
  website_improvements: z.string().optional(),
  local_seo_opportunities: z.string().optional(),
  content_opportunities: z.string().optional(),
  outreach_angle: z.string().optional(),
  outreach_subject: z.string().optional(),
  outreach_email: z.string().optional(),
  audit_notes: z.string().optional(),
});

export type AuditBusinessPayload = {
  audit_id: number;
  name: string;
  website?: string | null;
};

export async function runAuditBusiness(
  payload: AuditBusinessPayload
): Promise<{ businessId: number; created: boolean; searchCallCount: number }> {
  const audit = (await db
    .prepare("SELECT category, location FROM vis_audits WHERE id = ?")
    .get(payload.audit_id)) as { category: string; location: string } | undefined;
  if (!audit) throw new Error(`audit ${payload.audit_id} not found`);

  const anthropic = getAnthropic();

  const userIntro = [
    `Business: ${payload.name}`,
    `Category: ${audit.category}`,
    `Location: ${audit.location}`,
    payload.website ? `Known website: ${payload.website}` : `Website: unknown — find the official site first.`,
    "",
    "Research this business now.",
  ].join("\n");

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: userIntro }];

  const researchResponse = await anthropic.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: RESEARCH_TOOLS,
    messages,
  });
  const searchCallCount = countSearchCalls(researchResponse.content);

  messages.push({ role: "assistant", content: researchResponse.content });
  messages.push({
    role: "user",
    content:
      "Submit your findings now via the submit_business tool. Only include fields you can support with the evidence you gathered; omit or use \"not found\" for anything unverifiable.",
  });

  const submitResponse = await anthropic.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [...RESEARCH_TOOLS, SUBMIT_BUSINESS_TOOL],
    tool_choice: { type: "tool", name: "submit_business" },
    messages,
  });

  const toolUse = submitResponse.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "submit_business"
  );
  if (!toolUse) {
    throw new Error(`Claude did not call submit_business (stop_reason: ${submitResponse.stop_reason})`);
  }

  const parsed = BusinessSubmission.parse(toolUse.input);
  const { source_urls, ...rest } = parsed;
  const meta: Record<string, unknown> = { ...rest };
  if (source_urls) meta.source_urls_json = JSON.stringify(source_urls);
  if (!meta.location) meta.location = audit.location;
  if (!meta.category) meta.category = audit.category;

  const { id, created } = await upsertBusiness(payload.audit_id, meta, db);

  return { businessId: id, created, searchCallCount };
}
