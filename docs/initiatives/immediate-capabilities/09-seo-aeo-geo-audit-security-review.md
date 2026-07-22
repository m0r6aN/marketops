# Security Review — Capability 9 SEO / AEO / GEO Audit

**Date:** 2026-07-22
**Reviewer:** `security-review` skill
**Depth:** Standard
**Mode:** Local passive source and provider-boundary review

## Executive summary

Capability 9 sends a strictly normalized public URL to a fixed GenSpark raw-crawl command or analyzes operator-supplied HTML locally. It rejects local/internal hosts, IP literals, credentials, query strings, and shell-unsafe characters; bounds provider runtime/output and manual input; stores immutable hashes and outcomes; and never renders or executes evidence HTML.

No Critical, High, or Medium capability-specific finding was identified. The principal residual risks are unauthorized provider spend if the internal application is exposed publicly, reliance on GenSpark redirect/DNS protections, retention of potentially sensitive HTML, and misuse of deterministic heuristics as external ranking or citation evidence.

## Findings summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Low | Internal-only crawl action lacks operator authentication and rate limiting | `src/app/actions/discoverability-audits.ts:2` | OWASP A01 / API4, CWE-862 |
| F-002 | Low | Windows CLI invocation crosses a constrained shell boundary | `src/lib/discoverability-audits/provider.ts:3` | OWASP A03, CWE-78 |
| F-003 | Low | Manual HTML can consume local storage and analysis time | `src/lib/discoverability-audits/service.ts:2` | OWASP API4, CWE-400 |
| F-004 | Informational | Heuristic coverage is not external search or citation evidence | `src/lib/discoverability-audits/service.ts:7` | CWE-693 |

## Detailed findings

### F-001: Internal-only crawl action lacks operator authentication and rate limiting
- **Severity:** Low
- **Confidence:** High
- **Evidence:** The action validates the initiative and URL but not user identity; a GenSpark crawl can consume credits.
- **Impact:** Public exposure could permit unauthorized spend or evidence retention.
- **Remediation:** Keep deployment access-restricted. Add authenticated operator authorization, quotas, and rate limits before broader exposure.

### F-002: Windows CLI invocation crosses a constrained shell boundary
- **Severity:** Low
- **Confidence:** High
- **Evidence:** Windows resolves the trusted `.cmd` shim through a shell. User input is reduced to a URL character allowlist with no credentials, query, IP literal, percent escapes, or command metacharacters before execution.
- **Impact:** Current command injection exposure is constrained; trusted environment overrides or later relaxed validation could reopen risk.
- **Remediation:** Keep executable configuration trusted and URL validation fail-closed. Prefer a direct authenticated API or native executable when available.

### F-003: Manual HTML can consume local resources
- **Severity:** Low
- **Confidence:** High
- **Evidence:** Manual snapshots are capped at 1,000,000 characters and stored immutably; repeated internal calls have no per-user quota.
- **Impact:** An exposed deployment could accumulate database content or consume CPU through repeated analysis.
- **Remediation:** Retain the cap and internal restriction; add quotas, retention, and rate limits with authentication.

### F-004: Heuristic coverage is not external evidence
- **Severity:** Informational
- **Confidence:** High
- **Evidence:** Coverage is derived from deterministic source checks and explicitly labeled in the UI.
- **Impact:** Operators could over-interpret percentages as ranking, traffic, answer placement, or citation probability.
- **Remediation:** Preserve heuristic labels and require separate measured search and analytics evidence for outcome claims.

## Positive controls

- Strict URL scheme, host, credential, query, IP-literal, internal-suffix, port, and character validation.
- Fixed CLI command, 120-second timeout, 2 MiB output cap, no automatic render-JS, and bounded stored errors.
- Manual HTML cap, immutable snapshots, SHA-256 hashes, prepared SQLite statements, and honest outcome states.
- HTML remains inert: no raw HTML rendering, script execution, browser navigation, prompt injection path, or automated page modification.

## Coverage gaps

- GenSpark success and redirect behavior could not be observed because the account has insufficient credits.
- The repository cannot enforce GenSpark-side DNS resolution, redirect allowlists, robots compliance, or third-party page authorization.
- No authenticated deployed service exists for session, CSRF, concurrency, or rate-limit testing.
- This review is not a penetration test, SEO performance validation, or legal/terms assessment.

## Recommended next steps

Proceed for access-restricted internal use. Re-run the live provider-success smoke after credits are available and require a direct provider/redirect control review before broader deployment.
