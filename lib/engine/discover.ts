import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, ENGINE_MODEL, countSearchCalls } from "./anthropic";
import { serviceDb as db } from "../db";

const DISCOVERY_SYSTEM_PROMPT = `You are finding real local businesses for a visibility audit, using live web
search. Search "[category] in [location]", "best [category] [location]", and "[category] near
[location]"; use maps/local-pack results and directories as secondary sources. Only include real
businesses you found evidence for — never invent one. Prioritize businesses with an active
website; include a weak/no-website business only when it's still a useful audit target. Skip any
business already listed as already covered. When you have enough candidates, submit the list via
submit_candidates — do not keep searching past that.`;

const DISCOVERY_TOOLS: Anthropic.Messages.ToolUnion[] = [
  { type: "web_search_20260318", name: "web_search", max_uses: 10 },
];

const SUBMIT_CANDIDATES_TOOL: Anthropic.Messages.Tool = {
  name: "submit_candidates",
  description: "Submit the final list of discovered business candidates for this audit.",
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            website: { type: "string", description: "Official website URL, if found" },
          },
          required: ["name"],
        },
      },
    },
    required: ["candidates"],
  },
};

const CandidatesSchema = z.object({
  candidates: z.array(z.object({ name: z.string(), website: z.string().optional() })),
});

export type DiscoverResult = {
  candidates: { name: string; website?: string }[];
  searchCallCount: number;
};

// Discovery only — does not audit each business itself. The caller (worker.ts)
// fans out one audit_business job row per candidate; those get drained
// independently (and concurrently, across separate worker invocations).
export async function discoverCandidates(auditId: number): Promise<DiscoverResult> {
  const audit = (await db
    .prepare("SELECT category, location, target_count, notes FROM vis_audits WHERE id = ?")
    .get(auditId)) as
    | { category: string; location: string; target_count: number; notes: string | null }
    | undefined;
  if (!audit) throw new Error(`audit ${auditId} not found`);

  const existing = (await db
    .prepare("SELECT name FROM vis_businesses WHERE audit_id = ?")
    .all(auditId)) as { name: string }[];

  const anthropic = getAnthropic();

  const userIntro = [
    `Find up to ${audit.target_count} real businesses matching: ${audit.category} in ${audit.location}.`,
    audit.notes ? `Notes: ${audit.notes}` : "",
    existing.length ? `Already covered — skip these: ${existing.map((b) => b.name).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: userIntro }];

  const discoverResponse = await anthropic.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 4096,
    system: DISCOVERY_SYSTEM_PROMPT,
    tools: DISCOVERY_TOOLS,
    messages,
  });
  const searchCallCount = countSearchCalls(discoverResponse.content);

  messages.push({ role: "assistant", content: discoverResponse.content });
  messages.push({ role: "user", content: "Submit your candidate list now via submit_candidates." });

  const submitResponse = await anthropic.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 2048,
    system: DISCOVERY_SYSTEM_PROMPT,
    tools: [...DISCOVERY_TOOLS, SUBMIT_CANDIDATES_TOOL],
    tool_choice: { type: "tool", name: "submit_candidates" },
    messages,
  });

  const toolUse = submitResponse.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "submit_candidates"
  );
  if (!toolUse) {
    throw new Error(`Claude did not call submit_candidates (stop_reason: ${submitResponse.stop_reason})`);
  }

  const { candidates } = CandidatesSchema.parse(toolUse.input);
  return { candidates: candidates.slice(0, audit.target_count), searchCallCount };
}
