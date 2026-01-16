# 快速重新构建脚本 - UI修复后
# 用于在修改VSCode原生UI后快速编译

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 Quick Rebuild After UI Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = $PSScriptRoot + "\.."
$VSCODE_DIR = Join-Path $PROJECT_ROOT "vscode"

Write-Host "📍 This script will rebuild VSCode core after webviewViewPane.ts changes" -ForegroundColor Yellow
Write-Host "⏰ Estimated time: 10-20 minutes" -ForegroundColor Yellow
Write-Host ""

# 检查是否在后台运行
$response = Read-Host "Start compilation now? (y/n)"
if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔨 Starting VSCode core compilation..." -ForegroundColor Green
Write-Host ""

Push-Location $VSCODE_DIR
try {
    # 只编译必要的部分
    Write-Host "   Step 1/2: Compiling build..." -ForegroundColor Gray
    npm run gulp compile-build-without-mangling
    
    if ($LASTEXITCODE -ne 0) {
        throw "Compilation failed"
    }
    
    Write-Host ""
    Write-Host "   Step 2/2: Minifying..." -ForegroundColor Gray
    npm run gulp minify-vscode
    
    if ($LASTEXITCODE -ne 0) {
        throw "Minification failed"
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✅ Compilation completed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Completely restart VSCode (close all windows)" -ForegroundColor White
    Write-Host "  2. Open genRTL project" -ForegroundColor White
    Write-Host "  3. Check if Tab Bar is removed" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

