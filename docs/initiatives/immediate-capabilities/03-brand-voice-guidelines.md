# Capability 3 — Brand Voice Guidelines

## Initiative Classification

Mode: Repo-Local Parcel Mode

Reason: The capability is contained in the MarketOps Next.js application but crosses initiative canon, Library provenance, campaign lifecycle persistence, and future content-generation contracts.

Base commit: `0f8e92fea7126fda2cf3cddfab6409445e5f3958`

Branch: `feat/marketops-03-brand-voice`

## Goal

Give every initiative a reusable, source-backed brand voice contract with explicit version and approval state, then let managed campaigns pin an approved version without losing the historical snapshot used for that campaign.

## Product Contract

- A brand voice version belongs to exactly one initiative.
- Version numbers increase monotonically within an initiative.
- Draft and changes-requested versions may be edited.
- Review-ready versions may return to draft, receive changes requests, or be approved.
- Approved and superseded versions are immutable.
- Approving a version supersedes any previously approved version for that initiative in the same transaction.
- Review-ready and approved versions require source provenance, audience, positioning, tone guidance, allowed and discouraged language, claim boundaries, examples, counterexamples, and channel variations.
- A source reference records its type, label, reference, and evidence note.
- Library-entry sources must exist inside the same initiative and remain eligible for use.
- URL sources are references only; MarketOps does not fetch, scrape, or infer rights from them.
- Campaigns may pin an approved version. MarketOps persists both the version ID and a deterministic text snapshot so later changes cannot silently rewrite campaign history.
- Content generation is capability 4. Capability 3 only provides a stable context contract that later generators can consume.

## Core Types

- `BrandVoiceGuidelineRecord`: one versioned initiative voice contract.
- `BrandVoiceSourceReference`: source type, label, reference, and evidence note.
- `BrandVoiceToneAttribute`: named tone with operational guidance.
- `BrandVoiceClaimBoundary`: allowed, avoid, or needs-proof handling plus rationale.
- `BrandVoiceExamplePair`: channel-specific example and counterexample with explanation.
- `BrandVoiceChannelVariation`: channel, audience context, voice guidance, and CTA style.
- `BrandVoiceContext`: deterministic, source-indexed text for campaign and future drafting consumers.

## Integration Surfaces

| Surface | Producer | Consumer | Contract | Failure behavior |
|---|---|---|---|---|
| Initiative canon to draft | Initiative repository | Brand voice service | Current initiative narrative, audiences, tone, and claim rules | Reject missing or inactive initiative |
| Library to source provenance | Eligible initiative entries | Brand voice validator | Same-initiative library entry ID | Reject missing, rejected, archived, or cross-initiative entries |
| Approved voice to campaign | Brand voice repository | Campaign lifecycle | Approved version ID and deterministic context snapshot | Reject unapproved or cross-initiative versions |
| Version approval | Review-ready version | Version repository | Atomic approval and prior-version supersession | Roll back the full transition on failure |

## Security and Data Posture

- All free-form inputs are server-normalized and length-bounded.
- List sizes are bounded and stable identifiers are server-generated when missing.
- Initiative and Library source boundaries are checked before persistence.
- SQL writes use prepared statements and approval transitions use a transaction.
- Event detail records changed field names and state transitions, not raw source excerpts or guideline content.
- The feature performs no external requests and stores no provider credentials.
- MarketOps remains access-restricted and single-operator until authenticated actor support is implemented.

## Parcel: capability-03-brand-voice

### Goal

Produce the versioned brand-voice contract, operator workspace, campaign pinning integration, tests, and release evidence.

### Initiative

`marketops-immediate-capabilities`

### Project Track

MarketOps web application

### Wave

W3

### Branch

`feat/marketops-03-brand-voice`

### Worktree

`D:\Repos\MarketOps-worktrees\brand-voice`

### Dependencies

- Capability 2 merged through PR #4 at `0f8e92f`.

### Integration Surfaces

- initiative-to-brand-voice
- library-to-brand-voice-provenance
- brand-voice-to-campaign-lifecycle

### Security Gate

Focused security review required before PR.

### Allowed Files

- `docs/ROADMAP.md`
- `docs/initiatives/immediate-capabilities/03-brand-voice-guidelines.md`
- `docs/initiatives/immediate-capabilities/03-brand-voice-security-review.md`
- `docs/initiatives/immediate-capabilities/STATUS.md`
- `src/lib/brand-voice/types.ts`
- `src/lib/brand-voice/db.ts`
- `src/lib/brand-voice/service.ts`
- `src/lib/brand-voice/repository.ts`
- `src/app/actions/brand-voice.ts`
- `src/app/initiatives/[slug]/brand-voice/page.tsx`
- `src/components/brand-voice-workspace.tsx`
- `src/components/brand-voice-summary-card.tsx`
- `src/app/initiatives/[slug]/page.tsx`
- `src/lib/campaigns/db.ts`
- `src/lib/campaigns/lifecycle-types.ts`
- `src/lib/campaigns/lifecycle-service.ts`
- `src/lib/campaigns/lifecycle-repository.ts`
- `src/app/actions/campaign-lifecycle.ts`
- `src/components/campaign-lifecycle-workspace.tsx`
- `src/app/campaigns/[id]/page.tsx`
- `tests/brand-voice.test.ts`
- `tests/campaign-lifecycle.test.ts`

### Forbidden

- Provider-backed content generation or external network calls.
- Changes to Library ingestion, parsing, or review semantics.
- Changes to initiative identity or campaign ownership.
- Authentication, commercialization, or multi-tenant infrastructure.
- Silent mutation of approved or superseded versions.

### Out of Scope

- AI-generated marketing copy.
- Persuasion scoring or rewrite recommendations.
- Publishing, sending, or provider execution.
- Automatic source-rights determinations.

### Existing Patterns To Follow

- `src/lib/campaigns/lifecycle-*` for validation, SQLite persistence, and event evidence.
- `src/components/campaign-lifecycle-workspace.tsx` for an incremental operator form.
- `src/lib/library/repository.ts` for initiative-scoped source records.
- `src/app/initiatives/[slug]/page.tsx` for initiative-owned navigation.

### Required Tests

- Canon-seeded version-one draft preserves initiative provenance.
- Review-ready and approval completeness validation.
- Cross-initiative and ineligible Library source rejection.
- Approved-version immutability and atomic supersession.
- Deterministic brand-voice context includes version and source references.
- Campaign pin validation rejects unapproved or cross-initiative versions.
- Campaign snapshots retain the approved context used at save time.

### Verification

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
- Isolated runtime route smoke test.

### Evidence Required

- Passing automated test output.
- Production build output.
- Runtime route response containing the brand-voice workspace.
- Focused security review.
- Pull-request link and final branch SHA.

### Collision Risk

High for campaign lifecycle and initiative route files. All changes are serialized in this single branch.

### Stop-and-Report Rule

Stop if implementation requires provider execution, new source ingestion, authentication, a change to approved-version immutability, or any file outside the allowed list.
