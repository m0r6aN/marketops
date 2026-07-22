# Security Review — Capability 8 Email Campaign Builder

**Date:** 2026-07-22
**Reviewer:** `security-review` skill
**Depth:** Standard
**Mode:** Local passive source and provider-boundary review

## Executive summary

Capability 8 is a local planning and approval workspace. It stores no recipient email addresses or provider credentials and has no network, Mailchimp, mailbox, upload, send, schedule, or automation action. Server actions enforce initiative ownership for campaign, content, and brand-voice references; replace browser-supplied snapshots with canonical records; recompute claim findings; and preserve approved versions as immutable evidence.

No Critical, High, or Medium capability-specific finding was identified. MarketOps must remain access-restricted because its state-changing actions do not authenticate an operator. Readiness fields document an operator plan but cannot prove consent, suppression accuracy, legal compliance, sender authentication, deliverability, or provider state.

## Findings summary

| ID | Severity | Title | Locator | Framework |
|---|---|---|---|---|
| F-001 | Low | Internal-only actions lack operator authentication | `src/app/actions/email-campaigns.ts:10` | OWASP A01, CWE-862 |
| F-002 | Low | Readiness narratives cannot establish compliance | `src/lib/email-campaigns/service.ts:13` | CWE-693 |
| F-003 | Informational | Stored copy and audience strategy may be sensitive | `src/lib/email-campaigns/repository.ts:11` | OWASP A02, CWE-359 |
| F-004 | Informational | Provider side effects are deliberately absent | `src/app/initiatives/[slug]/email-campaigns/page.tsx:5` | OWASP API5 |

## Detailed findings

### F-001: Internal-only actions lack operator authentication
- **Severity:** Low
- **Confidence:** High
- **Evidence:** Server actions validate domain ownership and state but not an authenticated operator.
- **Impact:** Public exposure would permit unauthorized creation or modification of campaign plans.
- **Remediation:** Keep deployment access-restricted; add authenticated operator authorization before broader exposure or any provider adapter.

### F-002: Readiness narratives cannot establish compliance
- **Severity:** Low
- **Confidence:** High
- **Evidence:** Review validation requires consent basis, suppression, unsubscribe, sender-authentication, and address plans, but the repository cannot inspect recipient consent, provider suppression state, DNS, footer rendering, or jurisdiction.
- **Impact:** An operator could mistake an approved planning record for permission to send.
- **Remediation:** Preserve planning-only labels. A delivery capability must independently verify provider and recipient controls immediately before execution.

### F-003: Stored copy and audience strategy may be sensitive
- **Severity:** Informational
- **Confidence:** High
- **Evidence:** Sequence copy, targeting strategy, source snapshots, and sender plans persist in SQLite version history.
- **Impact:** Internal commercial information remains in local storage and approved history.
- **Remediation:** Protect database access and retention; avoid personal recipient data in audience descriptions.

### F-004: Provider side effects are deliberately absent
- **Severity:** Informational
- **Confidence:** High
- **Evidence:** GenSpark exposes list, member, campaign, send, schedule, and automation actions, but Capability 8 imports or invokes none of them.
- **Impact:** No current provider-spend, contact mutation, or accidental-send path exists.
- **Remediation:** Keep future create/send adapters separate, explicit, authenticated, rate-limited, and receipt-backed.

## Positive controls

- Same-initiative campaign, source content, and pinned brand voice are enforced server-side.
- Claim findings are recomputed from subject, preheader, body, and CTA before persistence.
- Bounded text, sequence count, order, delay, metrics, and reply-to validation.
- Immutable approved/superseded versions and explicit lifecycle evidence events.
- React text rendering only; no raw HTML, remote fetch, contact data, provider credentials, model prompt, send, or schedule path.

## Coverage gaps

- No authenticated deployed service exists for session, CSRF, concurrency, or rate-limit testing.
- No provider account, recipient list, DNS, rendered email, unsubscribe endpoint, or delivery telemetry is in scope.
- This review is not legal advice, deliverability testing, or a jurisdiction-specific anti-spam assessment.

## Recommended next steps

Proceed for access-restricted internal use. Require a separate security and privacy review before introducing contacts or any create/send provider adapter.
