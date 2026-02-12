# MarketOps Approver Summary

**Schema:** `marketops.approver-summary.v1`  
**Run ID:** `d6674680-7b33-4c58-add9-96617ff8ba17`  
**Mode:** `dry_run`  
**Issued:** 2026-02-12T03:29:39.8273424+00:00

## ✅ REVIEW_READY

> Dry run preview: 3 intent(s) blocked by mode — no changes made

### Required Actions
- [ ] Review operation details in full ledger

### ⚠️ Warnings
- This is a dry-run preview; no changes will be made


## Scope

**1** of **1** repos with findings — **3** total issues

**Repos:** `D:\Repos\marketops`

| Issue Type | Count |
|------------|-------|
| incomplete_readme | 1 |
| missing_codeowners | 1 |
| missing_editorconfig | 1 |

## Operations Summary

| Metric | Count |
|--------|-------|
| Total Intents | 3 |
| Blocked by Mode | 3 |
| Blocked by Policy | 0 |
| Would Execute | 0 |

**Status Breakdown:**
- `blocked_by_mode`: 3

### OpenPr → `D:\Repos\marketops`
- **Branch:** `main` | **Status:** `blocked_by_mode`
- **Blocked:** mode=True, policy=False
  - `dry_run_blocks_side_effects`: Dry run mode blocks all side effects.

| File | Issue | Severity | Action |
|------|-------|----------|--------|
| `README.md` | incomplete_readme | medium | update |
| `CODEOWNERS` | missing_codeowners | high | create |
| `.editorconfig` | missing_editorconfig | low | create |


## Run Details

- **Status:** completed
- **Started:** 2026-02-12T03:29:34.9473523+00:00
- **Completed:** 2026-02-12T03:29:39.8272931+00:00
- **Duration:** 4s
