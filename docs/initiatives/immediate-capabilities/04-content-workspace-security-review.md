# Security Review — Capability 4 Content Workspace

**Date:** 2026-07-22  
**Reviewer:** `security-review` skill  
**Depth:** Standard  
**Mode:** Local passive source and dependency review

## Executive Summary

Capability 4 adds an optional external-model boundary. The server constrains initiative ownership, approved brand voice, campaign and Library references, input sizes, state transitions, and approval completeness. Provider input labels source material as untrusted, provider output is treated only as editable draft text, and no tool or publishing authority is exposed. Missing configuration and provider errors are persisted honestly. No secrets are stored in application data or event details.

No new Critical, High, or Medium capability-specific application finding was identified. The existing application-wide lack of authentication remains an internal-deployment constraint. Production dependency audit reports seven existing advisories (three high, four moderate); npm's forced remediation proposes breaking framework/tool downgrades, so it was not applied.

## Findings

| ID | Severity | Title | Locator | Remediation |
|---|---|---|---|---|
| F-001 | Informational | Internal access restriction remains mandatory | `src/app/actions/content-workspace.ts` | Keep deployment access-restricted until identity and authorization exist |
| F-002 | Low | Indirect prompt injection remains a content-integrity risk | `src/lib/content-workspace/provider.ts`, `service.ts` | Preserve untrusted-source delimiters, human review, no tools/side effects, and claim checks |
| F-003 | Informational | Referenced content and generated output require operator rights/privacy review | Content workspace | Do not submit confidential, personal, or unlicensed material without permission |
| F-004 | Informational | Existing dependency advisories lack a safe automated resolution | `package-lock.json` | Track compatible upstream fixes; avoid `npm audit fix --force` |

### F-001: Internal access restriction remains mandatory

- **Confidence:** High
- **Evidence:** State-changing server actions have domain validation but no authenticated operator principal.
- **Impact:** Public exposure would allow unauthorized content and provider requests.
- **Framework:** OWASP A01, CWE-862.

### F-002: Indirect prompt injection remains a content-integrity risk

- **Confidence:** High
- **Evidence:** Eligible Library content can reach the model prompt. It is delimited and identified as untrusted; the model has no tools, authorization role, or external side effects. Output remains an editable draft requiring review.
- **Impact:** Malicious source text could influence draft wording despite instructions.
- **Remediation:** Keep sources reviewable, never give this generator tools, recompute claim findings, and require human approval. Add stronger content sanitization/evaluation if untrusted ingestion broadens.
- **Framework:** OWASP LLM01.

### F-003: Rights and privacy remain operator responsibilities

- **Confidence:** High
- **Evidence:** URLs are not fetched and MarketOps cannot determine ownership, confidentiality, or consent.
- **Impact:** Operators could intentionally submit inappropriate source material to a configured provider.
- **Remediation:** Use only authorized, non-sensitive source material under applicable provider terms.

### F-004: Existing dependency advisories

- **Confidence:** High
- **Evidence:** `npm audit --omit=dev` reported Hono, fast-uri, PostCSS, and sharp advisory paths. Forced fixes include breaking/incompatible package changes.
- **Impact:** Reachability varies; Capability 4 does not introduce these packages or accept CSS/image processing inputs.
- **Remediation:** Track compatible updates and reassess reachability; do not force a downgrade.
- **Framework:** OWASP A06, CWE-1104.

## Positive Controls

- Prepared SQLite statements and transactional approval/supersession.
- Server-derived brand-voice snapshot and claim findings.
- Same-initiative reference checks and bounded inputs/lists.
- Approved/superseded immutability.
- No URL fetch, raw HTML rendering, publishing, sending, or model tool calls.
- Provider key is read from environment and never persisted or logged.
- Generation failures and unavailable configuration are explicit evidence states.

## Coverage Gaps

- No authenticated production deployment exists for auth, CSRF/session, rate-limit, or header testing.
- No real provider call was required; missing-key and provider-error behavior are covered by code paths, while live provider terms and retention remain external constraints.
- This was not a complete software-composition or penetration test.

## Recommendation

Proceed with internal review under access restriction. Keep Capability 5 blocked and perform a new threat review before adding automated publication, richer retrieval, or tool-enabled generation.
