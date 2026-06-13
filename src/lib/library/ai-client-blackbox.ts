/**
 * Library Canon Foundry — Blackbox API client wrapper.
 *
 * Reusable client for JSON + text inference via Blackbox.
 * Default model is `blackbox-pro`.
 */

type BlackboxResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function getBlackboxApiConfig(): {
  apiKey: string;
  baseUrl: string;
} {
  const apiKey = process.env.BLACKBOX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BLACKBOX_API_KEY is not set. Add it to .env.local to use Blackbox processing."
    );
  }

  const baseUrl = (process.env.BLACKBOX_API_BASE_URL ?? "https://api.blackbox.ai/v1")
    .trim()
    .replace(/\/+$/, "");

  return { apiKey, baseUrl };
}

export async function callBlackbox(
  systemPrompt: string,
  userPrompt: string,
  modelId = process.env.BLACKBOX_MODEL ?? "blackbox-pro"
): Promise<string> {
  const { apiKey, baseUrl } = getBlackboxApiConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Blackbox request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as BlackboxResponse;
  return data.choices?.[0]?.message?.content ?? "";
}

export async function callBlackboxJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  modelId?: string
): Promise<T> {
  const raw = await callBlackbox(systemPrompt, userPrompt, modelId);

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Blackbox returned non-JSON output:\n${cleaned.slice(0, 500)}`);
  }
}
