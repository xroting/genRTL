# 🧪 测试UI修改脚本
# 这个脚本会快速构建Cline并启动开发模式

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🧪 Test UI Changes in Dev Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = $PSScriptRoot + "\.."
$CLINE_DIR = Join-Path $PROJECT_ROOT "cline"

# ============================================================
# 步骤1: 快速构建Cline
# ============================================================

Write-Host "1️⃣  Building Cline extension..." -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $CLINE_DIR)) {
    Write-Host "❌ Cline directory not found: $CLINE_DIR" -ForegroundColor Red
    exit 1
}

Push-Location $CLINE_DIR
try {
    # 构建webview（这是UI修改的关键）
    Write-Host "   🌐 Building webview (this includes UI changes)..." -ForegroundColor Gray
    npm run build:webview
    if ($LASTEXITCODE -ne 0) {
        throw "Webview build failed"
    }
    
    # 构建extension
    Write-Host "   📦 Building extension..." -ForegroundColor Gray
    node esbuild.mjs --production
    if ($LASTEXITCODE -ne 0) {
        throw "Extension build failed"
    }
    
    Write-Host "   ✅ Build completed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Build completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 提示用户下一步操作
# ============================================================

Write-Host "Next steps to test your UI changes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Test in VSCode Extension Development Host" -ForegroundColor Cyan
Write-Host "  1. Open VSCode" -ForegroundColor White
Write-Host "  2. Open the 'cline' folder" -ForegroundColor White
Write-Host "  3. Press F5 (Run > Start Debugging)" -ForegroundColor White
Write-Host "  4. A new 'Extension Development Host' window will open" -ForegroundColor White
Write-Host "  5. In that window, open Developer Tools (Ctrl+Shift+P > Toggle Developer Tools)" -ForegroundColor White
Write-Host "  6. Look for these console logs:" -ForegroundColor White
Write-Host "     - [ChatView] RENDER START" -ForegroundColor Gray
Write-Host "     - [ChatTabBar] COMPONENT RENDER" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 2: Copy to VSCode extensions and restart" -ForegroundColor Cyan
Write-Host "  Run the full build script:" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy ByPass -File .\dev\build-stepwise.ps1" -ForegroundColor Gray
Write-Host "  Then COMPLETELY restart VSCode (close all windows)" -ForegroundColor White
Write-Host ""

Write-Host "🔍 To verify the changes took effect:" -ForegroundColor Yellow
Write-Host "  In the Console, type: window.chatTabBarDebug" -ForegroundColor White
Write-Host "  If it returns 'undefined', the changes haven't loaded yet" -ForegroundColor White
Write-Host "  If it returns an object, the changes are working!" -ForegroundColor White
Write-Host ""

Write-Host "📝 Build artifacts location:" -ForegroundColor Gray
Write-Host "  Extension: $CLINE_DIR\dist\extension.js" -ForegroundColor Gray
Write-Host "  Webview:   $CLINE_DIR\webview-ui\build\index.html" -ForegroundColor Gray
Write-Host ""

