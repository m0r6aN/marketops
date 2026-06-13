# Assets Library Foundation

**Lane:** Assets Library Foundation  
**Type:** Docs-only design spec  
**Status:** Draft — implementation deferred  
**Date:** 2026-05-21  
**Depends on:** PR 3 (Positioning Canon + Claim Hygiene) merged at `5ef5813`

---

## Summary

Assets Library Foundation adds fixture-backed asset visibility across the MarketOps portfolio.
It gives operators a structured view of initiative-specific and portfolio-wide marketing assets
without introducing file upload infrastructure, cloud storage, or persistence layers.

The library supports campaign planning, proof references, page assets, screenshots, briefs, and
launch materials. Assets are typed, status-tracked, and claim-sensitivity-aware so that operators
can understand what material exists, what its review state is, and where it fits in the go-live
readiness picture.

**This lane does not add:**

- File upload or cloud storage of any kind
- Asset editors
- AI-generated content
- Analytics integrations
- Billing or monetization
- Authentication or multi-tenant workspaces
- Database schema changes or server-side persistence

All data is fixture-backed and local, consistent with the patterns established in PRs 1–3.

---

## Goals

- Add typed marketing asset domain definitions (`MarketingAsset`, `MarketingAssetType`,
  `MarketingAssetStatus`, `AssetSensitivity`, `AssetUsageContext`).
- Add a `/library` route as the portfolio-level asset library view.
- Render a portfolio asset library page that groups or filters assets by initiative, type, status,
  and claim sensitivity.
- Replace the current Assets placeholder card in `InitiativeDetailSections` with a populated
  initiative-level asset panel.
- Keep all data fixture-backed and local — no network calls, no server persistence.
- Pass `npm run build`, `npm run lint`, and `npx tsc --noEmit` clean on implementation.

---

## Non-Goals

- File upload (any provider)
- Cloud storage (S3, GCS, Azure Blob, or otherwise)
- Asset editor or inline text editing
- Campaign editor
- AI asset generation or AI-assisted copy
- Analytics integration
- Billing or monetization
- Authentication or multi-tenant workspaces
- Database schema changes
- Asset versioning or diff history
- Full-text search over asset content
- Automated semantic claim review (deferred to a future editor/AI lane)

---

## Domain Model

All types live in `src/lib/assets.ts`. No external dependencies beyond existing project types.

### `MarketingAssetType`

```ts
export type MarketingAssetType =
  | "page-copy"
  | "brief"
  | "proof-tour"
  | "screenshot"
  | "checklist"
  | "post-draft"
  | "interview-prompt"
  | "workflow-sketch"
  | "onboarding-copy"
  | "other";
```

### `MarketingAssetStatus`

```ts
export type MarketingAssetStatus =
  | "draft"
  | "in-review"
  | "approved"
  | "published"
  | "archived";
```

### `AssetSensitivity`

Mirrors the claim sensitivity model introduced in PR 3. Used to surface assets that require
claim hygiene review before use.

```ts
export type AssetSensitivity =
  | "standard"      // no elevated claim risk
  | "needs-proof"   // contains needs-proof claims; must have attached proof before publishing
  | "restricted";   // contains or risks banned claims; blocked pending review
```

### `AssetUsageContext`

Where the asset is intended to be used.

```ts
export type AssetUsageContext =
  | "landing-page"
  | "campaign"
  | "sales-brief"
  | "social"
  | "internal"
  | "other";
```

### `MarketingAsset`

Core asset record. All fields are present at fixture time; optional fields may be omitted for
assets not yet fully catalogued.

```ts
export type MarketingAsset = {
  id: string;                          // stable slug, e.g. "keon-openclaw-proof-tour"
  initiativeSlug?: string;             // omit for portfolio-wide assets
  title: string;
  type: MarketingAssetType;
  status: MarketingAssetStatus;
  sensitivity: AssetSensitivity;
  usageContext: AssetUsageContext;
  relatedCampaignIds?: string[];       // future: links to Campaign records
  description: string;                 // one-to-two sentence summary of asset purpose
  sourceUrl?: string;                  // external link if asset lives outside repo
  repoPath?: string;                   // relative path if asset is in the repo
  owner?: string;                      // operator handle or team name
  lastReviewedAt?: string;             // ISO 8601 date string
  notes?: string;                      // freeform editorial or review notes
};
```

**Design notes:**

- `initiativeSlug` is optional to allow portfolio-wide assets (e.g. a brand style guide) that
  are not tied to a single initiative.
