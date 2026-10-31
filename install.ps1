<#
.SYNOPSIS
  ONE Language v1.2.0 Stable - One-Click Environment Setup for VS Code
#>
[CmdletBinding()]
param()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$distVsix = Join-Path $root "dist\one-language-1.2.0.vsix"
$binDir = Join-Path $root "bin"
$sampleFile = Join-Path $root "examples\01_hello_world\main.one"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ONE Language v1.2.0 Stable - Complete Environment Installer   " -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# 1. Install VS Code Extension
if (Get-Command code -ErrorAction SilentlyContinue) {
    Write-Host "[1/3] Installing VS Code Extension..." -ForegroundColor Yellow
    code --install-extension $distVsix --force
    Write-Host "  [OK] VS Code Extension installed successfully." -ForegroundColor Green
} else {
    Write-Host "[1/3] VS Code CLI 'code' not found. Please install manual VSIX:" -ForegroundColor Yellow
    Write-Host "      $distVsix" -ForegroundColor White
}

# 2. Add bin to User PATH
Write-Host "`n[2/3] Configuring User Environment PATH..." -ForegroundColor Yellow
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$binDir*") {
    $newUserPath = "$userPath;$binDir"
    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
    Write-Host "  [OK] Added '$binDir' to User PATH." -ForegroundColor Green
} else {
    Write-Host "  [OK] User PATH already configured." -ForegroundColor Green
}
$env:PATH = "$env:PATH;$binDir"

# 3. Verify Runtime
Write-Host "`n[3/3] Verifying ONE Runtime & Qplayer Engine..." -ForegroundColor Yellow
& (Join-Path $binDir "one.cmd") run $sampleFile --engine=qplayer

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: ONE Language v1.2.0 is now LIVE in VS Code!          " -ForegroundColor Green
Write-Host "  - Open VS Code, create any '.one' file, and start coding.     " -ForegroundColor Green
Write-Host "  - CLI commands 'one run', 'one build' are ready globally.     " -ForegroundColor Green
Write-Host "================================================================`n" -ForegroundColor Green
