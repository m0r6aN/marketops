---
name: docs-as-marketing-review
version: 1.0.0
description: Review a source document and extract marketing-ready content opportunities (positioning, SEO, sales, social, trust) with proof strength, claim risk, and audit links back to the source. Extraction and classification only — no campaign generation, no content drafts.
inputs:
  - initiative: string
  - document_type: string  # whitepaper | spec | readme | architecture | changelog | proof-pack | canon | other
  - source_title: string
  - source_url_or_path: string
  - target_audience: string[]
  - review_goal: string
  - document_text: string
  - source_document_id: string         # optional; required if mode = "persist"
  - import_batch_id: string            # optional; required if mode = "persist"
outputs:
  - mode: "json" | "markdown" | "persist" (caller chooses; default "json")
rubric: docs/rubrics/docs-as-marketing.v1.md
example: docs/examples/docs-as-marketing-review.example.md
rubric_version: docs-as-marketing.v1
persistence:
  module: "@/lib/library/marketing-review-writer"
  tables:
    - library_marketing_review_summaries
    - library_marketing_red_flags
    - library_marketing_asset_opportunities
    - library_entries  # candidates land here as entry_type = "marketing_nugget"
---

# Skill: Docs as Marketing Review

Review the provided document and identify content that can be used as-is or
rewritten for marketing, positioning, SEO, sales, social, or trust-building
assets. **Extraction and classification only.** Do not draft campaigns or
finished assets.

For the full review checklist, tag taxonomies, and proof-strength rubric, see
[docs-as-marketing.v1.md](../rubrics/docs-as-marketing.v1.md). The rubric is
the source of truth for tag values; this file is the operational contract.

## Operating Procedure

1. **Read the source.** Treat `document_text` as authoritative. Do not import
   facts from outside the source. If a fact appears only in `source_title` or
   metadata, mark its proof as `Weak` or `Unsupported`.
2. **Scan against the rubric's seven checks** (in order):
   1. Value extraction
   2. Feature-to-benefit conversion
   3. Proof and credibility mining
   4. SEO and knowledge hub opportunities
   5. Social and short-form opportunities
   6. Conversion asset opportunities
   7. Red flag check
3. **For every extracted candidate, separate four things cleanly:**
   - `source_excerpt` — verbatim or near-verbatim quote from the document
   - `marketing_angle` — inferred positioning value (your inference, labelled)
   - `suggested_rewrite` — buyer-readable copy that preserves accuracy
   - `proof_strength` + `claim_risk` — see rubric §3 and §7
4. **Tag each candidate** using only the allowed values listed below. Reject
   any tag not in the allowed set.
5. **Flag every risky claim** with `safer_wording` or a `proof_requirement`.
6. **Link back to the source** (`link_back_required: true`) whenever a claim
   would carry weight in a marketing context.

## Hard Constraints (do not violate)

- Preserve technical accuracy. Never strengthen a claim beyond what the source
  supports.
- Do not turn roadmap items, design intent, or "planned" capabilities into
  present-tense statements. Use `Designed to…`, `Intended to…`, or `Roadmap
  Only` confidence.
- Treat the following words as **high-risk** unless directly supported by the
  source: `secure`, `compliant`, `verified`, `proven`, `production-ready`,
  `certified`, `audited`, `guaranteed`, benchmark numbers, SLA numbers.
- Prefer safer wording when proof is `Weak` or `Unsupported`.
- Every red flag must include either `safer_wording` or `proof_requirement`.

## Allowed Tag Values

**use_for** (channel / asset):
Website, Landing Page, Blog, SEO, Social Media, LinkedIn, X / Twitter, Email,
Newsletter, Sales Deck, Investor Deck, Webinar, Demo Script, Product Tour,
FAQ, Knowledge Hub, Case Study, One-Pager, Whitepaper, Press / Launch,
Documentation Link-Back

**audience**:
Developer, Platform Team, Security Team, Compliance Team, Executive, Founder,
Buyer, Operator, Auditor, Partner, Investor

