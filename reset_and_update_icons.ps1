# Reset and Update genRTL Icons
# This script cleans all caches and updates all icons

$ErrorActionPreference = "Stop"

Write-Host "=== genRTL Icon Update Script ===" -ForegroundColor Cyan

# 1. Close all genRTL instances
Write-Host "`n[1/6] Checking for running genRTL instances..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object { $_.ProcessName -like "*genRTL*" -or $_.ProcessName -like "*code*" }
if ($processes) {
    Write-Host "Found running processes. Please close genRTL manually and press Enter to continue..." -ForegroundColor Red
    Read-Host
} else {
    Write-Host "No running instances found." -ForegroundColor Green
}

# 2. Clear Windows icon cache
Write-Host "`n[2/6] Clearing Windows icon cache..." -ForegroundColor Yellow
taskkill /f /im explorer.exe 2>$null | Out-Null
Start-Sleep -Seconds 2

Remove-Item -Path "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache*" -Force -ErrorAction SilentlyContinue

Start-Process explorer.exe
Start-Sleep -Seconds 2
Write-Host "Icon cache cleared." -ForegroundColor Green

# 3. Clear genRTL user data cache
Write-Host "`n[3/6] Clearing genRTL cache..." -ForegroundColor Yellow
$genRTLCache = "$env:APPDATA\.vscode-oss"
if (Test-Path $genRTLCache) {
    Remove-Item -Path "$genRTLCache\Cache" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$genRTLCache\CachedData" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$genRTLCache\Code Cache" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$genRTLCache\GPUCache" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$genRTLCache\logs" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "genRTL cache cleared." -ForegroundColor Green
} else {
    Write-Host "No cache found (first run?)." -ForegroundColor Gray
}

# 4. Update exe icon
Write-Host "`n[4/6] Updating genRTL.exe icon..." -ForegroundColor Yellow
$exePath = Join-Path $PSScriptRoot "VSCode-win32-x64\genRTL.exe"
if (Test-Path $exePath) {
    Set-Location $PSScriptRoot
    try {
        node update_exe_icon.js
        Write-Host "EXE icon updated." -ForegroundColor Green
    } catch {
        Write-Host "Failed to update EXE icon: $_" -ForegroundColor Red
        Write-Host "You may need to run this script as Administrator" -ForegroundColor Yellow
    }
} else {
    Write-Host "genRTL.exe not found at $exePath" -ForegroundColor Red
}

# 5. Verify icon files in resources
Write-Host "`n[5/6] Verifying resource icons..." -ForegroundColor Yellow
$png70 = "VSCode-win32-x64\resources\app\resources\win32\code_70x70.png"
$png150 = "VSCode-win32-x64\resources\app\resources\win32\code_150x150.png"
$avLogo = "av_logo.png"

if ((Get-FileHash $png70).Hash -eq (Get-FileHash $avLogo).Hash) {
    Write-Host "✓ code_70x70.png is correct" -ForegroundColor Green
} else {
    Write-Host "✗ code_70x70.png needs update" -ForegroundColor Red
}

if ((Get-FileHash $png150).Hash -eq (Get-FileHash $avLogo).Hash) {
    Write-Host "✓ code_150x150.png is correct" -ForegroundColor Green
} else {
    Write-Host "✗ code_150x150.png needs update" -ForegroundColor Red
}

# 6. Final instructions
Write-Host "`n[6/6] All done!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Start genRTL from: $exePath" -ForegroundColor White
Write-Host "2. If the icon still doesn't show, try:" -ForegroundColor White
Write-Host "   - Right-click Desktop -> Refresh" -ForegroundColor Gray
Write-Host "   - Restart your computer" -ForegroundColor Gray
Write-Host "`nPress Enter to exit..." -ForegroundColor Cyan
Read-Host
