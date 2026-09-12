# Risks — marketops-private-beta-gtm-40m

| ID | Title | Severity | Status | Mitigation |
|---|---|---|---|---|
| r-dirty-tree | Untracked assets/ + 303k patch in main checkout | medium | open | leave untracked; parcel work isolated in worktrees |
| r-serialization | 13 SQLite db.ts modules + shared app-shell/layout collide across W1 | high | open | serialize w1-postgres first, track collisions in PARCELS.md |
| r-contract-drift | Silent contract change across 5 new schemas | high | open | PDD stop-and-report + amendment rule |
| r-hosting-undecided | Fly vs Azure undecided blocks infra parcels | high | open | decide before w1-postgres dispatch |
