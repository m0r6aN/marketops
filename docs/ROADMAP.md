# MarketOps Roadmap

This roadmap tracks deferred lanes and future work that is explicitly out of scope for current PRs. Items are added here when descoped during planning, not when abandoned. Each item should be re-evaluated before scheduling — requirements may have evolved.

---

## Active / In Progress

| Lane | Branch | Status |
|---|---|---|
| Full Marketing Campaign Lifecycle | `feat/marketops-02-full-campaign` | In progress |

---

## Deferred Lanes

### Campaign Workspace Foundation

Status: In progress on `feat/campaign-workspace-foundation`. Listed here for roadmap completeness.

- Campaign list view per initiative
- Campaign card component
- Campaign sensitivity and status badges
- Campaign detail panel integrated into initiative detail page
- Campaign fixture data for all four initiatives

---

### Assets Library Foundation

- Asset list view per initiative
- Asset type taxonomy (copy, creative, video, document)
- Asset status and ownership fields
- Asset card and detail panel
- Asset fixture data
- Integration with initiative detail page (Assets section)

---

### Metrics Snapshots

- Metric definition per initiative (e.g., conversion rate, pipeline volume, MQL count)
- Snapshot model: point-in-time metric values with timestamps
- Metric list and sparkline display per initiative
- Fixture-backed metrics for all four initiatives
- Integration with initiative detail page (Metrics section)

---

### Campaign Provider Execution

- Connect explicit provider adapters only after a channel-specific implementation is approved
- Preserve provider request, confirmation, failure, and partial-delivery evidence
- Keep planned, review-ready, approved, sent, failed, and measured states distinct
- Never infer provider success from a queued request

---

### Claim Helper Tests

- **Prerequisite:** a test framework must be added (e.g., Vitest or Jest)
- Minimum test cases for `src/lib/claims.ts`:
  - Banned claim match is case-insensitive
  - Needs-proof claim match is case-insensitive
  - `clean` is `true` when no matches
  - `clean` is `false` when either banned or needs-proof matches
  - No false positives on unrelated text
- Adding `src/lib/claims.ts` tests is the first priority when a test framework is introduced

---

### Claim Rationale UI Rendering

- `ClaimRule.rationale` field is defined but not rendered in PR 3
- Future editor lane should surface rationale inline with each claim rule
- Rationale is editorial context for reviewers, not user-facing copy

---

### Public URL / Repo URL Population

- `publicUrl` and `repoUrl` are typed on `Initiative` but left empty in current seed data
- Populate once URLs are confirmed for each initiative:
  - Keon Systems
  - BioStack
  - SilentApply
  - ForgePilot
- No schema changes required; values go directly into fixture data

---

### Monetization Features

These are deferred and not current scope. Do not implement any of the following without an explicit scoped spec.

- Initiative monetization strategy fields (pricing model, offer type, revenue stage)
- Pricing model exploration and comparison view
- Offer and package tracking per initiative
- Revenue readiness checklist
- Conversion experiment tracking
- Stripe / billing integration planning (not implementation)
- SaaS productization readiness assessment for MarketOps itself (dogfooding as a product)

---

### AI-Assisted Campaign Generation and Execution

- Build incrementally on the campaign editor, assets, Customer Finder, and measurement surfaces
- Keep generated claims tied to source evidence and show unsupported statements to the operator
- Add provider execution through explicit adapters with honest sent, failed, and partial status
- Add governance or approval controls when a concrete workflow, external rule, or commercialization decision requires them

---

### Analytics Integrations

- Deferred; no analytics vendor selected
- Candidates: PostHog, Plausible, custom event pipeline
- Must not introduce any vendor SDK into the core domain layer
- Analytics events should be defined as a side-effect interface, not inline tracking calls

---

### Authentication and Multi-Tenant Workspaces

- Deferred; current MarketOps remains single-operator for runtime behavior
- Customer Finder should preserve a future-compatible boundary, but must not invent tenant isolation claims it does not yet enforce
- Auth candidates: NextAuth, Clerk, custom JWT
- Multi-tenant requires schema changes, row-level security, and an explicit tenant isolation model
- Do not add any auth SDK or tenant fields without a full scoped spec reviewed by the team

---

## Completed Lanes

| PR | Description | Merged |
|---|---|---|
| PR 1 | Foundation: initiative domain model, detail page shell, fixture data | ✅ |
| PR 2 | Go-live readiness: checklist cards, readiness summary, domain hardening | ✅ |
| PR 3 | Positioning Canon + Claim Hygiene: narrative fields, claim validation helpers, PositioningCanonCard, ClaimHygienePanel | ✅ |
| PR 1 | Customer Finder and Outreach Planning: discovery sources, planning campaigns, provenance, and review-only drafts | ✅ |
| chore/project-hygiene-verification | Developer workflow docs, typecheck script | ✅ |
