# Security Review — Brand Voice Guidelines

**Date:** 2026-07-19  
**Reviewer:** `security-review` skill  
**Depth:** Standard  
**Mode:** Local, passive source and dependency review

## Executive summary

Capability 3 preserves the repository's internal-only posture and adds no external provider or network execution. Brand voice inputs are normalized and length-bounded on the server, database writes use prepared statements, source records are constrained to the active initiative, campaign pins are accepted only for approved or superseded versions from the same initiative, and the server rebuilds the campaign snapshot instead of trusting browser-supplied guideline text. Operator-supplied URLs are stored as references and are never fetched, which avoids an SSRF boundary.

No new Critical, High, or Medium application finding was identified in the capability-specific implementation. The existing lack of authentication and authorization remains a release boundary: this application is appropriate only behind access-restricted internal controls. Production dependency scanning reports two moderate PostCSS advisories through Next.js; npm offers only a breaking and invalid downgrade path, so no forced automated change was applied.

## Findings summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Informational | Internal access restriction remains mandatory | Application-wide server actions | OWASP A01 / CWE-862 |
| F-002 | Informational | External references do not establish usage rights | `src/lib/brand-voice/service.ts` | Operational boundary |
| F-003 | Informational | Transitive PostCSS advisories have no safe automated fix | `package-lock.json` | OWASP A06 / CWE-1104 |

## Detailed findings

### F-001: Internal access restriction remains mandatory

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `src/app/actions/brand-voice.ts`, `src/app/actions/campaign-lifecycle.ts`
- **Description:** Server actions validate initiative and record state but the current product has no authenticated operator identity or authorization layer.
- **Evidence:** Capability actions contain domain validation but no authenticated principal lookup. The repository explicitly describes the runtime as internal and single-operator.
- **Impact:** Publishing the application directly to untrusted users would permit unauthorized state changes.
- **Remediation:** Keep the deployment access-restricted. Add identity and authorization only when a concrete deployment or commercialization workflow requires it.
- **Framework mapping:** OWASP A01:2021, CWE-862

### F-002: External references do not establish usage rights

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `src/lib/brand-voice/service.ts` URL source validation
- **Description:** HTTP and HTTPS references are validated syntactically and persisted as provenance. MarketOps does not fetch, import, or inspect the referenced content.
- **Evidence:** No network client is present in the capability implementation; the server validates only URL syntax and protocol.
- **Impact:** Operators remain responsible for confirming permission, accuracy, and suitability of referenced material.
- **Remediation:** Preserve the provenance note and operator review. If retrieval is added later, threat-model SSRF, redirects, content limits, prompt injection, malware, and rights handling first.
- **Framework mapping:** Operational boundary

### F-003: Transitive PostCSS advisories have no safe automated fix

- **Severity:** Informational
- **Confidence:** High
- **Locator:** `package-lock.json` via the installed Next.js dependency tree
- **Description:** `npm audit --omit=dev` reports two moderate instances of GHSA-qx2v-qp2m-jg93. npm's suggested forced resolution would install an incompatible Next.js 9 release.
- **Evidence:** Local production-dependency audit on 2026-07-19 reported two moderate vulnerabilities and a breaking forced fix path.
- **Impact:** The advisory concerns PostCSS stringification. This capability does not accept or compile operator-supplied CSS, reducing its direct reachability here.
- **Remediation:** Track an upstream-compatible Next.js/PostCSS resolution; do not apply `npm audit fix --force` without a deliberate framework migration and regression review.
- **Framework mapping:** OWASP A06:2021, CWE-1104

## Positive controls verified

- Server-side normalization, maximum text lengths, list limits, enums, and approval completeness checks.
- Initiative ownership validation for canon, library sources, guideline versions, and campaign pins.
- Prepared SQLite statements and atomic approval/supersession behavior.
- Approved and superseded versions are immutable.
- Campaign snapshot text is regenerated server-side from the pinned record.
- Audit events store changed-field metadata rather than duplicate raw guideline content.
- React renders stored content as text; no raw HTML rendering was introduced.
- No external send, publish, provider, AI, or URL-fetching behavior was added.

## Coverage

Reviewed capability source, server actions, SQLite schema and migration, campaign integration, UI rendering paths, tests, and production dependency audit.

## Coverage gaps

- No authenticated production deployment exists to test authorization, CSRF/session controls, headers, or rate limiting.
- No active external-service testing was performed because capability 3 adds no external service.
- Dependency review was limited to npm's advisory data and local dependency resolution; it was not a full software-composition audit.

## Recommended next steps

1. Keep MarketOps behind an access-restricted internal boundary.
2. Review and approve brand voice records before campaign use; do not treat source references as proof of rights or accuracy.
3. Reassess URL retrieval security before adding any automated import capability.
4. Track a compatible upstream dependency update for the PostCSS advisory.
