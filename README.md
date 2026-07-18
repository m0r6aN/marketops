# MarketOps

MarketOps is an internal, all-in-one marketing operations website for running the complete marketing lifecycle: customer discovery, campaign planning, content development, outreach preparation, execution, measurement, and optimization.

It is designed to help operators manage product marketing, sales support, content distribution, campaign readiness, medium selection, agent activity, revenue signals, cloud/service health, approvals, and receipts from one workspace.

MarketOps is product-agnostic. It can be used for any product, brand, startup, internal platform, service, or portfolio initiative.

Keon may be used as the governance layer for higher-automation workflows, but MarketOps does not require Keon to be useful. The core product stands on its own as a marketing operations command center.

## Core product idea

MarketOps answers a practical operating question:

> What should we market, where should we ship it, what content fits each medium, what claims are safe, what needs approval, what automation is allowed, what worked, and what proof exists that the work happened correctly?

The operating loop is:

1. **Plan** initiatives, campaigns, mediums, content, audiences, and launch paths.
2. **Review** claims, readiness, risk, approval requirements, and automation eligibility.
3. **Activate** the right mediums in the right order.
4. **Automate** safe work through bounded agents and integration policies.
5. **Monitor** inboxes, revenue, cloud health, medium activity, support signals, and campaign performance.
6. **Approve** sensitive actions before external side effects occur.
7. **Record receipts** for proposals, approvals, decisions, execution intents, outcomes, and verification events.
8. **Optimize** future campaigns using actual performance, ROI, and operational feedback.

MarketOps is not just a campaign tracker. It is a minimal-interface command center for running marketing and related operating workflows across one product or an entire product portfolio.

## Product positioning

MarketOps is built around four major ideas:

* **Minimal interfaces** - reduce context switching across email, Stripe, cloud dashboards, social platforms, directories, campaign tools, spreadsheets, and notes.
* **Governed automation** - agents can observe, classify, draft, recommend, and eventually execute only within explicit policy boundaries.
* **Medium intelligence** - every marketing medium has different audience fit, content fit, cost model, risk profile, automation potential, and ROI behavior.
* **Receipts over narrative** - meaningful actions should produce an inspectable trail so operators can prove what happened, what was approved, and what remains blocked.

## Product implementation posture

MarketOps is currently built for internal use. Product workflows should be implemented according to operator needs first; commercialization, tenant governance, and packaging controls can be introduced later through the existing adapter and policy seams.

Implementation principles:

* Customer discovery, campaign management, outreach, engagement, execution, and growth analysis are first-class product capabilities.
* Keon Runtime, Collective, and Cortex may be integrated where they materially improve execution, coordination, memory, or evidence; MarketOps remains useful without them.
* External integrations may support read and write actions when the provider permits them and the operator has explicitly configured the account and desired workflow.
* Evidence, provenance, observability, honest status, and failure reporting should be preserved across manual and automated work.
* Controls should be proportional to a real workflow, provider rule, safety need, or legal obligation—not retained solely because earlier documentation treated them as doctrine.
* A capability that only plans or drafts must never be reported as having executed an external action.

## Features

### Customer Finder and outreach planning

MarketOps includes an evidence-backed Customer Finder inside the Campaigns workspace. It turns an editable target description into a planning campaign, processes supported discovery sources, deduplicates candidates, and preserves source provenance.

The implementation supports:

* initiative-aware target-customer suggestions
* explicit supported and unsupported source visibility
* manual CSV, company-website seed, and GitHub discovery inputs
* planning-state campaigns with idempotency and retained provenance
* deduplicated candidate records with verified evidence and confidence
* review-required outreach drafts across email, LinkedIn, X, and CRM CSV channels
* durable local SQLite state, workspace purge, and 90-day retention handling

Message delivery remains an explicit later adapter. A generated draft is never represented as sent.

### Product and initiative command center

MarketOps organizes each product, initiative, or brand into an operator-facing cockpit.

Planned and current concepts include:

* Product and initiative registry
* Campaign status
* Active mediums
* Content assets
* Personas
* Operator alerts
* Inbox state
* Revenue state
* Cloud/service health
* Automation posture
* Approval requirements
* Receipt history
* Recommended next actions

Examples of products that could be managed in MarketOps:

