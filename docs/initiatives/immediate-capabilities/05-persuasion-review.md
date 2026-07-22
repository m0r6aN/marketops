# Capability 5 — Apply Persuasion Psychology

## Classification

Mode: Repo-Local Parcel Mode

Base: `072653b` (Capability 4 merge)
Branch: `feat/marketops-05-persuasion-review`

## Goal

Add an initiative-scoped persuasion review lens to the content workspace that improves clarity and relevance without manipulation, unsupported claims, or mutation of approved content.

## Product Contract

- A review snapshots exactly one content version, its source provenance, pinned brand voice, claim findings, and update timestamp.
- Every assessment records the principle, audience rationale, proposed revision, evidence or assumption, and ethical or reputational risk.
- Reviews cover clarity, audience relevance, credibility, value framing, objection handling, CTA strength, and channel fit.
- Deceptive urgency or scarcity, fabricated social proof, dark patterns, unsupported claims, sensitive-trait exploitation, and discriminatory targeting are explicitly flagged and block revision creation.
- Review creation and application are recomputed server-side; browser-supplied review results are not trusted.
- Applying a safe review creates a new editable content version. It never mutates an approved or superseded version.
- Stale reviews cannot be applied after their source content version changes.
- Claim hygiene is recomputed for the suggested revision before the new version is persisted.
- Events and apply attempts record succeeded or failed outcomes without claiming publication, delivery, or provider execution.
- Capability 5 does not use an external AI provider and never sends, schedules, publishes, emails, or posts content.

## Parcel

### Allowed Files

- `docs/ROADMAP.md`
- `docs/initiatives/immediate-capabilities/05-persuasion-review.md`
- `docs/initiatives/immediate-capabilities/05-persuasion-review-security-review.md`
- `docs/initiatives/immediate-capabilities/STATUS.md`
- `src/lib/persuasion-review/**`
- `src/app/actions/persuasion-review.ts`
- `src/app/initiatives/[slug]/persuasion/page.tsx`
- `src/app/initiatives/[slug]/page.tsx`
- `src/components/content-workspace.tsx`
- `src/components/persuasion-review-summary-card.tsx`
- `src/components/persuasion-review-workspace.tsx`
- `tests/persuasion-review.test.ts`

### Forbidden / Out of Scope

- Publishing, sending, scheduling, campaign automation, or Capability 6 video scripting.
- External provider calls or model-generated persuasion advice.
- Profiling or targeting based on sensitive traits.
- Authentication, commercialization controls, or speculative governance infrastructure.
- Changes to initiative, campaign, Library, brand-voice, or content-workspace contracts.

## Required Verification

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build -- --webpack`
- `npm audit --omit=dev`
- `git diff --check`
- Isolated runtime HTTP/content smoke for `/initiatives/keon-systems/persuasion`
- Focused security review covering manipulation, stale snapshots, cross-initiative access, persistence, and prompt/provider boundaries

## Sequence Gate

Capability 6 remains blocked until Capability 5 is merged, rejected, or explicitly superseded.

## Implemented Slice

- Persisted immutable persuasion review snapshots, seven assessments, issue flags, apply runs, and events.
- Added initiative route `/initiatives/[slug]/persuasion`, initiative summary integration, and a content-workspace entry point.
- Added server-only review creation and guarded revision creation with fresh claim hygiene and same-initiative validation.
- Added explicit blocks for deceptive urgency/scarcity, fabricated social proof, dark patterns, unsupported saved claims, sensitive-trait exploitation, and discriminatory targeting.
- Safe application creates a new draft; no source version is mutated and no publication or provider action exists.

## Acceptance Evidence

| Check | Result |
|---|---|
| Test suite | 28 passed, including 5 capability-specific tests, on declared Vitest 2.1.x line |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed with Next.js 16.2.6 and Webpack; persuasion route included |
| Runtime smoke | HTTP 200 and expected `Persuasion Review` content on isolated port 4337 |
| Dependency audit | Existing 3 high / 4 moderate advisories; no dependency added; forced fixes are breaking |
| Security review | No new Critical, High, or Medium capability-specific finding |
| Publishing/provider behavior | None exists in this capability |
