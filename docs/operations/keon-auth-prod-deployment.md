# Keon Auth Service Production Deployment Runbook

This runbook documents production deployment and rollback for `keon-auth-service` on Fly.io.

## 1) Preconditions

- `flyctl` installed and authenticated.
- Fly app exists: `keon-auth`.
- Repository contains `services/keon-auth-service`.
- Required Fly secrets are configured:
  - `KEON_AUTH_DB_URL`
  - `KEON_AUTH_JWT_SECRET`
  - `KEON_AUTH_CORS_ORIGIN`
  - any provider/API keys required by the service.

Set/update secrets example:

```bash
flyctl secrets set \
  KEON_AUTH_DB_URL="..." \
  KEON_AUTH_JWT_SECRET="..." \
  KEON_AUTH_CORS_ORIGIN="https://your-frontend.example.com" \
  --app keon-auth
```

## 2) Deploy

From repository root:

```bash
scripts/deploy-keon-auth-prod.sh
```

Equivalent direct command:

```bash
flyctl deploy --remote-only --app keon-auth services/keon-auth-service
```

## 3) Post-deploy verification

```bash
flyctl status --app keon-auth
flyctl logs --app keon-auth
```

Health checks:
- service responds on expected health endpoint
- auth login/refresh flow succeeds from production frontend origin
- no startup/migration errors in logs

## 4) Rollback

List releases:

```bash
flyctl releases --app keon-auth
```

Rollback to previous release:

```bash
flyctl releases rollback <VERSION> --app keon-auth
```

Re-verify service status and logs after rollback.

## 5) Operational notes

- Prefer deploying from `main` after CI checks pass.
- Keep secrets out of repo; only use `flyctl secrets`.
- For incidents, capture:
  - failing release version
  - relevant log window
  - rollback version used
  - customer/user impact summary
