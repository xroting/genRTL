# ================================================================================
# 🎨 Webview 编译和部署脚本
# ================================================================================
# 用途：编译webview并自动部署到扩展目录
# 使用：powershell -ExecutionPolicy ByPass -File .\dev\build-webview.ps1
# ================================================================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎨 Building and Deploying Webview" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = $PSScriptRoot + "\.."
$WEBVIEW_DIR = Join-Path $PROJECT_ROOT "cline\webview-ui"
$TARGET_DIR = Join-Path $PROJECT_ROOT "vscode\extensions\genRTL-cline\webview-ui\build"

# ============================================================
# 步骤1: 编译 Webview
# ============================================================

Write-Host "1️⃣  Compiling webview..." -ForegroundColor Yellow
Write-Host ""

Push-Location $WEBVIEW_DIR
try {
    Write-Host "   📦 Running npm build..." -ForegroundColor Gray
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Webview build failed"
    }
    
    Write-Host "   ✅ Webview compiled successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""

# ============================================================
# 步骤2: 部署到扩展目录
# ============================================================

Write-Host "2️⃣  Deploying to extension directory..." -ForegroundColor Yellow
Write-Host ""

try {
    $BUILD_SOURCE = Join-Path $WEBVIEW_DIR "build"
    
    # 确保目标目录存在
    if (-not (Test-Path $TARGET_DIR)) {
        New-Item -ItemType Directory -Force -Path $TARGET_DIR | Out-Null
    }
    
    Write-Host "   📁 Copying files..." -ForegroundColor Gray
    Copy-Item -Path "$BUILD_SOURCE\*" -Destination $TARGET_DIR -Recurse -Force
    
    Write-Host "   ✅ Files deployed successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "   From: $BUILD_SOURCE" -ForegroundColor Gray
    Write-Host "   To:   $TARGET_DIR" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Deployment failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================
# 步骤3: 同步回源码目录（可选）
# ============================================================

Write-Host "3️⃣  Syncing back to source (optional)..." -ForegroundColor Yellow
Write-Host ""

try {
    $SOURCE_BUILD = Join-Path $PROJECT_ROOT "cline\webview-ui\build"
    
    Write-Host "   📄 Syncing..." -ForegroundColor Gray
    Copy-Item -Path "$TARGET_DIR\*" -Destination $SOURCE_BUILD -Recurse -Force
    
    Write-Host "   ✅ Synced" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Sync warning (non-critical): $_" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================
# 完成
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 Webview build and deployment completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. 完全重启VSCode (关闭所有窗口)" -ForegroundColor White
Write-Host "   2. 测试webview的新功能" -ForegroundColor White
Write-Host ""

