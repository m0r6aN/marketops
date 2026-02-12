param (
    [string]$OutputName = "MarketOps_ProofPack_v1.3_tenant-demo.zip"
)

$ErrorActionPreference = "Stop"

$root = Get-Location
$zipPath = Join-Path $root $OutputName

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "🔐 Creating sealed demo zip..."

Compress-Archive `
    -Path "$root\*" `
    -DestinationPath $zipPath `
    -Force

Write-Host "✅ Created: $zipPath"