* SaaS applications
* AI tools
* developer platforms
* consulting services
* internal enterprise products
* creator products
* marketplaces
* portfolio companies
* Keon ecosystem products
* non-Keon products

### Medium intelligence registry

MarketOps is designed to track where marketing can happen and whether each medium is appropriate for a given product.

Mediums may include:

* LinkedIn
* email
* product directories
* AI directories
* Product Hunt
* Reddit
* Hacker News
* GitHub
* industry forums
* partner ecosystems
* marketplaces
* newsletters
* podcasts
* webinars
* paid ads
* SEO pages
* comparison pages
* docs and changelogs
* communities
* review platforms
* cloud marketplaces
* platform ecosystems such as Redis, Azure, Vercel, GitHub, OpenAI, Anthropic, Hugging Face, Zapier, Make, and n8n

Each medium can track:

* category
* surfaces
* audience fit
* industry fit
* application fit
* funnel stage
* content formats
* cost model
* automation eligibility
* risk profile
* required assets
* active campaigns
* ROI history
* recommended first action
* stop conditions
* scale conditions

### Medium surfaces

A medium is not just a place to post. Many mediums have multiple surfaces.

Examples:

* posts
* comments
* direct messages
* mentions
* lead forms
* listing questions
* reviews
* community threads
* support messages
* partner inquiries
* ad comments
* webhook events
* marketplace messages

MarketOps should eventually let operators assign an automation policy per surface.

Example:

* LinkedIn posts: draft and schedule with approval
* LinkedIn comments: draft replies only
* LinkedIn DMs: monitor and classify, approval required for response
* Reddit: monitor only, no automated posting
* Email support: auto-draft responses, auto-send only for low-risk approved templates
* Azure health: recommend remediation, auto-remediate only reversible low-risk issues

### Content-to-medium fit

MarketOps tracks which content assets are suitable for which mediums.

Content assets may include:

* founder posts
* technical blogs
* launch blurbs
* product pages
* landing pages
* whitepapers
* proof tours
* case studies
* sales one-pagers
* comparison pages
* email sequences
* social posts
* directory listings
* demo videos
* screenshots
* changelogs
* docs excerpts
* support answers
* partner copy

Each content asset can track:

* asset type
* target product
* target campaign
* best-fit mediums
* bad-fit mediums
* required adaptation
* claim sensitivity
* approval state
* source material
* related receipts
* expiration or review date
* use-for tags

Example use-for tags:

* Social Media
* Email
* Directory Listing
* Whitepaper
* Proof Tour
* Founder Post
* Technical Blog
* Community Discussion
* Sales Follow-up
* Partner Listing
* Product Page
* Paid Ad
* Webinar
* Newsletter
* Support Response

### Claim safety and review

MarketOps helps separate:

* claims that are safe to publish
* claims that need proof
* claims that need softer wording
* claims that are internal-only
* claims that should be blocked
* claims that require human approval
* claims that require legal, compliance, medical, security, or executive review

This is especially important for regulated, enterprise, AI, healthcare, security, financial, and technical products.

### Medium-aware claim hygiene

Different mediums tolerate different language.

For example:

* LinkedIn may support founder-led proof language.
* Reddit and Hacker News require careful, non-salesy technical framing.
* Healthcare content must avoid medical advice or treatment claims.
* Paid ads may require platform-policy-safe wording.
* Enterprise comparison pages need stronger evidence and careful competitor language.
* Directory listings need concise, factual positioning.
* Sales emails need low-friction CTAs and unsubscribe compliance.

MarketOps is intended to help adapt content to each medium without inventing unsupported claims.

### Campaign workspace

MarketOps supports campaign planning and execution workflows.

Current and planned campaign capabilities include:

* campaign list and workspace foundations
* campaign cards
* campaign status
* launch planning
* claim sensitivity
* readiness tracking
* linked initiatives
* linked mediums
* linked content assets
* approval state
* automation policy reference
* performance snapshots
* ROI tracking
* receipt trail

Campaigns should eventually answer:

* What is the campaign goal?
* Which product does it support?
* Which mediums are activated?
* Which content assets are used?
* What claims are allowed?
* What approvals are required?
* What automation is allowed?
* What budget or capacity caps apply?
* What stop conditions exist?
* What receipts prove the campaign was reviewed and executed correctly?

### Where to start first

MarketOps should not push every product into every channel immediately.

