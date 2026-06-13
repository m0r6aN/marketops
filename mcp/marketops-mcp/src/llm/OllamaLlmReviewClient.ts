import type { DocsAsMarketingInput, DocsAsMarketingOutput } from "../types.js";
import type { LlmReviewClient } from "./LlmReviewClient.js";

export class OllamaLlmReviewClient implements LlmReviewClient {
  readonly providerId = "ollama";
  private model: string;
  private baseUrl: string;
  private numCtx: number;

  constructor(model?: string, baseUrl?: string, numCtx?: number) {
    this.model = model ?? process.env.DOCS_AS_MARKETING_MODEL_NAME ?? "llama3.2";
    this.baseUrl = normalizeOllamaBaseUrl(
      baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434"
    );
    const envCtx = process.env.OLLAMA_NUM_CTX;
    const parsedEnv = envCtx ? parseInt(envCtx, 10) : NaN;
    this.numCtx = numCtx ?? (Number.isNaN(parsedEnv) ? undefined : parsedEnv) ?? 8192;
  }

  async review(input: DocsAsMarketingInput): Promise<DocsAsMarketingOutput> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.buildSystemPrompt(),
          },
          {
            role: "user",
            content: this.buildUserPrompt(input),
          },
        ],
        stream: false,
        format: "json",
        options: {
          num_ctx: this.numCtx,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const raw = getOllamaMessageContent(data);

    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    try {
      return JSON.parse(cleaned) as DocsAsMarketingOutput;
    } catch {
      throw new Error(`Ollama returned non-JSON output:\n${raw.slice(0, 500)}`);
    }
  }

  private buildSystemPrompt(): string {
    return `You are a "Docs as Marketing" reviewer. Review documents and extract marketing-ready opportunities.

Follow the rubric strictly:
1. Value extraction — problem statements, product identity, outcomes, differentiators
2. Feature-to-benefit conversion
3. Proof and credibility mining — classify proof strength as Strong/Medium/Weak/Unsupported
4. SEO and knowledge hub opportunities
5. Social and short-form content mining
6. Conversion asset opportunities
7. Red flag check — flag unsupported claims, roadmap-as-capability, overstated security language

Return valid JSON only — no markdown fences, no prose.`;
  }

  private buildUserPrompt(input: DocsAsMarketingInput): string {
    return `Review this ${input.document_type} for marketing extraction.

Title: ${input.source_title}
Goal: ${input.review_goal}
Target Audience: ${input.target_audience.join(", ")}

Document:
${input.document_text}

Return JSON matching this schema:
{
  "summary": {
    "best_marketing_uses": ["string"],
    "overall_score": 0-100,
    "highest_value_theme": "string"
  },
  "candidates": [
    {
      "source_section": "string",
      "source_excerpt": "string",
      "marketing_angle": "string",
      "suggested_rewrite": "string",
      "use_for": ["Landing Page", "Blog", "SEO", ...],
      "audience": ["Developer", "Executive", ...],
      "funnel_stage": "Awareness",
      "content_type": ["Feature", "Benefit", ...],
      "confidence": "Use As-Is",
      "proof_strength": "Strong",
      "claim_risk": "Low",
      "link_back_required": true
    }
  ],
  "red_flags": [
    {
      "source_excerpt": "string",
      "risk_level": "Medium",
      "issue": "string",
      "safer_wording": "string",
      "proof_requirement": "string"
    }
  ],
  "asset_opportunities": [
    {
      "asset_type": "LinkedIn Post",
      "theme": "string",
      "priority": "High"
    }
  ]
}`;
  }
}

function getOllamaMessageContent(data: unknown): string {
  if (!isRecord(data)) {
    throw new Error("Ollama returned malformed response: expected JSON object");
  }

  const message = data.message;
  if (!isRecord(message) || typeof message.content !== "string") {
    throw new Error("Ollama returned malformed response: missing message.content");
  }

  return message.content;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}