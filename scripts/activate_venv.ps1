# Activate the repo's Python venv. Run from repo root: .\scripts\activate_venv.ps1
# Or from anywhere: & "C:\Code\Git\personal-info\scripts\activate_venv.ps1"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvActivate = Join-Path $RepoRoot ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $VenvActivate)) {
    Write-Error "Venv not found at $VenvActivate. Run: python -m venv .venv"
    exit 1
}

. $VenvActivate
Write-Host "Activated venv at $RepoRoot\.venv"
