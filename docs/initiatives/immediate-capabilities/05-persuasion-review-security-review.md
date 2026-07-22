# Security Review — Capability 5 Persuasion Review

**Date:** 2026-07-22
**Reviewer:** `security-review` skill
**Depth:** Standard
**Mode:** Local passive source, runtime, and dependency review

## Executive Summary

Capability 5 performs a deterministic, initiative-scoped review over persisted content. It does not call a model, fetch URLs, publish content, or acquire delivery authority. The server rebuilds claim findings, verifies the pinned brand-voice snapshot, rejects cross-initiative and stale review application, blocks known manipulation and discriminatory patterns, and creates a new draft instead of mutating approved content. Review creation and every revision attempt leave persisted evidence.

No new Critical, High, or Medium capability-specific application finding was identified. MarketOps still requires access-restricted internal deployment because the application has no authenticated operator principal. The pattern-based persuasion checks are conservative guardrails, not a semantic guarantee; operator review remains required. The production dependency audit reproduced seven existing advisories (three high, four moderate), and the suggested forced fixes are breaking framework/tool downgrades. Capability 5 adds no dependency.

## Findings Summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Informational | Internal access restriction remains mandatory | `src/app/actions/persuasion-review.ts:67` | OWASP A01, CWE-862 |
| F-002 | Low | Heuristic tactic detection cannot prove ethical or factual completeness | `src/lib/persuasion-review/service.ts:16` | CWE-693 |
| F-003 | Informational | Content snapshots may contain operator-supplied sensitive material | `src/lib/persuasion-review/repository.ts:138` | OWASP A02 |
| F-004 | Informational | Existing dependency advisories lack a safe automated resolution | `package-lock.json` | OWASP A06, CWE-1104 |

## Detailed Findings

### F-001: Internal access restriction remains mandatory

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `src/app/actions/persuasion-review.ts:67`
- **Description:** State-changing server actions validate domain ownership and state but do not identify an authenticated operator.
- **Evidence:** Both review creation and revision creation accept record identifiers without an application identity or authorization check.
- **Impact:** Public exposure would permit unauthorized review records and draft creation.
- **Remediation:** Keep deployment access-restricted until a separately scoped identity and authorization capability exists.
- **Framework mapping:** OWASP A01, CWE-862.

### F-002: Heuristic tactic detection cannot prove ethical or factual completeness

- **Severity:** Low
- **Confidence:** High
- **Locator:** `src/lib/persuasion-review/service.ts:16`, `src/lib/persuasion-review/service.ts:87`
- **Description:** Explicit phrases and saved claim boundaries are blocked, but paraphrases and novel unsupported claims can require operator judgment.
- **Evidence:** The review uses deterministic regular expressions plus server-recomputed initiative and brand-voice claim findings. It never represents this result as publication approval.
- **Impact:** An operator could overlook manipulative or unsupported language not covered by the saved rules.
- **Remediation:** Preserve human review and no-publish boundaries. Expand tested rules when real examples appear; do not market the heuristic as exhaustive classification.
- **Framework mapping:** CWE-693.

### F-003: Stored content remains an operator data-handling responsibility

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `src/lib/persuasion-review/repository.ts:138`
- **Description:** Review snapshots intentionally persist the body, provenance, audience, brand voice, claim findings, and recommendations in the local application database.
- **Evidence:** No network or provider path exists, but stored records inherit the sensitivity of operator-supplied content.
- **Impact:** Inappropriate input could place confidential or personal material into local persisted history.
- **Remediation:** Use authorized marketing material and protect database access and retention consistently with the internal deployment.
- **Framework mapping:** OWASP A02.

### F-004: Existing dependency advisories

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `package-lock.json`
- **Description:** `npm audit --omit=dev` reports three high and four moderate advisories through existing Hono, fast-uri, PostCSS, and sharp paths.
- **Evidence:** Forced remediation proposes breaking shadcn and Next.js downgrades. Capability 5 adds no package or dependency change.
- **Impact:** Reachability varies and is not introduced by the persuasion review surface.
- **Remediation:** Track compatible upstream fixes and reassess reachability; do not apply forced breaking downgrades.
- **Framework mapping:** OWASP A06, CWE-1104.

## Positive Controls

- Server-derived brand-voice snapshot and claim findings.
- Same-initiative source, voice, campaign, and Library checks before revision persistence.
- Source `updatedAt` pin blocks stale review application.
- Known deceptive, fabricated, coercive, sensitive-trait, discriminatory, and unsupported-claim flags block revision creation.
- Approved and superseded content remains immutable; safe application creates a draft version.
- Prepared SQLite statements, transactional evidence events, and explicit succeeded/failed apply runs.
- React text rendering only; no raw HTML, URL fetch, provider prompt, tool call, send, or publish path.

## Coverage

Reviewed the capability parcel, server actions, review and apply flow, persistence, UI rendering, tests, production build, local runtime route, and production dependency audit.

## Coverage Gaps

- No authenticated production deployment exists for auth, CSRF/session, rate-limit, or security-header testing.
- Pattern-based detection is not a linguistic or legal compliance certification.
- No active penetration test or complete software-composition reachability analysis was performed.

## Recommended Next Steps

Proceed with internal review under access restriction. Keep operator approval and the no-publish boundary explicit. Revisit rules using observed false positives and false negatives before any commercialization or automated execution scope.
