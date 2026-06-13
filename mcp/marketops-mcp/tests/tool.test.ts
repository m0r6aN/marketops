/**
 * Unit tests for the docs_as_marketing_review tool.
 *
 * Runs with node:test (zero dependency). Build first so dist/ has the
 * compiled JS + copied schemas — `npm test` does that for you.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MockLlmReviewClient } from "../dist/llm/LlmReviewClient.js";
import { OllamaLlmReviewClient } from "../dist/llm/OllamaLlmReviewClient.js";
import {
    TOOL_DEFINITION,
    TOOL_NAME,
    isToolError,
    runDocsAsMarketingReview,
} from "../dist/tools/docsAsMarketingReview.js";
import type { LlmReviewClient } from "../src/llm/LlmReviewClient.js";
import type {
    DocsAsMarketingInput,
    DocsAsMarketingOutput,
    ToolError,
} from "../src/types.js";

type ReviewResult = DocsAsMarketingOutput | ToolError;
type RunOptions = {
  llm: LlmReviewClient;
  maxInputChars?: number;
  strictJson?: boolean;
};

const runReview = runDocsAsMarketingReview as (
  rawInput: unknown,
  opts: RunOptions
) => Promise<ReviewResult>;

const toolError = isToolError as (value: ReviewResult) => value is ToolError;

const here = dirname(fileURLToPath(import.meta.url));
const exampleInput = JSON.parse(
  readFileSync(
    join(
      here,
      "..",
      "src",
      "examples",
      "docs-as-marketing-review.input.example.json"
    ),
    "utf8"
  )
) as DocsAsMarketingInput;

const llm = new MockLlmReviewClient() as unknown as LlmReviewClient;

const minimalReviewOutput = {
  summary: {
    best_marketing_uses: ["Blog"],
    overall_score: 80,
    highest_value_theme: "Proof-led positioning",
  },
  candidates: [],
  red_flags: [],
  asset_opportunities: [],
};

test("tool registration: name and schema present", () => {
  assert.equal(TOOL_NAME, "docs_as_marketing_review");
  assert.equal(TOOL_DEFINITION.name, "docs_as_marketing_review");
  assert.ok(TOOL_DEFINITION.inputSchema, "inputSchema should be attached");
  assert.equal(
    TOOL_DEFINITION.inputSchema.$id,
    "https://marketops.local/schemas/docs-as-marketing-input.v1.json"
  );
});

test("valid input is accepted and produces schema-valid output", async () => {
  const result = await runReview(exampleInput, { llm });
  assert.ok(!toolError(result), `expected success, got error: ${JSON.stringify(result)}`);
  assert.ok(Array.isArray(result.candidates));
  assert.ok(Array.isArray(result.red_flags));
  assert.ok(Array.isArray(result.asset_opportunities));
  assert.ok(result.summary.overall_score >= 0 && result.summary.overall_score <= 100);
});

test("invalid input is rejected with structured error", async () => {
  const result = await runReview(
    { initiative: "x", document_type: "whitepaper" }, // missing required fields
    { llm }
  );
  assert.ok(toolError(result), "expected ToolError");
  assert.equal(result.error, "invalid_input");
  assert.ok(Array.isArray(result.details), "ajv errors should be attached");
});

test("invalid document_type enum is rejected", async () => {
  const bad = { ...exampleInput, document_type: "novel" };
  const result = await runReview(bad, { llm });
  assert.ok(toolError(result));
  assert.equal(result.error, "invalid_input");
});

test("document_too_large is returned when over the cap", async () => {
  const result = await runReview(exampleInput, {
    llm,
    maxInputChars: 50,
  });
  assert.ok(toolError(result));
  assert.equal(result.error, "document_too_large");
});

test("roadmap language is flagged with Roadmap Only confidence", async () => {
  const result = await runReview(exampleInput, { llm });
  assert.ok(!toolError(result));
  const roadmapCandidates = result.candidates.filter(
    (c) => c.confidence === "Roadmap Only"
  );
  assert.ok(
    roadmapCandidates.length >= 1,
    "roadmap sentence should produce at least one Roadmap Only candidate"
  );
  const roadmapFlags = result.red_flags.filter((f) =>
    /roadmap/i.test(f.issue)
  );
  assert.ok(
    roadmapFlags.length >= 1,
    "roadmap sentence should produce at least one red flag"
  );
});

test("risky security language without proof is flagged as High risk", async () => {
  const input = {
    ...exampleInput,
    document_text:
      "Our platform is secure by default. The API has been verified against industry threats.",
  };
  const result = await runReview(input, { llm });
  assert.ok(!toolError(result));
  const highRisk = result.red_flags.filter((f) => f.risk_level === "High");
  assert.ok(
    highRisk.length >= 1,
    "expected at least one High risk flag for unsupported security claims"
  );
  for (const flag of highRisk) {
    const hasMitigation = Boolean(flag.safer_wording || flag.proof_requirement);
    assert.ok(
      hasMitigation,
      "every red flag must include safer_wording or proof_requirement"
    );
  }
});

test("every red flag carries safer_wording OR proof_requirement", async () => {
  const result = await runReview(exampleInput, { llm });
  assert.ok(!toolError(result));
  for (const flag of result.red_flags) {
    const ok = Boolean(flag.safer_wording || flag.proof_requirement);
    assert.ok(
      ok,
      `red flag missing mitigation: ${JSON.stringify(flag)}`
    );
  }
});

test("strict mode rejects a malformed LLM response", async () => {
  const badLlm: LlmReviewClient = {
    providerId: "bad",
    async review() {
      return {
        summary: { best_marketing_uses: [], overall_score: 500, highest_value_theme: null },
        candidates: [],
        red_flags: [],
        asset_opportunities: [],
      } as unknown as DocsAsMarketingOutput;
    },
  };
  const result = await runReview(exampleInput, {
    llm: badLlm,
    strictJson: true,
  });
  assert.ok(toolError(result));
  assert.equal(result.error, "invalid_output");
});

test("non-strict mode surfaces a warning instead of rejecting", async () => {
  const badLlm: LlmReviewClient = {
    providerId: "bad",
    async review() {
      return {
        summary: { best_marketing_uses: [], overall_score: 500, highest_value_theme: null },
        candidates: [],
        red_flags: [],
        asset_opportunities: [],
      } as unknown as DocsAsMarketingOutput;
    },
  };
  const result = await runReview(exampleInput, {
    llm: badLlm,
    strictJson: false,
  });
  assert.ok(toolError(result));
  assert.equal(result.error, "output_schema_warning");
});

test("llm_failure is returned when the adapter throws", async () => {
  const throwingLlm: LlmReviewClient = {
    providerId: "boom",
    async review() {
      throw new Error("provider unreachable");
    },
  };
  const result = await runReview(exampleInput, {
    llm: throwingLlm,
  });
  assert.ok(toolError(result));
  assert.equal(result.error, "llm_failure");
  assert.match(result.message, /provider unreachable/);
});

test("Ollama adapter parses chat message JSON content", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      message: { content: JSON.stringify(minimalReviewOutput) },
    }),
  } as Response)) as typeof fetch;

  try {
    const client = new OllamaLlmReviewClient("test-model", "http://ollama.test");
    const result = await client.review(exampleInput);
    assert.deepEqual(result, minimalReviewOutput);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Ollama adapter normalizes host values missing a URL scheme", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return {
      ok: true,
      json: async () => ({
        message: { content: JSON.stringify(minimalReviewOutput) },
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const client = new OllamaLlmReviewClient("test-model", "0.0.0.0:11435/");
    await client.review(exampleInput);
    assert.equal(requestedUrl, "http://localhost:11435/api/chat");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Ollama adapter rejects malformed chat responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ message: {} }),
  } as Response)) as typeof fetch;

  try {
    const client = new OllamaLlmReviewClient("test-model", "http://ollama.test");
    await assert.rejects(
      () => client.review(exampleInput),
      /missing message\.content/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("source excerpts are quoted verbatim from input — no fabrication", async () => {
  const result = await runReview(exampleInput, { llm });
  assert.ok(!toolError(result));
  for (const c of result.candidates) {
    assert.ok(
      exampleInput.document_text.includes(c.source_excerpt),
      `source_excerpt not found in document_text: "${c.source_excerpt}"`
    );
  }
  for (const f of result.red_flags) {
    assert.ok(
      exampleInput.document_text.includes(f.source_excerpt),
      `red flag source_excerpt not found in document_text: "${f.source_excerpt}"`
    );
  }
});
