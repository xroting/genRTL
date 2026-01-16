# 🔍 验证UI修改是否生效

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔍 Verifying UI Changes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = $PSScriptRoot + "\.."
$CLINE_DIR = Join-Path $PROJECT_ROOT "cline"
$WEBVIEW_BUILD = Join-Path $CLINE_DIR "webview-ui\build"
$TARGET_DIR = Join-Path $PROJECT_ROOT "vscode\extensions\genRTL-cline"

# 检查源文件修改时间
$sourceFile = Join-Path $CLINE_DIR "webview-ui\src\components\chat\ChatView.tsx"
$buildFile = Join-Path $WEBVIEW_BUILD "index.html"

Write-Host "1️⃣  Checking file timestamps..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $sourceFile) {
    $sourceTime = (Get-Item $sourceFile).LastWriteTime
    Write-Host "   📄 Source file: ChatView.tsx" -ForegroundColor White
    Write-Host "      Last modified: $sourceTime" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Source file not found" -ForegroundColor Red
}

if (Test-Path $buildFile) {
    $buildTime = (Get-Item $buildFile).LastWriteTime
    Write-Host "   📦 Build file: index.html" -ForegroundColor White
    Write-Host "      Last built: $buildTime" -ForegroundColor Gray
    
    if ($buildTime -lt $sourceTime) {
        Write-Host "   ⚠️  BUILD IS OUTDATED! Need to rebuild." -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ Build is up-to-date" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ Build file not found - need to build!" -ForegroundColor Red
}

Write-Host ""

# 检查构建文件中是否包含调试标记
Write-Host "2️⃣  Checking build content for debug markers..." -ForegroundColor Yellow
Write-Host ""

$jsFiles = Get-ChildItem -Path $WEBVIEW_BUILD -Filter "*.js" -Recurse | Select-Object -First 10

$foundMarker = $false
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "ChatTabBar.*COMPONENT RENDER" -or $content -match "RENDER START") {
        Write-Host "   ✅ Found debug markers in: $($file.Name)" -ForegroundColor Green
        $foundMarker = $true
        break
    }
}

if (-not $foundMarker) {
    Write-Host "   ⚠️  Debug markers NOT found in build files" -ForegroundColor Yellow
    Write-Host "      This means the build is using old code!" -ForegroundColor Yellow
}

Write-Host ""

# 检查目标目录
Write-Host "3️⃣  Checking target extension directory..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $TARGET_DIR) {
    Write-Host "   📁 Target: $TARGET_DIR" -ForegroundColor White
    
    $targetWebviewBuild = Join-Path $TARGET_DIR "webview-ui\build\index.html"
    if (Test-Path $targetWebviewBuild) {
        $targetTime = (Get-Item $targetWebviewBuild).LastWriteTime
        Write-Host "   📦 Target build: $targetTime" -ForegroundColor Gray
        
        if (Test-Path $buildFile) {
            if ($targetTime -lt $buildTime) {
                Write-Host "   ⚠️  TARGET IS OUTDATED! Need to copy files." -ForegroundColor Yellow
                Write-Host "      Run: powershell -ExecutionPolicy ByPass -File .\dev\build-stepwise.ps1" -ForegroundColor Gray
            } else {
                Write-Host "   ✅ Target is up-to-date" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ❌ Target build not found" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Target directory not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📋 Summary & Recommendations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "If debug markers were NOT found:" -ForegroundColor Yellow
Write-Host "  1. Rebuild webview:" -ForegroundColor White
Write-Host "     cd cline/webview-ui" -ForegroundColor Gray
Write-Host "     npm run build" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Or use the full build script:" -ForegroundColor White
Write-Host "     powershell -ExecutionPolicy ByPass -File .\dev\build-stepwise.ps1" -ForegroundColor Gray
Write-Host ""

Write-Host "If target is outdated:" -ForegroundColor Yellow
Write-Host "  Run the full build script to copy files" -ForegroundColor White
Write-Host ""

Write-Host "After building:" -ForegroundColor Yellow
Write-Host "  IMPORTANT: Completely close and restart VSCode!" -ForegroundColor Red
Write-Host "  (Reload Window is not enough for webview changes)" -ForegroundColor White
Write-Host ""

Write-Host "To test in dev mode instead:" -ForegroundColor Yellow
Write-Host "  1. Open the 'cline' folder in VSCode" -ForegroundColor White
Write-Host "  2. Press F5 to start Extension Development Host" -ForegroundColor White
Write-Host "  3. Changes will be hot-reloaded automatically" -ForegroundColor White
Write-Host ""

