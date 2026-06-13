# marketops-mcp

MCP server for MarketOps tooling. The first (and currently only) tool exposes
the [Docs as Marketing Review](./src/skills/docs-as-marketing-review.md) skill
as a structured, schema-bounded tool so agents can invoke it without pasting
long prompts.

## What this server does

- Registers one tool: **`docs_as_marketing_review`**.
- Validates input against [`src/schemas/docsAsMarketingInput.schema.json`](./src/schemas/docsAsMarketingInput.schema.json).
- Delegates the review to an `LlmReviewClient` implementation. A
  deterministic `MockLlmReviewClient` ships by default so the container boots
  and tests run without an API key.
- Validates the LLM response against
  [`src/schemas/docsAsMarketingOutput.schema.json`](./src/schemas/docsAsMarketingOutput.schema.json)
  before returning.
- Exposes the rubric, skill, and example fixtures as `marketops://` MCP
  resources so a connected client can browse the contract.
- Returns structured `{ error, message, details }` envelopes on failure —
  never throws across the MCP boundary.

The server speaks **MCP stdio** by default. There's no HTTP listener.

## Build

```bash
cd mcp/marketops-mcp
npm install
npm run build
```

`build` compiles TypeScript and copies JSON schemas + rubric + skill +
examples into `dist/` so the runtime can `readFileSync` them with relative
paths.

## Run locally (stdio)

```bash
npm start
# or, no build step:
npm run dev
```

The process talks JSON-RPC over stdin/stdout. To poke at it manually, use an
MCP client (Claude Desktop, the `@modelcontextprotocol/inspector` package,
or your own).

## Run tests

```bash
npm test
```

Tests run with `node:test` (zero deps). They exercise the compiled output in
`dist/`, so `npm test` runs the typecheck implicitly via `tsc --noEmit`.

## Docker

### Build

```bash
docker build -t marketops-mcp-docs-marketing ./mcp/marketops-mcp
```

### Run (stdio)

```bash
docker run --rm -i marketops-mcp-docs-marketing
```

`-i` keeps stdin attached so the MCP client on the other end can speak
JSON-RPC. No ports to expose; no network calls at runtime unless you wire in
a non-mock LLM provider.

### Compose

```bash
docker compose -f ./mcp/marketops-mcp/compose.yaml build
docker compose -f ./mcp/marketops-mcp/compose.yaml run --rm --no-deps -T marketops-mcp
```

`-T` disables TTY allocation so MCP JSON-RPC stays on plain stdio.

### Environment

| Variable                              | Default  | Purpose                                                           |
| ------------------------------------- | -------- | ----------------------------------------------------------------- |
| `MARKETOPS_MCP_MODE`                  | `stdio`  | Reserved. Only `stdio` is implemented today.                      |
| `DOCS_AS_MARKETING_MODEL_PROVIDER`    | `mock`   | LLM provider id. `mock` is the only implementation in this build. |
| `DOCS_AS_MARKETING_MODEL_NAME`        | _unset_  | Provider-specific model identifier (passed to provider impls).    |
| `DOCS_AS_MARKETING_API_KEY`           | _unset_  | Provider API key (passed to provider impls).                      |
| `DOCS_AS_MARKETING_MAX_INPUT_CHARS`   | _unset_  | If set to a positive integer, rejects `document_text` larger than this. |
| `DOCS_AS_MARKETING_STRICT_JSON`       | `true`   | When `true`, reject LLM responses that fail output-schema validation. |

## Connect to Claude Desktop

