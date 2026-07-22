# Parcel: capability-08-email-campaign-builder

## Goal

Build initiative-scoped, source-backed email marketing sequences with audience, sender, compliance-readiness, copy, CTA, approval, and measurement planning before any provider delivery integration.

## Branch and dependency

- Branch: `feat/marketops-08-email-campaign-builder`
- Base: Capability 7 merge commit `708ca9a`
- Capability 7 merged through PR #9.

## Contract

- Start from an approved or superseded content version, its pinned brand voice, and a managed campaign in the same initiative.
- Deterministically seed three editable emails with order, delay, purpose, subject, preheader, body, CTA, immutable source snapshot, provenance, brand-voice snapshot, and server-derived claim findings.
- Permit 1-12 ordered steps. The first begins at day zero; delays are bounded to 0-90 whole days.
- Record campaign objective, audience segment, sender name, reply-to, consent or relationship basis, suppression plan, unsubscribe plan, sender-authentication plan, physical-address plan, primary/secondary metrics, and attribution window.
- Review-ready and approved versions require complete sender, readiness, source, copy, CTA, brand-voice, and measurement fields.
- Approval is blocked by unresolved avoided or needs-proof claim findings.
- Approved and superseded versions are immutable; revisions create a new draft and approval supersedes the prior approved version.
- Evidence events record creation, edits, status changes, and supersession only.

## Explicit non-authority

- Capability 8 does not create a Mailchimp campaign, access a list, upload contacts, alter subscribers, send, schedule, start an automation, or claim delivery.
- Email copy and readiness plans are operator-reviewed planning artifacts, not proof of legal compliance, consent, inbox placement, sender authentication, rendering, or accessibility.

## GenSpark boundary evidence

GenSpark CLI 1.4.0 exposes separate Mailchimp actions for list discovery, campaign creation, member changes, tags, send/schedule, and automation control. `create_campaign` requires a list ID, subject, sender name, and reply-to; `send_campaign` is a distinct side-effecting action. Capability 8 invokes none of them. This separation leaves a clean future provider adapter without giving the builder delivery authority.

## Acceptance criteria

- Operators can seed, edit, add/remove steps, version, review, and approve an email sequence from the initiative route.
- Server actions replace browser-supplied campaign/source/brand snapshots with canonical same-initiative records and recompute claims.
- The initiative summary exposes campaign and approval counts.
- Tests cover seeding, ownership, ordering, delay bounds, readiness, claim blocking, immutability, supersession, and evidence.
- Test, typecheck, lint, Webpack build, dependency audit, diff check, runtime smoke, and focused security review pass.

## External constraints

- Any later delivery feature must verify provider account ownership, sender authentication, consent or other lawful basis, suppression lists, unsubscribe operation, physical-address requirements, privacy rules, rate limits, and jurisdiction-specific anti-spam obligations.
- Provider acceptance does not establish inbox delivery, legal compliance, consent, or attribution accuracy.

## Acceptance evidence

| Check | Result |
|---|---|
| Test suite | 43 passed across 8 files, including 5 capability-specific tests |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed with Next.js 16.2.6 and Webpack; email-campaign route included |
| Runtime smoke | HTTP 200 and expected `Email Campaigns` content on isolated port 4339 |
| GenSpark boundary | CLI 1.4.0 Mailchimp create/send contracts inspected; no side-effecting action invoked |
| Dependency audit | Existing 3 high / 4 moderate advisories; no dependency added; forced fixes are breaking |
| Security review | No new Critical, High, or Medium capability-specific finding |
| Diff check | Passed |

## Sequence gate

Capability 9 remains blocked until Capability 8 is merged, rejected, or explicitly superseded.
