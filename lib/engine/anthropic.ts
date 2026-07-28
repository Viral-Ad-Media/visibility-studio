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
