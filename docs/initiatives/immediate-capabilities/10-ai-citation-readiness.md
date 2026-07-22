# Parcel: capability-10-ai-citation-readiness

## Goal

Turn successful discoverability-audit evidence into initiative-scoped, versioned page-improvement plans that strengthen source clarity, answerability, entity definition, authorship, freshness, structured data, and claim-to-source mappings without promising AI citation placement.

## Branch and dependency

- Branch: `feat/marketops-10-ai-citation-readiness`
- Base: Capability 9 merge commit `b20ef6b`
- Capability 9 merged through PR #11.

## Contract

- Start only from a successful same-initiative SEO/AEO/GEO audit with an immutable HTML evidence hash.
- Pin audit ID, timestamp, target URL, evidence hash, and finding snapshot on every plan version.
- Capture the target question, concise answer, entity definition, authoritative sources, claim-to-source mappings, recommended page changes, structured-data plan, authorship/authority plan, freshness plan, internal-link plan, and monitoring queries.
- Require public HTTP/HTTPS source URLs, unique source/claim IDs, and claim mappings that reference sources in the same plan.
- Recompute initiative claim hygiene across the answer, entity definition, and mapped claims before persistence.
- Review-ready and approved plans require complete audit evidence, answer/entity text, at least one documented source, at least one source-mapped claim, page-structure plans, and at least one monitoring query.
- Approval is blocked by unresolved avoided or needs-proof claim findings.
- Approved and superseded versions are immutable; revisions create a new draft and approval supersedes the prior approved version.

## Explicit non-authority

- Capability 10 does not search the web, query an AI model, edit or publish a page, submit a sitemap, add schema, buy links, manipulate rankings, or claim that a search or AI system cited the page.
- Approved means the internal improvement plan passed its evidence checks—not that an external system ranked, surfaced, quoted, or cited the target.

## GenSpark boundary evidence

GenSpark CLI 1.4.0 exposes separate general web-search and scholarly-search actions that return result titles, snippets, URLs, authors, venues, and citation counts. Capability 10 invokes neither action. A future monitoring lane may record time-stamped query evidence through an explicit provider adapter, but search results cannot prove stable placement across models, users, locations, or time.

## Acceptance criteria

- Operators can seed a plan from successful audit evidence, add sources and claims, edit page-improvement plans, version, review, and approve.
- Server actions replace browser-supplied audit snapshots with canonical same-initiative evidence and recompute claim findings.
- Tests cover audit pinning, review completeness, public sources, claim mapping, claim hygiene, immutability, supersession, and evidence events.
- Test, typecheck, lint, Webpack build, dependency audit, diff check, runtime smoke, and focused security review pass.

## External constraints

- Source authority, factual accuracy, licensing, publication rights, indexability, model retrieval, answer generation, ranking, citation selection, and query variability cannot be established by repository checks.
- Monitoring must preserve provider, query, timestamp, locale/model context, result evidence, and failures; absence from one result is not proof of global absence.

## Acceptance evidence

| Check | Result |
|---|---|
| Test suite | 53 passed across 10 files, including 5 capability-specific tests |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed with Next.js 16.2.6 and Webpack; citation-readiness route included |
| Runtime smoke | HTTP 200 and expected `Citation Readiness` content on isolated port 4341 |
| GenSpark boundary | CLI 1.4.0 web and scholarly search contracts inspected; no query or side effect invoked |
| Dependency audit | Existing 3 high / 4 moderate advisories; no dependency added; forced fixes are breaking |
| Security review | No new Critical, High, or Medium capability-specific finding |
| Diff check | Passed |
| Draft pull request | [#12](https://github.com/m0r6aN/marketops/pull/12) |

## Sequence closeout

Capability 10 merged through PR #12 at merge commit `c3bbb2c`. All ten immediate capabilities are complete. No deferred functionality starts automatically from this closeout.
