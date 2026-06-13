/**
 * Library Canon Foundry — Ollama client for local LLM inference.
 */
export async function callOllama(
  systemPrompt: string,
  userPrompt: string,
  modelId = process.env.OLLAMA_MODEL ?? "llama3.2",
  baseUrl = process.env.OLLAMA_HOST ?? "http://localhost:11434",
  numCtx?: number,
  format?: "json"
): Promise<string> {
  const ollamaBaseUrl = normalizeOllamaBaseUrl(baseUrl);
  const envCtx = process.env.OLLAMA_NUM_CTX;
  const parsedEnv = envCtx ? parseInt(envCtx, 10) : NaN;
  const resolvedNumCtx = numCtx ?? (Number.isNaN(parsedEnv) ? undefined : parsedEnv) ?? 8192;
  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      ...(format ? { format } : {}),
      options: {
        num_ctx: resolvedNumCtx,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.message?.content ?? "";
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/+$/, "");
  if (!trimmed) {
    return "http://localhost:11434";
  }

  const withProtocol = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.hostname === "0.0.0.0") {
    url.hostname = "localhost";
  }

  return url.toString().replace(/\/+$/, "");
}

export async function callOllamaJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  modelId?: string,
  baseUrl?: string,
  numCtx?: number
): Promise<T> {
  const raw = await callOllama(systemPrompt, userPrompt, modelId, baseUrl, numCtx, "json");

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Ollama returned non-JSON output:\n${cleaned.slice(0, 500)}`);
  }
}