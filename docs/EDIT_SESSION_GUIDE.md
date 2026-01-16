# EditSession 使用指南

## Cursor 式 diff + Keep/Undo 功能

本文档说明如何使用 genRTL 中实现的类似 Cursor 的 AI 代码编辑体验。

## 概述

EditSession 系统提供了一个完整的 AI 代码修改管理方案：

1. **乐观写入**：AI 生成的修改默认立即应用到文件
2. **可视化 Diff**：在 Chat 中展示行级别的 +/- diff
3. **可撤销**：随时可以 Undo 回滚到修改前的状态
4. **冲突检测**：如果用户在 AI 修改后又手动编辑，系统会检测并提示

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Webview (GUI)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Chat UI   │  │  DiffCard   │  │  useEditSession    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │ gRPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Extension Host                           │
│  ┌───────────────────────┐  ┌─────────────────────────────┐│
│  │ EditSessionService    │  │   EditSessionManager        ││
│  │ (gRPC Handlers)       │  │   (Session Management)      ││
│  └───────────────────────┘  └─────────────────────────────┘│
│                              ┌─────────────────────────────┐│
│                              │   diff-utils               ││
│                              │   (Diff Calculation)       ││
│                              └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 使用方式

### 1. 在 Extension 中创建 EditSession

```typescript
import { EditSessionManager } from "@core/edit-session"

// 获取单例管理器
const manager = EditSessionManager.getInstance()

// 创建 EditSession
const session = await manager.createSession({
  fileUri: document.uri.toString(),
  filePath: relativePath,
  beforeText: document.getText(),
  afterText: newContent,  // AI 生成的新内容
  beforeDocVersion: document.version,
  taskId: currentTaskId,
  description: "将 counter 模块的输出从 8 位改为 16 位",
})

// 应用编辑（乐观写入）
const success = await manager.applyEdit(session.sessionId, {
  showInChat: true,  // 在 Chat 中显示 DiffCard
})
```

### 2. 在 Webview 中展示 DiffCard

```tsx
import DiffCardContainer from "@/components/DiffCard/DiffCardContainer"

function ChatMessage({ message }) {
  // 如果消息包含 DiffCard 数据
  if (message.diffCard) {
    return (
      <DiffCardContainer
        sessionId={message.diffCard.sessionId}
        initialData={message.diffCard}
        onStatusChange={(id, status) => {
          console.log(`Session ${id} changed to ${status}`)
        }}
        onError={(error) => {
          console.error("DiffCard error:", error)
        }}
      />
    )
  }
  
  // 其他消息类型...
}
```

### 3. 使用 useEditSession Hook

```tsx
import useEditSession from "@/hooks/useEditSession"

function MyComponent() {
  const {
    activeSessions,
    confirmEdit,
    undoEdit,
    openDiffPreview,
    loading,
    error,
  } = useEditSession()
  
  const handleKeep = async (sessionId: string) => {
    const success = await confirmEdit(sessionId)
    if (success) {
      console.log("Edit confirmed!")
    }
  }
  
  const handleUndo = async (sessionId: string) => {
    const success = await undoEdit(sessionId)
    if (success) {
      console.log("Edit undone!")
    }
  }
  
  return (
    <div>
      {activeSessions.map(session => (
        <div key={session.sessionId}>
          <span>{session.filePath}</span>
          <button onClick={() => handleKeep(session.sessionId)}>Keep</button>
          <button onClick={() => handleUndo(session.sessionId)}>Undo</button>
        </div>
      ))}
    </div>
  )
}
```

## Diff 计算

系统使用 LCS（最长公共子序列）算法计算行级别的 diff：

```typescript
import { computeLineDiff, computeDiffStats } from "@core/edit-session"

const diffLines = computeLineDiff(beforeText, afterText)
const stats = computeDiffStats(diffLines)

console.log(`+${stats.additions} -${stats.deletions}`)

// diffLines 格式:
// [
//   { kind: "context", text: "module counter (", oldLine: 1, newLine: 1 },
//   { kind: "del", text: "  output reg [7:0] count", oldLine: 2 },
//   { kind: "add", text: "  output reg [15:0] count", newLine: 2 },
//   { kind: "context", text: ");", oldLine: 3, newLine: 3 },
// ]
```

## Undo 机制

### 安全检查

Undo 操作会进行以下检查：

1. 验证 Session 状态是否允许 Undo
2. 检查文件的当前版本号是否与 `afterDocVersion` 匹配
3. 如果版本号不匹配，比较当前内容与 `afterText`
4. 如果内容已变化，标记为冲突状态

### 冲突处理

```typescript
const result = await manager.undoEdit(sessionId)

if (!result.success && result.needsMerge) {
  // 文件已被修改，存在冲突
  console.log("Conflict detected!")
  console.log("Current text:", result.conflictDetails?.currentText)
  console.log("Before text:", result.conflictDetails?.beforeText)
  console.log("After text:", result.conflictDetails?.afterText)
  
  // 可以选择强制 Undo
  const forceResult = await manager.forceUndo(sessionId)
}
```

## 状态流转

```
                   ┌─────────┐
                   │ Pending │ (创建后)
                   └────┬────┘
                        │ applyEdit()
                        ▼
                   ┌─────────┐
         ┌─────── │ Applied │ ───────┐
         │        └────┬────┘        │
         │             │             │
    undoEdit()   confirmEdit()   检测到冲突
         │             │             │
         ▼             ▼             ▼
    ┌────────┐   ┌───────────┐  ┌────────────┐
    │ Undone │   │ Confirmed │  │ Conflicted │
    └────────┘   └───────────┘  └─────┬──────┘
                                      │
                                 forceUndo()
                                      │
                                      ▼
                                 ┌────────┐
                                 │ Undone │
                                 └────────┘
```

## gRPC API

### EditSessionService

| 方法 | 描述 |
|------|------|
| `createEditSession` | 创建新的编辑会话 |
| `applyEdit` | 应用编辑到文件 |
| `confirmEdit` | 确认编辑（Keep） |
| `undoEdit` | 撤销编辑（Undo） |
| `forceUndo` | 强制撤销（忽略冲突） |
| `getSession` | 获取会话详情 |
| `getActiveSessions` | 获取所有活跃会话 |
| `getSessionsByTaskId` | 获取指定任务的所有会话 |
| `getDiffCard` | 获取 DiffCard 数据 |
| `subscribeToSessionEvents` | 订阅会话事件流 |
| `openDiffPreview` | 在 VSCode diff 编辑器中打开 |

## 最佳实践

### 1. 对于 Verilog 代码修改

建议让 AI 只修改 module 内部的特定部分，避免影响 `timescale` 或 `ifdef` 等全局配置：

```verilog
// AI 应该输出类似这样的 diff：
module counter (
  input wire clk,
- output reg [7:0] count
+ output reg [15:0] count
);
```

### 2. 限制大范围修改

如果 AI 的修改范围过大（例如替换整个文件），建议：
- 显示醒目的警告
- 要求用户确认后再应用

### 3. 多文件修改

对于涉及多个文件的修改，为每个文件创建单独的 EditSession，允许用户逐个确认或撤销。

## 调试

启用调试日志：

```typescript
// 在 EditSessionManager 中会输出日志
// [EditSessionManager] Created session xxx for xxx.sv
// [EditSessionManager] Applied edit for session xxx
// [EditSessionManager] Confirmed session xxx
// [EditSessionManager] Undone session xxx
```

浏览器控制台中也可以看到 DiffCard 相关的日志：
```
[useEditSession] confirmEdit: xxx
[DiffCardContainer] Status changed: confirmed
```

