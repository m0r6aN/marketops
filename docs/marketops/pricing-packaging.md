# Pricing & Packaging (Private Beta) — PROPOSAL

> **PROPOSED — NEEDS PRODUCT SIGN-OFF.** Nothing in this document is
> approved pricing. All tiers, ACV figures, and feature mappings below are
> a draft for product review. No charge path, no Stripe SDK, and no
> enforcement logic ships with this parcel — spec, types, and fixtures only.
> Enforcement/gating wires up in `w2-billing-wire`.

## 1. Plans

| Plan | Price (ACV) | Access |
|---|---|---|
| `beta` | $0 — invite-only, time-boxed | Beta tenants admitted by the GTM team; no payment instrument collected. |
| `pilot` — Starter | **$25k** (proposed) | Paid pilot, annual contract value. |
| `pilot` — Standard | **$35k** (proposed) | Paid pilot, annual contract value. |
| `pilot` — Scale | **$50k** (proposed) | Paid pilot, annual contract value. |

The paid range ($25–50k ACV) follows the initiative brief. Tier names,
price points, and the number of tiers are all open product decisions —
recorded here as proposed, not decided.

## 2. Beta vs pilot → `Entitlement.features` mapping (proposed)

Feature strings MUST stay within the existing fixture vocabulary
(`claim-review`, `approval-workflow`, `proofpack-export`). No new feature
strings are introduced by this proposal; tier differentiation above the
vocabulary (seats, volume, SLA) is out of scope for the `Entitlement`
contract.

| Plan / tier | `plan` | `features` (proposed) |
|---|---|---|
| Beta (invite-only) | `beta` | `["claim-review"]` |
| Pilot — Starter ($25k) | `pilot` | `["claim-review", "approval-workflow"]` |
| Pilot — Standard ($35k) | `pilot` | `["claim-review", "approval-workflow", "proofpack-export"]` |
| Pilot — Scale ($50k) | `pilot` | `["claim-review", "approval-workflow", "proofpack-export"]` |

Notes:

- Scale differentiates on non-feature terms (seats, support, review SLA),
  not on additional feature strings — the contract carries no such fields.
- Current fixtures are consistent with this mapping: `tenant-keon`
  (`pilot`, all three features) reads as Standard-or-above;
  `tenant-biostack` (`pilot`, `claim-review` + `approval-workflow`)
  reads as Starter.
- Downgrade/upgrade between pilot tiers changes only the commercial terms
  plus the `features` array; `plan` stays `pilot`.

## 3. Lapsed / cancelled gating semantics (spec)

`Entitlement.status` is the single gate signal. Enforcement lands in
`w2-billing-wire`; this parcel defines the intended semantics only:

- `active` — all listed `features` are granted for the requesting
  `tenantId`.
- `lapsed` — payment failure or expired term with recovery expected.
  All beta/pilot features gate OFF (deny with receipt, consistent with
  the existing tenant-deny posture). A subsequent recovery webhook
  (`customer.subscription.updated`) returns the entitlement to `active`
  with no data loss implied by the contract.
- `cancelled` — subscription deleted / pilot terminated. All features
  gate OFF. Re-activation requires a new purchase
  (`checkout.session.completed`), i.e. a fresh entitlement lifecycle,
  not a silent flip back to `active`.

Idempotency: webhook replays must never double-apply transitions (see
`contracts/BillingWebhook.json` — `eventId` is the unique deduplication
key). A replayed `customer.subscription.deleted` after a newer
`checkout.session.completed` must not regress a re-activated tenant;
ordering/conflict rules are a `w2-billing-wire` decision, flagged here.

## 4. Webhook → entitlement outcome table (contract reference)

| Stripe event type | Intended entitlement outcome |
|---|---|
| `checkout.session.completed` | `active` (new or renewed pilot) |
| `customer.subscription.updated` | `active` (renewal / plan change / recovery) |
| `customer.subscription.deleted` | `cancelled` |
| `invoice.payment_failed` | `lapsed` |

Fixtures in `tests/contracts/fixtures/billing-webhooks.json` cover one
valid event per type, mapped to these outcomes.

## 5. Open decisions (need product sign-off)

1. Tier count and price points ($25k / $35k / $50k all proposed).
2. Beta feature set (`claim-review` only — proposed; approval-workflow
   for beta is the main alternative).
3. Whether Scale needs contract-level differentiation beyond features.
4. Replay-ordering rule when a stale `deleted` arrives after a newer
   `checkout.session.completed` (flagged for `w2-billing-wire`).
5. Dunning window before `invoice.payment_failed` flips status to
   `lapsed` (immediate vs grace period).