- `relatedCampaignIds` is forward-compatible with the Campaign Workspace Foundation lane running
  in parallel; in this lane it is always an empty array or omitted.
- `repoPath` and `sourceUrl` are both optional; an asset may have neither if it is catalogued but
  not yet located.
- `sensitivity` drives claim hygiene callouts in the UI without requiring the asset to contain
  extractable text.

---

## Seed Asset Examples

These examples cover the four current initiatives. They are illustrative fixtures; exact values
will be confirmed during implementation.

### Keon Systems

| id | title | type | status | sensitivity | usageContext |
|---|---|---|---|---|---|
| `keon-openclaw-proof-tour` | OpenClaw Proof Tour | `proof-tour` | `in-review` | `needs-proof` | `campaign` |
| `keon-behavior-governance-proof-tour` | Behavior Governance Proof Tour | `proof-tour` | `draft` | `needs-proof` | `campaign` |
| `keon-access-page-copy` | Access Page Copy | `page-copy` | `approved` | `standard` | `landing-page` |
| `keon-governed-ai-exec-brief` | Governed AI Execution Executive Brief | `brief` | `in-review` | `needs-proof` | `sales-brief` |

**Notes:**
- Proof tours must reference verifier-bound evidence before sensitivity can drop to `standard`.
- Executive brief contains live-policy-check claims; flagged `needs-proof`.

---

### BioStack

| id | title | type | status | sensitivity | usageContext |
|---|---|---|---|---|---|
| `biostack-provider-summary-workflow` | Provider Summary Workflow | `workflow-sketch` | `draft` | `needs-proof` | `campaign` |
| `biostack-alpha-onboarding-copy` | Alpha Onboarding Copy | `onboarding-copy` | `approved` | `standard` | `landing-page` |
| `biostack-protocol-tracking-screenshots` | Protocol Tracking Screenshots | `screenshot` | `published` | `standard` | `campaign` |

**Notes:**
- Provider summary workflow contains interaction-intelligence claims; flagged `needs-proof`.
- Screenshots are observational; no clinical claims present.

---

### SilentApply

| id | title | type | status | sensitivity | usageContext |
|---|---|---|---|---|---|
| `silentapply-waitlist-page-copy` | Waitlist Page Copy | `page-copy` | `approved` | `standard` | `landing-page` |
| `silentapply-user-interview-prompt` | User Interview Prompt | `interview-prompt` | `draft` | `standard` | `internal` |
| `silentapply-targeting-workflow-sketch` | Targeting Workflow Sketch | `workflow-sketch` | `draft` | `needs-proof` | `campaign` |

**Notes:**
- Targeting workflow sketch references application quality scoring and interview pipeline lift;
  flagged `needs-proof` until backing data is attached.
- Waitlist copy reviewed against tone notes; no outcome promises present.

---

### ForgePilot

| id | title | type | status | sensitivity | usageContext |
|---|---|---|---|---|---|
| `forgepilot-builder-workflow-brief` | Builder Workflow Brief | `brief` | `draft` | `standard` | `sales-brief` |
| `forgepilot-launch-readiness-checklist` | Launch Readiness Checklist | `checklist` | `approved` | `standard` | `internal` |
| `forgepilot-build-in-public-post-draft` | Build-in-Public Post Draft | `post-draft` | `draft` | `needs-proof` | `social` |

**Notes:**
- Build-in-public post contains faster-shipping-cycles and reduced-context-switching claims;
  flagged `needs-proof` until metrics are attached.
- Launch readiness checklist is internal tooling; no claim sensitivity concerns.

---

## UI Plan

### `/library` — Portfolio Asset Library

A new top-level route at `/library` renders the portfolio-level asset library view.

**Layout:**

- Page heading: "Asset Library"
- Subheading: count of total assets, grouped by initiative
- Filter bar (fixture-backed, no server calls):
  - By initiative (all | keon-systems | biostack | silentapply | forgepilot | portfolio-wide)
  - By type (all | page-copy | brief | proof-tour | screenshot | …)
  - By status (all | draft | in-review | approved | published | archived)
  - By sensitivity (all | standard | needs-proof | restricted)
- Asset cards or table rows beneath the filter bar

**Asset card fields (minimal):**

- Title
- Type badge
- Status badge
- Sensitivity badge (only shown when `needs-proof` or `restricted`)
- Initiative chip (omitted for portfolio-wide)
- Description (truncated to 2 lines)
- `sourceUrl` or `repoPath` link if present

