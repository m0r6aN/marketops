# 🔱 MarketOps Proof Pack — Runs Overview

Tenant: tenant-demo  
Mode: dry_run  
Verification: 58 checks — ALL PASS  

---

## Scenario Comparison

| Scenario | Purpose | Intents | Blocked by Mode | Blocked by Policy | Verdict | What It Proves |
|-----------|----------|----------|----------------|-------------------|----------|----------------|
| 01-hygiene-sweep | Governance-safe hygiene improvements | 3 | 3 | 0 | clear | Containment without policy friction |
| 04-policy-violation | Attempt direct push to main | 4 | 4 | 1 | denied | Policy enforcement + denial path |

---

## Scenario 01 — Hygiene Sweep

Detected:
- Missing CODEOWNERS
- Missing .editorconfig
- Incomplete README sections

Generated:
- 3 PR-based intents

Outcome:
- All blocked by dry_run
- No policy violations
- Safe for review

This demonstrates:
- Deterministic intent generation
- Structural side-effect containment
- Clean governance state

---

## Scenario 04 — Policy Violation

Attempted:
- Direct repo mutation on main branch (TagRepo)

Detected:
- Violation: direct_push_to_main
- Rule: policy.direct_push_main.denied.v1

Outcome:
- Denied by policy
- Blocked by mode
- Remediation: Use PR instead

This demonstrates:
- Active policy enforcement
- Hard-denial path
- Cryptographically bound governance decisions

---

## Why Two Scenarios Matter

Scenario 1 proves:
> "Safe changes are governable."

Scenario 4 proves:
> "Unsafe changes are detectable and denied."

Together, they prove MarketOps is not a suggestion engine —
it is a governed execution substrate.

