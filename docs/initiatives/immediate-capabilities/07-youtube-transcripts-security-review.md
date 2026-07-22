# Security Review — Capability 7 YouTube Transcripts

**Date:** 2026-07-22
**Reviewer:** `security-review` skill
**Depth:** Standard
**Mode:** Local passive source and provider-contract review

## Executive summary

Capability 7 sends a strictly validated YouTube video ID to a fixed server-side GenSpark CLI operation and persists immutable transcript outcomes. It does not fetch arbitrary URLs, download media, expose provider credentials to the browser, execute transcript content, or treat provider output as authorization. Provider errors and empty responses fail closed and are stored without claiming transcript success.

No Critical, High, or Medium capability-specific finding was identified. The principal constraints are external provider availability and source rights. MarketOps must remain access-restricted because state-changing actions still lack authenticated operator identity and rate limiting.

## Findings summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Low | Internal-only action has no operator authentication or rate limit | `src/app/actions/youtube-transcripts.ts:10` | OWASP A01 / API4, CWE-862 |
| F-002 | Low | Windows CLI execution crosses a local shell boundary | `src/lib/youtube-transcripts/provider.ts:47` | OWASP A03, CWE-78 |
| F-003 | Informational | Transcript snapshots may contain copyrighted or personal data | `src/lib/youtube-transcripts/repository.ts:13` | OWASP A02, CWE-359 |
| F-004 | Informational | Provider, credits, captions, and platform terms are external constraints | `src/lib/youtube-transcripts/provider.ts:39` | CWE-693 |

## Detailed findings

### F-001: Internal-only action has no operator authentication or rate limit
- **Severity:** Low
- **Confidence:** High
- **Evidence:** The action validates initiative and request fields but not user identity; each accepted call can consume provider credits.
- **Impact:** Public exposure could permit unauthorized spend or data retention.
- **Remediation:** Keep the deployment access-restricted. Add authenticated operator authorization and per-operator throttling before broader exposure.

### F-002: Windows CLI execution crosses a local shell boundary
- **Severity:** Low
- **Confidence:** High
- **Evidence:** Windows requires shell resolution for the `.cmd` shim. The executable and subcommand are server-controlled, while the only user-derived argument is reduced to `[A-Za-z0-9_-]{11}` before execution.
- **Impact:** Current injection exposure is constrained; a malicious trusted environment override could select a different executable.
- **Remediation:** Restrict deployment environment control, retain strict video-ID validation, never add unvalidated CLI arguments, and prefer a supported direct API or native executable if one becomes available.

### F-003: Transcript snapshots may contain protected data
- **Severity:** Informational
- **Confidence:** High
- **Evidence:** Transcript text and source metadata are intentionally retained in SQLite with provenance and a hash.
- **Impact:** Copyrighted, confidential, or personal content may persist in internal records.
- **Remediation:** Fetch only authorized sources, apply internal storage/retention controls, and honor deletion or licensing obligations.

### F-004: External service and platform constraints
- **Severity:** Informational
- **Confidence:** High
- **Evidence:** The live CLI returned `Insufficient credits`; some videos lack captions or disallow access.
- **Impact:** Retrieval can be unavailable independently of repository correctness.
- **Remediation:** Preserve honest outcome states and do not bypass platform or rights restrictions.

## Positive controls

- Strict host/video-ID normalization before execution; no arbitrary URL fetch or SSRF path.
- Fixed CLI operation, bounded 120-second runtime, 8 MiB output cap, and 1,000-character stored errors.
- Explicit rights acknowledgement and intended-use record.
- Immutable attempts, SHA-256 transcript hashes, prepared SQLite statements, and inert React text rendering.
- Provider error, invalid JSON, error envelope, and empty success all fail closed.

## Coverage gaps

- GenSpark transcript success output could not be observed because the account has insufficient credits; parser tests cover documented envelope variants.
- No authenticated deployed service exists for session, CSRF, concurrency, or rate-limit testing.
- This review is not legal advice or a YouTube terms/copyright determination.

## Recommended next steps

Proceed for access-restricted internal use. Re-run the live provider smoke after credits are available, and add authentication plus throttling before any broader deployment.
