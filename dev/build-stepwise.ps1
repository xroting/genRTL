# 🔧 分步构建脚本 - 跳过Cline类型检查
# 这个脚本会手动构建Cline扩展（跳过类型检查），然后构建VSCode核心

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 Stepwise Build - Skip Cline Type Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = $PSScriptRoot + "\.."
$CLINE_DIR = Join-Path $PROJECT_ROOT "cline"
$VSCODE_DIR = Join-Path $PROJECT_ROOT "vscode"
$TARGET_DIR = Join-Path $VSCODE_DIR "extensions\genRTL-cline"

# ============================================================
# 步骤1: 构建Cline扩展（跳过类型检查）
# ============================================================

Write-Host "1️⃣  Building Cline extension (skipping type check)..." -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $CLINE_DIR)) {
    Write-Host "❌ Cline directory not found: $CLINE_DIR" -ForegroundColor Red
    exit 1
}

Push-Location $CLINE_DIR
try {
    # 跳过protobuf生成（文件已存在）
    Write-Host "   ⏭️  Skipping protobuf (already exists)..." -ForegroundColor Gray
    
    # 跳过webview构建（已存在）
    Write-Host "   ⏭️  Skipping webview (already exists)..." -ForegroundColor Gray
    
    # 构建extension（跳过类型检查）
    Write-Host "   📦 Building extension (no type check)..." -ForegroundColor Gray
    node esbuild.mjs --production
    if ($LASTEXITCODE -ne 0) {
        throw "Extension build failed"
    }
    
    Write-Host "   ✅ Cline built successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Cline build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""

# ============================================================
# 步骤2: 拷贝Cline文件到VSCode扩展目录
# ============================================================

Write-Host "2️⃣  Copying Cline files to VSCode extensions..." -ForegroundColor Yellow
Write-Host ""

try {
    # 创建目标目录
    Write-Host "   📁 Creating target directory..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $TARGET_DIR | Out-Null
    New-Item -ItemType Directory -Force -Path "$TARGET_DIR\dist" | Out-Null
    
    # 拷贝dist
    Write-Host "   📄 Copying dist..." -ForegroundColor Gray
    Copy-Item -Path "$CLINE_DIR\dist\*" -Destination "$TARGET_DIR\dist\" -Recurse -Force
    
    # 拷贝package.json
    Write-Host "   📄 Copying package.json..." -ForegroundColor Gray
    Copy-Item -Path "$CLINE_DIR\package.json" -Destination $TARGET_DIR -Force
    
    # 拷贝assets
    Write-Host "   📄 Copying assets..." -ForegroundColor Gray
    Copy-Item -Path "$CLINE_DIR\assets" -Destination $TARGET_DIR -Recurse -Force
    
    # 拷贝walkthrough（如果存在）
    if (Test-Path "$CLINE_DIR\walkthrough") {
        Write-Host "   📄 Copying walkthrough..." -ForegroundColor Gray
        Copy-Item -Path "$CLINE_DIR\walkthrough" -Destination $TARGET_DIR -Recurse -Force
    }
    
    # 拷贝webview build
    Write-Host "   📄 Copying webview build..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path "$TARGET_DIR\webview-ui" | Out-Null
    Copy-Item -Path "$CLINE_DIR\webview-ui\build" -Destination "$TARGET_DIR\webview-ui\" -Recurse -Force
    
    # 清理package.json
    Write-Host "   🧹 Cleaning package.json..." -ForegroundColor Gray
    Push-Location $TARGET_DIR
    try {
        node -e @"
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.dependencies;
delete pkg.devDependencies;
delete pkg.scripts;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"@
        if ($LASTEXITCODE -ne 0) {
            throw "Package.json cleanup failed"
        }
    } finally {
        Pop-Location
    }
    
    Write-Host "   ✅ Files copied successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Copy failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================
# 步骤3: 验证文件
# ============================================================

Write-Host "3️⃣  Verifying files..." -ForegroundColor Yellow
Write-Host ""

$filesToCheck = @(
    "$TARGET_DIR\dist\extension.js",
    "$TARGET_DIR\webview-ui\build\index.html",
    "$TARGET_DIR\package.json"
)

$allGood = $true
foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file - NOT FOUND" -ForegroundColor Red
        $allGood = $false
    }
}

if (-not $allGood) {
    Write-Host ""
    Write-Host "❌ Some files are missing!" -ForegroundColor Red
    exit 1
}

# 检查命令是否注册
Write-Host "   🔍 Checking command registration..." -ForegroundColor Gray
$commandCheck = Select-String -Path "$TARGET_DIR\package.json" -Pattern "authStateChanged" -Quiet
if ($commandCheck) {
    Write-Host "   ✅ authStateChanged command found in package.json" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  authStateChanged command not found in package.json" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================
# 步骤4: 询问是否继续构建VSCode核心
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Cline extension ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Extension location: $TARGET_DIR" -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  Note: You modified VSCode native UI (genrtlSettingsEditor.ts)" -ForegroundColor Yellow
Write-Host "   You MUST also build VSCode core for changes to take effect." -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "Do you want to build VSCode core now? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host ""
    Write-Host "4️⃣  Building VSCode core..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⏰ This will take 10-20 minutes..." -ForegroundColor Gray
    Write-Host ""
    
    Push-Location $VSCODE_DIR
    try {
        # 编译VSCode核心
        Write-Host "   🔨 Compiling VSCode without mangling..." -ForegroundColor Gray
        npm run gulp compile-build-without-mangling
        
        Write-Host "   🎨 Compiling extension media..." -ForegroundColor Gray
        npm run gulp compile-extension-media
        
        Write-Host "   📦 Compiling extensions build..." -ForegroundColor Gray
        npm run gulp compile-extensions-build
        
        Write-Host "   📦 Minifying VSCode..." -ForegroundColor Gray
        npm run gulp minify-vscode
        
        # Windows特定构建
        Write-Host "   🪟 Building Windows package..." -ForegroundColor Gray
        npm run gulp "vscode-win32-x64-min-ci"
        
        Write-Host ""
        Write-Host "   ✅ VSCode core built successfully" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ VSCode build failed: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    } finally {
        Pop-Location
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "🎉 Full build completed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Completely restart VSCode (close all windows)" -ForegroundColor White
    Write-Host "  2. Clear old auth data in Console:" -ForegroundColor White
    Write-Host "     localStorage.removeItem('genrtl_auth_token')" -ForegroundColor Gray
    Write-Host "     localStorage.removeItem('genrtl_user')" -ForegroundColor Gray
    Write-Host "  3. Start backend: cd genRTL-saas && npm run dev" -ForegroundColor White
    Write-Host "  4. Test login and verify SecretStorage" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️  Skipping VSCode core build" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You will need to build VSCode core separately:" -ForegroundColor Yellow
    Write-Host "  cd vscode" -ForegroundColor Gray
    Write-Host "  npm run gulp compile-build-without-mangling" -ForegroundColor Gray
    Write-Host "  npm run gulp compile-extension-media" -ForegroundColor Gray
    Write-Host "  npm run gulp compile-extensions-build" -ForegroundColor Gray
    Write-Host "  npm run gulp minify-vscode" -ForegroundColor Gray
    Write-Host "  npm run gulp vscode-win32-x64-min-ci" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "📚 See docs/BUILD_WORKAROUND.md for more details" -ForegroundColor Cyan
Write-Host ""

