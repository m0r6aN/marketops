# Agent Directive: Implement and Deploy `keon-auth` Service (Production Only)

## Objective

Implement and deploy a new `keon-auth` Azure Container App in **production** (`keon-rg`) within the same Container Apps environment/network as `keon-mcp-gateway`, then wire `keon-mcp-gateway` to the deployed auth service so gateway requests stop failing with upstream 503/502 errors.

---

## Confirmed Context and Findings

- `keon-mcp-gateway` ingress is reachable publicly; DNS/TLS are healthy.
- `keon-mcp-gateway` app process starts and listens on port `8080`.
- Requests to `/`, custom domain `/`, and `/.well-known/mcp` return `503`/`502` upstream errors.
- `keon-runtime` exists and is healthy in `keon-rg`.
- `keon-auth` is **missing** in `keon-rg`.
- `keon-mcp-gateway` currently references:
  - `Auth__Issuer=keon-auth`
  - `Auth__Audience=keon-mcp-gateway`
- Production scope only (no staging changes).

---

## Required Outcome

1. `keon-auth` exists as a Container App in `keon-rg`.
2. `keon-auth` is healthy with at least 1 replica.
3. `keon-mcp-gateway` auth issuer configuration points to a resolvable/valid auth service endpoint in the same environment.
4. Gateway requests no longer return ingress upstream reset errors; responses become protocol/auth-expected (e.g., 401/404/200 depending route and token).

---

## Implementation Requirements

### 1) Add `keon-auth` as a first-class deployable service in production workflow

The agent must update deployment automation (pipeline/scripts/IaC) so `keon-auth` is deployed alongside existing production services in `keon-rg`.

Minimum deployment settings for `keon-auth`:

- **Name:** `keon-auth`
- **Resource Group:** `keon-rg`
- **Environment:** same managed environment as gateway (`cae-keon-prod`)
- **Ingress:** internal (`external=false`) unless a hard requirement says otherwise
- **Target Port:** `8080` (or service-specific, but must match container listener)
- **Min Replicas:** `1` (avoid auth cold-start during gateway calls)
- **Image:** production image in ACR (versioned tag, no `latest`)
- **Health Probes:** readiness/liveness configured to real health endpoints
- **Secrets/Env:** issuer/audience/signing key material and any required dependencies

> If the existing workflow uses Bicep/Terraform/YAML/shell scripts, align with that pattern.  
> If no IaC exists in this repo, add a dedicated production deployment script plus documentation and explicit command examples.

---

### 2) Configure gateway to point to deployed auth service correctly

Update `keon-mcp-gateway` production configuration to use a resolvable issuer value for Container Apps internal networking.

Preferred forms:
- `http://keon-auth` (service discovery in same environment, if supported by app expectations), or
- `http://keon-auth.internal.<env-id>.<region>.azurecontainerapps.io` (explicit internal FQDN), if app requires explicit host.

Set/verify:
- `Auth__Issuer=<resolved keon-auth endpoint>`
- `Auth__Audience=keon-mcp-gateway`

---

### 3) Deploy order

Deploy in this order:

1. `keon-auth`
2. wait until ready/healthy
3. update/redeploy `keon-mcp-gateway` env pointing to auth issuer
4. validate gateway behavior end-to-end

---

## Verification Plan (must be executed)

### A) Infrastructure verification

```bash
az containerapp list --resource-group keon-rg --query "[].name" -o tsv
az containerapp show --name keon-auth --resource-group keon-rg --query "{name:name,fqdn:properties.configuration.ingress.fqdn,external:properties.configuration.ingress.external,targetPort:properties.configuration.ingress.targetPort,latestReady:properties.latestReadyRevisionName}" -o json
az containerapp revision list --name keon-auth --resource-group keon-rg -o table
az containerapp revision list --name keon-mcp-gateway --resource-group keon-rg -o table
```

Acceptance:
- `keon-auth` appears in list.
- latest revision for `keon-auth` is ready.
- replica count > 0 for active revision.

---

### B) Logs and runtime behavior

In one terminal:

```bash
az containerapp logs show --name keon-auth --resource-group keon-rg --follow
```

In another terminal:

```bash
az containerapp logs show --name keon-mcp-gateway --resource-group keon-rg --follow
```

Send gateway requests and confirm no upstream reset errors.

---

### C) Endpoint tests (curl)

```bash
curl -vk https://keon-mcp-gateway.redrock-24997c6f.eastus2.azurecontainerapps.io/
curl -vk https://mcp.keon.systems/
curl -vk https://keon-mcp-gateway.redrock-24997c6f.eastus2.azurecontainerapps.io/.well-known/mcp
```

Expected:
- No `upstream connect error` reset message.
- Responses should reflect real app behavior (401/404/200 etc.), not infrastructure proxy failure.

If token-required endpoint exists, also test with auth header:

```bash
curl -vk https://<gateway-host>/<expected-mcp-route> -H "Authorization: Bearer <token>"
```

---

## Operational Guardrails

- Production-only scope; do not alter staging resources.
- Use immutable image tags.
- Do not remove existing custom domain binding on gateway.
- Keep gateway target port aligned with listener (`8080`).
- Preserve existing runtime integration (`Runtime__BaseUrl`) unless separately validated.

---

## Suggested CLI Blueprint (adapt to existing workflow)

```bash
# 1) Deploy keon-auth (example; adapt image/env/secrets/probes)
az containerapp up \
  --name keon-auth \
  --resource-group keon-rg \
  --environment cae-keon-prod \
  --image <acr>/keon-auth:<tag> \
  --ingress internal \
  --target-port 8080 \
  --min-replicas 1

# 2) Point gateway to auth issuer
az containerapp update \
  --name keon-mcp-gateway \
  --resource-group keon-rg \
  --set-env-vars Auth__Issuer=http://keon-auth Auth__Audience=keon-mcp-gateway

# 3) Verify revisions and run curl tests from Verification Plan
```

---

## Deliverables the agent must produce

1. Deployment workflow updates adding `keon-auth` production deployment.
2. Configuration update wiring gateway to `keon-auth`.
3. Evidence log (commands + outputs) proving:
   - `keon-auth` exists and is healthy
   - gateway no longer returns upstream 503/502 reset errors
4. Short rollback note:
   - prior gateway env values
   - command to roll back gateway revision if needed

---

## Definition of Done

- `keon-auth` is deployed and healthy in `keon-rg`.
- `keon-mcp-gateway` is configured against live auth issuer endpoint.
- External gateway requests no longer fail with upstream proxy 503/502 reset.
- Verification artifacts are captured and attached to change record.
