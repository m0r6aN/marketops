<#
.SYNOPSIS
    MarketOps Proof Pack Verifier v1
    One-command verification of the entire evidence pack.

.DESCRIPTION
    Reads PACK_INDEX.json, verifies every RUN_MANIFEST.json hash,
    verifies every artifact hash within each manifest,
    recomputes the deterministic pack seal, and prints PASS/FAIL.

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

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MarketOps Proof Pack Verifier v1" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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

    # Verify manifest hash
    $manifestContent = Get-Content $manifestPath -Raw
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

    # Parse manifest and verify each artifact
    $manifest = $manifestContent | ConvertFrom-Json

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

