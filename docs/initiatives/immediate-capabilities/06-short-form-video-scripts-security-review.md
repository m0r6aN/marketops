# Security Review — Capability 6 Short-Form Video Scripts

**Date:** 2026-07-22
**Reviewer:** `security-review` skill
**Depth:** Standard
**Mode:** Local passive source, runtime, and dependency review

## Executive Summary

Capability 6 converts an immutable approved or superseded content version into a structured local script plan. It has no model/provider call, URL fetch, media upload, renderer, identity or voice synthesis, or publishing authority. Server actions replace browser-supplied source and brand-voice snapshots with canonical records, recompute claim findings, validate same-initiative references and contiguous timing, and preserve approved versions as immutable evidence.

No new Critical, High, or Medium capability-specific application finding was identified. MarketOps remains restricted to internal access because state-changing actions have no authenticated operator. Script and visual-direction fields are planning artifacts: they cannot establish media rights, accessibility conformance, factual sufficiency, platform policy compliance, or production feasibility.

## Findings Summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Informational | Internal access restriction remains mandatory | `src/app/actions/video-scripts.ts:20` | OWASP A01, CWE-862 |
| F-002 | Low | Production-plan text does not establish media rights or accessibility | `src/lib/video-scripts/service.ts:102` | CWE-693 |
| F-003 | Informational | Source and script snapshots inherit operator data sensitivity | `src/lib/video-scripts/repository.ts:18` | OWASP A02 |
| F-004 | Informational | Existing dependency advisories are unchanged | `package-lock.json` | OWASP A06, CWE-1104 |

## Detailed Findings

### F-001: Internal access restriction remains mandatory

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `src/app/actions/video-scripts.ts:20`
- **Evidence:** Server actions enforce domain ownership and state but do not identify an authenticated operator.
- **Impact:** Public exposure would permit unauthorized script and version changes.
- **Remediation:** Keep deployment access-restricted until separately scoped authentication and authorization exist.
- **Framework mapping:** OWASP A01, CWE-862.

### F-002: Production-plan text does not establish rights or accessibility

- **Severity:** Low
- **Confidence:** High
- **Locator:** `src/lib/video-scripts/service.ts:102`, `src/components/video-script-workspace.tsx`
- **Evidence:** Deterministic visual directions explicitly require rights-cleared visuals, but the repository cannot inspect future assets, licenses, captions, flashing content, audio levels, or platform-specific rules.
- **Impact:** An operator could treat a reviewed script as authorization to use media or as proof of accessibility or platform compliance.
- **Remediation:** Preserve the planning-only label and require asset-rights, accessibility, and platform-policy checks in any later production capability.
- **Framework mapping:** CWE-693.

### F-003: Stored snapshots inherit source sensitivity

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `src/lib/video-scripts/repository.ts:18`
- **Evidence:** Source body, provenance, brand voice, narration, captions, and evidence notes are intentionally persisted locally; no external transmission exists.
- **Impact:** Confidential or personal source content would remain in version history.
- **Remediation:** Use authorized marketing material and protect database access and retention consistently with the internal deployment.
- **Framework mapping:** OWASP A02.

### F-004: Existing dependency advisories

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `package-lock.json`
- **Evidence:** Capability 6 adds no dependency. `npm audit --omit=dev` reports three high and four moderate existing advisories; forced fixes propose breaking Next.js and shadcn downgrades.
- **Impact:** Reachability varies and is not introduced by this parcel.
- **Remediation:** Track compatible upstream fixes; do not force breaking downgrades.
- **Framework mapping:** OWASP A06, CWE-1104.

## Positive Controls

- Canonical server-derived source, provenance, brand-voice snapshot, and claim findings.
- Immutable approved/superseded source requirement and immutable approved script versions.
- Same-initiative content, campaign, and brand-voice validation.
- Bounded text, scene count, duration, ordered contiguous timing, and complete-scene review checks.
- Prepared SQLite statements and explicit creation, update, status, and supersession events.
- React text rendering only; no raw HTML, fetch, upload, model prompt, rendering, send, or publish path.

## Coverage

Reviewed the parcel contract, domain validation, persistence, server actions, UI rendering, tests, and media/provider boundaries.

## Coverage Gaps

- No authenticated deployed service exists for session, CSRF, rate-limit, or header testing.
- No real media asset, encoder, platform API, or accessibility audit is in scope.
- This is not a penetration test or legal/media-rights review.

## Recommended Next Steps

Proceed for access-restricted internal use. Preserve the planning-only boundary and require explicit security, privacy, rights, accessibility, and provider review before any later media-generation or publishing capability.
