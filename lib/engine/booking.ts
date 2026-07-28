import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, ENGINE_MODEL } from "./anthropic";
import { serviceDb as db } from "../db";
import { listEventTypes, createSingleUseSchedulingLink, type CalendlyEventType } from "./calendly";

// Ported from .claude/skills/run-campaigns/SKILL.md's event-type selectivity
// rule: don't just grab the first active event type — a real account can
// have event types built for a completely different funnel (e.g. an
// investment-qualifying coaching call), which would be actively wrong to
// hand to a cold local-business prospect.
async function pickEventType(eventTypes: CalendlyEventType[]): Promise<CalendlyEventType | null> {
  if (eventTypes.length === 0) return null;
  if (eventTypes.length === 1) return eventTypes[0];

  const anthropic = getAnthropic();
  const listing = eventTypes
    .map((et, i) => `${i}. "${et.name}" (${et.duration}min) — ${et.description_plain ?? "no description"}`)
    .join("\n");
  const response = await anthropic.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 64,
    system: `You are picking which Calendly event type to use for a cold-outreach discovery call
with a local-business prospect. Prefer a short (15-30 min), simple, generic event type with no
more than a name/email/phone-style custom question. Reject event types built for a different
funnel entirely (e.g. investment-qualifying calls, coaching/mastermind screening, internal team
meetings). Respond with ONLY the number of the best match, or the word "none" if nothing in the
list is suitable for a generic prospect discovery call.`,
    messages: [{ role: "user", content: listing }],
  });
  const text = response.content
    .find((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    ?.text?.trim()
    .toLowerCase();
  if (!text || text === "none") return null;
  const idx = parseInt(text, 10);
  return Number.isInteger(idx) && eventTypes[idx] ? eventTypes[idx] : null;
}

export async function createBookingLink(
  accountId: number
): Promise<{ bookingLink: string; eventTypeName: string }> {
  const setting = (await db
    .prepare("SELECT value FROM vis_settings WHERE account_id = ? AND key = 'calendly_event_type_uri'")
    .get(accountId)) as { value: string } | undefined;

  const eventTypes = await listEventTypes(accountId);

  let eventTypeUri = setting?.value;
  let eventTypeName: string;

  if (eventTypeUri) {
    eventTypeName = eventTypes.find((et) => et.uri === eventTypeUri)?.name ?? "configured event type";
  } else {
    const picked = await pickEventType(eventTypes);
    if (!picked) {
      throw new Error(
        "No suitable Calendly event type found — none of the connected account's event types look like a generic discovery call. Create one and set it in Settings, or set calendly_event_type_uri manually."
      );
    }
    eventTypeUri = picked.uri;
    eventTypeName = picked.name;
  }

  const bookingLink = await createSingleUseSchedulingLink(accountId, eventTypeUri);
  return { bookingLink, eventTypeName };
}