**funnel_stage** (single value):
Awareness, Education, Consideration, Conversion, Activation, Retention,
Expansion, Trust Building, Objection Handling

**content_type** (one or more, from rubric §"Content Type Tags"):
Problem Statement, Product Positioning, Feature, Benefit, Proof Point,
Differentiator, Customer Outcome, Technical Explanation, Architecture
Principle, Integration, Benchmark, FAQ, Glossary, Tutorial, Comparison,
Objection, Risk Reduction, Quote Candidate, Hook, CTA Candidate

**confidence** (single value):
Use As-Is, Light Rewrite, Heavy Rewrite, Needs Proof, Needs Version Check,
Roadmap Only, Internal Only, Do Not Use

**proof_strength** (single value):
Strong, Medium, Weak, Unsupported

**claim_risk** (single value):
Low, Medium, High

## Output Contract

The caller selects the output mode.

### Mode: `json` (default, machine-readable)

Return **valid JSON only** — no prose, no markdown fences when called
programmatically. Shape:

```json
{
  "summary": {
    "best_marketing_uses": ["Landing Page", "Whitepaper"],
    "overall_score": 0,
    "highest_value_theme": "string"
  },
  "candidates": [
    {
      "source_section": "string",
      "source_excerpt": "string",
      "marketing_angle": "string",
      "suggested_rewrite": "string",
      "use_for": ["Landing Page"],
      "audience": ["CTO"],
      "funnel_stage": "Consideration",
      "content_type": ["Problem Statement"],
      "confidence": "Light Rewrite",
      "proof_strength": "Medium",
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
}
```

Field rules:

- `summary.overall_score` — integer 0–100, your judgment of how much
  marketing-grade content the source yields.
- `summary.best_marketing_uses` — top 2–5 `use_for` values, ordered by value.
- `candidates[]` — one entry per extracted opportunity. Include enough
  `source_excerpt` to make the finding auditable (≥ 1 sentence, ≤ ~3
  sentences; truncate with `…` if needed).
- `red_flags[]` — every flagged item must have `safer_wording` **or**
  `proof_requirement` (at least one; both is fine).
- `asset_opportunities[]` — distinct downstream assets the source could feed,
  with `priority: High | Medium | Low`.
- Omit fields only if explicitly optional. Do not invent fields outside this
  schema.

### Mode: `markdown` (human-readable)

Return a concise summary using the rubric's "Recommended LLM Output Format"
tables (§"Recommended LLM Output Format"). Keep it tight — this mode is for
human skim, not handoff to another system.

### Mode: `persist` (write to Library DB)

Produce the same JSON as `json` mode, then hand it to the writer at
`@/lib/library/marketing-review-writer` so it lands in the Library Canon
Foundry schema. Requires `source_document_id` and `import_batch_id`.

Return:

```json
{
  "review_summary_id": "string",
  "library_entry_ids": ["string"],
  "red_flag_ids": ["string"],
  "asset_opportunity_ids": ["string"],
  "json": { /* the full json-mode payload, verbatim */ }
}
```

#### Persistence Contract — JSON ↔ tables

The writer MUST perform exactly these mappings. Do not invent new columns.
Tag-value validation against the allowed sets in this skill happens **before**
insert; reject the whole review on any unknown tag.

**`summary` → `library_marketing_review_summaries` (one row)**

| JSON field                  | Column                  | Notes                                  |
|-----------------------------|-------------------------|----------------------------------------|
| `summary.overall_score`     | `overall_score`         | integer 0–100                          |
| `summary.best_marketing_uses` | `best_marketing_uses` | `JSON.stringify(array)`                |
| `summary.highest_value_theme` | `highest_value_theme` |                                        |
| (constant)                  | `rubric_version`        | `docs-as-marketing.v1`                 |
| (caller)                    | `source_document_id`    | from input                             |
| (caller)                    | `import_batch_id`       | from input                             |
| (now)                       | `reviewed_at`, `created_at` | ISO-8601                            |

