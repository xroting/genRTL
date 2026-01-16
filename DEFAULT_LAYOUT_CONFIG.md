# genRTL 默认配置说明

## 已配置的默认设置

为了让 genRTL AI 默认显示在右侧辅助侧边栏，已在 `product.json` 中添加以下配置：

```json
"configurationDefaults": {
  "workbench.auxiliaryBar.visible": true,
  "workbench.sideBar.location": "left",
  "workbench.panel.defaultLocation": "bottom",
  "workbench.view.genRTL-ai-ActivityBar.location": "auxiliarySideBar"
}
```

### 配置说明：

1. **`workbench.auxiliaryBar.visible: true`**
   - 默认显示辅助侧边栏（右侧边栏）

2. **`workbench.sideBar.location: "left"`**
   - 主侧边栏在左侧（文件资源管理器等）

3. **`workbench.panel.defaultLocation: "bottom"`**
   - 面板默认在底部（终端、输出等）

4. **`workbench.view.genRTL-ai-ActivityBar.location: "auxiliarySideBar"`**
   - genRTL AI 视图容器显示在辅助侧边栏（右侧）

## 效果

启动 genRTL 后：
- ✅ 左侧：文件资源管理器、搜索、源代码管理等常规视图
- ✅ 右侧：genRTL AI 助手（自动打开）
- ✅ 底部：终端和输出面板

## 用户自定义

用户可以随时通过以下方式调整：
1. 拖拽视图图标到其他位置
2. 在设置中搜索 "auxiliary bar" 或 "sidebar location"
3. 使用命令面板：`View: Toggle Auxiliary Bar Visibility`