The product is designed around controlled activation:

1. Smoke test
2. Soft activation
3. Controlled automation
4. Scaled activation
5. Optimization loop

Planned readiness checks include:

* Is the landing page ready?
* Is the CTA clear?
* Is tracking configured?
* Is the right content available?
* Is claim hygiene complete?
* Is follow-up automation ready?
* Is support capacity available?
* Is the medium appropriate for this product maturity stage?
* Is the automation policy safe?
* Are budget and lead-volume caps defined?
* Are stop conditions defined?

MarketOps should be able to recommend:

* start here
* do not activate this yet
* monitor only
* draft only
* approval required
* safe to schedule
* safe to scale

### Marketing automation

MarketOps is designed to support marketing automation without blindly turning agents loose.

Automation levels include concepts such as:

* manual only
* observe only
* draft only
* review required
* safe to schedule
* safe to auto-respond
* safe to auto-remediate
* approval required
* forbidden

Automation should be bounded by:

* product
* medium
* surface
* persona
* agent capability
* claim sensitivity
* risk level
* approval requirement
* daily action limits
* budget caps
* escalation triggers
* receipt requirements

### Agent monitoring and automation

Agents should be first-class operators inside MarketOps, but with explicit boundaries.

Planned agent types include:

* Inbox Triage Agent
* Medium Monitor Agent
* Content Repurpose Agent
* Claim Hygiene Agent
* Lead Research Agent
* Campaign Analyst Agent
* Support Draft Agent
* Revenue Watch Agent
* Cloud Watch Agent
* Reputation Watch Agent
* Collective Offer Agent

Agents may eventually:

* observe
* classify
* summarize
* recommend
* draft
* request approval
* schedule
* respond
* pause
* remediate
* deploy
* escalate

The governing principle:

> Agents can observe broadly, recommend safely, draft usefully, and act only within explicit policy.

### Marketing personas

MarketOps supports product-specific and medium-specific marketing personas.

A persona can define:

* product fit
* medium fit
* allowed surfaces
* voice
* tone
* audience
* allowed claims
* forbidden claims
* CTA style
* response policy
* automation eligibility
* escalation triggers

Example persona modes:

* Founder Voice
* Enterprise Proof Voice
* Technical Community Voice
* Support Agent
* Curiosity Agent
* Directory Listing Voice
* Provider Professional Voice
* Silent Monitor
* Sales Follow-up Voice
* Partner Ecosystem Voice

Persona behavior can vary by medium.

Examples:

* Agents may post material but not respond.
* Agents may draft responses but require human approval.
* Agents may answer low-risk questions from approved source material.
* Agents may monitor only.
* Agents may build curiosity through controlled hints and clues.
* Agents may escalate sensitive topics.

### Operator inbox

MarketOps is designed around one unified action inbox.

The operator inbox can bring together:

* new leads
* email messages requiring review
* Stripe events
* payment failures
* trial ending alerts
* LinkedIn comments
* direct messages
* directory questions
* campaign warnings
* claim hygiene blocks
* cloud health events
* cost spikes
* agent drafts
* approval requests
* medium risk alerts
* support escalations
* receipt verification events

Each alert should include:

* product
* source
* severity
* recommended action
* responsible agent
* automation eligibility
* related campaign
* related medium
* related customer or prospect
* receipt trail

### Email integration

Per-product email integration is planned to reduce surface switching and improve reporting.

Email workflows may include:

* product-specific inboxes
* support inboxes
* sales inboxes
* access request inboxes
* lead classification
* support classification
* partnership detection
* investor/media detection
* spam suppression
* auto-labeling
* auto-draft replies
* approved auto-response for low-risk cases
* escalation routing
* unanswered-message detection
* sentiment detection
* campaign/medium attribution
* customer timeline

Examples:

* [support@example-product.com](mailto:support@example-product.com)
* [access@example-product.com](mailto:access@example-product.com)
* [hello@example-product.com](mailto:hello@example-product.com)
* [partnerships@example-product.com](mailto:partnerships@example-product.com)

### Stripe and revenue integration

Per-product Stripe integration is planned for revenue and ROI visibility.

Revenue features may include:

* MRR
* ARR
* new subscriptions
* canceled subscriptions
* failed payments
* trials started
* trials ending soon
* refunds
* disputes
* revenue by product
* revenue by plan
* revenue by campaign
* revenue by medium
* revenue by customer segment
* conversion attribution
* lead-to-revenue timelines

