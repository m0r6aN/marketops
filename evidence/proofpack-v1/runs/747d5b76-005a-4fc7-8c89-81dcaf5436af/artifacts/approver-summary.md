# MarketOps Approver Summary

**Schema:** `marketops.approver-summary.v1`  
**Run ID:** `747d5b76-005a-4fc7-8c89-81dcaf5436af`  
**Mode:** `dry_run`  
**Issued:** 2026-02-12T03:29:39.8457974+00:00

## ❌ DENY

> Policy violations detected: 1 intent(s) blocked

### Required Actions
- [ ] Address policy violations before proceeding
- [ ] Review operation details in full ledger

### ⚠️ Warnings
- This is a dry-run preview; no changes will be made


## Scope

**2** of **2** repos with findings — **4** total issues

**Repos:** `D:\Repos\marketops`, `D:\Repos\marketops\main`

| Issue Type | Count |
|------------|-------|
| incomplete_readme | 1 |
| missing_codeowners | 1 |
| missing_editorconfig | 1 |
| direct_push_to_main | 1 |

## Operations Summary

| Metric | Count |
|--------|-------|
| Total Intents | 4 |
| Blocked by Mode | 4 |
| Blocked by Policy | 1 |
| Would Execute | 0 |

**Status Breakdown:**
- `blocked_by_mode`: 3
- `denied_by_policy`: 1

### OpenPr → `D:\Repos\marketops`
- **Branch:** `main` | **Status:** `blocked_by_mode`
- **Blocked:** mode=True, policy=False
  - `dry_run_blocks_side_effects`: Dry run mode blocks all side effects.

| File | Issue | Severity | Action |
|------|-------|----------|--------|
| `README.md` | incomplete_readme | medium | update |
| `CODEOWNERS` | missing_codeowners | high | create |
| `.editorconfig` | missing_editorconfig | low | create |

### TagRepo → `D:\Repos\marketops\main`
- **Branch:** `main` | **Status:** `denied_by_policy`
- **Blocked:** mode=True, policy=True
  - `dry_run_blocks_side_effects`: Dry run mode blocks all side effects.
  - `policy_denial`: Intent 808a2ca9-082a-4fdc-8925-e32910a08a9f targets direct push to main (blocked by policy)

| File | Issue | Severity | Action |
|------|-------|----------|--------|
| `D:\Repos\marketops\main` | direct_push_to_main | critical | modify |


## Policy Evaluation — Verdict: `denied`

**1** violation(s) detected:

### ❌ direct_push_to_main
- **Rule:** `policy.direct_push_main.denied.v1`
- **Intent:** `808a2ca9-082a-4fdc-8925-e32910a08a9f`
- **Reason:** Intent 808a2ca9-082a-4fdc-8925-e32910a08a9f targets direct push to main (blocked by policy)
- **Recommendation:** Use a pull request instead of direct push to main


## Run Details

- **Status:** completed
- **Started:** 2026-02-12T03:29:37.3615230+00:00
- **Completed:** 2026-02-12T03:29:39.8457949+00:00
- **Duration:** 2s
