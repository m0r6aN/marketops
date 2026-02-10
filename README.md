# MarketOps

**Evidence-first artifact publishing under dictated governance**

MarketOps publishes technical, operational, and governance proof artifacts only after a full validation cycle that runs through Federation Core and omega-sdk. It retains zero runtime knowledge of legacy vendor control planes; the CLI never imports any forbidden adapters, and every live surface is guarded by a no-vendor-knowledge workflow. When governance is unavailable, unverifiable, or incomplete, publication fails closed.

---

## Guiding doctrine

1. **Zero vendor knowledge.** MarketOps has **no compile-time or runtime coupling** to retired control planes. Any historical adapters live under `src/legacy` for archaeology only.
2. **Fail-closed proof delivery.** Canonical hashes, audit receipts, and verification reports must exist before a packet is published. Missing evidence now results in `FailureStage.Hash`, `FailureStage.Audit`, or `FailureStage.Verify` denies.
3. **One-way governance flow.** The governance substrate governs → omega-sdk executes → MarketOps publishes. MarketOps never reaches back into the control plane, and omega-sdk is the sole surface that touches Federation Core.

---

## MarketOps is

* A deterministic publish pipeline for artifacts, not messaging or engagement.
* A proof emission engine that documents decisions, executions, and verifications.
* A consumer of omega-sdk with a focus on hard failure when the SDK cannot deliver.

MarketOps is not a campaign tool, a cadence engine, or a claim-making machine.

---

## Anti-goals

MarketOps will not incorporate any of the following into core logic or documentation:

1. Copy or claims about growth, ROI, or attention capture.
2. Engagement or cadence-based success metrics.
3. SEO/AEO/GEO manipulations or keyword stuffing.
4. Direct marketing outreach, lead-gen logic, or popularity-driven reasoning.
5. Practices that would obscure governance intent or proof fidelity.

Each pull request is evaluated for these anti-goals before merging.

---

## Operational model

### Local-first publish pipeline

**Observer → Curator → Gate → Delay → Publisher**

* **Observer** detects candidate artifacts.
* **Curator** validates structure and intent.
* **Gate** requests authorization, writes receipts, and verifies evidence.
* **Delay** enforces timing discipline.
* **Publisher** emits artifacts only when all gates report success.

Every stage is deterministic, audited, and “boring by design.”

---

## Governance boundary

* Authorization, verification, and audit happen outside MarketOps (in Federation Core via omega-sdk).
* MarketOps only orchestrates, interprets the results, and records evidence.
* Missing SDK capabilities cause fails (no `HttpClient` workaround) and are logged in `SDK_GAPS.md`.
* MarketOps emits the canonical `GateResult` record, never vendor-specific types.

---

## Defaults (canonical)

* `tenantId`: `federation-public`
* `actorId`: `operator-marketops`
* Allowlist:
  * `federation.systems/site-docs`
  * `federation.systems/public-artifacts`
  * `github:federation/docs`
  * `github:federation/specs`
  * `github:federation/sdk-releases`
  * `diagrams:federation/public`

---

## Repository layout

```
/src
  /MarketOps                # Core pipeline and ports (pure)
  /MarketOps.OmegaSdk        # SDK adapters
  /MarketOps.Cli            # CLI composition root
  /Omega.Sdk                # Minimal omega-sdk stub for builds
/tests
  /MarketOps.Tests
/contracts                  # Canonical schemas
/docs
  ARCHITECTURE.md
  GOVERNANCE.md
```

---

## CLI (v0)

### Precheck

Local validation only; no governance calls.

```bash
marketops precheck --packet ./PublishPacket.json
```

### Gate

Requires omega-sdk control plane access and functioning evidence collection.

```bash
marketops gate --packet ./PublishPacket.json
```

The command exits with `ExitDeniedFailClosed` whenever hashes, audits, or verification cannot be produced.

---

## Design intent

* Be understandable without insider knowledge of any single control plane.
* Prevent accidental governance bypass by hard-failing on gaps.
* Keep the pipeline a proof emitter—nothing else.

MarketOps exists to let systems speak only through what they can prove.