The intended goal is to connect marketing activity to business outcomes.

Example:

> LinkedIn post -> access request -> email thread -> demo -> Stripe subscription -> revenue receipt.

### Azure and cloud monitoring

MarketOps is intended to monitor cloud/service health for products under management.

Azure monitoring is a planned first-class target, with room for other cloud providers later.

Potential monitored surfaces include:

* Azure Container Apps
* App Service
* Azure Functions
* PostgreSQL
* Storage
* Key Vault
* Application Insights
* Log Analytics
* Container Registry
* DNS and custom domains
* SSL certificates
* deployment status
* error rates
* latency
* scale events
* cost spikes

Auto-remediation should be safety-tiered:

* observe
* recommend
* draft action
* safe auto-remediate
* approval required
* forbidden

Examples of safe or reviewable remediation:

* restart unhealthy container app
* scale up temporarily
* scale down after traffic drop
* retry failed job
* alert on failed deployment
* warn on SSL expiration
* detect runaway cost
* detect database connection exhaustion
* prepare remediation command for approval

### Cost, performance, and ROI tracking

MarketOps is designed to track the real performance of each medium and campaign.

Metrics may include:

* cost per visit
* cost per qualified lead
* cost per activated trial
* cost per customer
* MRR influenced
* ARR influenced
* assisted conversions
* time to conversion
* content reuse value
* lead quality
* support burden
* unsubscribe rate
* negative signal rate
* churn impact
* trial activation rate
* onboarding success
* cloud cost impact
* agent labor saved
* human review time

MarketOps should eventually maintain a medium ROI ledger for each product and campaign.

### Experiment design

MarketOps should help design and remember marketing experiments.

An experiment can define:

* hypothesis
* target audience
* product
* medium
* content asset
* CTA
* budget cap
* duration
* success metric
* failure threshold
* expected learning
* postmortem result
* related receipts

This prevents repeated random marketing attempts and builds a useful memory of what worked, what failed, and why.

### Competitive and ecosystem intelligence

Planned intelligence features include:

* competitor medium tracking
* competitor messaging analysis
* directory presence tracking
* partner ecosystem tracking
* launch history
* ad copy tracking
* SEO page tracking
* channel gap analysis
* market opportunity detection

MarketOps should help operators find underused channels and avoid copying competitors blindly.

### Budget and capacity governors

MarketOps should support controlled growth.

Governors may include:

* maximum campaign spend
* maximum daily spend
* maximum leads per week
* maximum trials per product
* maximum support tickets
* maximum outbound messages
* maximum automated actions
* maximum cloud spend
* maximum unresolved alerts
* auto-pause thresholds

This allows teams to grow slowly, validate processes, harden automation, and avoid overwhelming support or operations.

### Saturation and fatigue detection

MarketOps should detect when a medium or campaign is degrading.

Signals may include:

* declining click-through rate
* lower engagement
* repeated audience overlap
* rising unsubscribe rate
* increasing negative comments
* flat conversion despite more activity
* poor-fit lead increase
* campaign-driven support burden
* churn spike after acquisition campaign

Recommended actions may include:

* pause campaign
* reduce cadence
* change CTA
* change medium
* improve landing page
* update claim language
* adjust audience
* improve onboarding before scaling

### Reports and operator briefings

Planned reports include:

* weekly operator brief
* product performance summary
* medium performance report
* campaign ROI report
* lead quality report
* automation activity report
* receipt summary
* approval backlog
* revenue movement
* cloud cost movement
* agent activity summary
* human touch report
* recommended next actions

A weekly operator brief should answer:

* What happened?
* What worked?
* What failed?
* What needs approval?
* What did agents handle?
* What required human judgment?
* What revenue moved?
* What costs changed?
* What should happen next?

## Library Canon Foundry

MarketOps includes a SQLite-backed local library for imported source documents and extracted knowledge.

It supports processing modes for:

* `canon`
* `marketing`
* `internal`
* `trash`

The Library Canon Foundry tracks:

* approved and locked canon
* marketing nuggets
* internal notes
* conflicts
* trash records
* review queues
* import batches
* extracted knowledge
* source document context

It is designed to support structured review without inventing unsupported claims.

## Docs as Marketing Review

