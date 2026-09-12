# Environments — marketops-private-beta-gtm-40m

| Env | Purpose | Requires | Secrets realm |
|---|---|---|---|
| local | parcel verification | unit + fixture tests | mock/test only |
| beta | private dogfood + pilots | INT matrix + security gates + backups | vault staging, IP-allowlisted |
| prod-public | explicitly OUT OF SCOPE — blocked until $40M gates + full SaaS hardening | — | — |
