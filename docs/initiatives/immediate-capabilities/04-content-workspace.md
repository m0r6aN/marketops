# Capability 4 — Draft Marketing Content / Write Engaging Content

## Classification

Mode: Repo-Local Parcel Mode  
Base: `e0b5a56` (Capability 3 merge)  
Branch: `feat/marketops-04-content-workspace`

## Goal

Give each initiative one source-backed workspace for drafting, AI-assisted generation, review, versioning, and approval of marketing content without publishing or distributing it.

## Product Contract

- Every content item and version belongs to exactly one initiative.
- Versions increase monotonically per content item.
- Draft and changes-requested versions are editable; approved and superseded versions are immutable.
- Approving a version atomically supersedes the prior approved version of the same item.
- Review requires title, channel, format, objective, audience, CTA, content, provenance, and an approved same-initiative brand voice.
- The server pins the brand-voice ID and rebuilds its deterministic snapshot; browser-supplied snapshots are not trusted.
- Campaign and Library references must belong to the same initiative and remain eligible.
- URLs are stored references only and are never fetched.
- Claim review combines initiative rules with the pinned brand-voice claim boundaries. Avoided or needs-proof literal matches block approval.
- Authorship is explicit: `operator-authored`, `ai-assisted`, or `ai-generated`.
- AI authorship requires a recorded successful generation run for the content item.
- Generation records provider, model, request summary, result, failure, and `succeeded`, `failed`, or `unavailable` outcome.
- Missing provider configuration records `unavailable`; MarketOps never simulates output.
- Source material is marked untrusted in the provider prompt and cannot authorize actions.
- Capability 4 never sends, schedules, publishes, emails, or posts content.

## Integration Surfaces

| Surface | Producer | Consumer | Failure behavior |
|---|---|---|---|
| Approved brand voice | Brand voice repository | Content version | Reject unapproved/cross-initiative version |
| Campaign context | Campaign repository | Content brief/source | Reject cross-initiative campaign |
| Source provenance | Eligible Library entries/operator references | Content prompt/review | Reject ineligible/cross-initiative records |
| Claim boundaries | Initiative + pinned voice | Claim review | Recompute server-side; block approval while findings remain |
| Generation provider | Explicit Anthropic adapter | Editable content version | Record failed/unavailable; never infer success |

## Parcel

### Allowed Files

- `docs/ROADMAP.md`
- `docs/initiatives/immediate-capabilities/04-content-workspace.md`
- `docs/initiatives/immediate-capabilities/04-content-workspace-security-review.md`
- `docs/initiatives/immediate-capabilities/STATUS.md`
- `src/lib/content-workspace/**`
- `src/app/actions/content-workspace.ts`
- `src/app/initiatives/[slug]/content/page.tsx`
- `src/app/initiatives/[slug]/page.tsx`
- `src/components/content-workspace.tsx`
- `src/components/content-workspace-summary-card.tsx`
- `tests/content-workspace.test.ts`
- `vitest.config.ts` (serialize shared SQLite integration tests)

### Forbidden / Out of Scope

- Publishing, sending, scheduling, social/email delivery, or provider execution outside drafting.
- Capability 5 persuasion scoring or psychological targeting.
- Authentication, multi-tenant, commercialization, or speculative governance infrastructure.
- URL retrieval, scraping, source-rights inference, or treating model output as approval.
- Changes to initiative, campaign, Library, or brand-voice contracts.

## Acceptance Checklist

- [x] Content items and versions persist with event evidence.
- [x] Approval/supersession and immutability are enforced.
- [x] Brand voice, campaign, and Library boundaries are validated server-side.
- [x] Source-backed operator drafting works without a provider.
- [x] Configured generation records honest outcomes and never publishes.
- [x] Claim findings are recomputed server-side and block unsafe approval.
- [x] Initiative route and summary integration exist.
- [x] Automated tests, typecheck, lint, production build, diff check, runtime smoke, dependency audit, and focused security review are required before PR.
- [ ] Draft PR opened and branch/head recorded in the coordinator ledger.

## Verification

`npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check`; isolated runtime HTTP/content smoke.

## Sequence Gate

Capability 5 remains blocked until Capability 4 is merged, rejected, or explicitly superseded.