The Docs as Marketing workflow extracts marketing opportunities from existing source material.

It can identify:

* marketing candidates
* red flags
* asset opportunities
* reusable claims
* content angles
* founder-story material
* landing page opportunities
* social snippets
* sales-deck proof points
* SEO and knowledge hub opportunities
* risky or unsupported claims

Structured review outputs include:

* marketing candidates
* red flags
* asset opportunities
* summary scoring

Review outputs can be persisted into Library tables through a transaction-safe writer.

## MCP integration package

MarketOps includes a nested MCP server at:

```text
mcp/marketops-mcp
```

The MCP package:

* exposes `docs_as_marketing_review` as a schema-bounded MCP stdio tool
* uses deterministic mock behavior for builds and tests without API keys
* exposes rubric, skill, and examples as `marketops://` MCP resources
* supports agent-assisted marketing review without requiring large prompt pastes

The MCP server uses stdio JSON-RPC and does not expose an HTTP listener by default.

## Governance and proof pipeline

MarketOps includes a .NET solution with core contracts, CLI, API host, governance adapter seams, and tests.

The pipeline models two execution modes:

* `dry_run` - identical planning pipeline, zero external side effects
* `prod` - same pipeline, with governed side effects when authorization is available

Pipeline concepts include:

* discovery
* selection
* verification
* evaluation
* planning
* execution
* sealing

The pipeline records side-effect intents and proof-ledger-style artifacts.

Current seams support `PublishPacket` and `GateResult` workflows through REST and CLI surfaces.

## Proof and receipt primitives

MarketOps uses receipt concepts to make work inspectable.

Receipt-worthy events may include:

* campaign proposal
* campaign approval
* content review
* claim hygiene result
* medium activation
* automation policy decision
* agent recommendation
* operator approval
* integration event
* cloud event
* revenue event
* publish intent
* execution result
* verification result

Receipts should eventually answer:

* What was proposed?
* What was reviewed?
* What policy applied?
* Who or what approved it?
* What action was attempted?
* What actually happened?
* What evidence was used?
* What remains blocked?
* What can be verified?

## Keon governance integration

MarketOps can operate independently, but it is designed to integrate with Keon for higher-assurance automation.

The intended division is:

| Layer                    | Responsibility                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MarketOps                | Organizes products, initiatives, mediums, campaigns, content, personas, agents, alerts, integrations, approvals, readiness, revenue signals, cloud signals, and receipts. |
| Keon                     | Governs automation boundaries, policy decisions, execution permissions, and receipt requirements where configured.                                                        |
| MCP                      | Provides agent-facing tool interfaces for structured MarketOps workflows.                                                                                                 |
| Governance adapter seams | Provide explicit integration boundaries for future policy, audit, verification, and execution flows.                                                                      |

The intended integration path is:

1. **Contract-first modeling** - shared MarketOps types define products, initiatives, mediums, campaigns, assets, personas, agents, alerts, integrations, receipts, automation policies, and approval states.
2. **Governance seams** - publish/gate packets flow through decision, audit, verification, and optional execution ports.
3. **Receipts everywhere** - approvals, decisions, evidence verification, side-effect intents, and outcomes become inspectable records.
4. **Bounded automation** - agents may prepare or execute only within an approved capability level and policy boundary.
5. **Live governance runtime** - later integration may connect those seams to production Keon services without coupling the UI or domain model directly to Keon internals.

Important current constraint:

* Live Keon runtime integration is not yet implemented in the active app.
* `src/legacy/MarketOps.Keon` is retained as an archive and should not be used as the active integration path.

## Example use cases

### 1. Automating marketing for any product

Use MarketOps to manage marketing operations for a SaaS product, AI tool, internal platform, consulting service, or portfolio company.

MarketOps can help organize:

* what to market
* which mediums fit
* what content exists
* what content is missing
* what claims are safe
* what needs approval
* what automations are allowed
* which leads came from which medium
* which efforts produced revenue

### 2. Launch readiness

Use MarketOps to evaluate whether a product or campaign is ready for public motion:

* positioning is clear
* risky claims are identified
* proof requirements are visible
* required assets exist
* launch checklist gaps are surfaced
* support capacity is considered
* follow-up automation is ready
* tracking is in place

### 3. Claim-safe campaign planning

MarketOps helps separate:

