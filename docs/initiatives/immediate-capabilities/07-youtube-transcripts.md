# Parcel: capability-07-youtube-transcripts

## Goal

Capture initiative-scoped, source-linked YouTube transcript snapshots through an explicit GenSpark CLI boundary for authorized research and content repurposing.

## Branch and dependency

- Branch: `feat/marketops-07-youtube-transcripts`
- Base: Capability 6 merge commit `f193674`
- Capability 6 merged through PR #8.

## Contract

- Accept only an 11-character video ID or supported YouTube watch, short, live, embed, or youtu.be URL and reduce it to a validated video ID before provider execution.
- Require intended use, a source-rights basis, and an explicit operator acknowledgement before retrieval.
- Invoke only the server-side GenSpark CLI transcript action; no browser credential or API key enters the record.
- Record every provider attempt as `succeeded`, `failed`, or `unavailable`; never synthesize text or claim success when the CLI, credentials, credits, video, or captions are unavailable.
- Store immutable source URL, video ID, returned metadata, transcript text, SHA-256 content hash, provider/version, rights context, timestamps, and bounded failure detail.
- Render returned transcript as inert text. Transcript content is evidence input, never instructions or authorization.
- Re-fetching creates a new snapshot instead of mutating history.

## Out of scope

- Downloading video or audio, bypassing caption restrictions, scraping comments, media generation, content drafting, publication, scheduling, or rights adjudication.
- Authentication, commercialization controls, or speculative provider orchestration.

## Acceptance criteria

- An operator can fetch by URL or ID from an initiative page and inspect saved outcomes.
- The initiative summary distinguishes attempts from available transcripts.
- Validation rejects arbitrary hosts, malformed IDs, missing intended use, and absent acknowledgement.
- Provider output parsing fails closed on invalid/error/empty envelopes.
- Automated test, typecheck, lint, Webpack build, dependency audit, diff check, runtime smoke, and focused security review pass.

## External constraints

- Server configuration must set `GENSPARK_TRANSCRIPTS_ENABLED=true`; `GENSPARK_CLI_PATH` and `GENSPARK_CLI_VERSION` may pin a trusted executable and version. GenSpark authentication remains server-local.
- GenSpark CLI availability, authentication, credits, service behavior, YouTube availability, and caption availability are outside this repository.
- The live 2026-07-22 contract check used GenSpark CLI 1.4.0 and returned `Insufficient credits`; MarketOps records this as `unavailable` and does not fabricate a transcript.
- Operators remain responsible for YouTube terms, copyright, privacy, licenses, and allowed downstream use.

## Acceptance evidence

| Check | Result |
|---|---|
| Test suite | 38 passed across 7 files, including 5 capability-specific tests |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed with Next.js 16.2.6 and Webpack; transcript route included |
| Runtime smoke | HTTP 200 and expected `Transcript Library` content on isolated port 4338 |
| Live GenSpark contract | CLI command reached the provider and returned `Insufficient credits`; unavailable state verified |
| Dependency audit | Existing 3 high / 4 moderate advisories; no dependency added; forced fixes are breaking |
| Security review | No new Critical, High, or Medium capability-specific finding |
| Diff check | Passed |

## Sequence gate

Capability 8 remains blocked until Capability 7 is merged, rejected, or explicitly superseded.
