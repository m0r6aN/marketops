# Risks — marketops-private-beta-gtm-40m

| ID | Title | Severity | Status | Mitigation |
|---|---|---|---|---|
| r-dirty-tree | Untracked assets/ + 303k patch + foreign edgeless-co-etsy-launch/ in main checkout | medium | open | leave untracked; parcel work isolated in worktrees |
| r-serialization | 13 SQLite db.ts modules + shared app-shell/layout collide across W1 | high | closed | w1-postgres landed swap cleanly; active collision now only #24-vs-#25 lockfile (serialize: #25 then #24-with-rebase) |
| r-contract-drift | Silent contract change across 5 new schemas | high | open | PDD stop-and-report + amendment rule; zero drift to date |
| r-hosting-undecided | Fly vs Azure undecided blocks infra parcels | high | closed | Azure decided; runbooks in #24/#25 |
| r-pg-live-unverified | PG RLS + Key Vault paths unverified live (no Azure in parcels) | high | open | INT int-tenant-isolation + int-receipt-verify in beta env; R1–R7 checklist in runbook |
