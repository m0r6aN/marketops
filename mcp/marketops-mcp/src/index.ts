#!/usr/bin/env node
/**
 * MarketOps MCP server — stdio bootstrap.
 *
 * Registers exactly one tool today (`docs_as_marketing_review`) and exposes
 * a small set of `marketops://` resources pointing at the rubric, skill, and
 * example fixtures so MCP-aware clients can browse the contract.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MockLlmReviewClient, type LlmReviewClient } from "./llm/LlmReviewClient.js";
import { OllamaLlmReviewClient } from "./llm/OllamaLlmReviewClient.js";
import {
    TOOL_DEFINITION,
    TOOL_NAME,
    isToolError,
    runDocsAsMarketingReview,
} from "./tools/docsAsMarketingReview.js";

const here = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = (sub: string) => join(here, sub);

const RESOURCES = [
  {
    uri: "marketops://skills/docs-as-marketing-review",
    name: "Skill: Docs as Marketing Review",
    mimeType: "text/markdown",
    path: join(ASSET_DIR("skills"), "docs-as-marketing-review.md"),
  },
  {
    uri: "marketops://rubrics/docs-as-marketing.v1",
    name: "Rubric: docs-as-marketing.v1",
    mimeType: "text/markdown",
    path: join(ASSET_DIR("rubrics"), "docs-as-marketing.v1.md"),
  },
  {
    uri: "marketops://examples/docs-as-marketing-review.input",
    name: "Example input",
    mimeType: "application/json",
    path: join(
      ASSET_DIR("examples"),
      "docs-as-marketing-review.input.example.json"
    ),
  },
  {
    uri: "marketops://examples/docs-as-marketing-review.output",
    name: "Example output",
    mimeType: "application/json",
    path: join(
      ASSET_DIR("examples"),
      "docs-as-marketing-review.output.example.json"
    ),
  },
] as const;

function buildLlmClient(): LlmReviewClient {
  const provider = (process.env.DOCS_AS_MARKETING_MODEL_PROVIDER ?? "mock")
    .trim()
    .toLowerCase();

  switch (provider) {
    case "":
    case "mock":
      return new MockLlmReviewClient();
    case "ollama":
      return new OllamaLlmReviewClient();
    default:
      // Fail loud rather than silently falling back; agents would rather see
      // the error than get mock output they thought was real.
      throw new Error(
        `Unknown DOCS_AS_MARKETING_MODEL_PROVIDER: "${provider}". ` +
          `Supported providers: "mock", "ollama".`
      );
  }
}

function maxInputCharsFromEnv(): number {
  const raw = process.env.DOCS_AS_MARKETING_MAX_INPUT_CHARS;
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function strictJsonFromEnv(): boolean {
  const raw = (process.env.DOCS_AS_MARKETING_STRICT_JSON ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0";
}

export async function main(): Promise<void> {
  const llm = buildLlmClient();
  const maxInputChars = maxInputCharsFromEnv();
  const strictJson = strictJsonFromEnv();

  const server = new Server(
    { name: "marketops-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [TOOL_DEFINITION],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== TOOL_NAME) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "unknown_tool",
              message: `Unknown tool: ${req.params.name}`,
            }),
          },
        ],
      };
    }

    const result = await runDocsAsMarketingReview(req.params.arguments ?? {}, {
      llm,
      maxInputChars,
      strictJson,
    });

    return {
      isError: isToolError(result),
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      mimeType: r.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const r = RESOURCES.find((x) => x.uri === req.params.uri);
    if (!r) {
      throw new Error(`Unknown resource: ${req.params.uri}`);
    }
    return {
      contents: [
        {
          uri: r.uri,
          mimeType: r.mimeType,
          text: readFileSync(r.path, "utf8"),
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stay alive until the transport closes.
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}

// `node dist/index.js` is the entrypoint; `tsx src/index.ts` works too.
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main().catch((err) => {
    // stderr only — stdout is reserved for the MCP transport.
    process.stderr.write(
      `[marketops-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
