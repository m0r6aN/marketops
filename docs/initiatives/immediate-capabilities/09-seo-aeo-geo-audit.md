# Parcel: capability-09-seo-aeo-geo-audit

## Goal

Capture initiative-scoped page evidence and produce deterministic SEO, AEO, and GEO improvement findings without claiming search rank, answer placement, traffic, or AI citation outcomes.

## Branch and dependency

- Branch: `feat/marketops-09-seo-aeo-geo-audit`
- Base: Capability 8 merge commit `0325ac8`
- Capability 8 merged through PR #10.

## Contract

- Accept only canonical public HTTP/HTTPS page URLs with no credentials, query string, IP literal, localhost/internal suffix, or shell-unsafe path characters.
- Support a bounded GenSpark raw-HTML crawl and an operator-supplied HTML fallback. JavaScript rendering is never enabled automatically.
- Record every attempt as `succeeded`, `failed`, or `unavailable`; provider or credit failures cannot create findings or claim evidence.
- Store immutable requested/final URL, source mode, provider/version, HTML evidence snapshot, SHA-256 hash, findings, heuristic coverage, errors, and timestamp.
- Inspect title, meta description, canonical link, H1 count, robots signals, question headings, answer schema, visible-answer depth, entity schema, freshness metadata, and external source links.
- Render findings and evidence summaries as inert text. Crawled or pasted HTML is never executed, rendered, or treated as instructions.
- Label percentages as heuristic coverage, not scores from a search engine or AI provider.

## GenSpark boundary evidence

GenSpark CLI 1.4.0 exposes a default crawler, a bounded raw mode, offsets for additional raw chunks, and an optional higher-cost JavaScript renderer. Capability 9 uses only the first raw chunk and never requests render-JS. The 2026-07-22 live contract check reached the provider but returned `Insufficient credits`; MarketOps preserves this as `unavailable`.

## Out of scope

- Rank tracking, keyword-volume claims, backlink crawling, Lighthouse/Core Web Vitals, browser rendering, competitor scraping, page modification, schema publication, sitemap submission, or citation-placement promises.
- Following arbitrary local URLs, uploading credentials, bypassing anti-bot controls, or automatically increasing provider spend.

## Acceptance criteria

- Operators can run GenSpark or manual-HTML audits from an initiative route and inspect immutable evidence and findings.
- URL validation fails closed for internal, credentialed, query, IP-literal, and shell-unsafe targets.
- Provider parsing rejects error, invalid, and empty-success envelopes.
- Tests cover URL controls, manual evidence, deterministic coverage, provider failure, hashing, and unavailable records.
- Test, typecheck, lint, Webpack build, dependency audit, diff check, runtime smoke, and focused security review pass.

## External constraints

- Crawl availability, redirects, robots rules, provider terms, credits, rate limits, and page ownership remain outside this repository.
- Heuristic findings require operator review and do not prove indexability, ranking, traffic, answer-engine inclusion, generative-engine visibility, or citation likelihood.
- A later deployment should use a direct crawl service with explicit redirect/DNS controls if external audits expand beyond access-restricted internal use.

## Acceptance evidence

| Check | Result |
|---|---|
| Test suite | 48 passed across 9 files, including 5 capability-specific tests |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed with Next.js 16.2.6 and Webpack; discoverability route included |
| Runtime smoke | HTTP 200 and expected `Discoverability Audits` content on isolated port 4340 |
| Live GenSpark contract | CLI 1.4.0 raw crawl reached provider and returned `Insufficient credits`; unavailable path verified |
| Dependency audit | Existing 3 high / 4 moderate advisories; no dependency added; forced fixes are breaking |
| Security review | No new Critical, High, or Medium capability-specific finding |
| Diff check | Passed |

## Sequence gate

Capability 10 remains blocked until Capability 9 is merged, rejected, or explicitly superseded.
