# Parcels — marketops-private-beta-gtm-40m

| Parcel | Wave | Branch | Worktree | Status | Collision |
|---|---|---|---|---|---|
| w0-contracts-beta | W0 | feat/w0-contracts-beta | (pruned) | merged (#15) | Low |
| w0-spike-tenant-deny-receipt | W0 | feat/w0-spike-tenant-deny-receipt | (pruned) | merged (#16) | Low |
| w1-claim-eval-harness | W1 | feat/w1-claim-eval-harness | (pruned) | merged (#20) | Low |
| w1-email-compliance-gates | W1 | feat/w1-email-compliance-gates | (pruned) | merged (#19) | Medium |
| w1-private-site-waitlist | W1 | feat/w1-private-site-waitlist | (pruned) | merged (#21) | Low |
| w1-pricing-entitlement-spec | W1 | feat/w1-pricing-entitlement-spec | (pruned) | merged (#18) | Low |
| w1-auth-middleware-scope | W1 | feat/w1-auth-middleware-scope | C:\Repos\MarketOps.w1-auth-middleware-scope | in-review (#23) | Medium |
| w1-postgres-rls-migrate | W1 | feat/w1-postgres-rls-migrate | C:\Repos\MarketOps.w1-postgres-rls-migrate | in-review (#25) | High |
| w1-secrets-vault-failclosed | W1 | feat/w1-secrets-vault-failclosed | C:\Repos\MarketOps.w1-secrets-vault-failclosed | in-review (#24) | Medium |
| w1-private-hero | W1 | feat/w1-private-hero | C:\Repos\MarketOps.w1-private-hero | in-review (#22) | Low |

## Dependency graph
w0-contracts-beta → w0-spike → all w1-* → w2-* (serialized) → INT → H → R.

## Collision-risk files
package.json/lockfile, next.config.ts, src/app/layout.tsx, src/components/app-shell.tsx, src/lib/*/db.ts, contracts/*.json, MarketOps.sln — serialize, track in index, merge sequentially.

## Active collision: #24 vs #25
Both touch package.json/package-lock.json (pg vs @azure/* lines). Merge order: #22 → #23 → #25 → #24-with-rebase. No other file overlap between in-review parcels.
