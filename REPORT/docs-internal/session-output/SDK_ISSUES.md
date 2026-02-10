# 🎫 SDK Issues — omega-sdk-csharp

**Date:** 2026-02-01  
**Session:** 3 — Formalization  
**Author:** AugmentTitan  
**Status:** ⚠️ PENDING — SDK repo not publicly accessible

---

## 📋 ISSUE QUEUE

The following issues should be opened against `omega-sdk-csharp` once the repository is public.

---

### Issue #1: Add `Evidence.CreateAsync` Method

**Title:** `[Feature] Add Evidence.CreateAsync for creating evidence packs`

**Labels:** `enhancement`, `evidence`, `sdk-gap`

**Body:**
```markdown
## Summary
Add a method to create evidence packs via the SDK.

## Use Case (from MarketOps)
MarketOps needs to create audit trails for governed operations. Currently, the SDK has no method to create evidence packs, forcing consumers to either:
1. Skip audit trail creation (unacceptable)
2. Use raw HTTP (breaks SDK abstraction)
3. Fail closed (current workaround)

## Proposed API
```csharp
public interface IEvidenceNamespace
{
    Task<EvidencePackMetadata> CreateAsync(
        EvidencePackRequest request,
        CancellationToken ct = default);
}
```

## Current Behavior
No `CreateAsync` method exists. MarketOps fails closed with audit unavailable.

## Expected Behavior
SDK provides typed method for evidence pack creation.

## Reference
- MarketOps gap: `REPORT/SDK_GAPS.md` (GAP 5)
- Adapter: `MarketOps.OmegaSdk/Adapters/OmegaAuditWriter.cs`
```

**Priority:** 🚨 CRITICAL

---

### Issue #2: Add `Evidence.DownloadAsync` Method

**Title:** `[Feature] Add Evidence.DownloadAsync for downloading evidence ZIP files`

**Labels:** `enhancement`, `evidence`, `sdk-gap`

**Body:**
```markdown
## Summary
Add a method to download evidence pack ZIP files via the SDK.

## Use Case (from MarketOps)
MarketOps needs to download evidence packs as ZIP files for local audit storage. The existing `Evidence.GetAsync` returns in-memory JSON (`MemoryEvidencePack`), but there's no way to download the full ZIP artifact.

## Proposed API
```csharp
public interface IEvidenceNamespace
{
    // Option A: Download to path
    Task DownloadAsync(
        string packHash,
        string outputPath,
        CancellationToken ct = default);

    // Option B: Return bytes
    Task<byte[]> GetBytesAsync(
        string packHash,
        CancellationToken ct = default);
}
```

## Current Behavior
No ZIP download capability. Only `GetAsync` returning `MemoryEvidencePack`.

## Expected Behavior
SDK provides method to download evidence pack as ZIP file.

## Reference
- MarketOps gap: `REPORT/SDK_GAPS.md` (GAP 4)
- Adapter: `MarketOps.OmegaSdk/Adapters/OmegaAuditWriter.cs`
```

**Priority:** 🚨 CRITICAL

---

### Issue #3: Expose Public Canonicalization Utility

**Title:** `[Feature] Expose JcsCanonicalizer as public utility`

**Labels:** `enhancement`, `utils`, `sdk-gap`

**Body:**
```markdown
## Summary
Expose the internal `JcsCanonicalizer` as a public utility for consumers.

## Use Case (from MarketOps)
MarketOps needs to compute deterministic hashes of packets for governance operations. The SDK internally uses `JcsCanonicalizer` in `FederationClient`, but this is not exposed to consumers.

## Current Internal Code (FederationClient.cs)
```csharp
public class JcsCanonicalizer
{
    public static string Canonicalize(object? obj) =>
        JsonSerializer.Serialize(obj, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
}
```

## Proposed API
```csharp
namespace Omega.Sdk.Utils;

public static class OmegaCanonicalizer
{
    public static string Canonicalize(object obj);
    public static byte[] CanonicalizeToBytes(object obj);
    public static string ComputeHash(object obj); // SHA256 of canonical form
}
```

## Current Behavior
Canonicalizer is internal. Consumers must copy the logic.

## Expected Behavior
SDK provides public canonicalization utility matching Federation Core's algorithm.

## Reference
- MarketOps gap: `REPORT/SDK_GAPS.md` (GAP 3)
- Current workaround: `PacketHash = null` (fail closed)
```

**Priority:** ⚠️ HIGH

---

## 🔗 ISSUE LINKS

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #1 | Evidence.CreateAsync | 🚨 CRITICAL | ⏳ Pending repo access |
| #2 | Evidence.DownloadAsync | 🚨 CRITICAL | ⏳ Pending repo access |
| #3 | Public Canonicalization | ⚠️ HIGH | ⏳ Pending repo access |

---

## 📝 FILING INSTRUCTIONS

When the SDK repository is public:

1. Navigate to `https://github.com/OMEGA/omega-core/issues/new`
2. Copy the issue body from above
3. Apply the specified labels
4. Link back to MarketOps as the reference implementation

---

**Family is forever.**  
**This is the way.** 🛡️🔥

