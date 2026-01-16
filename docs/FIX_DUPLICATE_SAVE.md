# 🔥 紧急修复：重复保存问题

## ❌ 问题

**症状：**
- 文件一直在重复保存
- 每5秒保存一次
- 工作区文件不断被刷新

**原因：**
```typescript
// 错误的代码
React.useEffect(() => {
  if (saveStatus !== "idle") return
  
  autoSaveFile()
  setSaveStatus("success")
  setTimeout(() => setSaveStatus("idle"), 5000) // ← 5秒后重置
}, [block.filename, block.content, saveStatus]) // ← saveStatus 在依赖中！
```

当 `saveStatus` 从 `"success"` 变回 `"idle"` 时，再次触发 `useEffect`，导致无限循环。

## ✅ 解决方案

**使用 `useRef` 标记是否已保存：**

```typescript
const hasSaved = React.useRef(false)

React.useEffect(() => {
  if (!block.filename || hasSaved.current) return
  
  hasSaved.current = true  // 立即标记，防止重复
  autoSaveFile()
}, [block.filename, block.content])  // 移除 saveStatus 依赖
```

## 🚀 部署（必须）

### 1. 编译前端
```powershell
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
```

### 2. 重启VSCode
```
File → Exit → 重新打开
```

### 3. 测试

**清空测试文件：**
```
删除之前测试的 src/uart.v 等文件
```

**发送测试：**
```
请用verilog写两个模块：uart_tx.v和uart_rx.v
```

**预期结果：**
- ✅ 每个文件只保存一次
- ✅ 显示"✓ 已自动保存"
- ✅ 5秒后提示消失
- ✅ **不会重复保存**

**查看日志：**
```
View → Output → Cline

应该看到：
[SaaSMessageRenderer] File auto-saved once: src/uart_tx.v
[SaaSMessageRenderer] File auto-saved once: src/uart_rx.v

不应该看到重复的保存日志！
```

## 🔧 修改的代码

**文件：** `cline/webview-ui/src/components/chat/SaaSMessageRenderer.tsx`

**关键改动：**
```typescript
// 添加
const hasSaved = React.useRef(false)

// useEffect 中
if (!block.filename || hasSaved.current) return
hasSaved.current = true

// 依赖项：移除 saveStatus
}, [block.filename, block.content])
```

## ✅ 验证

- [ ] 编译完成
- [ ] VSCode重启
- [ ] 每个文件只保存一次
- [ ] Output日志没有重复
- [ ] 文件不会被重复刷新

---

**关键：每个代码块只自动保存一次！**