Add an entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "marketops": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "marketops-mcp-docs-marketing"]
    }
  }
}
```

Or via Compose:

```json
{
  "mcpServers": {
    "marketops": {
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/absolute/path/to/mcp/marketops-mcp/compose.yaml",
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "marketops-mcp"
      ]
    }
  }
}
```

Or, without Docker:

```json
{
  "mcpServers": {
    "marketops": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/marketops-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. The `docs_as_marketing_review` tool will appear in
its tool list.

## Tool: `docs_as_marketing_review`

### Input

See [`src/schemas/docsAsMarketingInput.schema.json`](./src/schemas/docsAsMarketingInput.schema.json)
for the authoritative contract. Minimum fields:

```jsonc
{
  "initiative":          "Keon Systems",
  "document_type":       "whitepaper",        // whitepaper | spec | readme | architecture | changelog | proof-pack | canon | other
  "source_title":        "Governed AI Execution",
  "source_url_or_path":  "docs/whitepapers/governed-ai-execution.md",
  "target_audience":     ["CTO", "Platform Team", "Security Team"],
  "review_goal":         "Find reusable marketing content",
  "document_text":       "..."
}
```

A full input example lives at
[`src/examples/docs-as-marketing-review.input.example.json`](./src/examples/docs-as-marketing-review.input.example.json).

### Output

See [`src/schemas/docsAsMarketingOutput.schema.json`](./src/schemas/docsAsMarketingOutput.schema.json).
Shape:

```jsonc
{
  "summary": {
    "best_marketing_uses": ["Landing Page", "Sales Deck"],
    "overall_score": 72,
    "highest_value_theme": "..."
  },
  "candidates":          [/* per-extraction objects */],
  "red_flags":           [/* per risky claim */],
  "asset_opportunities": [/* downstream asset ideas */]
}
```

Every `candidate` carries `source_excerpt` (verbatim from the source),
`marketing_angle` (the reviewer's inference), `suggested_rewrite`,
`proof_strength`, `claim_risk`, and `link_back_required`. Every `red_flag`
must include `safer_wording` and/or `proof_requirement` — the schema enforces
this with `anyOf`.

Full output example: [`src/examples/docs-as-marketing-review.output.example.json`](./src/examples/docs-as-marketing-review.output.example.json).

### Error envelope

On failure, the tool returns `isError: true` with a JSON-encoded payload:

```jsonc
{
  "error":   "invalid_input",         // machine-readable code
  "message": "Input did not match …", // short description
  "details": [/* ajv errors, or context */]
}
```

Error codes today: `invalid_input`, `document_too_large`, `llm_failure`,
`invalid_output`, `output_schema_warning`, `unknown_tool`.

## Current limitations

- Only the `mock` LLM provider is implemented. A real provider needs an
  `LlmReviewClient` implementation wired into `buildLlmClient()` in
  [`src/index.ts`](./src/index.ts).
- The tool **does not persist** anything. Persistence lives in the main
  MarketOps app's `marketing-review-writer.ts`; this server is read-only.
- The tool **does not draft campaigns or assets**. It only extracts,
  classifies, scores, and flags.
- Output mode is JSON only. The skill defines a Markdown rendering too;
  it's reserved in the schema but not yet implemented here.

## Future tools (placeholders — not implemented)

- `marketops_save_marketing_candidate` — write a candidate into the main
  MarketOps Library.
- `marketops_link_candidate_to_campaign` — bind a candidate to a campaign
  record.
- `marketops_validate_claim_against_canon` — cross-check a claim against the
  Library's approved canon.
- `marketops_generate_asset_brief` — produce a structured asset brief from
  one or more candidates.
- `marketops_mark_candidate_used` — mark a candidate as shipped.

## Contract docs

- **Skill:** [`src/skills/docs-as-marketing-review.md`](./src/skills/docs-as-marketing-review.md)
- **Rubric:** [`src/rubrics/docs-as-marketing.v1.md`](./src/rubrics/docs-as-marketing.v1.md)
- **Input schema:** [`src/schemas/docsAsMarketingInput.schema.json`](./src/schemas/docsAsMarketingInput.schema.json)
- **Output schema:** [`src/schemas/docsAsMarketingOutput.schema.json`](./src/schemas/docsAsMarketingOutput.schema.json)
