# 🚀 快速构建脚本 - 开发调试专用

## 📋 概述

开发Cline扩展时，完整构建VSCode核心太慢（10-30分钟）。这些脚本只重新构建Cline扩展部分，大大加快开发迭代速度。

## 🎯 三种构建方式对比

| 脚本 | 用途 | 构建内容 | 速度 | 适用场景 |
|------|------|---------|------|----------|
| `dev/build.ps1` | **完整构建** | VSCode核心 + Cline | 🐢 10-30分钟 | ① 首次构建<br>② 修改了VSCode核心代码<br>③ 大版本更新 |
| `dev/quick-build-cline.ps1` | **快速构建** | Cline扩展 (extension + webview) | 🐇 2-5分钟 | ① 修改了extension代码<br>② 修改了webview代码<br>③ 修改了package.json<br>④ **推荐日常开发使用** |
| `dev/quick-build-cline-webview-only.ps1` | **超快构建** | 仅webview | ⚡ 30秒-1分钟 | ① 只修改了webview UI<br>② 只修改了React组件<br>③ 只修改了hooks/样式 |

## 🔧 使用方法

### 方法1: 快速构建Cline扩展（推荐）

**适用于本次修复（修改了extension代码、package.json等）**

```powershell
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\quick-build-cline.ps1
```

**构建内容：**
- ✅ 生成protobuf代码
- ✅ 类型检查
- ✅ 打包extension代码 (`dist/extension.js`)
- ✅ 构建webview (`webview-ui/build`)
- ✅ 拷贝所有文件到 `vscode/extensions/genRTL-cline/`
- ✅ 清理package.json（移除dependencies/scripts）

**预计时间：** 2-5分钟

### 方法2: 超快构建webview（仅webview修改时）

**适用于只修改了React组件、hooks、样式等webview代码**

```powershell
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\quick-build-cline-webview-only.ps1
```

**构建内容：**
- ✅ 构建webview (`webview-ui/build`)
- ✅ 仅拷贝webview build到目标目录

**预计时间：** 30秒-1分钟

⚠️ **注意：** 这个脚本不更新extension代码、package.json等。如果你修改了那些文件，请使用方法1。

### 方法3: 完整构建（仅在必要时使用）

```powershell
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
```

**何时需要完整构建：**
- ✅ 第一次搭建开发环境
- ✅ 修改了VSCode核心代码（`vscode/src/`）
- ✅ 修改了原生UI（`genrtlSettingsEditor.ts`等）
- ✅ 大版本更新或依赖变化

**预计时间：** 10-30分钟

## 📝 本次修复使用哪个脚本？

**本次修复修改了：**
1. ✅ `cline/src/registry.ts` - 添加命令ID
2. ✅ `cline/src/extension.ts` - 注册命令处理器
3. ✅ `cline/src/core/controller/index.ts` - 添加同步方法
4. ✅ `cline/package.json` - 添加命令声明
5. ✅ `vscode/src/.../genrtlSettingsEditor.ts` - 调用命令

**推荐流程：**

```powershell
# 步骤1: 快速构建Cline扩展（包含package.json更新）
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\quick-build-cline.ps1

# 步骤2: 验证命令已注册（可选）
Select-String -Path "D:\xroting\avlog\genRTL\vscode\extensions\genRTL-cline\package.json" -Pattern "syncGenRTLAuth"
# 应该看到命令声明

# 步骤3: 完全重启VSCode
# - 关闭所有窗口
# - 重新打开

# 步骤4: 启动后端
cd D:\xroting\avlog\genRTL-saas
npm run dev

# 步骤5: 测试登录
# - 打开 Account & Authentication
# - 点击 Sign in
# - 检查Console日志
```

## 🔍 验证构建结果

### 检查命令是否注册

```powershell
Select-String -Path "D:\xroting\avlog\genRTL\vscode\extensions\genRTL-cline\package.json" -Pattern "syncGenRTLAuth"
```