**Asset card interactions:** read-only. No edit, upload, or delete actions in this lane.

---

### Initiative Detail — Asset Panel

The existing Assets placeholder card in `InitiativeDetailSections` is replaced with a populated
`InitiativeAssetsPanel` component.

Props: `{ initiative: Initiative; assets: MarketingAsset[] }`

The component filters `assets` to those matching `initiative.slug` and renders them in a compact
list or grid. Groups by `status` (approved → in-review → draft → archived). Shows sensitivity
badges on flagged assets.

If no assets exist for the initiative, renders a concise empty state (e.g., "No assets catalogued
yet.") rather than an empty list.

---

### Navigation

The "Library" nav item in `app-nav.tsx` transitions from visually inactive or placeholder state
to an active link pointing to `/library` when this lane is implemented.

No nav changes are made in this docs-only PR.

---

## Claim Hygiene Integration

Assets carry a `sensitivity` field that surfaces claim hygiene requirements without requiring the
asset to contain extractable text.

**Display rules:**

- `standard` — no claim hygiene callout shown.
- `needs-proof` — show a "Claim hygiene required: needs proof" badge. Asset should not be
  published until proof is attached.
- `restricted` — show a "Claim hygiene required: restricted" badge. Asset is blocked pending
  review. Do not surface in external-facing views.

**Automatic validation:**

No automatic claim validation runs against asset text in this lane. The `src/lib/claims.ts`
helpers introduced in PR 3 (`getBannedClaimMatches`, `getNeedsProofClaimMatches`,
`getClaimHygieneSummary`) are available for future editor or AI review lanes that extract and
validate asset copy. Operator-assigned `sensitivity` is the source of truth in this lane.

**Future integration point:**

When an asset editor is added (deferred), the editor should call `getClaimHygieneSummary` on
save and surface matched rules inline. The `sensitivity` field should be updated automatically
based on the hygiene result or kept as a manual override.

---

## Verification Plan (for future implementation PR)

Run in order after implementation:

```bash
npm run build
npm run lint
```

If a `typecheck` script exists in `package.json`:

```bash
npm run typecheck
```

Otherwise:

```bash
npx tsc --noEmit
```

Finally:

```bash
git diff --check
git status --short
```

**All four checks must exit clean before the implementation PR is opened.**

Report for each check:
- Command run
- Exit code
- Any warnings or errors, with file and line reference
- Whether a `typecheck` npm script exists or `npx tsc --noEmit` was used as fallback

---

## Deferred Work

The following items are explicitly out of scope for the Assets Library Foundation lane and are
deferred to future lanes:

| Item | Rationale |
|---|---|
| File upload and cloud storage | Infrastructure dependency; adds cost and ops surface |
| Asset editor (inline or modal) | Requires mutation surface and validation loop |
| Text extraction from binary assets | Requires storage access or external parser |
| Semantic claim review against asset text | Requires editor to surface text; deferred with editor |
| AI-generated asset copy | Out of scope until generation constraints are defined |
| Analytics (views, downloads, engagement) | Requires event infrastructure |
| Campaign asset production workflows | Depends on Campaign Workspace Foundation shipping |
| Asset versioning and diff history | Requires persistence layer |
| Full-text asset search | Requires index or server-side query support |
| `relatedCampaignIds` population | Deferred until Campaign records exist |
| `publicUrl` / `repoPath` population | Values confirmed at implementation time |
| `rationale` on `ClaimRule` in asset context | Carried forward from PR 3; rendered in future editor lane |

---

## Open Questions

1. **Asset ownership model:** Should `owner` be a free-form string or a reference to an operator
   record? Fixture-backed for now; defer normalization.

2. **Portfolio-wide assets:** Are there currently any assets that span all four initiatives (e.g.,
   brand style guide, shared proof methodology)? If so, they should be seeded without an
   `initiativeSlug`.

3. **Filter persistence:** Should filter state be reflected in the URL (e.g., `/library?type=brief`)
   for shareability? Recommended: yes, via Next.js search params. Confirm at implementation time.

4. **Sensitivity override vs. auto-detection:** When an editor lane is added, should operator-set
   `sensitivity` be treated as an override (higher wins) or replaced by auto-detection? Recommend
   higher-of-two wins; confirm at design time.

5. **`npm run typecheck` script:** PR 3 deferred adding this script. Confirm whether it has been
   added before the implementation PR runs verification.

---

*This spec is docs-only. No source files, fixtures, routes, or components are created in this PR.
Implementation is a separate future lane.*
