/**
 * docs_as_marketing_review — extract marketing-ready opportunities from a
 * source document. Schema-bounded, deterministic at the I/O boundary.
 *
 * Tool logic is intentionally thin: it validates input, asks the configured
 * LlmReviewClient to do the review, then validates the response. Provider
 * choice and review heuristics live in src/llm/.
 */
import Ajv, { type ValidateFunction } from "ajv";
// ajv-formats is CJS-only; under NodeNext+ESM the default export lives at `.default`.
import * as ajvFormatsModule from "ajv-formats";
const addFormats = (
  ajvFormatsModule as unknown as {
    default: (ajv: Ajv) => Ajv;
  }
).default;
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DocsAsMarketingInput,
  DocsAsMarketingOutput,
  ToolError,
} from "../types.js";
import type { LlmReviewClient } from "../llm/LlmReviewClient.js";

const here = dirname(fileURLToPath(import.meta.url));
// At runtime this file is dist/tools/docsAsMarketingReview.js, so schemas
// live at dist/schemas/*.schema.json. copy-assets.mjs places them there.
const SCHEMA_DIR = join(here, "..", "schemas");

const inputSchema = JSON.parse(
  readFileSync(join(SCHEMA_DIR, "docsAsMarketingInput.schema.json"), "utf8")
);
const outputSchema = JSON.parse(
  readFileSync(join(SCHEMA_DIR, "docsAsMarketingOutput.schema.json"), "utf8")
);

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateInput: ValidateFunction<DocsAsMarketingInput> =
  ajv.compile<DocsAsMarketingInput>(inputSchema);
const validateOutput: ValidateFunction<DocsAsMarketingOutput> =
  ajv.compile<DocsAsMarketingOutput>(outputSchema);

export const TOOL_NAME = "docs_as_marketing_review" as const;

export const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description:
    "Review a source document and extract marketing-ready opportunities " +
    "(positioning, SEO, sales, social, trust) with proof strength, claim " +
    "risk, and audit-grade source excerpts. Extraction and classification " +
    "only — no campaign generation, no drafting of finished assets.",
  inputSchema: inputSchema,
} as const;

export type RunOptions = {
  llm: LlmReviewClient;
  /** Cap on document_text length. 0 disables the cap. */
  maxInputChars?: number;
  /** When true (default), reject any LLM response that fails schema validation. */
  strictJson?: boolean;
};

/**
 * Run the tool end-to-end.
 *
 * Returns either the validated output or a structured ToolError. Never
 * throws for input/output validation problems — caller can map the error
 * straight into MCP's structured tool error envelope.
 */
export async function runDocsAsMarketingReview(
  rawInput: unknown,
  opts: RunOptions
): Promise<DocsAsMarketingOutput | ToolError> {
  if (!validateInput(rawInput)) {
    return {
      error: "invalid_input",
      message: "Input did not match docsAsMarketingInput.schema.json",
      details: validateInput.errors,
    };
  }

  const input = rawInput as DocsAsMarketingInput;

  const maxChars = opts.maxInputChars ?? 0;
  if (maxChars > 0 && input.document_text.length > maxChars) {
    return {
      error: "document_too_large",
      message: `document_text exceeds DOCS_AS_MARKETING_MAX_INPUT_CHARS (${maxChars})`,
      details: { actualChars: input.document_text.length, maxChars },
    };
  }

  let output: DocsAsMarketingOutput;
  try {
    output = await opts.llm.review(input);
  } catch (err) {
    return {
      error: "llm_failure",
      message:
        err instanceof Error
          ? err.message
          : "LLM client threw a non-Error value",
      details: { providerId: opts.llm.providerId },
    };
  }

  const strict = opts.strictJson ?? true;
  if (!validateOutput(output)) {
    if (strict) {
      return {
        error: "invalid_output",
        message:
          "LLM response did not match docsAsMarketingOutput.schema.json. " +
          "Set DOCS_AS_MARKETING_STRICT_JSON=false to return it anyway.",
        details: validateOutput.errors,
      };
    }
    // Non-strict mode: surface the violations alongside the payload so the
    // caller can still see what was produced.
    return {
      error: "output_schema_warning",
      message:
        "LLM response failed schema validation but strict mode is off; payload included in details.",
      details: { errors: validateOutput.errors, payload: output },
    };
  }

  return output;
}

export function isToolError(
  value: DocsAsMarketingOutput | ToolError
): value is ToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ToolError).error === "string"
  );
}
