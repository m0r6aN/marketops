# Initiative Charter — MarketOps × Keon Integration (`marketops-keon-integration`)

## Foreman line
`keon-integration` · Goal: **wire MarketOps to Keon Systems on all four levels — Runtime policy, Collective deliberation, Cortex evidentiary memory, BrowseAhead search protection — with every call flowing through the MCP Gateway, reusing proven BioStack patterns instead of reinventing them.**

## Mission
Make MarketOps the first real governed solution in MarTech: every consequential marketing effect proposed in MarketOps, authorized against policy, deliberated where stakes demand it, scanned where the web is involved, and preserved as verifiable evidence — producing real receipts that simultaneously prove and vet Keon across a second industry.

## Why this matters
MarketOps without Keon is a credible proposal-side with self-asserted verdicts. With Keon it becomes receipt-backed Benefits: publish/approve decisions carry Runtime-signed dispositions, claim reviews carry deliberation evidence, web-sourced claims carry scan receipts, and the whole chain is reconstructible from Cortex epochs. BioStack proves the same substrate in health-evidence; two verticals vetting one substrate is the enterprise story.

## In scope
- **S8 MCP Gateway transport** — governed tool client (stdio/HTTP), identity bind, per-tool scopes, canonical envelope parsing, `correlation_id` threading into MarketOps receipts.
- **S9 Runtime authorization** — propose → Decide → execute-or-record-no-effect; Runtime-signed dispositions stored, correlated; local `claim-policy.v1` stays proposal-side.
- **S10 Collective deliberation intake** — candidates + dissent + confidence as review *evidence*; never authority; adversarial-review-required-to-candidate rule mirrored.
- **S11 Cortex evidentiary mirror** — decision receipts mirrored to spine records; `epochRef` anchoring; proof-bundle composition for the valuation packet.
- **S12 Context-Fabric-conformant assembly** — library/canon context advisory-only, provenance-bound, tenant-scoped, deterministic.
- **S13 BrowseAhead scanning** — `keon.browseahead.scan.v1` on customer-finder/citation paths; sanitized-bundle-only ingestion; receipts cited downstream.
- **DRY alignment with BioStack** (`D:\Repos\BioStack`) — borrow, in order: `IKeonRuntimeClient` shape + `KeonRuntimeUnavailableException` halts-effect rule; `DecisionReceipt`/`ReceiptRequest`/`PolicyHash` models; `RuntimeReceiptFactory` dual-path doctrine (fail-closed `IssueAndAppend` for effect-bearing, `TryIssueAndAppend` for non-effecting only, Anchored/Unanchored/NotRecorded statuses, distinct unanchored URI/policymarker); `ReceiptEffectStatus` allowlist rule; `ReceiptClass` taxonomy discipline (`family.subject.action`, reserved-but-unwired classes, `legacy.unclassified` sentinel); `SpineEntry` hash chain (`SequenceNumber`/`PreviousEntryHash` unique anti-fork, `EntryHash` over governed fields + prev); DI fail-closed boot (stub-in-prod refuses without explicit acknowledge; allow-all rejected in prod); `PolicyGate` local-pre-classifier + delegate with `LocallyClassified` flag and zeroed-hash marker.
- Sealed evidence-bundle + hash-chained receipt ledger + offline verifier (`h-evidence-seal`, extended by Evidence Ledger canon: chain-over-collection, canonical vocabulary only).

## Out of scope
- Reimplementing Runtime policy evaluation, Cortex storage internals, Collective cognition, or Gateway transport inside MarketOps (integration clients only — COLLECTIVE-032 class violation otherwise).
- Live Runtime authorization before a live Runtime exists; beta stays proposal-side until S9 lands against a real endpoint.
- Public "Keon-governed" or "Proven" claims until sealed bundles + chain verification exist (EHG-009, EL-010).
- Gated internal Keon working-name vocabulary in any public copy (EL-010).
- Full SaaS hardening (belongs to the $40M track, not this line).

## Success criteria
- [ ] Contracts PR merged: `KeonEnvelope`, `DecisionRequest/Disposition`, `DeliberationCandidate`, `ScanReceipt`, `LedgerEntry` mirrors (aligned to BioStack adapter vocabulary, joint review before merge).
- [ ] S8 transport live against fixtures, then a real gateway; correlation threads into MarketOps receipts.
- [ ] S13 scan receipts on customer-finder/citation paths; sanitized-only ingestion proven by negative tests.
- [ ] S10 deliberation evidence lands in claim receipts; S12 assembly conformance tests green.
- [ ] S11 mirror + epoch anchoring; proof bundle composes for the valuation packet.
- [ ] S9 authorization against live Runtime in beta; local policy stays proposal-side with `LocallyClassified`-style marking.
- [ ] INT-keon matrix green in beta; `h-evidence-seal` (bundles + chain + verifier + CI gate) done before any public proof claims.

## Release gates
contracts-aligned → spike-ok (gateway fixture round-trip + denial receipt) → S8+S13 merged → S10+S12 merged → S11 merged → S9 beta-live → INT-keon beta-pass → seal-complete → evidence≈claims → Milestone-B packet.

## Required evidence
Contract fixtures + adapter tests per surface; gateway envelope golden payloads; scan determinism double-runs + redaction-leak tests; deliberation non-authority tests; chain verifier + tamper vectors; sealed bundles with per-artifact SHA256 cited by version in every status claim.

## Security posture
Tenant/actor bind at every Keon call; per-tool scopes (incl. `keon:browseahead:scan`); no secret material in repo; unanchored rows unmistakable (distinct URI + zeroed policy marker); ingestion never validates (EL-008); embedder/LLM outputs never authority; beta stays fail-closed on Keon unavailability for effect-bearing paths.

## Human decision owners
Scope/schedule: coordinator + product owner. Canon interpretation: Keon canon owners. Pilot contracts: product owner. Live Runtime endpoint + credentials: Keon operators (out of this repo).

## Stop conditions
The coordinator must stop and request direction if:
- A Keon endpoint, credential, or canon interpretation needed for S9/S11 is unavailable.
- BioStack adapter vocabulary and our mirrors drift (contract amendment + joint review before proceeding).
- Any parcel needs live keys, real sends, or public claims to proceed.
- A security boundary (tenant/scope/authority/non-leak) is unclear.
- Beta proposal-side work is pulled into this line (it stays separate until its own gates pass).
