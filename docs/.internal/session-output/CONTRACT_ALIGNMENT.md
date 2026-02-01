# 🔒 CONTRACT ALIGNMENT — MarketOps × omega-sdk-csharp

**Date:** 2026-02-01  
**Session:** DECOUPLING PROOF SESSION 1  
**SDK Version:** omega-sdk-csharp v1.0.0  
**Contract Source:** `D:\Repos\OMEGA\sdks\omega-sdk-csharp\contracts\MANIFEST.yaml`

---

## 📋 TOOL ID MAPPING

### Tool: `keon.decide` (Decision Governance)

**Invocation Pattern:**
```csharp
await client.Tools.InvokeAsync(
    toolId: "keon.decide",
    input: new Dictionary<string, object>
    {
        ["capability"] = "marketops.publish",
        ["input"] = decisionInput,
        ["context"] = contextObject
    },
    tenantId: "keon-public",
    actorId: "operator-marketops",
    correlationId: "t:keon-public|c:{uuid7}",
    cancellationToken: ct);
```

**Required Parameters:**
- `capability` (string) — Capability being requested (e.g., `"marketops.publish"`)
- `input` (object) — Decision input payload
- `context` (object) — Decision context (tenant, correlation, tags)

**Response Shape:**
```json
{
  "ok": true,
  "data": {
    "result": { /* tool-specific result */ },
    "audit": {
      "keonReceiptId": "string",
      "decidedAtUtc": "ISO8601",
      "outcome": "ALLOW | DENY"
    }
  }
}
```

**Receipt References:**
- `result.audit.keonReceiptId` → Decision receipt ID
- `result.audit.decidedAtUtc` → Decision timestamp
- `result.audit.outcome` → Decision outcome

---

### Tool: `keon.execute` (Execution Governance)

**Invocation Pattern:**
```csharp
await client.Tools.InvokeAsync(
    toolId: "keon.execute",
    input: new Dictionary<string, object>
    {
        ["target"] = executionTarget,
        ["parameters"] = executionParams
    },
    decisionReceiptId: decisionReceiptId, // ✅ Governance binding
    tenantId: "keon-public",
    actorId: "operator-marketops",
    correlationId: "t:keon-public|c:{uuid7}",
    cancellationToken: ct);
```

**Required Parameters:**
- `target` (string) — Execution target identifier
- `parameters` (object) — Execution parameters

**Optional Parameters:**
- `decisionReceiptId` (string) — Binds execution to prior decision

**Response Shape:**
```json
{
  "ok": true,
  "data": {
    "result": { /* execution result */ },
    "audit": {
      "executionId": "string",
      "executedAtUtc": "ISO8601",
      "status": "SUCCESS | FAILED"
    }
  }
}
```

---

### Tool: `evidence.create` (Evidence Pack Creation)

**⚠️ SDK GAP:** No direct `Evidence.CreateAsync()` method.

**Workaround:** Use REST endpoint directly or tool invocation.

**REST Endpoint:** `POST /compliance/evidence-packs`

**Request Body:**
```json
{
  "tenantId": "string",
  "correlationId": "string",
  "fromUtc": "ISO8601",
  "toUtc": "ISO8601"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "packId": "string",
    "packHash": "string",
    "createdAtUtc": "ISO8601"
  }
}
```

---

### Tool: `evidence.verify` (Evidence Pack Verification)

**SDK Method:** `client.Evidence.VerifyAsync(packHash, ...)`

**Contract:** `POST /compliance/evidence-packs/{pack_hash}:verify`

**Required Parameters:**
- `packHash` (string) — Evidence pack hash

**Response Shape:**
```json
{
  "ok": true,
  "data": {
    "isValid": true,
    "verdict": "VALID | INVALID | EXPIRED",
    "errors": ["string"]
  }
}
```

---

### Tool: `gateway.ping` (Health Check)

**SDK Method:** `client.HealthAsync()` (assumed, not in MANIFEST)

**Contract:** `GET /health`

**Response:**
```json
{
  "ok": true,
  "data": {
    "status": "healthy | degraded | unhealthy",
    "timestamp": "ISO8601"
  }
}
```

---

## 🔗 EVIDENCE REFERENCES

**Evidence Pack Retrieval:**
- SDK: `client.Evidence.GetAsync(packHash)` → Returns `MemoryEvidencePack` (JSON)
- Contract: `GET /compliance/evidence-packs/{pack_hash}`

**Evidence Pack Download (ZIP):**
- ⚠️ **SDK GAP:** No `DownloadAsync()` method
- Contract: `GET /compliance/evidence-packs/{pack_id}/download` (assumed)
- Workaround: Use raw `HttpClient` or add to SDK

---

## ✅ ALIGNMENT STATUS

| Tool ID | SDK Support | Contract Verified | Workaround Needed |
|---------|-------------|-------------------|-------------------|
| `keon.decide` | ✅ Via `Tools.InvokeAsync` | ✅ | ⚠️ Adapter wrapping |
| `keon.execute` | ✅ Via `Tools.InvokeAsync` | ✅ | ⚠️ Adapter wrapping |
| `evidence.create` | ❌ Missing | ✅ REST endpoint | 🚨 Raw HTTP or tool invoke |
| `evidence.verify` | ✅ `Evidence.VerifyAsync` | ✅ | ✅ Direct SDK |
| `gateway.ping` | ⚠️ Assumed | ✅ | ✅ Direct SDK |

---

**END OF CONTRACT ALIGNMENT**

