# DiffCard Keep/Undo 功能使用指南

## 🎉 功能状态

✅ **已完全实现** - 所有 Keep/Undo 功能均已实现并通过编译

---

## 📋 功能概览

### 1. DiffCard UI
- ✅ 显示文件路径和修改描述
- ✅ 行级 diff 显示（+ 新增，- 删除）
- ✅ 颜色高亮（绿色新增，红色删除）
- ✅ 统计信息（+N -M 行）
- ✅ 状态指示（APPLIED / CONFIRMED / UNDONE）

### 2. 交互按钮
- **✓ Keep** - 确认修改，标记为 "已确认"
- **↶ Undo** - 撤销修改，恢复原文件
- **Open in Diff** - 在 VSCode diff 编辑器中查看

---

## 🧪 测试步骤

### 步骤 1：重启 VSCode
```bash
# 完全关闭所有 VSCode 窗口，然后重新打开
```

### 步骤 2：打开测试环境
1. 打开 genRTL 项目
2. 打开 Cline 侧边栏（AI 助手）
3. 查看 Chat 界面

### 步骤 3：点击测试按钮
- 在 Chat 输入框附近找到 **"🧪 测试 DiffCard"** 绿色按钮
- 点击按钮
- 应该看到一个 DiffCard 显示：
  ```
  📄 counter.v
  测试：将 counter 模块的输出从 8 位改为 16 位
  +1 -1
  [APPLIED]
  ```

### 步骤 4：测试 Keep 按钮
1. 点击蓝色 **"✓ Keep"** 按钮
2. 观察：
   - 状态变为 `[CONFIRMED]`
   - 按钮变灰（不可再点击）
   - 控制台输出：`✅ Edit confirmed: <sessionId>`

### 步骤 5：测试 Undo 按钮
1. 刷新页面或点击新的测试按钮
2. 点击灰色 **"↶ Undo"** 按钮
3. 观察：
   - 状态变为 `[UNDONE]`
   - 按钮变灰
   - 文件应恢复到修改前状态
   - 控制台输出：`✅ Edit undone: <sessionId>`

### 步骤 6：测试 Diff 预览
1. 点击 **"Open in Diff"** 图标按钮
2. VSCode 应打开一个 diff 编辑器
3. 左侧显示修改前，右侧显示修改后

---

## 🔍 调试方法

### 浏览器控制台
在 Cline webview 中按 `F12` 打开控制台，查看日志：

```javascript
// Keep 按钮点击
[useEditSession] Confirming edit for session: <sessionId>
[useEditSession] ✅ Edit confirmed: <sessionId>

// Undo 按钮点击
[useEditSession] Undoing edit for session: <sessionId>
[useEditSession] ✅ Edit undone: <sessionId>

// 冲突检测
[useEditSession] ⚠️ Conflict detected: <sessionId>
```

### Extension Host 日志
在 VSCode 中按 `Ctrl+Shift+P` → "Developer: Show Logs" → "Extension Host"

```
[EditSessionManager] Confirmed session <sessionId>
[EditSessionManager] Undone session <sessionId>
[EditSessionManager] Document version changed: 5 -> 7
```

---

## 🏗️ 架构说明

### 数据流

```
用户点击 Keep/Undo
    ↓
DiffCard.tsx (UI)
    ↓
DiffCardContainer.tsx
    ↓
useEditSession.ts (Hook)
    ↓
EditSessionServiceClient (gRPC)
    ↓
[ProtoBus 通信]
    ↓
confirmEdit.ts / undoEdit.ts (Handler)
    ↓
EditSessionManager.ts
    ↓
VSCode Workspace API
    ↓
修改文件 / 更新状态
```

### 关键组件

| 组件 | 路径 | 功能 |
|------|------|------|
| `DiffCard` | `webview-ui/src/components/DiffCard/` | UI 显示 |
| `useEditSession` | `webview-ui/src/hooks/` | gRPC 调用 |
| `EditSessionManager` | `core/edit-session/` | 会话管理 |
| `confirmEdit` | `controller/edit-session/` | Keep 处理器 |
| `undoEdit` | `controller/edit-session/` | Undo 处理器 |

---

## 🔐 安全机制

### 1. 版本检测
- 记录修改前文档版本 `beforeDocVersion`
- 记录修改后文档版本 `afterDocVersion`
- Undo 时检测版本是否变化

### 2. 冲突处理
```typescript
if (document.version !== session.afterDocVersion) {
  // 文件在 AI 修改后又被手动编辑
  // 尝试三方合并
  const mergeResult = tryThreeWayMerge(
    beforeText, afterText, currentText
  )
  
  if (mergeResult.hasConflicts) {
    // 提示用户确认
    status = "conflicted"
  }
}
```

### 3. 强制撤销
- 用户可选择 `forceUndo()` 忽略冲突警告
- 直接恢复到 `beforeText`（可能丢失手动修改）

---

## 🚀 集成到 AI 流程

### 在 LLM 工具中调用

```typescript
import { EditSessionManager } from "@core/edit-session"

// AI 修改文件后
async function onAIEditFile(fileUri: string, beforeText: string, afterText: string) {
  const manager = EditSessionManager.getInstance()
  
  // 1. 创建会话
  const session = await manager.createSession({
    fileUri,
    filePath: vscode.workspace.asRelativePath(fileUri),
    beforeText,
    afterText,
    beforeDocVersion: document.version,
    taskId: currentTaskId,
    description: "AI 修改了文件"
  })
  
  // 2. 应用编辑（乐观写入）
  await manager.applyEdit(session.sessionId)
  
  // 3. 获取 DiffCard 数据
  const diffCard = manager.getDiffCardMessage(session.sessionId)
  
  // 4. 发送到 Chat
  await controller.postMessageToWebview({
    orchestratorMessage: {
      ts: Date.now(),
      type: "say",
      say: "diff_card",
      text: "AI 已修改文件",
      diffCard,
    }
  })
}
```

---

## 📊 状态流转图

```
pending (等待应用)
    ↓ applyEdit()
applied (已应用，可撤销)
    ↓ confirmEdit() / undoEdit()
    ├─→ confirmed (已确认)
    ├─→ undone (已撤销)
    └─→ conflicted (冲突)
         ↓ forceUndo()
        undone (强制撤销)
```

---

## 🐛 已知问题

无已知问题 ✅

---

## 📚 参考文档

- [EditSession 类型定义](../cline/src/core/edit-session/types.ts)
- [EditSessionManager 实现](../cline/src/core/edit-session/EditSessionManager.ts)
- [DiffCard UI 组件](../cline/webview-ui/src/components/DiffCard/index.tsx)
- [Proto 定义](../cline/proto/cline/edit_session.proto)

---

## ✅ 完成清单

- [x] DiffCard UI 显示
- [x] Keep 按钮功能
- [x] Undo 按钮功能
- [x] 冲突检测
- [x] VSCode Diff 预览
- [x] gRPC 服务连接
- [x] 前端编译通过
- [x] 后端编译通过
- [ ] 与 AI 流程集成（下一步）
- [ ] 端到端测试

---

**状态：🟢 功能完成，等待用户测试**

