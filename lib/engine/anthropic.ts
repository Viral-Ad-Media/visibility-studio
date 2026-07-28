import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const ENGINE_MODEL = "claude-sonnet-5";

export const RESEARCH_TOOLS: Anthropic.Messages.ToolUnion[] = [
  { type: "web_search_20260318", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20260318", name: "web_fetch", max_uses: 8 },
];

export function countSearchCalls(content: Anthropic.Messages.ContentBlock[]): number {
  return content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
}

// Introductory Sonnet 5 pricing, per million tokens, in effect through
// 2026-08-31 — revisit after that date. Cache writes carry the standard
// ~25% premium over base input; cache reads are billed at ~10% of base
// input. https://docs.anthropic.com/en/docs/about-claude/pricing
const PRICE_PER_MTOK_USD = {
  input: 2.0,
  output: 10.0,
  cacheWrite: 2.5,
  cacheRead: 0.2,
};

// web_search is billed per call ($10/1,000), separate from token cost.
export const SEARCH_CALL_COST_USD = 0.01;

export function estimateCost(usage: Anthropic.Usage): number {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;

  return (
    (inputTokens / 1_000_000) * PRICE_PER_MTOK_USD.input +
    (outputTokens / 1_000_000) * PRICE_PER_MTOK_USD.output +
    (cacheWriteTokens / 1_000_000) * PRICE_PER_MTOK_USD.cacheWrite +
    (cacheReadTokens / 1_000_000) * PRICE_PER_MTOK_USD.cacheRead
  );
}
