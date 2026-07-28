import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, ENGINE_MODEL, estimateCost } from "./anthropic";
import { serviceDb as db } from "../db";
import type { Business } from "../shared";

// Ported verbatim (rules only, mechanics stripped) from
// .claude/skills/run-campaigns/SKILL.md's "Redesign mockups" section.
const SYSTEM_PROMPT = `You are creating a homepage redesign concept mockup for a local business, based on
a visibility audit already performed on their current site.

Ground every change in the business's own audit findings given below — visibility_issues,
website_improvements, homepage_headline, main_cta. This is a concept pitch, not a generic
template: if "no address/phone visible" was a finding, the mockup shows them prominently; if "no
clear CTA" was a finding, the mockup has an obvious one; if the finding was a broken/thin
homepage, the mockup demonstrates what a real one looks like for that category of business.

Hard rules:
- Write original copy — never lift the business's real photos or body text verbatim. Use clean
  CSS/typography-driven design instead of fabricated stock photography; the real business name,
  category, and phone are fine to use since they're factual and already public.
- Never invent customer testimonials or review quotes. If social proof is called for, use a
  generic pattern ("see our reviews on Google") rather than a fake named quote — a fabricated
  testimonial is a trust-destroying detail if the prospect ever notices.
- Include a small, unobtrusive footer line making clear this is a concept, not the live site —
  e.g. "Concept mockup — not [Business Name]'s live site."
- Design for the business's actual category — a barbershop and a roofing company should not look
  the same. Pick a palette and type pairing grounded in that category; no lorem ipsum, no generic
  stock-template look.
- Output a single self-contained HTML file: inline <style>, no external assets or CDN links,
  a complete <!DOCTYPE html><html><head> (with a <title>)<body> structure. It is served raw with
  no surrounding app chrome, so it must be a complete page on its own.

Respond with ONLY the raw HTML — no commentary, no markdown code fences, nothing before
<!DOCTYPE and nothing after the closing </html> tag.`;

export async function generateRedesign(
  campaignBusinessId: number
): Promise<{ html: string; estimatedCostUsd: number }> {
  const business = (await db
    .prepare(
      `SELECT b.* FROM vis_businesses b
       JOIN vis_campaign_businesses cb ON cb.business_id = b.id
       WHERE cb.id = ?`
    )
    .get(campaignBusinessId)) as Business | undefined;
  if (!business) throw new Error(`campaign business ${campaignBusinessId} has no matching business row`);

  const anthropic = getAnthropic();
  const userPrompt = [
    `Business: ${business.name}`,
    `Category: ${business.category ?? "unknown"}`,
    `Location: ${business.location ?? "unknown"}`,
    `Phone: ${business.phone ?? "not available"}`,
    `Homepage headline: ${business.homepage_headline ?? "none found"}`,
    `Main CTA: ${business.main_cta ?? "none found"}`,
    `Visibility issues: ${business.visibility_issues ?? "none recorded"}`,
    `Website improvements: ${business.website_improvements ?? "none recorded"}`,
    "",
    "Create the redesign concept mockup now.",
  ].join("\n");

  const response = await anthropic.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .find((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    ?.text?.trim();
  if (!text) throw new Error("Claude did not return any text content for the redesign");
  if (!/^<!doctype html/i.test(text) && !/^<html/i.test(text)) {
    throw new Error("Redesign output doesn't look like a complete HTML document");
  }

  return { html: text, estimatedCostUsd: estimateCost(response.usage) };
}
