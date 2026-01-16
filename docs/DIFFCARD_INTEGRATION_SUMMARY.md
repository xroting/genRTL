# DiffCard 集成总结

## 问题诊断

原始实现存在以下问题导致 DiffCard 没有生效：

1. **消息类型未注册**：`ClineSay` 类型中缺少 `"diff_card"`
2. **Proto 定义缺失**：`ui.proto` 中缺少 `DIFF_CARD` 枚举值
3. **Proto 转换器未更新**：`cline-message.ts` 中缺少 `diff_card` 的双向映射
4. **Chat 组件未集成**：`Chat.tsx` 中没有渲染 DiffCard 的逻辑

## 解决方案

### 1. ExtensionMessage.ts 扩展

```typescript
// 添加到 ClineSay 类型
export type ClineSay =
  | ... // 其他类型
  | "diff_card" // Cursor-style diff + Keep/Undo

// 添加到 ClineMessage 接口
export interface ClineMessage {
  // ... 其他字段
  diffCard?: DiffCardData // Cursor-style diff card data
}

// 新增接口定义
export interface DiffCardData {
  sessionId: string
  filePath: string
  diffLines: DiffLine[]
  stats: DiffStats
  status: "pending" | "applied" | "confirmed" | "undone" | "conflicted" | "expired"
  canUndo: boolean
  description?: string
  createdAt: number
}

export interface DiffLine {
  kind: "context" | "add" | "del"
  text: string
  oldLine?: number
  newLine?: number
}

export interface DiffStats {
  additions: number
  deletions: number
  context: number
}
```

### 2. Proto 定义更新

**`cline/proto/cline/ui.proto`**:
```protobuf
enum ClineSay {
  // ... 其他值
  GENERATE_EXPLANATION = 29;
  DIFF_CARD = 30; // Cursor-style diff card
}
```

### 3. Proto 转换器更新

**`cline/src/shared/proto-conversions/cline-message.ts`**:

```typescript
// String -> Enum 映射
const mapping: Record<AppClineSay, ClineSay> = {
  // ... 其他映射
  generate_explanation: ClineSay.GENERATE_EXPLANATION,
  diff_card: ClineSay.DIFF_CARD, // 新增
}

// Enum -> String 映射
const mapping: Record<Exclude<ClineSay, ClineSay.UNRECOGNIZED>, AppClineSay> = {
  // ... 其他映射
  [ClineSay.GENERATE_EXPLANATION]: "generate_explanation",
  [ClineSay.DIFF_CARD]: "diff_card", // 新增
}
```

### 4. Chat.tsx 集成

**`cline/webview-ui/src/pages/gui/Chat.tsx`**:

```typescript
// 1. 导入 DiffCardContainer
import DiffCardContainer from "../../components/DiffCard/DiffCardContainer"

// 2. 更新 isVisibleMessage
function isVisibleMessage(msg: ClineMessage): boolean {
  if (msg.type === "say") {
    return [
      // ... 其他类型
      "diff_card" // 新增
    ].includes(msg.say || "")
  }
  return false
}

// 3. 在 renderMessage 中添加 DiffCard 渲染
const renderMessage = useCallback((msg: ClineMessage, ...) => {
  const isDiffCard = msg.type === "say" && msg.say === "diff_card"
  
  // Render DiffCard if this is a diff_card message
  if (isDiffCard && msg.diffCard) {
    return (
      <div key={msg.ts || index} style={{ margin: "12px 0" }}>
        <DiffCardContainer
          initialData={msg.diffCard}
          onStatusChange={(sessionId, status) => {
            console.log(`[Chat] DiffCard ${sessionId} status changed to ${status}`)
          }}
          onError={(error) => {
            console.error(`[Chat] DiffCard error:`, error)
          }}
        />
      </div>
    )
  }
  
  // ... 其他渲染逻辑
}, [])
```

### 5. 测试工具

**`cline/webview-ui/src/test/editSessionTest.ts`**:

```typescript
export function createTestDiffCardMessage(): ClineMessage {
  // 创建测试用的 DiffCard 消息
  const diffLines: DiffLine[] = [
    { kind: "context", text: "module counter (", oldLine: 1, newLine: 1 },
    { kind: "del", text: "  output reg [7:0] count", oldLine: 3 },
    { kind: "add", text: "  output reg [15:0] count", newLine: 3 },
    // ...
  ]
  
  return {
    ts: Date.now(),
    type: "say",
    say: "diff_card",
    text: "AI 已修改文件",
    diffCard: {
      sessionId: "test-session-" + Date.now(),
      filePath: "src/counter.v",
      diffLines,
      stats: { additions: 1, deletions: 1, context: 9 },
      status: "applied",
      canUndo: true,
      description: "将 counter 模块的输出从 8 位改为 16 位",
      createdAt: Date.now(),
    }
  }
}

// 在开发模式下暴露到 window
if (typeof window !== "undefined") {
  (window as any).createTestDiffCardMessage = createTestDiffCardMessage
}
```

