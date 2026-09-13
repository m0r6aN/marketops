# INT-b-claim-billing — entitlement × claim gates, composed (local)

Parcel: int-b-claim-billing | Surfaces S3+S4 | Environment: local
Scenarios: int-billing-gate, int-claim-block
Branch: feat/int-b-claim-billing | Base: f2782ba
Commit: parcel commit(s) on feat/int-b-claim-billing — see PR "Commits" section
  for exact hashes (base f2782ba, clean tree at start).
Date (UTC): 2026-09-13

Goal: prove entitlement and claim gates COMPOSED — the money × trust matrix.

## Scenario table

| # | Scenario | Input | Expected | Observed |
|---|----------|-------|----------|----------|
| B1 | billing positive | keon (active) × S3 chokepoints claim-review / approval-workflow / proofpack-export via requireEntitlement + enforceEntitlement | allowed:true, status active at all three | PASS — 11/11 in claim-billing.test.ts |
| B2 | billing negative | biostack (lapsed) × same three chokepoints | ENTITLEMENT_INACTIVE, failureStage decision, 403 via EnforceEntitlement; message matches /lapsed/ | PASS |
| B3 | webhook flip | keon pass → ingest invoice.payment_failed (testMode, memory db) → re-check claim-review | flips pass→gated, outcome lapsed | PASS |
| B4 | webhook dedupe | same eventId ingested twice (checkout.session.completed, memory db) | first deduped:false/outcome active; replay deduped:true; exactly 1 row | PASS |
| C1 | claim positive | safe body → evaluateClaim + deriveReviewClaimVerdict + decideClaimApply | safe / safe / safe with policy version in rationale | PASS |
| C2 | claim blocked (money≠override) | entitled keon + banned body ("proves all AI actions are safe") + approval+evidence present | CLAIM_BLOCKED 403 failureStage decision; money.allowed stays true AND verdict stays blocked (explicit inversion guard) | PASS — trust does NOT yield to money |
| C3 | claim failure | empty / whitespace / non-string / null initiative / broken rule lists | every case needs-review, never silent allow; detailed carries claim-policy.v1 | PASS |
| C4 | apply w/o approval | needs-proof review, hasApproval:false → decideClaimApply | APPROVAL_REQUIRED 403 + readable receipt (policy version + "Proof brief — proof-brief-v1", verificationState recorded) | PASS |
| M1 | composed lapsed+banned | biostack entitlement check + banned review apply | BOTH denials observable: ENTITLEMENT_INACTIVE and CLAIM_BLOCKED, each failureStage decision | PASS — neither gate masks the other |
| M2 | no cross-tenant leak | biostack session vs keon-scoped banned review via requireRowTenantMatch; inspect entitlement denialMessage | TENANT_MISMATCH 403, message leaks no banned phrase; entitlement denial contains neither banned nor needs-proof phrase, tenantId biostack | PASS |
| S0 | vocabulary guard | S3 chokepoint feature list vs ENTITLEMENT_FEATURES | equal sets (no drift) | PASS |

Sources read (no changes): src/lib/entitlements/gate.ts,
src/lib/entitlements/webhook.ts, src/lib/claims/policy.ts,
src/lib/persuasion-review/service.ts (S4 apply path),
src/app/actions/persuasion-review.ts (claim-review chokepoint),
src/app/actions/library.ts (approval-workflow + proofpack-export chokepoints).
Patterns reused from tests/billing/billing-gate.test.ts and
tests/claim-approval/claim-approval.test.ts; no duplication of their unit
coverage.

## Verification transcript (local)

- `npm install --no-save --no-package-lock --no-audit --no-fund`
  → "changed 136 packages in 2m" (plus `npm rebuild better-sqlite3` →
  "rebuilt dependencies successfully" to restore native bindings wiped by the
  fresh install; no package files touched).
- `npm run typecheck` → FAIL (pre-existing, out of parcel scope):
  `src/lib/library/ai-client-secrets.ts(15,40): error TS7016: Could not find
  a declaration file for module '@azure/identity'.` tsconfig excludes
  `tests/**`, so the parcel's test file is not part of typecheck; `src/**`
  is forbidden to this parcel, so no fix was attempted. Base commit carries
  the same failure (parcel tree was clean at f2782ba; only
  tests/integration/claim-billing.test.ts + this evidence file added).
- `npm run lint` (full `eslint`) → PASS, no output.
- `npx vitest run tests/integration/claim-billing.test.ts`
  → 1 file, 11 tests, 11 passed.
- `npm test` (full suite) → 21 files passed, 189 passed, 1 skipped.

## Findings

- No gate bypass found. No money-over-trust inversion. No contract drift
  (S3 vocabulary matches ENTITLEMENT_FEATURES; BILLING_EVENT_OUTCOME mapping
  untouched and consistent with prior billing-gate coverage).
- Pre-existing `npm run typecheck` failure in
  src/lib/library/ai-client-secrets.ts (@azure/identity types) — reported,
  not fixed (src/** forbidden). Recommend a follow-up lane to add the
  missing types or a local declaration.

## Limitations (beta-deferred)

- Test-mode webhook only: ingest exercised with `testMode:true` against an
  isolated `:memory:` dedupe db. Live signature verification is deliberately
  unimplemented — deferred per h-webhook-signature (unsigned live events
  stay rejected with LIVE_WEBHOOK_REJECTED).
- In-memory entitlement store: webhook apply mutates the beta store that
  reseeds on restart; durable cross-instance store deferred per
  h-entitlement-store (gate.ts read API is the seam).
- Local env only: no Stripe SDK, no network, no charge paths, no live keys.
- Tenant isolation for legacy SQLite rows follows the documented
  local-default convention (see persuasion-review/repository.ts); beta PG
  isolation is RLS-enforced outside this parcel's scope.

## Files changed (parcel scope)

- tests/integration/claim-billing.test.ts (new)
- evidence/INT-b-claim-billing.md (new)
