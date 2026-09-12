# Parcels — marketops-private-beta-gtm-40m

| Parcel | Wave | Branch | Worktree | Status | Collision |
|---|---|---|---|---|---|
| w0-contracts-beta | W0 | feat/w0-contracts-beta | C:\Repos\MarketOps.w0-contracts-beta | dispatched | Low |
| w0-spike-tenant-deny-receipt | W0 | feat/w0-spike-tenant-deny-receipt | C:\Repos\MarketOps.w0-spike-tenant-deny-receipt | proposed (blocked on contracts) | Low |
| w1-auth-middleware-scope | W1 | feat/w1-auth-tenant-scope | pending | proposed | Medium |
| w1-postgres-rls-migrate | W1 | feat/w1-postgres-rls-migrate | pending | proposed | High |
| w1-secrets-vault-failclosed | W1 | feat/w1-secrets-vault-failclosed | pending | proposed | Medium |
| w1-claim-eval-harness | W1 | feat/w1-claim-eval-harness | pending | proposed | Low |
| w1-email-compliance-gates | W1 | feat/w1-email-compliance-gates | pending | proposed | Medium |
| w1-private-site-waitlist | W1 | feat/w1-private-site-waitlist | pending | proposed | Low |
| w1-pricing-entitlement-spec | W1 | feat/w1-pricing-entitlement-spec | pending | proposed | Low |

## Dependency graph
w0-contracts-beta → w0-spike → all w1-* → w2-* (serialized) → INT → H → R.

## Collision-risk files
package.json/lockfile, next.config.ts, src/app/layout.tsx, src/components/app-shell.tsx, src/lib/*/db.ts, contracts/*.json, MarketOps.sln — serialize, track in index, merge sequentially.
