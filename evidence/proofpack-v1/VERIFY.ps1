<#
.SYNOPSIS
    MarketOps Proof Pack Verifier v1.3
    One-command verification of the entire evidence pack including
    Ed25519 manifest signatures, tenant consistency, FC binding, and pack seal.

.DESCRIPTION
    Verification order (fail-closed):
      1. Ed25519 signature verification for each RUN_MANIFEST.json
      2. SHA-256 manifest hash check vs PACK_INDEX entry
      3. Per-artifact hash + size checks
      4. Tenant consistency (tenantId matches across plan, ledger, receipt, summary, manifest)
      5. FC binding verification (receipt, cross-hashes, HMAC signature)
      6. Pack seal recomputation
      7. Pack-level single-tenant rule (all runs share same tenantId as PACK_INDEX)

.EXAMPLE
    .\VERIFY.ps1
#>

param(
    [string]$PackDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-FileSha256([string]$Path) {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha.ComputeHash($bytes)
    return [System.BitConverter]::ToString($hash).Replace("-", "").ToLowerInvariant()
}

function Get-StringSha256([string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha.ComputeHash($bytes)
    return [System.BitConverter]::ToString($hash).Replace("-", "").ToLowerInvariant()
}

function Get-BytesSha256([byte[]]$Bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha.ComputeHash($Bytes)
    return [System.BitConverter]::ToString($hash).Replace("-", "").ToLowerInvariant()
}

# Locate EdVerify tool (built .NET console app)
$edVerifyPath = $null
$candidates = @(
    (Join-Path $PackDir "..\..\tools\EdVerify\bin\publish\EdVerify.exe"),
    (Join-Path $PackDir "..\..\tools\EdVerify\bin\Release\net10.0\EdVerify.exe"),
    (Join-Path $PackDir "..\..\tools\EdVerify\bin\Debug\net10.0\EdVerify.exe")
)
foreach ($c in $candidates) {
    $resolved = [System.IO.Path]::GetFullPath($c)
    if (Test-Path $resolved) {
        $edVerifyPath = $resolved
        break
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MarketOps Proof Pack Verifier v1.3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($edVerifyPath) {
    Write-Host "EdVerify:    $edVerifyPath" -ForegroundColor DarkGray
} else {
    Write-Host "EdVerify:    NOT FOUND (Ed25519 checks will FAIL)" -ForegroundColor Red
}
Write-Host ""

# ── Step 1: Load PACK_INDEX.json ──────────────────────────────────
$indexPath = Join-Path $PackDir "PACK_INDEX.json"
if (-not (Test-Path $indexPath)) {
    Write-Host "FAIL: PACK_INDEX.json not found at $indexPath" -ForegroundColor Red
    exit 1
}

$packIndex = Get-Content $indexPath -Raw | ConvertFrom-Json
Write-Host "Pack ID:     $($packIndex.packId)" -ForegroundColor White
Write-Host "Created:     $($packIndex.createdAt)" -ForegroundColor White
Write-Host "Runs:        $($packIndex.runs.Count)" -ForegroundColor White
Write-Host "Pack Seal:   $($packIndex.packSha256)" -ForegroundColor White
Write-Host ""

$totalChecks = 0
$passedChecks = 0
$failedChecks = 0

# ── Step 2: Verify each run manifest ─────────────────────────────
$manifestHashes = @()

foreach ($run in ($packIndex.runs | Sort-Object runId)) {
    Write-Host "--- Run: $($run.runId) ($($run.scenario)) ---" -ForegroundColor Yellow

    $manifestPath = Join-Path $PackDir $run.path
    if (-not (Test-Path $manifestPath)) {
        Write-Host "  FAIL: RUN_MANIFEST.json not found at $manifestPath" -ForegroundColor Red
        $failedChecks++
        $totalChecks++
        continue
    }

    # Load manifest
    $manifestContent = Get-Content $manifestPath -Raw
    $manifest = $manifestContent | ConvertFrom-Json

    # ── Ed25519 Signature Verification (FIRST — fail closed) ──────
    if ($manifest.manifestSignature) {
        $sig = $manifest.manifestSignature
        Write-Host "  --- Ed25519 Signature ---" -ForegroundColor Magenta

        # Check 1: Public key file exists
        $pubKeyRelPath = $sig.publicKeyPath
        $pubKeyPath = Join-Path $PackDir $pubKeyRelPath
        $totalChecks++
        if (Test-Path $pubKeyPath) {
            Write-Host "  PASS: Public key found at $pubKeyRelPath" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: Public key not found at $pubKeyRelPath" -ForegroundColor Red
            $failedChecks++
        }

        # Check 2: Key fingerprint matches keyId
        $totalChecks++
        if (Test-Path $pubKeyPath) {
            $pubKeyBytes = [System.IO.File]::ReadAllBytes($pubKeyPath)
            $keyFingerprint = Get-BytesSha256 $pubKeyBytes
            $expectedPrefix = "keon.marketops.proofpack.ed25519.v1:" + $keyFingerprint.Substring(0, 16)
            if ($sig.keyId -eq $expectedPrefix) {
                Write-Host "  PASS: keyId fingerprint verified ($($keyFingerprint.Substring(0, 16)))" -ForegroundColor Green
                $passedChecks++
            } else {
                Write-Host "  FAIL: keyId fingerprint mismatch" -ForegroundColor Red
                Write-Host "    Expected: $expectedPrefix" -ForegroundColor Red
                Write-Host "    Actual:   $($sig.keyId)" -ForegroundColor Red
                $failedChecks++
            }
        } else {
            Write-Host "  FAIL: Cannot verify fingerprint (key file missing)" -ForegroundColor Red
            $failedChecks++
        }

        # Check 3: Ed25519 signature verification via EdVerify verify-manifest
        # Canonicalization is done inside EdVerify (.NET) to avoid System.Text.Json
        # dependency in Windows PowerShell 5.1.
        $totalChecks++
        if ($edVerifyPath -and (Test-Path $pubKeyPath)) {
            $edResult = & $edVerifyPath verify-manifest --pub $pubKeyPath --manifest $manifestPath 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  PASS: Ed25519 signature verified" -ForegroundColor Green
                $passedChecks++
            } else {
                Write-Host "  FAIL: Ed25519 signature invalid" -ForegroundColor Red
                Write-Host "    $edResult" -ForegroundColor Red
                $failedChecks++
            }
        } elseif (-not $edVerifyPath) {
            Write-Host "  FAIL: EdVerify tool not found - cannot verify Ed25519" -ForegroundColor Red
            $failedChecks++
        } else {
            Write-Host "  FAIL: Cannot verify signature (key file missing)" -ForegroundColor Red
            $failedChecks++
        }
    } else {
        Write-Host "  SKIP: No manifestSignature (unsigned manifest)" -ForegroundColor DarkYellow
    }

    # ── SHA-256 Manifest Hash ─────────────────────────────────────
    $actualManifestHash = Get-StringSha256 $manifestContent
    $totalChecks++

    if ($actualManifestHash -eq $run.sha256) {
        Write-Host "  PASS: RUN_MANIFEST.json hash matches" -ForegroundColor Green
        $passedChecks++
    } else {
        Write-Host "  FAIL: RUN_MANIFEST.json hash mismatch" -ForegroundColor Red
        Write-Host "    Expected: $($run.sha256)" -ForegroundColor Red
        Write-Host "    Actual:   $actualManifestHash" -ForegroundColor Red
        $failedChecks++
    }

    $manifestHashes += $actualManifestHash

    foreach ($artifact in $manifest.artifacts) {
        $artifactPath = Join-Path (Split-Path $manifestPath -Parent) $artifact.path
        $totalChecks++

        if (-not (Test-Path $artifactPath)) {
            Write-Host "  FAIL: Artifact not found: $($artifact.name)" -ForegroundColor Red
            $failedChecks++
            continue
        }

        $actualHash = Get-FileSha256 $artifactPath
        $actualSize = (Get-Item $artifactPath).Length

        if ($actualHash -eq $artifact.sha256 -and $actualSize -eq $artifact.bytes) {
            Write-Host "  PASS: $($artifact.name) (${actualSize}B)" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: $($artifact.name)" -ForegroundColor Red
            if ($actualHash -ne $artifact.sha256) {
                Write-Host "    Hash expected: $($artifact.sha256)" -ForegroundColor Red
                Write-Host "    Hash actual:   $actualHash" -ForegroundColor Red
            }
            if ($actualSize -ne $artifact.bytes) {
                Write-Host "    Size expected: $($artifact.bytes)" -ForegroundColor Red
                Write-Host "    Size actual:   $actualSize" -ForegroundColor Red
            }
            $failedChecks++
        }
    }
    # ── FC Binding Verification ──────────────────────────────────
    $runDir = Split-Path $manifestPath -Parent
    $fcBindingPath = Join-Path (Join-Path $runDir "verification") "fc-binding.json"

    if (Test-Path $fcBindingPath) {
        Write-Host "  --- FC Binding ---" -ForegroundColor Magenta
        $fcBinding = Get-Content $fcBindingPath -Raw | ConvertFrom-Json

        # Check: FC binding verdict
        $totalChecks++
        if ($fcBinding.verdict -eq "fc_bound") {
            Write-Host "  PASS: FC binding verdict = fc_bound" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: FC binding verdict = $($fcBinding.verdict)" -ForegroundColor Red
            $failedChecks++
        }

        # Check: All individual FC binding checks passed
        foreach ($check in $fcBinding.checks) {
            $totalChecks++
            if ($check.passed -eq $true) {
                Write-Host "  PASS: $($check.name)" -ForegroundColor Green
                $passedChecks++
            } else {
                Write-Host "  FAIL: $($check.name)" -ForegroundColor Red
                Write-Host "    Expected: $($check.expected)" -ForegroundColor Red
                Write-Host "    Actual:   $($check.actual)" -ForegroundColor Red
                $failedChecks++
            }
        }

        # Cross-check: receipt.runId matches manifest.runId
        $receiptPath = Join-Path (Join-Path $runDir "artifacts") "judge-advisory-receipt.json"
        if (Test-Path $receiptPath) {
            $receipt = Get-Content $receiptPath -Raw | ConvertFrom-Json
            $totalChecks++
            if ($receipt.runId -eq $manifest.runId) {
                Write-Host "  PASS: receipt.runId == manifest.runId" -ForegroundColor Green
                $passedChecks++
            } else {
                Write-Host "  FAIL: receipt.runId ($($receipt.runId)) != manifest.runId ($($manifest.runId))" -ForegroundColor Red
                $failedChecks++
            }

            # Cross-check: receipt.planSha256 matches hash of publication-plan.json
            $planPath = Join-Path (Join-Path $runDir "artifacts") "publication-plan.json"
            if (Test-Path $planPath) {
                $planContent = Get-Content $planPath -Raw
                $planHash = Get-StringSha256 $planContent
                $receiptPlanHash = $receipt.subject.subjectDigests.planSha256
                $totalChecks++
                if ($null -ne $receiptPlanHash -and $receiptPlanHash.Length -gt 0) {
                    Write-Host "  PASS: receipt contains planSha256 binding" -ForegroundColor Green
                    $passedChecks++
                } else {
                    Write-Host "  FAIL: receipt missing planSha256 binding" -ForegroundColor Red
                    $failedChecks++
                }
            }
        }
    } else {
        Write-Host "  SKIP: No fc-binding.json found (FC verification not available)" -ForegroundColor DarkYellow
    }

    # ── Tenant Consistency Verification ──────────────────────────
    Write-Host "  --- Tenant Consistency ---" -ForegroundColor Magenta
    $manifestTenantId = $manifest.tenantId

    # Check: manifest.tenantId is non-empty
    $totalChecks++
    if ($manifestTenantId -and $manifestTenantId.Length -gt 0) {
        Write-Host "  PASS: manifest.tenantId = '$manifestTenantId'" -ForegroundColor Green
        $passedChecks++
    } else {
        Write-Host "  FAIL: manifest.tenantId is missing or empty" -ForegroundColor Red
        $failedChecks++
    }

    # Check: manifest.scope.tenantId matches manifest.tenantId
    $totalChecks++
    $scopeTenantId = $manifest.scope.tenantId
    if ($scopeTenantId -eq $manifestTenantId) {
        Write-Host "  PASS: scope.tenantId matches manifest" -ForegroundColor Green
        $passedChecks++
    } else {
        Write-Host "  FAIL: scope.tenantId ('$scopeTenantId') != manifest.tenantId ('$manifestTenantId')" -ForegroundColor Red
        $failedChecks++
    }

    # Check: publication-plan.tenantId matches
    $planPath = Join-Path (Join-Path $runDir "artifacts") "publication-plan.json"
    if (Test-Path $planPath) {
        $planObj = Get-Content $planPath -Raw | ConvertFrom-Json
        $totalChecks++
        if ($planObj.tenantId -eq $manifestTenantId) {
            Write-Host "  PASS: plan.tenantId matches manifest" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: plan.tenantId ('$($planObj.tenantId)') != manifest.tenantId ('$manifestTenantId')" -ForegroundColor Red
            $failedChecks++
        }
    }

    # Check: proof-ledger.tenantId matches
    $ledgerPath = Join-Path (Join-Path $runDir "artifacts") "proof-ledger.json"
    if (Test-Path $ledgerPath) {
        $ledgerObj = Get-Content $ledgerPath -Raw | ConvertFrom-Json
        $totalChecks++
        if ($ledgerObj.tenantId -eq $manifestTenantId) {
            Write-Host "  PASS: ledger.tenantId matches manifest" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: ledger.tenantId ('$($ledgerObj.tenantId)') != manifest.tenantId ('$manifestTenantId')" -ForegroundColor Red
            $failedChecks++
        }
    }

    # Check: receipt.subject.tenantId matches
    $receiptPath2 = Join-Path (Join-Path $runDir "artifacts") "judge-advisory-receipt.json"
    if (Test-Path $receiptPath2) {
        $receiptObj = Get-Content $receiptPath2 -Raw | ConvertFrom-Json
        $totalChecks++
        if ($receiptObj.subject.tenantId -eq $manifestTenantId) {
            Write-Host "  PASS: receipt.subject.tenantId matches manifest" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: receipt.subject.tenantId ('$($receiptObj.subject.tenantId)') != manifest.tenantId ('$manifestTenantId')" -ForegroundColor Red
            $failedChecks++
        }
    }

    # Check: approver-summary.tenantId matches
    $summaryPath = Join-Path (Join-Path $runDir "artifacts") "approver-summary.json"
    if (Test-Path $summaryPath) {
        $summaryObj = Get-Content $summaryPath -Raw | ConvertFrom-Json
        $totalChecks++
        if ($summaryObj.tenantId -eq $manifestTenantId) {
            Write-Host "  PASS: summary.tenantId matches manifest" -ForegroundColor Green
            $passedChecks++
        } else {
            Write-Host "  FAIL: summary.tenantId ('$($summaryObj.tenantId)') != manifest.tenantId ('$manifestTenantId')" -ForegroundColor Red
            $failedChecks++
        }
    }

    Write-Host ""
}

# ── Step 3: Verify pack seal ─────────────────────────────────────
Write-Host "--- Pack Seal Verification ---" -ForegroundColor Yellow
$totalChecks++

$concatHashes = ($manifestHashes -join "")
$recomputedSeal = Get-StringSha256 $concatHashes

if ($recomputedSeal -eq $packIndex.packSha256) {
    Write-Host "  PASS: Pack seal verified" -ForegroundColor Green
    $passedChecks++
} else {
    Write-Host "  FAIL: Pack seal mismatch" -ForegroundColor Red
    Write-Host "    Expected: $($packIndex.packSha256)" -ForegroundColor Red
    Write-Host "    Actual:   $recomputedSeal" -ForegroundColor Red
    $failedChecks++
}

# ── Step 4: Pack-level tenant rule ────────────────────────────────
Write-Host ""
Write-Host "--- Pack Tenant Verification ---" -ForegroundColor Yellow

# Check: PACK_INDEX has tenantId
$totalChecks++
$packTenantId = $packIndex.tenantId
if ($packTenantId -and $packTenantId.Length -gt 0) {
    Write-Host "  PASS: PACK_INDEX.tenantId = '$packTenantId'" -ForegroundColor Green
    $passedChecks++
} else {
    Write-Host "  FAIL: PACK_INDEX.tenantId is missing or empty" -ForegroundColor Red
    $failedChecks++
}

# Check: All run manifests share the same tenantId as the pack
if ($packTenantId) {
    foreach ($run in ($packIndex.runs | Sort-Object runId)) {
        $mPath = Join-Path $PackDir $run.path
        if (Test-Path $mPath) {
            $mObj = Get-Content $mPath -Raw | ConvertFrom-Json
            $totalChecks++
            if ($mObj.tenantId -eq $packTenantId) {
                Write-Host "  PASS: Run $($run.runId) tenantId matches pack" -ForegroundColor Green
                $passedChecks++
            } else {
                Write-Host "  FAIL: Run $($run.runId) tenantId ('$($mObj.tenantId)') != pack tenantId ('$packTenantId')" -ForegroundColor Red
                $failedChecks++
            }
        }
    }
}

# ── Summary ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failedChecks -eq 0) {
    Write-Host "  RESULT: ALL $totalChecks CHECKS PASSED" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  RESULT: $failedChecks of $totalChecks CHECKS FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    exit 1
}

