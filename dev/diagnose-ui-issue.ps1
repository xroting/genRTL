# 🔍 深度诊断脚本 - 查找UI不生效的根本原因

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔍 Deep Diagnostic - Why UI Changes Not Working" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = $PSScriptRoot + "\.."
$CLINE_SRC = Join-Path $PROJECT_ROOT "cline"
$VSCODE_EXT = Join-Path $PROJECT_ROOT "vscode\extensions\genRTL-cline"

Write-Host "1️⃣  Checking Source Code for Debug Markers..." -ForegroundColor Yellow
Write-Host ""

# 检查源代码是否包含我们的修改
$chatViewSrc = Join-Path $CLINE_SRC "webview-ui\src\components\chat\ChatView.tsx"
if (Test-Path $chatViewSrc) {
    $content = Get-Content $chatViewSrc -Raw
    if ($content -match "RENDER START.*Build timestamp") {
        Write-Host "   ✅ Source code contains debug markers" -ForegroundColor Green
        Write-Host "      Found: [ChatView] RENDER START - Build timestamp" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ Source code does NOT contain debug markers!" -ForegroundColor Red
        Write-Host "      This means the file wasn't properly modified" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   ❌ Source file not found: $chatViewSrc" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2️⃣  Checking Webview Build Output..." -ForegroundColor Yellow
Write-Host ""

$webviewBuildDir = Join-Path $CLINE_SRC "webview-ui\build"
if (-not (Test-Path $webviewBuildDir)) {
    Write-Host "   ❌ Webview build directory not found!" -ForegroundColor Red
    Write-Host "      Path: $webviewBuildDir" -ForegroundColor Gray
    Write-Host "      Need to run: cd cline && npm run build:webview" -ForegroundColor Yellow
    exit 1
}

# 检查build目录中的JS文件
$jsFiles = Get-ChildItem -Path "$webviewBuildDir\assets" -Filter "*.js" -ErrorAction SilentlyContinue
if ($jsFiles.Count -eq 0) {
    Write-Host "   ❌ No JS files found in build output!" -ForegroundColor Red
    exit 1
}

Write-Host "   📦 Found $($jsFiles.Count) JS files in build output" -ForegroundColor White

# 检查构建的JS文件中是否包含调试标记
$foundMarker = $false
$searchStrings = @(
    "NEW CODE LOADED",
    "RENDER START",
    "Build timestamp",
    "COMPONENT RENDER",
    "chatTabBarDebug",
    "position.*fixed.*top.*10px",
    "backgroundColor.*#ff0000"
)

foreach ($file in $jsFiles) {
    $jsContent = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($searchStr in $searchStrings) {
        if ($jsContent -match [regex]::Escape($searchStr)) {
            Write-Host "   ✅ Found '$searchStr' in: $($file.Name)" -ForegroundColor Green
            $foundMarker = $true
        }
    }
}

if (-not $foundMarker) {
    Write-Host ""
    Write-Host "   ❌ NO DEBUG MARKERS FOUND IN BUILD!" -ForegroundColor Red
    Write-Host "      This means the webview build is using OLD source code" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Possible reasons:" -ForegroundColor Yellow
    Write-Host "   1. npm run build:webview failed silently" -ForegroundColor White
    Write-Host "   2. Build cache is stale" -ForegroundColor White
    Write-Host "   3. Wrong source directory was built" -ForegroundColor White
    Write-Host ""
    Write-Host "   Try:" -ForegroundColor Yellow
    Write-Host "   cd $CLINE_SRC\webview-ui" -ForegroundColor Gray
    Write-Host "   rm -rf build node_modules/.vite" -ForegroundColor Gray
    Write-Host "   npm run build" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "3️⃣  Checking Target Extension Directory..." -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $VSCODE_EXT)) {
    Write-Host "   ❌ Target extension directory not found!" -ForegroundColor Red
    Write-Host "      Path: $VSCODE_EXT" -ForegroundColor Gray
    Write-Host "      Need to run: build-stepwise.ps1" -ForegroundColor Yellow
    exit 1
}

$targetWebviewDir = Join-Path $VSCODE_EXT "webview-ui\build"
if (-not (Test-Path $targetWebviewDir)) {
    Write-Host "   ❌ Target webview build not found!" -ForegroundColor Red
    Write-Host "      Path: $targetWebviewDir" -ForegroundColor Gray
    Write-Host "      Files were not copied by build script" -ForegroundColor Yellow
    exit 1
}

# 检查目标目录中的JS文件
$targetJsFiles = Get-ChildItem -Path "$targetWebviewDir\assets" -Filter "*.js" -ErrorAction SilentlyContinue
if ($targetJsFiles.Count -eq 0) {
    Write-Host "   ❌ No JS files in target directory!" -ForegroundColor Red
    exit 1
}

Write-Host "   📦 Found $($targetJsFiles.Count) JS files in target" -ForegroundColor White

# 检查目标JS文件中是否包含调试标记
$foundTargetMarker = $false
foreach ($file in $targetJsFiles) {
    $jsContent = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($searchStr in $searchStrings) {
        if ($jsContent -match [regex]::Escape($searchStr)) {
            Write-Host "   ✅ Found '$searchStr' in target: $($file.Name)" -ForegroundColor Green
            $foundTargetMarker = $true
        }
    }
}

if (-not $foundTargetMarker) {
    Write-Host ""
    Write-Host "   ❌ DEBUG MARKERS NOT FOUND IN TARGET!" -ForegroundColor Red
    Write-Host "      The target directory has OLD build files" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   This means build-stepwise.ps1 didn't copy the latest files" -ForegroundColor Yellow
    Write-Host "   Or you need to run it again" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "4️⃣  Comparing File Timestamps..." -ForegroundColor Yellow
Write-Host ""

# 比较源文件和目标文件的时间戳
$sourceFile = $jsFiles[0]
$targetFile = $targetJsFiles[0]

$sourceTime = (Get-Item $sourceFile.FullName).LastWriteTime
$targetTime = (Get-Item $targetFile.FullName).LastWriteTime

Write-Host "   📅 Source build time: $sourceTime" -ForegroundColor White
Write-Host "   📅 Target build time: $targetTime" -ForegroundColor White

if ($targetTime -lt $sourceTime) {
    Write-Host ""
    Write-Host "   ⚠️  TARGET IS OLDER THAN SOURCE!" -ForegroundColor Yellow
    Write-Host "      Need to run build-stepwise.ps1 again" -ForegroundColor Yellow
} elseif ($targetTime -eq $sourceTime) {
    Write-Host "   ✅ Timestamps match - files were copied correctly" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Target is newer than source (unusual)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "5️⃣  Checking VSCode Extension Loading..." -ForegroundColor Yellow
Write-Host ""

# 检查VSCode是否真的从这个目录加载扩展
$packageJson = Join-Path $VSCODE_EXT "package.json"
if (Test-Path $packageJson) {
    $pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
    Write-Host "   📦 Extension name: $($pkg.name)" -ForegroundColor White
    Write-Host "   📦 Extension version: $($pkg.version)" -ForegroundColor White
    Write-Host "   📦 Display name: $($pkg.displayName)" -ForegroundColor White
} else {
    Write-Host "   ❌ package.json not found in target!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎯 Diagnosis Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($foundMarker -and $foundTargetMarker) {
    Write-Host "✅ All checks passed! Debug markers are in both source and target." -ForegroundColor Green
    Write-Host ""
    Write-Host "If you still don't see logs in Console:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "CRITICAL STEPS:" -ForegroundColor Red
    Write-Host "  1. Completely QUIT VSCode (not just close windows)" -ForegroundColor White
    Write-Host "     - Close all windows" -ForegroundColor Gray
    Write-Host "     - Check Task Manager - NO Code.exe processes should be running" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Delete VSCode cache (optional but recommended):" -ForegroundColor White
    Write-Host "     - %APPDATA%\Code\Cache" -ForegroundColor Gray
    Write-Host "     - %APPDATA%\Code\CachedData" -ForegroundColor Gray
    Write-Host "     - %APPDATA%\Code\CachedExtensions" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Restart VSCode" -ForegroundColor White
    Write-Host ""
    Write-Host "  4. Open Developer Tools immediately:" -ForegroundColor White
    Write-Host "     Ctrl+Shift+P > 'Developer: Toggle Developer Tools'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  5. Look for these logs in Console:" -ForegroundColor White
    Write-Host "     [ChatView] RENDER START - Build timestamp:" -ForegroundColor Gray
    Write-Host "     [ChatTabBar] COMPONENT RENDER - Build timestamp:" -ForegroundColor Gray
    Write-Host ""
    Write-Host "If STILL no logs:" -ForegroundColor Yellow
    Write-Host "  The issue might be that ChatView is not being rendered at all" -ForegroundColor White
    Write-Host "  This could be because:" -ForegroundColor White
    Write-Host "  - showNavbar is false" -ForegroundColor Gray
    Write-Host "  - The extension is loading from a different directory" -ForegroundColor Gray
    Write-Host "  - VSCode is using a different build of your extension" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Next step: Check VSCode's extension directory:" -ForegroundColor Yellow
    Write-Host "  Open VSCode Console and type:" -ForegroundColor White
    Write-Host "  vscode.extensions.getExtension('genRTL.genRTL-cline').extensionPath" -ForegroundColor Gray
    Write-Host "  It should return: $VSCODE_EXT" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ Some checks failed. See errors above." -ForegroundColor Red
    Write-Host ""
}

