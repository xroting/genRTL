# Trusted Types 错误修复

## 问题描述

编译后VSCode出现空白界面，Console显示错误：
```
ERR Failed to render view claude-dev.SidebarProvider TypeError: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.
```

## 根本原因

VSCode使用了Trusted Types安全策略来防止XSS攻击。直接使用`innerHTML`会被浏览器拦截。

## 解决方案

### 修改的文件：`webviewViewPane.ts`

1. **清空容器内容**
   - ❌ 错误方式：`container.innerHTML = ''`
   - ✅ 正确方式：
   ```typescript
   while (container.firstChild) {
       container.removeChild(container.firstChild);
   }
   ```

2. **设置文本内容**
   - ❌ 错误方式：`element.innerHTML = '×'`
   - ✅ 正确方式：`element.textContent = '×'`

### 关键修改点

#### 在 `updateTabBar()` 方法中：

```typescript
// 修改前
this._tabBarContainer.innerHTML = '';
closeBtn.innerHTML = '×';
newTabBtn.innerHTML = '+';

// 修改后
while (this._tabBarContainer.firstChild) {
    this._tabBarContainer.removeChild(this._tabBarContainer.firstChild);
}
closeBtn.textContent = '×';
newTabBtn.textContent = '+';
```

## 测试步骤

1. 重新编译VSCode:
   ```powershell
   cd D:\xroting\avlog\genRTL\vscode
   yarn compile
   ```

2. 编译Cline扩展:
   ```powershell
   cd D:\xroting\avlog\genRTL
   powershell -ExecutionPolicy ByPass -File .\dev\build-stepwise.ps1
   ```

3. 重启genRTL IDE

4. 打开AI助手侧边栏

5. 验证：
   - ✅ Chat输入框显示正常
   - ✅ Tab栏显示在webview上方
   - ✅ Console无Trusted Types错误

## 相关文档

- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [VSCode Security Best Practices](https://code.visualstudio.com/api/extension-guides/webview#security)

