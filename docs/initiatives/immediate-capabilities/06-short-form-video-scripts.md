# Parcel: capability-06-short-form-video-scripts

## Goal

Produce initiative-scoped, source-backed, versioned short-form video scripts with timed scenes, narration, on-screen text, visual direction, claim review, and approval state.

## Initiative

MarketOps immediate capabilities

## Project Track

MarketOps web application

## Wave

W6

## Branch

`feat/marketops-06-short-form-video`

## Worktree

`D:\Repos\MarketOps-worktrees\persuasion-review`

## Dependencies

- Capability 5 merged through PR #7 at `a64e4d6`.

## Integration Surfaces

- Approved or superseded content version to short-form script source snapshot.
- Approved or superseded brand voice to deterministic script context.
- Initiative and campaign claim boundaries to script claim findings.

## Security Gate

Security review required before merge.

## Allowed Files

- `docs/ROADMAP.md`
- `docs/initiatives/immediate-capabilities/STATUS.md`
- `docs/initiatives/immediate-capabilities/06-short-form-video-scripts.md`
- `docs/initiatives/immediate-capabilities/06-short-form-video-scripts-security-review.md`
- `src/lib/video-scripts/**`
- `src/app/actions/video-scripts.ts`
- `src/app/initiatives/[slug]/video-scripts/page.tsx`
- `src/app/initiatives/[slug]/page.tsx`
- `src/components/video-script-summary-card.tsx`
- `src/components/video-script-workspace.tsx`
- `tests/video-scripts.test.ts`

## Forbidden

- Video, avatar, image, voice, or audio generation.
- Uploading source content to a provider.
- Publishing, posting, scheduling, rendering, encoding, or delivery.
- Editing content, persuasion-review, brand-voice, campaign, or initiative contracts.
- Authentication, commercialization controls, or speculative governance infrastructure.
- Capability 7 YouTube transcript retrieval.

## Out of Scope

This parcel plans scripts only. It does not create media assets, clone identities, synthesize speech, acquire media rights, or connect social platforms.

## Existing Patterns To Follow

- `src/lib/content-workspace/**` for versioning, approval, provenance, claim review, and evidence events.
- `src/lib/persuasion-review/**` for immutable snapshots and server-side recomputation.
- `src/app/initiatives/[slug]/content/page.tsx` for initiative-scoped dynamic routes.

## Contract

- A script begins from an immutable approved or superseded content version in the same initiative.
- The script stores the source content version ID, update timestamp, body snapshot, source materials, campaign, pinned brand voice, and server-derived claim findings.
- Supported targets are TikTok, Instagram Reels, YouTube Shorts, LinkedIn, and Other, with 9:16, 1:1, or 16:9 aspect ratios and durations from 15 through 90 seconds.
- Every scene records start/end seconds, narration, on-screen text, visual direction, and an evidence note.
- Scene timing must be ordered, contiguous, start at zero, and end at the declared duration.
- Deterministic seeding creates an editable draft from source content and the saved CTA; it never claims provider or media generation.
- Review-ready and approved scripts require complete scenes, provenance, an eligible pinned brand voice, and no unresolved avoided or needs-proof claim findings.
- Approved and superseded script versions are immutable; revisions create a new draft version and approval supersedes the prior approved version.
- Events record creation, updates, status changes, and supersession without send, render, or publication states.

## Required Tests

- `tests/video-scripts.test.ts`
- Deterministic scene seed and full duration coverage.
- Same-initiative content, campaign, and brand-voice enforcement.
- Invalid timing and incomplete review rejection.
- Server-derived claim findings block approval.
- Version approval, immutability, supersession, and evidence events.

## Acceptance Criteria

- Operators can seed a structured script from eligible content, edit its brief and scenes, and version it.
- The initiative page exposes script counts and approved state.
- The script route clearly states that no media generation or publication occurs.
- All required verification and focused security review pass.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build -- --webpack`
- `npm audit --omit=dev`
- `git diff --check`
- Isolated HTTP/content smoke for `/initiatives/keon-systems/video-scripts`.

## Evidence Required

- Test, typecheck, lint, build, diff-check, audit, and runtime-smoke output.
- Focused security review document.
- Draft PR URL.

## Acceptance Evidence

| Check | Result |
|---|---|
| Test suite | 33 passed across 6 files, including 5 capability-specific tests |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed with Next.js 16.2.6 and Webpack; video-script route included |
| Runtime smoke | HTTP 200 and expected `Video Scripts` content on isolated port 4337 |
| Dependency audit | Existing 3 high / 4 moderate advisories; no dependency added; forced fixes are breaking |
| Security review | No new Critical, High, or Medium capability-specific finding |
| Provider/media/publishing behavior | None exists in this capability |

## Collision Risk

Medium. The initiative detail page, roadmap, and coordinator ledger are serialization points and must be changed only in this parcel.

## PR Notes

- What changed: structured, versioned short-form video script planning.
- Why: convert approved marketing content into production-ready script plans without media-provider coupling.
- Risk: operators may mistake planning guidance for factual, legal, accessibility, or media-rights approval.
- Verification: inspect scene timing, immutable approval behavior, claim blocks, and the local route.
- Evidence: capability document, security review, automated tests, and runtime smoke.

## Session Handoff

- Starting commit: `a64e4d6`
- Ending commit: pending publication commit
- Files changed: parcel docs, video-script domain/persistence/actions/route/components, initiative integration, and tests
- Commands run: test, typecheck, lint, Webpack build, dependency audit, diff check, and isolated runtime smoke
- Tests passed: 33
- Tests failed: 0
- Decisions needed: none
- Blockers: GenSpark credits exhausted; local implementation authorized.
- Next safe action: create logical commits, rebase current main, push, and open a draft PR.
- Do not touch: provider execution, media generation, YouTube transcripts, publishing, auth, or commercialization controls.

## Stop-and-Report Rule

If implementation requires a product decision not present here, a file outside Allowed Files, a contract change, or an unclear security boundary, stop and request an amendment before continuing.

## Sequence Gate

Capability 7 remains blocked until Capability 6 is merged, rejected, or explicitly superseded.