**应该看到：**
```json
{
    "command": "genRTL-cline.syncGenRTLAuth",
    "title": "Sync GenRTL Auth State",
    "category": "Cline"
}
```

### 检查extension代码是否更新

```powershell
Select-String -Path "D:\xroting\avlog\genRTL\vscode\extensions\genRTL-cline\dist\extension.js" -Pattern "syncGenRTLAuth"
```

应该找到相关代码。

## 🐛 调试技巧

### 1. 查看VSCode开发者工具

按 `Ctrl+Shift+I` 打开开发者工具，查看Console日志。

### 2. 查看扩展宿主进程输出

VSCode顶部菜单：**帮助 -> 切换开发人员工具 -> Extension Host**

### 3. 重新加载窗口（不重启VSCode）

按 `Ctrl+Shift+P`，输入 "Reload Window"

⚠️ **注意：** 对于package.json的修改，必须完全重启VSCode，重新加载窗口不够！

### 4. 清理缓存（如果遇到奇怪问题）

```powershell
# 清理Cline构建缓存
cd D:\xroting\avlog\genRTL\cline
npm run clean:build

# 然后重新快速构建
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\quick-build-cline.ps1
```

## 📊 性能对比

实测时间（基于普通开发机器）：

| 操作 | 时间 | 说明 |
|------|------|------|
| 完整构建 | 15-30分钟 | 包含VSCode核心编译 |
| 快速构建Cline | 2-5分钟 | 只编译扩展 |
| 超快构建webview | 30-60秒 | 只编译React |
| 重新加载窗口 | 2-3秒 | Ctrl+Shift+P -> Reload Window |
| 完全重启VSCode | 5-10秒 | 关闭所有窗口后重新打开 |

## ⚠️ 重要提醒

1. **修改package.json后必须完全重启VSCode** - 重新加载窗口不够！
2. **修改原生UI代码（genrtlSettingsEditor.ts）需要完整构建** - 它在VSCode核心中
3. **首次使用建议先完整构建一次** - 确保所有依赖都正确
4. **遇到奇怪问题时** - 先尝试 `npm run clean:build` 再重新构建

## 🎯 最佳实践

### 开发流程

1. **首次构建：** 使用完整构建 `dev/build.ps1`
2. **日常开发：** 使用快速构建 `dev/quick-build-cline.ps1`
3. **仅改UI：** 使用超快构建 `dev/quick-build-cline-webview-only.ps1`
4. **改原生UI：** 必须使用完整构建（因为在VSCode核心中）

### 测试流程

```powershell
# 1. 修改代码
# 2. 快速构建
powershell -ExecutionPolicy ByPass -File .\dev\quick-build-cline.ps1

# 3. 重启VSCode（如果改了package.json）或重新加载窗口
# 4. 测试功能
# 5. 如果有问题，检查Console日志
# 6. 修改 -> 构建 -> 测试（循环）
```

## 📞 问题排查

### 问题1: "command not found" 错误

**原因：** package.json中的命令声明没有生效

**解决：**
1. 确认 `cline/package.json` 中有命令声明
2. 运行快速构建确保package.json被拷贝
3. **完全重启VSCode**（重新加载窗口不够！）

### 问题2: 代码修改没有生效

**原因：** 构建后的文件没有更新

**解决：**
1. 检查构建是否成功（有无报错）
2. 确认目标目录有更新：`vscode/extensions/genRTL-cline/`
3. 完全重启VSCode

### 问题3: 构建速度还是很慢

**原因：** 可能在运行完整构建

**解决：**
1. 确认运行的是 `dev/quick-build-cline.ps1`
2. 如果只改webview，用 `dev/quick-build-cline-webview-only.ps1`
3. 检查是否有npm缓存问题：`npm run clean:build`

---

**Created:** 2025-12-26  
**Purpose:** 加速Cline扩展开发调试

