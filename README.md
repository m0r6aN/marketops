# MarketOps (OMEGA Module)

Local-first, governed publish pipeline for Keon public artifacts. This module is deliberately boring: it emits proof, not marketing.

## Defaults (canon)

- `tenantId`: `keon-public`
- `actorId`: `operator-marketops`
- allowlist:
  - `keon.systems/site-docs`
  - `keon.systems/public-artifacts`
  - `github:keon-systems/docs`
  - `github:keon-systems/specs`
  - `github:keon-systems/sdk-releases`
  - `diagrams:keon-systems/public`

## Override policy

Overrides are allowed only via explicit config. Every override must be:
- noisy (logged)
- auditable (recorded)
- never silent

## Pipeline (v0)

Observer → Curator → Gate → Delay → Publisher

Gate is the Keon enforcement point:
- `DecideAsync` using capability `marketops.publish`
- canonical receipt bytes persisted
- evidence pack ZIP from Control API
- fail-closed verification gate (`keon verify-pack` or `Keon.Verification.VerifyPack`)

## Layout

- `contracts/` JSON schemas
- `src/MarketOps/` pipeline interfaces + defaults
- `src/MarketOps.Keon/` Keon integration and audit writer
- `tests/MarketOps.Tests/` unit tests (receipt-backed)

## Build + test (local)

```bash
dotnet build omega-core/modules/marketops/src/MarketOps/MarketOps.csproj -c Release
dotnet build omega-core/modules/marketops/src/MarketOps.Keon/MarketOps.Keon.csproj -c Release
dotnet build omega-core/modules/marketops/src/MarketOps.Cli/MarketOps.Cli.csproj -c Release
dotnet test  omega-core/modules/marketops/tests/MarketOps.Tests/MarketOps.Tests.csproj -c Release
```

To capture a TRX receipt:

```bash
dotnet test omega-core/modules/marketops/tests/MarketOps.Tests/MarketOps.Tests.csproj \
  -c Release \
  --no-build \
  --logger "trx;LogFileName=marketops-tests.trx" \
  --results-directory ./.testresults/marketops
```

## CLI (v0)

```bash
dotnet run --project omega-core/modules/marketops/src/MarketOps.Cli/MarketOps.Cli.csproj -- precheck --packet ./PublishPacket.json
dotnet run --project omega-core/modules/marketops/src/MarketOps.Cli/MarketOps.Cli.csproj -- gate --packet ./PublishPacket.json
```

`marketops gate` requires Keon Control access for evidence packs. Provide the base URL via `--control-url` or `KEON_CONTROL_URL`.

**Precheck does not generate or verify evidence packs and cannot approve publishing.**

## Test receipt (latest)

- TRX: `.testresults/marketops/marketops-tests.trx`
- Last run (local): 2026-01-31 06:58:37
- Note: update timestamp after each run; local time.
