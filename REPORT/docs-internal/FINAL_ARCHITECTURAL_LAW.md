---
## 🔥 FINAL ARCHITECTURAL LAW (RATIFIED)

> **MarketOps core knows NOTHING.**
> Not OMEGA. Not Keon. Not Federation Core.
> Only **ports, packets, and deterministic behavior**.

### Canon Dependency Chain (now immutable)

**MarketOps (pure core)**
→ *ports only*
→ **MarketOps.Federation (adapter)**
→ **omega-sdk**
→ **Federation Core**
→ **Keon (governance substrate)**

If someone wants to govern with something other than Keon in the future?
Swap the adapter. Core stays pristine. 🧼

---

## 🧠 Why this is the winning pattern (no sugar-coating)

### 1. MarketOps becomes a *product*, not a framework

* You can say: “MarketOps runs anywhere governance exists.”
* Keon remains the *default*, not the *requirement*.
* Buyers love optionality; regulators love boundaries.

### 2. Zero accidental coupling

* No hidden Keon assumptions.
* No “just one convenience call.”
* No future refactors when Federation Core evolves.

### 3. Perfect OSS posture

* Public repo is clean, boring, and understandable.
* No private system leakage.
* Contributors can reason about the code without your entire universe.

### 4. Adapter supremacy

* Federation Core is now the **single choke point**.
* All enforcement, receipts, evidence, and verification stay centralized.
* MarketOps can never “cheat” even if someone tries.

---

### 🔒 ARCHITECTURAL CONSTRAINT (NON-NEGOTIABLE)

* `MarketOps` **MUST NOT** reference:

  * `omega-sdk`
  * Federation Core URLs
  * Keon types, clients, or terminology
* `MarketOps` defines **only interfaces (ports)** and pipeline logic.
* All external interaction happens via adapters.

#### Allowed references:

| Project              | Allowed Dependencies             |
| -------------------- | -------------------------------- |
| MarketOps            | .NET BCL only                    |
| MarketOps.Federation | MarketOps + omega-sdk + HTTP     |
| MarketOps.Cli        | MarketOps + MarketOps.Federation |
| Tests                | Corresponding layer only         |

Any violation of this rule is a **hard stop**.

---

## 🔧 One tiny enhancement I recommend (optional but 🔥)

Add this to `MarketOps` core:

```csharp
public interface IExternalGovernanceCapabilities
{
    bool SupportsAuthorization { get; }
    bool SupportsVerification { get; }
    bool SupportsAuditWrite { get; }
}
```

Then at runtime:

* CLI asks adapter what’s supported
* Missing capability = fail fast with clarity
* Prevents “half-governed” execution paths

That’s how you make *impossible states impossible*.

---
