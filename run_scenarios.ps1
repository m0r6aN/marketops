$ErrorActionPreference = "Stop"

$base = "http://localhost:9410"
$root = Join-Path (Get-Location) "evidence\session7"
New-Item -ItemType Directory -Force -Path $root | Out-Null

function Post-Json($url, $obj) {
  $json = $obj | ConvertTo-Json -Depth 20
  Write-Host "POST $url"
  $response = Invoke-WebRequest -Uri $url -Method Post -ContentType "application/json" -Body $json -UseBasicParsing
  return $response.Content | ConvertFrom-Json
}

function Get-Json($url) {
  Write-Host "GET $url"
  $response = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing
  return $response.Content | ConvertFrom-Json
}

# Scenario 1: 01-hygiene-sweep
Write-Host "`n=== Scenario 1: 01-hygiene-sweep ===" -ForegroundColor Cyan
$dir = Join-Path $root "01-hygiene-sweep"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$body = @{
  mode = "dry_run"
  input = @{
    repos = @("D:\Repos\marketops", "D:\Repos\marketops\src\MarketOps", "D:\Repos\marketops\src\MarketOps.Api.Host")
  }
}

$run1 = Post-Json "$base/marketops/runs" $body
$runId1 = $run1.runId
Write-Host "Run ID: $runId1" -ForegroundColor Green

Start-Sleep -Seconds 1

$plan1 = Get-Json "$base/marketops/runs/$runId1/plan"
$ledger1 = Get-Json "$base/marketops/runs/$runId1/ledger"
$advisory1 = Get-Json "$base/marketops/runs/$runId1/advisory"

$plan1 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "publication-plan.json")
$ledger1 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "proof-ledger.json")
$advisory1 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "judge-advisory-receipt.json")

Write-Host "✅ Scenario 1 complete"

# Scenario 2: 02-release-pr-omega-sdk-csharp
Write-Host "`n=== Scenario 2: 02-release-pr-omega-sdk-csharp ===" -ForegroundColor Cyan
$dir = Join-Path $root "02-release-pr-omega-sdk-csharp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$body = @{
  mode = "dry_run"
  input = @{
    repos = @("D:\Repos\marketops\src\MarketOps")
  }
}

$run2 = Post-Json "$base/marketops/runs" $body
$runId2 = $run2.runId
Write-Host "Run ID: $runId2" -ForegroundColor Green

Start-Sleep -Seconds 1

$plan2 = Get-Json "$base/marketops/runs/$runId2/plan"
$ledger2 = Get-Json "$base/marketops/runs/$runId2/ledger"
$advisory2 = Get-Json "$base/marketops/runs/$runId2/advisory"

$plan2 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "publication-plan.json")
$ledger2 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "proof-ledger.json")
$advisory2 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "judge-advisory-receipt.json")

Write-Host "✅ Scenario 2 complete"

# Scenario 3: 03-policy-violation-blocked
Write-Host "`n=== Scenario 3: 03-policy-violation-blocked ===" -ForegroundColor Cyan
$dir = Join-Path $root "03-policy-violation-blocked"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$body = @{
  mode = "dry_run"
  input = @{
    repos = @("D:\Repos\marketops\src\MarketOps.Api.Host")
  }
}

$run3 = Post-Json "$base/marketops/runs" $body
$runId3 = $run3.runId
Write-Host "Run ID: $runId3" -ForegroundColor Green

Start-Sleep -Seconds 1

$plan3 = Get-Json "$base/marketops/runs/$runId3/plan"
$ledger3 = Get-Json "$base/marketops/runs/$runId3/ledger"
$advisory3 = Get-Json "$base/marketops/runs/$runId3/advisory"

$plan3 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "publication-plan.json")
$ledger3 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "proof-ledger.json")
$advisory3 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "judge-advisory-receipt.json")

Write-Host "✅ Scenario 3 complete"

# Scenario 4: 04-policy-violation-direct-push-main
Write-Host "`n=== Scenario 4: 04-policy-violation-direct-push-main ===" -ForegroundColor Cyan
$dir = Join-Path $root "04-policy-violation-direct-push-main"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$body = @{
  mode = "dry_run"
  input = @{
    repos = @("D:\Repos\marketops")
    simulateViolation = "direct_push_main"
  }
}

$run4 = Post-Json "$base/marketops/runs" $body
$runId4 = $run4.runId
Write-Host "Run ID: $runId4" -ForegroundColor Green

Start-Sleep -Seconds 1

$plan4 = Get-Json "$base/marketops/runs/$runId4/plan"
$ledger4 = Get-Json "$base/marketops/runs/$runId4/ledger"
$advisory4 = Get-Json "$base/marketops/runs/$runId4/advisory"

$plan4 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "publication-plan.json")
$ledger4 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "proof-ledger.json")
$advisory4 | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 (Join-Path $dir "judge-advisory-receipt.json")

Write-Host "✅ Scenario 4 complete"

Write-Host "`n✅ Evidence saved to: $root" -ForegroundColor Green