**`cline/webview-ui/src/main.tsx`**:
```typescript
// Load EditSession test helpers in development
if (import.meta.env.DEV) {
  import("./test/editSessionTest")
}
```

## 构建流程

```powershell
# 1. 重新生成 proto 定义
cd D:\xroting\avlog\genRTL\cline
node scripts/build-proto.mjs

# 2. 编译 webview
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build-webview.ps1

# 3. 完全重启 VSCode
```

## 测试方法

### 方法 1：浏览器控制台测试

1. 启动 VSCode 扩展开发环境
2. 按 F12 打开开发者工具
3. 在控制台执行：

```javascript
const testMsg = window.createTestDiffCardMessage()
console.log(testMsg)
```

### 方法 2：后端发送 DiffCard 消息

在 Extension 端（例如在 Task 中）：

```typescript
// 创建 EditSession
const manager = EditSessionManager.getInstance()
const session = await manager.createSession({
  fileUri: document.uri.toString(),
  filePath: relativePath,
  beforeText: oldContent,
  afterText: newContent,
  beforeDocVersion: document.version,
  taskId: this.task.taskId,
  description: "修改描述",
})

// 应用编辑并显示 DiffCard
await manager.applyEdit(session.sessionId, {
  showInChat: true, // 会自动发送 diff_card 消息到 Chat
})

// 或者手动发送消息
await this.task?.say("diff_card", "AI 已修改文件", undefined, undefined, {
  diffCard: {
    sessionId: session.sessionId,
    filePath: session.filePath,
    diffLines: session.diffLines,
    stats: session.stats,
    status: session.status,
    canUndo: session.canUndo,
    description: session.description,
    createdAt: session.createdAt,
  }
})
```

## 预期效果

当 DiffCard 消息显示在 Chat 中时，你应该看到：

### 卡片头部
- 📄 文件图标和文件路径
- 🟢 状态徽章（Applied/Confirmed/Undone/Pending）
- 📊 统计信息（+1 -1 表示新增 1 行，删除 1 行）

### Diff 内容区
- 删除行：红色背景，前缀 `-`
- 新增行：绿色背景，前缀 `+`
- 上下文行：无背景
- 行号显示（旧行号 | 新行号）

### 操作按钮
- ✅ Keep 按钮（绿色）：确认修改
- ↩️ Undo 按钮（红色）：撤销修改
- 🔍 在 VSCode 中打开 diff（可选）

## 后续集成步骤

1. **在 AI 修改文件时集成**：
   - 在 `PatchApplier` 或相关文件修改逻辑中
   - 调用 `EditSessionManager.createSession()`
   - 调用 `manager.applyEdit(sessionId, { showInChat: true })`

2. **处理 Keep/Undo 响应**：
   - gRPC 服务已实现（`confirmEdit`、`undoEdit`）
   - UI 已连接（`useEditSession` hook）

3. **完善错误处理**：
   - 冲突检测和提示
   - 三方合并支持
   - Undo 失败的降级策略

## 文件清单

### 修改的文件
- ✅ `cline/src/shared/ExtensionMessage.ts` - 添加消息类型和接口
- ✅ `cline/proto/cline/ui.proto` - 添加 DIFF_CARD 枚举
- ✅ `cline/src/shared/proto-conversions/cline-message.ts` - 添加转换映射
- ✅ `cline/webview-ui/src/pages/gui/Chat.tsx` - 集成 DiffCard 渲染
- ✅ `cline/webview-ui/src/main.tsx` - 加载测试工具
- ✅ `CHANGELOG.md` - 更新修改日志

### 新增的文件
- ✅ `cline/webview-ui/src/test/editSessionTest.ts` - 测试工具
- ✅ `docs/DIFFCARD_TESTING.md` - 测试指南

### 已存在的文件（之前创建）
- ✅ `cline/src/core/edit-session/` - 核心逻辑
- ✅ `cline/src/core/controller/edit-session/` - gRPC 处理器
- ✅ `cline/proto/cline/edit_session.proto` - Proto 定义
- ✅ `cline/webview-ui/src/components/DiffCard/` - UI 组件
- ✅ `cline/webview-ui/src/hooks/useEditSession.ts` - React Hook

## 编译结果

✅ **编译成功！**

```
vite v7.2.2 building client environment for production...
✓ 3299 modules transformed.
✓ built in 15.97s
🎉 Webview build and deployment completed!
```

## 总结

DiffCard 功能现在已经完全集成到 AppNew.tsx 架构中：

1. ✅ 消息类型定义完成
2. ✅ Proto 定义和转换器更新完成
3. ✅ Chat 组件集成完成
4. ✅ 测试工具准备完成
5. ✅ 编译无错误
6. ✅ 文档更新完成

**下次启动 VSCode 时，DiffCard 功能应该可以正常工作了！**

