# Customer Discovery and Outreach Planning

## Scope

This capability belongs inside MarketOps.
It expands the campaign workspace with a planning-only customer discovery flow.

The initial release supports:

- editable target-customer suggestions
- source selection
- planning campaign creation under `/campaigns`
- source processing for supported sources
- candidate provenance and deduplication
- review-only outreach draft generation

The initial release does **not** support outbound delivery.
Even though future outreach channels are named, sending is excluded from this release and remains a separately governed capability.

## Approved source policy

Approved for the initial release:

- Manual CSV import
- Company websites and public team pages
- GitHub organizations and repositories
- LinkedIn public company and profile pages
- X / Twitter public profiles and posts
- Business directories and startup directories

Supported in this release:

- Manual CSV import
- GitHub public API search and public repository metadata
- Company websites and public team pages when seed URLs are supplied manually

Approved but not yet supported in this release:

- LinkedIn public company and profile pages
- X / Twitter public profiles and posts
- Business directories and startup directories

Unsupported sources must remain visible in the checklist with an explicit unavailable note.
They must not be shown as successfully searchable or processed.

## Processing model

The current processing model is hybrid:

- manual imports for operator-provided CSV data and website seeds
- public API usage for GitHub
- connector placeholders for approved but currently unavailable sources

Blind scraping or access-control circumvention is prohibited.
If a source cannot be processed honestly, the campaign must record a visible failure or unsupported state.

## Campaign schema and states

Canonical runtime states now allow:

- `planning`
- `discovering`
- `review-ready`
- `active`
- `paused`
- `complete`

This release creates customer discovery campaigns in `planning` state and tracks source-processing progress separately through a discovery status field (`pending`, `processing`, `completed`, `partial`, `empty`, `failed`).

Every discovery campaign records:

- origin prompt
- final target description
- selected sources
- creation time
- processing timestamps
- provenance for the request
- retention expiry

## Candidate record rules

Each candidate record must preserve, when available:

- person or organization name
- source and source URL
- reason for the match
- verified public evidence
- confidence assessment
- public contact path
- discovery timestamp

Deduplication is allowed only when complete source provenance is preserved.
Verified evidence and model inference must remain in separate fields.

## Outreach planning rules

Allowed:

- candidate-specific draft generation for email, LinkedIn, X, and CRM / CSV handoff
- human review before any external use
- using verified campaign facts and verified candidate evidence only

Not allowed:

- automatic sending
- invented contact information
- invented candidate claims
- claiming unsupported sources were processed

## Retention and deletion

Current policy:

- discovery data auto-expires after 90 days
- workspace-wide purge capability is available in the Campaigns workspace

## Authentication and tenancy

The runtime remains single-operator today.
The design should stay future-compatible with multi-tenant isolation, but this release does not introduce auth or tenant claims it cannot enforce.

## Compliance posture

The workflow must:

- record lawful basis / provenance for public business data used in candidate records
- fail closed when a source cannot be processed
- require human review before any external communication
- avoid collecting unnecessary sensitive personal data
