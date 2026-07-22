# Security Review — Capability 10 AI Citation Readiness

**Date:** 2026-07-22
**Reviewer:** `security-review` skill
**Depth:** Standard
**Mode:** Local passive source and provider-boundary review

## Executive summary

Capability 10 is a local planning and approval workspace derived from immutable successful audit evidence. It has no network, model, search, crawl, page-edit, schema-publication, or ranking action. Server actions pin the canonical audit snapshot, validate public source URLs and claim mappings, recompute initiative claim hygiene, and preserve approved versions as immutable evidence.

No Critical, High, or Medium capability-specific finding was identified. The main risks are public exposure without operator authentication, operator-supplied sources being mistaken for independently verified authority, and approval being misread as proof of external ranking or citation outcomes.

## Findings summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Low | Internal-only actions lack operator authentication | `src/app/actions/citation-readiness.ts:2` | OWASP A01, CWE-862 |
| F-002 | Low | Source metadata is operator-asserted rather than independently verified | `src/lib/citation-readiness/service.ts:4` | CWE-345 |
| F-003 | Low | Internal approval could be mistaken for external citation evidence | `src/app/initiatives/[slug]/citation-readiness/page.tsx:1` | CWE-693 |
| F-004 | Informational | Strategy and claim mappings may contain sensitive commercial information | `src/lib/citation-readiness/repository.ts:2` | OWASP A02, CWE-359 |

## Detailed findings

### F-001: Internal-only actions lack operator authentication
- **Severity:** Low
- **Confidence:** High
- **Evidence:** Server actions validate initiative and lifecycle state but not an authenticated operator.
- **Impact:** Public exposure would permit unauthorized strategy changes or approval-state manipulation.
- **Remediation:** Keep deployment access-restricted and add authenticated operator authorization before broader exposure.

### F-002: Source metadata is operator-asserted
- **Severity:** Low
- **Confidence:** High
- **Evidence:** URLs must be public HTTP/HTTPS and claims must map to plan sources, but Capability 10 deliberately does not fetch or validate source ownership, content, freshness, or authority.
- **Impact:** A complete plan could still rely on weak, stale, mischaracterized, or unauthorized evidence.
- **Remediation:** Require operator review now; any later source-verification adapter must preserve fetch evidence, redirects, timestamps, licenses, failures, and content hashes.

### F-003: Approval could be mistaken for external evidence
- **Severity:** Low
- **Confidence:** High
- **Evidence:** UI and documentation label approval as internal plan readiness, but the product name concerns AI citations.
- **Impact:** Operators could overstate likely or actual citation placement.
- **Remediation:** Preserve explicit non-guarantee language and require separate time-stamped provider evidence for any outcome claim.

### F-004: Strategy and claims may be sensitive
- **Severity:** Informational
- **Confidence:** High
- **Evidence:** Answers, entity definitions, source mappings, page-change strategy, and monitoring queries persist in SQLite history.
- **Impact:** Internal commercial and messaging strategy remains in local storage.
- **Remediation:** Protect database access and retention consistently with the internal deployment.

## Positive controls

- Canonical same-initiative successful audit and SHA-256 evidence hash are pinned server-side.
- Public source URL validation, unique identifiers, referential claim/source integrity, bounded item counts, and text limits.
- Server-derived claim hygiene, immutable approved/superseded versions, and explicit evidence events.
- React text rendering only; no raw HTML, network fetch, model prompt, search, crawl, edit, publication, or placement action.

## Coverage gaps

- No source contents, licenses, publisher authority, search result, AI model output, ranking, or citation placement is independently verified.
- No authenticated deployed service exists for session, CSRF, concurrency, or rate-limit testing.
- This review is not a factual, legal, SEO-performance, or model-behavior assessment.

## Recommended next steps

Proceed for access-restricted internal use. Keep external monitoring and page publication as separately reviewed, evidence-backed capabilities if they are later authorized.
