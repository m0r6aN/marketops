/**
 * Library Canon Foundry — Anthropic SDK wrapper.
 *
 * Single place for all LLM calls.  Enforces JSON output parsing and
 * provides clear error messages when the API key is missing.
 */
import Anthropic from "@anthropic-ai/sdk";

// Lazy-init so the missing key error surfaces at call time, not import time.
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set.  Add it to .env.local to use Library processing."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls claude-sonnet-4-6 and returns the assistant text response.
 * The caller is responsible for parsing JSON from the response.
 */
export async function callSonnet(
  systemPrompt: string,
  userPrompt: string,
  modelId = "claude-sonnet-4-6"
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response content type from Claude API");
  }

  return block.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-safe wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls Claude and parses the response as JSON.
 * Strips markdown code fences if Claude wraps the output.
 */
export async function callSonnetJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  modelId?: string
): Promise<T> {
  const raw = await callSonnet(systemPrompt, userPrompt, modelId);

  // Strip ```json ... ``` or ``` ... ``` wrappers if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `Claude returned non-JSON output:\n${cleaned.slice(0, 500)}`
    );
  }
}