**`candidates[]` → `library_entries` (one row each, `entry_type = 'marketing_nugget'`)**

| JSON field            | Column                | Notes                                              |
|-----------------------|-----------------------|----------------------------------------------------|
| `source_section`      | `source_section`      |                                                    |
| `source_excerpt`      | `source_excerpt`      | also copy to `source_quote` for legacy readers     |
| `marketing_angle`     | `marketing_angle`     |                                                    |
| `suggested_rewrite`   | `suggested_rewrite`   | also copy to `copy_text` for legacy readers        |
| `use_for[]`           | `use_for`             | `JSON.stringify(array)`; also pick first → `suggested_channel` |
| `audience[]`          | `review_audience`     | `JSON.stringify(array)`; legacy `audience` left NULL |
| `funnel_stage`        | `funnel_stage`        |                                                    |
| `content_type[]`      | `content_type`        | `JSON.stringify(array)`                            |
| `confidence`          | `review_confidence`   | one of allowed `confidence` values                 |
| `proof_strength`      | `proof_strength`      |                                                    |
| `claim_risk`          | `claim_risk`          |                                                    |
| `link_back_required`  | `link_back_required`  | boolean → 0/1                                      |
| (constant)            | `rubric_version`      | `docs-as-marketing.v1`                             |
| (writer)              | `review_summary_id`   | id of the row inserted above                       |
| derived               | `title`               | first 80 chars of `marketing_angle` (or `source_section`) |
| derived               | `content`             | `suggested_rewrite`                                |
| derived               | `status`              | `pending_review`                                   |
| derived               | `tags`                | `'[]'`                                             |
| (now)                 | `created_at`, `updated_at`, `ingested_at`-equivalents | ISO-8601 |

**`red_flags[]` → `library_marketing_red_flags` (one row each)**

| JSON field          | Column              | Notes                                         |
|---------------------|---------------------|-----------------------------------------------|
| `source_excerpt`    | `source_excerpt`    |                                               |
| `risk_level`        | `risk_level`        | Low \| Medium \| High                         |
| `issue`             | `issue`             |                                               |
| `safer_wording`     | `safer_wording`     | one of safer_wording / proof_requirement is required |
| `proof_requirement` | `proof_requirement` |                                               |
| (writer)            | `review_summary_id`, `source_document_id` |                         |
| (writer)            | `library_entry_id`  | set when the flag was extracted from a specific candidate |

**`asset_opportunities[]` → `library_marketing_asset_opportunities` (one row each)**

| JSON field    | Column         | Notes                            |
|---------------|----------------|----------------------------------|
| `asset_type`  | `asset_type`   |                                  |
| `theme`       | `theme`        |                                  |
| `priority`    | `priority`     | High \| Medium \| Low; default Medium |
| (constant)    | `status`       | `proposed`                       |
| (writer)      | `source_document_id`, `review_summary_id` |          |

#### Persistence rules

- All inserts MUST run in a single transaction. If any row violates a tag rule
  or a NOT-NULL constraint, abort the whole transaction and return
  `{"error": "persist_failed", "reason": "..."}`.
- Every `red_flags[]` row MUST satisfy `safer_wording != null OR
  proof_requirement != null`. Enforce this in the writer, not in SQL.
- IDs are generated by the writer (e.g. `crypto.randomUUID()`); never let the
  model invent them.
- Re-runs against the same `source_document_id` are allowed; the writer
  inserts a new `review_summary_id` rather than updating in place so the
  history is preserved.

## Refusal / Failure Modes

- If `document_text` is empty or unreadable, return:
  `{"error": "no_source_text", "candidates": [], "red_flags": [], "asset_opportunities": []}`.
- If the source is clearly off-topic for marketing extraction (e.g., raw logs,
  pure config), return an empty `candidates` array and one `red_flag` of
  `risk_level: "High"` explaining why no extraction was performed.
- Never fabricate excerpts. If you cannot quote, do not extract.
