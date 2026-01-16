# genRTL Logo 和名称更新说明

## 更新时间
2024年12月

## 更新内容

### 1. Logo 图标已全面更新

基于您新设计的 `av_logo.png`（灰色六边形带白色"genRTL"文字），已更新以下所有图标文件：

#### SVG 图标（使用嵌入PNG的方式）
- ✅ `icons/stable/codium_cnl.svg`
- ✅ `icons/stable/codium_clt.svg`
- ✅ `icons/stable/codium_cnl_w80_b8.svg`
- ✅ `icons/insider/codium_cnl.svg`
- ✅ `icons/insider/codium_clt.svg`
- ✅ `icons/insider/codium_cnl_w80_b8.svg`

#### VSCode 内部 SVG 图标
- ✅ `vscode/src/vs/workbench/browser/media/code-icon.svg`
- ✅ `vscode/extensions/github-authentication/media/code-icon.svg`

#### Linux 资源图标
- ✅ `src/stable/resources/linux/genRTL.png`
- ✅ `src/stable/resources/linux/genRTL.svg`
- ✅ `src/stable/resources/linux/code.svg`
- ✅ `src/insider/resources/linux/genRTL.png`
- ✅ `src/insider/resources/linux/genRTL.svg`
- ✅ `src/insider/resources/linux/code.svg`

#### Windows 和其他平台图标
- ✅ `vscode/resources/win32/code.ico` - Windows 多尺寸ICO
- ✅ `vscode/resources/linux/code_*.png` - Linux各尺寸PNG（16px到1024px）

### 2. 软件名称已全面更新为 genRTL

#### 核心配置文件
- ✅ `prepare_vscode.sh` - 所有产品名称配置
- ✅ `vscode/product.json` - 主配置文件
- ✅ `VSCode-win32-x64/resources/app/product.json` - 已编译版本配置
- ✅ `product.json` - 根目录配置

#### 脚本文件
- ✅ `convert_logo.py`
- ✅ `rebuild_with_new_logo.sh`
- ✅ `prepare_cline.sh` - Cline扩展目录改为 `genRTL-cline`
- ✅ `build.sh`

#### Linux 桌面集成
- ✅ `src/stable/resources/linux/code.desktop`
- ✅ `src/stable/resources/linux/code-url-handler.desktop`
- ✅ `src/stable/resources/linux/code.appdata.xml`
- ✅ `src/insider/resources/linux/code.desktop`
- ✅ `src/insider/resources/linux/code-url-handler.desktop`
- ✅ `src/insider/resources/linux/code.appdata.xml`

### 3. 已清理的旧文件
- ✅ 删除 `VSCode-win32-x64/resources/app/extensions/genRTL-cline/` 旧扩展目录
- ✅ 删除 `nul` 错误文件

## 重新编译说明

现在所有配置都已更新，您需要重新编译才能看到完整效果：

```bash
# 清理旧的构建
rm -rf VSCode-win32-x64
rm -rf vscode

# 重新构建
./build.sh
```

或者使用快速方式仅更新图标：

```bash
./rebuild_with_new_logo.sh
```

## 验证

重新编译后，您应该能看到：
1. ✅ 软件标题栏显示 "genRTL"
2. ✅ Logo 显示您的新灰色六边形设计（带白色genRTL文字）
3. ✅ 任务栏/Dock图标为新logo
4. ✅ 关于对话框中显示 "genRTL"
5. ✅ 所有菜单和设置中的软件名称为 "genRTL"

## 注意事项

1. **缓存问题**：如果编译后仍看到旧logo，请清理浏览器/系统缓存
2. **扩展名称**：Cline扩展现在位于 `genRTL-cline` 目录
3. **配置目录**：用户配置将保存在 `.genRTL` 或 `.genRTL-server` 目录

## 技术细节

- SVG图标使用Base64嵌入PNG的方式，确保视觉效果与原始PNG完全一致
- Windows ICO包含多种尺寸（16, 32, 48, 64, 128, 256px）
- Linux PNG图标涵盖从16px到1024px的9种尺寸
- 所有文本引用已从"genRTL"替换为"genRTL"