* claims that are safe to publish
* claims that need proof
* claims that should be rewritten
* claims that should be blocked
* internal notes that should not leak into public copy

### 4. Turning docs into marketing assets

The Docs as Marketing workflow mines documentation for:

* landing page angles
* sales-deck proof points
* SEO and knowledge hub opportunities
* social snippets
* conversion asset ideas
* public proof points
* risky or unsupported claims

### 5. Product-aware inbox automation

MarketOps can eventually monitor product-specific inboxes, classify messages, draft responses, escalate sensitive issues, and connect inbound messages to campaigns, mediums, customers, and receipts.

### 6. Revenue-aware marketing operations

With Stripe integration, MarketOps can connect campaign and medium activity to revenue events, subscription changes, failed payments, trials, churn, and ROI.

### 7. Cloud-aware product operations

With Azure and future cloud integrations, MarketOps can surface product health, deployment issues, error spikes, latency, cost movement, and safe remediation recommendations alongside marketing and revenue signals.

### 8. Agent-assisted marketing review

Agents can call the MCP tool with a bounded input/output schema instead of pasting long prompts. This makes review behavior more repeatable and easier to validate.

### 9. Governance-aware publishing

The .NET pipeline models how a publish packet can move through precheck and gate decisions before any external side effect is allowed.

This supports future workflows such as:

* publish release
* open PR
* tag repo
* publish post
* send approved email
* update directory listing
* write auditable evidence packs

### 10. Keon-governed automation

Where Keon is configured, MarketOps can use Keon-style governance concepts in real product workflows:

1. MarketOps observes product and marketing state.
2. An agent or system proposes an action.
3. Policy determines whether the action is allowed, blocked, or requires approval.
4. A human approves when needed.
5. Agents execute within bounded capability levels.
6. MarketOps records receipts.
7. Keon governs higher-automation execution boundaries.
8. Receipts prove what happened.

## Repository layout

```text
.
├── contracts/                 # JSON schemas for publish/gate contracts
├── docs/                      # Operating docs, roadmap, runbooks, PR plans
├── mcp/marketops-mcp/         # MCP stdio server for MarketOps tools
├── public/                    # Next.js public assets
├── src/
│   ├── app/                   # Next.js app routes
│   ├── components/            # UI components
│   ├── lib/                   # Frontend/domain services and local SQLite modules
│   ├── MarketOps/             # .NET core contracts, pipeline, policy, proof primitives
│   ├── MarketOps.Api.Host/    # .NET API host
│   ├── MarketOps.Cli/         # .NET CLI for precheck/gate workflows
│   ├── MarketOps.OmegaSdk/    # Governance adapter seam
│   ├── Omega.Sdk/             # Minimal SDK stub for builds/tests
│   └── legacy/                # Archived integration code, not active path
├── tests/MarketOps.Tests/     # .NET test suite
├── tools/                     # Auxiliary verification/emission tools
├── package.json               # Root Next.js app scripts
└── MarketOps.sln              # .NET solution
```

## Tech stack

### Frontend and app

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS 4
* shadcn-style component configuration
* `better-sqlite3` for local app state

### Agent tooling

* MCP stdio server
* TypeScript
* JSON Schema validation with Ajv
* Docker and Compose support for the MCP package

### Backend and governance pipeline

* .NET 10 projects
* xUnit tests
* CLI and API host seams
* governance decision, evidence, and execution ports
* canonicalization and signing helpers

## Requirements

* Node.js 20+
* npm
* .NET SDK 10+
* Docker, optional, for MCP container workflows

## Getting started

### Install root app dependencies

```bash
npm install
```

### Run the Next.js app

```bash
npm run dev
```

The dev server is configured to run on port `4333`.

### Build the app

```bash
npm run build
```

### Lint and typecheck

```bash
npm run lint
npm run typecheck
```

## .NET workflows

### Restore, build, and test solution

```bash
dotnet restore MarketOps.sln
dotnet build MarketOps.sln
dotnet test MarketOps.sln
```

### CLI usage

The CLI supports precheck and gate flows over a `PublishPacket` JSON file.

```bash
dotnet run --project src/MarketOps.Cli -- precheck --packet src/MarketOps.Cli/test-packet.json --pretty
```

```bash
dotnet run --project src/MarketOps.Cli -- gate --packet src/MarketOps.Cli/test-packet.json --control-url <governance-url> --pretty
```

