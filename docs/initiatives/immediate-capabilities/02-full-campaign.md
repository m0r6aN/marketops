# Capability 2 — Full Marketing Campaign

## Status

Implementation branch: `feat/marketops-02-full-campaign`

Capability 1 closed through merged PR #3. This capability starts from merge commit `c7f35215f9b89ab823b8b4519c8e1fff68c0d8f2` and extends the canonical managed-campaign model.

## Goal

Give an internal MarketOps operator one persistent workspace for the complete campaign loop: brief, offer, audience, assets, channel and outreach planning, review, honest execution status, measurement, and optimization.

## Product Contract

- A lifecycle belongs to exactly one existing managed campaign.
- The campaign's initiative remains the authority for Customer Finder candidate selection.
- Selected candidates must be verified candidates from discovery campaigns in that same initiative.
- A lifecycle may be saved incrementally; incomplete phases remain visible rather than being treated as errors.
- Review status and execution status are separate.
- `manual` execution status is an operator-authored record and requires an evidence note when marked completed or failed.
- `provider-ready` is a planning posture only. Until a real adapter is configured, it cannot be marked in progress, completed, or failed.
- Saving a lifecycle never sends, publishes, schedules, or modifies an external provider.
- Lifecycle and execution-status changes create a reviewable event trail.

## Lifecycle Phases

1. Brief and offer
2. Audience and verified candidate selection
3. Asset plan and working brand-voice constraints
4. Channel and outreach plan
5. Review readiness
6. Execution record
7. Measurement
8. Optimization and next iteration

## Integration Surfaces

| Surface | Producer | Consumer | Contract | Failure behavior |
|---|---|---|---|---|
| Managed campaign to lifecycle | Campaign repository | Lifecycle workspace | Existing managed campaign ID | Reject missing or discovery-only campaigns |
| Customer Finder to audience plan | Verified candidate repository | Lifecycle workspace | Candidate ID scoped to initiative | Reject unavailable or cross-initiative IDs |
| Operator execution record | Lifecycle form | Event trail | Mode, status, evidence note | Provider-ready status cannot claim execution |

## Security and Data Posture

- Inputs are length-bounded and normalized on the server.
- Candidate IDs are checked against the managed campaign's initiative before persistence.
- Event details contain changed field names and status metadata, not raw campaign copy or candidate evidence.
- No credentials, provider tokens, outbound payloads, or message delivery are part of this capability.
- The current internal product remains single-operator; authentication and multi-tenant claims are out of scope.

## Required Verification

- Lifecycle persistence and event-trail tests.
- Provider-ready false-execution rejection test.
- Manual execution evidence requirement test.
- Cross-initiative candidate rejection test.
- Lifecycle progress computation test.
- Full `npm test`, typecheck, lint, production build, and diff check.

## Deferred Deliberately

- Reusable brand voice guidelines are capability 3.
- Content generation and asset versioning are capability 4.
- Provider adapters and autonomous execution are not included.
- Analytics-provider ingestion is not included; outcomes are operator-recorded.
