# MarketOps Operating Model

## Purpose

MarketOps is the operating surface for planning, reviewing, and tracking market-facing work.
Keon is the governance and execution system that may later automate parts of that work under explicit policy.

In this phase, MarketOps defines the operating model and includes limited runtime support for campaign planning, customer discovery, and review-only outreach preparation.
It does not claim that live Keon runtime integration already exists, and it does not authorize autonomous outbound delivery.

## MarketOps and Keon

MarketOps and Keon have different roles:

- MarketOps organizes the work: initiatives, campaigns, assets, approvals, and receipts.
- Keon is the later execution and governance layer that may bound how agents act, what requires approval, and what receipts must be recorded.

This relationship matters because MarketOps is not described here as standalone generic marketing software.
It is the product surface where proposed work, review decisions, execution events, and receipts can be modeled in a way Keon can eventually govern.

PR 0 only establishes that model.
It does not add a policy engine, execution engine, runtime connector, or live integration path.

## Core Loop

The operating loop is:

1. A proposal is created.
2. A person or policy-required reviewer approves, rejects, or requests changes.
3. A later execution step may occur within the allowed automation boundary for that work.
4. A receipt is recorded for that step.
5. Operators can review the receipt to confirm the recorded step and what still needs attention.

In short: proposal -> approval -> execution -> receipt.

That loop keeps planning, control, action, and review connected.
It also gives later automation a recorded decision trail instead of treating execution as an opaque background event.

## Core Entities

Each core entity has a specific role in the model:

- `Initiative`: the portfolio-level operating unit. It groups work around a business objective or program.
- `Medium`: the delivery surface or channel where work appears, such as a site, email stream, social surface, or partner channel.
- `Campaign`: the execution lane that ties an initiative to one or more mediums and to a concrete delivery objective. Discovery campaigns may begin in planning state before any launch work exists.
- `ContentAsset`: the concrete artifact prepared, revised, approved, or published through a campaign and medium.
- `Persona`: the target audience or operator context that shapes messaging, review, and delivery choices.
- `Agent`: a bounded execution actor that may assist or act only within the automation level and approval state allowed for the work.
- `OperatorAlert`: a human-facing warning, escalation, or review signal that says something needs attention.
- `Integration`: the seam to an external system, service, or tool.
- `Receipt`: the reviewable record of a proposal, approval, execution step, or verification outcome.
- `AutomationPolicy`: the contract that states how much automation is allowed and under what constraints.
- `ApprovalState`: the recorded review status for a step that requires human or policy-governed approval.

These entities are meant to make the operating model explicit before deeper runtime behavior is added.

## Customer Discovery and Outreach Planning Boundaries

Customer discovery is a planning capability inside MarketOps.
It is intentionally separated from outbound delivery.

The currently approved flow is:

1. suggest an editable target-customer description
2. let the operator choose approved data sources
3. create a planning campaign and record provenance
4. process supported sources honestly
5. deduplicate candidates while retaining source provenance
6. prepare review-required outreach drafts from verified facts

This flow must not:

- invent contact details or candidate facts
- claim a source was processed when it was unavailable
- bypass source access controls, rate limits, or terms of service
- send messages automatically
- collapse verified evidence and model inference into one undifferentiated field

Outbound delivery remains a separately governed capability and is not authorized by this flow.

## What Receipts Prove

Receipts prove that a specific bounded step or execution event was recorded according to the contract used by that lane.
Depending on the step, a receipt may prove that work was proposed, approved, that a recorded execution step occurred, or that a review or verification event was recorded.

Receipts do not prove:

- that a business claim is universally true
- that all future executions are safe
- that an external system is correct because it is configured
- that a policy or runtime integration already exists if that integration has not been implemented

A receipt is evidence about what was recorded in a specific flow.
It is not a blanket guarantee about everything around that flow.

## Why Approvals Exist

Approvals exist because not every marketing or integration action should be allowed to execute autonomously.

Some work changes public-facing claims.
Some work touches external systems.
Some work may be low risk and routine.
Some work may be sensitive enough that a human must review it before anything happens.

The approval layer exists to make those distinctions explicit and recordable.
It gives operators a clear point to allow, deny, or escalate work before a later execution step is allowed to proceed.

## Why Automation Levels Exist

Automation levels exist so the system can distinguish between:

- work done directly by humans
- work prepared by agents but held for review
- work that may execute after approval within a defined boundary
- work that remains blocked until policy or review conditions are satisfied

Without automation levels, the system cannot say what kind of action was permitted, what level of autonomy was modeled, or why a later step was or was not allowed to run.
The levels are there to keep execution legible and governable.

## Why PR 0 Is Contract-Only

PR 0 is contract-only so later lanes can build against shared terms before runtime behavior is introduced.

That boundary is deliberate:

- no live Keon integration
- no autonomous outbound delivery
- no policy engine for external send authorization
- no hidden database-coupled automation behavior that bypasses review

This keeps the foundation narrow.
It gives later implementation lanes stable entity definitions and operating-language seams without pretending the end-to-end execution path is already live.