Notes:

* `precheck` does not call governance and does not verify evidence.
* `gate` requires `--control-url` or a configured governance URL environment variable.
* `--execute` enables the execution stage where supported by the configured governance client.

## MCP server

The MCP package lives in:

```text
mcp/marketops-mcp
```

### Build

```bash
cd mcp/marketops-mcp
npm install
npm run build
```

### Run locally over stdio

```bash
npm start
```

### Test

```bash
npm test
```

### Docker

```bash
docker build -t marketops-mcp-docs-marketing ./mcp/marketops-mcp
docker run --rm -i marketops-mcp-docs-marketing
```

The MCP server uses stdio JSON-RPC. It does not expose an HTTP listener by default.

## Local data and environment

The app writes local runtime state under `.marketops/`, including SQLite data such as `marketops.sqlite`. These files are ignored by Git.

Local environment files are ignored by default:

* `.env`
* `.env.*`

Example/template files remain trackable:

* `.env.example`
* `.env.sample`
* `.env.template`

Relevant model/provider environment names appear in code and docs, including:

* `ANTHROPIC_STRONG_MODEL`
* `BLACKBOX_API_BASE_URL`
* `BLACKBOX_MODEL`
* `BLACKBOX_STRONG_MODEL`
* `BLACKBOX_LOCAL_MODEL`
* `OLLAMA_HOST`
* `OLLAMA_MODEL`
* `OMEGA_SDK_URL`

Future integration environment names may include provider-specific settings for:

* email providers
* Stripe
* Azure
* analytics
* social platforms
* directory providers
* governance runtimes

## Verification checklist

Before committing substantive changes, run the standard checks:

```bash
npm run build
npm run lint
npm run typecheck
dotnet test MarketOps.sln
git status --short
```

For MCP-specific changes:

```bash
cd mcp/marketops-mcp
npm run build
npm test
```

## Current roadmap themes

Active and deferred lanes include:

* MarketOps contract foundation
* product and initiative cockpits
* medium registry
* content-to-medium fit matrix
* campaign workspace foundation
* asset library foundation
* persona engine
* agent capability matrix
* operator inbox
* integrations command center
* email integration shell
* Stripe and revenue integration shell
* Azure monitoring shell
* automation policy model
* receipt viewer and audit trail
* metrics snapshots
* campaign editor
* claim helper tests
* claim rationale UI rendering
* public and repo URL population for initiatives
* monetization planning surfaces
* AI-assisted campaign generation after claim hygiene stabilizes
* analytics integrations through side-effect interfaces
* authentication
* multi-tenant workspaces after a scoped spec
* Keon-governed automation integration through explicit seams

See `docs/ROADMAP.md` for the living roadmap.

## Design principles

* **Product-agnostic first** - MarketOps should support any product, not only one ecosystem.
* **Minimal interfaces** - reduce the number of tools an operator must constantly monitor.
* **Receipts over narrative** - claims about execution should be backed by inspectable artifacts.
* **Contract-first integration** - shared types and schemas precede runtime coupling.
* **Human review before risky automation** - approval state and automation level are first-class concepts.
* **Read-only before write** - integrations should observe before they mutate external systems.
* **Draft before execute** - agents should draft safely before they are allowed to act.
* **No hidden side effects in dry run** - dry-run mode should model the same pipeline without external mutation.
* **Canon is protected** - public-facing durable truths should be extracted, reviewed, approved, and conflict-checked.
* **Mediums are not equal** - every medium has different audience fit, risk, automation potential, and ROI behavior.
* **Governance stays explicit** - Keon or any other governance runtime should integrate through explicit seams, not hidden coupling.

## Status

MarketOps is under active development.

The safest reading is:

* The Next.js operator UI and local library foundations are active app surfaces.
* The MCP Docs as Marketing tool is implemented as a structured stdio server.
* The .NET pipeline, contracts, CLI, and tests model governance-aware publish flows.
* The shared MarketOps contract layer defines product, medium, campaign, content, persona, agent, alert, integration, receipt, automation policy, and approval concepts.
* Email, Stripe, Azure, operator inbox, agent monitoring, persona-driven automation, medium intelligence, ROI tracking, and live Keon governance integration are planned or staged features unless explicitly implemented in the active app.
