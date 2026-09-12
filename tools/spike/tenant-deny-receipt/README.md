# Spike: tenant write + cross-tenant deny + denial receipt

Thin vertical slice proving the W0 contract abstractions before W1 parallel work.

## Run

```sh
npm install --no-save --no-package-lock --no-audit --no-fund  # toolchain only, no git impact
node tools/spike/tenant-deny-receipt/run.mjs
```

Expected: exit 0 and `SPIKE-RESULT pass: ...`.

## What it proves

1. Tenant-scoped write reads back for the owning tenant (S1 positive).
2. Cross-tenant access is denied with code `TENANT_MISMATCH`, a denial
   receipt is recorded, and the scoped query leaks zero rows (S1/S2 negative).
3. Null session is denied with code `UNAUTHENTICATED` + receipt (failure).
4. Merged `tenants`/`entitlements` fixtures validate against merged schemas.
5. All state lives in a temp dir that is destroyed afterwards; the repo
   (including `.marketops/*.sqlite`) is untouched — no Postgres exists yet,
   so temp SQLite is the faithful analog of the planned "temp Postgres".

## Stop-and-report

If the guard abstraction or denial shape feels wrong for W1, do NOT extend
this harness into product code — request a contract amendment first.
