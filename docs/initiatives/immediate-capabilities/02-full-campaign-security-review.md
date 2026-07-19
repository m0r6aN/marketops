# Security Review — Capability 2 Full Marketing Campaign

**Date:** 2026-07-18

**Depth:** Standard, feature-focused

**Mode:** Local passive review

## Executive Summary

The lifecycle implementation fails closed at its most important product boundary: provider-ready campaigns cannot claim execution, manual completion or failure requires an evidence note, and Customer Finder candidate IDs are revalidated against the campaign initiative on every save. SQL statements are parameterized, text and list sizes are bounded, React escapes rendered content, and event details deliberately omit raw campaign and candidate text.

The feature is acceptable for the stated internal, single-operator posture. It is not ready for public or multi-user exposure because the current Next.js application has no authenticated actor or authorization check. Dependency scanning also found known development-server vulnerabilities in the existing Vitest/Vite toolchain and a moderate production dependency advisory through Next.js/PostCSS. No breaking forced dependency changes were made in this feature branch.

## Findings Summary

| ID | Severity | Title | Locator | Status |
|---|---|---|---|---|
| F-001 | Medium | State-changing lifecycle action has no authenticated actor | `src/app/actions/campaign-lifecycle.ts:13` | Accepted only for internal, access-restricted deployment |
| F-002 | High | Existing Vitest/Vite development toolchain contains known local-server vulnerabilities | `package.json:39` | Open; do not expose Vitest UI or Vite dev servers |
| F-003 | Moderate | Existing Next.js dependency includes vulnerable PostCSS range | `package.json:21` | Open; monitor for a non-breaking upstream resolution |

## Detailed Findings

### F-001: State-changing lifecycle action has no authenticated actor

- **Severity:** Medium
- **Confidence:** High
- **Locator:** `src/app/actions/campaign-lifecycle.ts:13-31`
- **Description:** The server action validates campaign type, initiative-scoped candidates, and input content, but the application has no session or authenticated operator identity to authorize or attribute the mutation.
- **Impact:** If this internal application is exposed to an untrusted network, an unauthenticated visitor could alter campaign lifecycle and execution-status records.
- **Remediation:** Keep the deployment access-restricted. Before public or multi-user exposure, introduce an authenticated operator boundary and campaign-level authorization, then add actor identity to lifecycle events.
- **Evidence:** Repository search found no Next.js auth middleware or session boundary; the action contains no actor check.
- **Framework mapping:** OWASP A01 Broken Access Control, CWE-862

### F-002: Existing Vitest/Vite development toolchain contains known local-server vulnerabilities

- **Severity:** High for an exposed development server; Low for the verified `vitest run` CI usage
- **Confidence:** High
- **Locator:** `package.json:39`, `package-lock.json`
- **Description:** `npm audit` reports five moderate, one high, and one critical development-tree vulnerability, including Vitest UI arbitrary file read/execution and Vite Windows path-handling disclosures. The suggested remediation is a major Vitest upgrade.
- **Impact:** A developer who exposes the affected Vitest UI or Vite development server to an untrusted network could expose local files or host credentials.
- **Remediation:** Do not expose development or Vitest UI servers. Upgrade Vitest/Vite on a dedicated dependency-remediation branch with the full test suite and Windows-specific verification.
- **Evidence:** `npm audit --json` reports GHSA-5xrq-8626-4rwp, GHSA-fx2h-pf6j-xcff, and related transitive advisories.
- **Framework mapping:** CWE-862, CWE-22, CWE-200

### F-003: Existing Next.js dependency includes vulnerable PostCSS range

- **Severity:** Moderate
- **Confidence:** High
- **Locator:** `package.json:21`, `package-lock.json`
- **Description:** Production-only audit reports two moderate findings through Next.js's transitive PostCSS version. The automated force-fix proposes an invalid breaking downgrade to an old Next.js release.
- **Impact:** Untrusted CSS serialized through the affected PostCSS path may create an XSS condition. This lifecycle feature does not accept or serialize CSS.
- **Remediation:** Do not apply the force downgrade. Monitor Next.js for a compatible patched dependency and avoid treating untrusted content as CSS input.
- **Evidence:** `npm audit --omit=dev` reports GHSA-qx2v-qp2m-jg93 through `next/node_modules/postcss`.
- **Framework mapping:** OWASP A03 Injection, CWE-79

## Positive Controls Verified

- Candidate selection is recalculated from the managed campaign's initiative before persistence.
- Missing, expired, or cross-initiative candidates fail closed and are visible for removal in the UI.
- Provider-ready mode cannot move beyond `not-started` without a future real adapter.
- Manual completion and failure require an operator evidence note.
- Text fields are trimmed and capped at 20,000 characters; list inputs are deduplicated and capped at 100 items.
- SQLite writes use prepared statements.
- Event detail stores changed field names and status metadata rather than raw free-form evidence.
- The feature exposes no network client, provider credential, outbound send, scheduling, or publication function.

## Coverage

Reviewed the capability's server action, validation service, repository and schema changes, client rendering, candidate boundary, event trail, tests, and dependency audit results.

## Coverage Gaps

- No live deployment, reverse proxy, network ACL, or hosting configuration was available for inspection.
- No authentication implementation exists to test.
- No browser penetration testing or aggressive fuzzing was performed.
- The audit did not review unrelated legacy .NET execution surfaces.

## Release Gate

Capability 2 may merge for internal, access-restricted use. Public or multi-user exposure remains blocked until F-001 is resolved. Development servers and Vitest UI must remain local-only while F-002 is open.
