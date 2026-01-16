# 测试 DiffCard 功能

## 已完成的集成

1. **类型定义**：
   - 在 `ExtensionMessage.ts` 中添加了 `"diff_card"` 到 `ClineSay` 类型
   - 添加了 `DiffCardData`、`DiffLine`、`DiffStats` 接口

2. **UI 集成**：
   - 在 `Chat.tsx` 中添加了 DiffCard 渲染逻辑
   - 导入了 `DiffCardContainer` 组件
   - 在 `isVisibleMessage` 中添加了 `"diff_card"` 支持

3. **测试工具**：
   - 创建了 `editSessionTest.ts` 测试辅助函数
   - 在 `main.tsx` 中加载测试工具（仅开发模式）

## 测试方法

### 方法 1：使用浏览器控制台测试

1. **重新编译前端**：
```powershell
powershell -ExecutionPolicy ByPass -File .\dev\build-webview.ps1
```

2. **启动 VSCode 开发环境**，打开浏览器控制台（F12）

3. **在控制台中执行**：
```javascript
// 创建测试消息
const testMsg = window.createTestDiffCardMessage()
console.log(testMsg)

// 这将显示一个 DiffCard 消息对象
// 包含 counter.v 的 8位到16位的修改
```

4. **查看效果**：
   - 你应该能看到消息对象包含 `diffCard` 字段
   - UI 会自动渲染 DiffCard 组件

### 方法 2：从后端发送 DiffCard 消息

在 Extension 端（后端）发送消息时，添加 `diffCard` 字段：

```typescript
// 在 Task 或其他地方添加消息
await this.controller.task?.say("diff_card", "AI 已修改文件", undefined, undefined, {
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

当 DiffCard 消息被渲染时，你应该看到：

1. **卡片头部**：
   - 文件图标和文件名
   - 状态徽章（Applied/Confirmed/Undone 等）
   - 统计信息（+N -M）

2. **Diff 内容区**：
   - 行级别的 diff 展示
   - 删除行（红色背景）
   - 新增行（绿色背景）
   - 上下文行（无背景）

3. **操作按钮**：
   - Keep 按钮（绿色，确认修改）
   - Undo 按钮（红色，撤销修改）
   - 在 VSCode 中打开 diff 的按钮

## 如果没有看到效果

### 检查清单：

1. **前端是否重新编译**：
```powershell
powershell -ExecutionPolicy ByPass -File .\dev\build-webview.ps1
```

2. **VSCode 是否完全重启**：
   - 关闭所有 VSCode 窗口
   - 重新打开

3. **检查控制台错误**：
   - 按 F12 打开开发者工具
   - 查看 Console 选项卡是否有错误
   - 查看是否有 `[Chat] DiffCard` 相关的日志

4. **检查消息是否正确**：
```javascript
// 在控制台检查 clineMessages
console.log(window.clineMessages)  // 或通过 Redux DevTools 查看
```

5. **检查 isVisibleMessage 函数**：
   - 确保 `"diff_card"` 包含在可见消息类型中

## 下一步：与 EditSessionManager 集成

当 AI 修改文件时，需要：

1. 调用 `EditSessionManager.createSession()`
2. 调用 `manager.applyEdit(sessionId, { showInChat: true })`
3. 后端会自动发送 `diffCard` 消息到 webview
4. Chat 会自动渲染 DiffCard

## 示例：完整的修改流程

```typescript
// 1. AI 生成了新内容
const newContent = aiResponse.content

// 2. 创建 EditSession
const manager = EditSessionManager.getInstance()
const session = await manager.createSession({
  fileUri: document.uri.toString(),
  filePath: relativePath,
  beforeText: document.getText(),
  afterText: newContent,
  beforeDocVersion: document.version,
  taskId: this.task.taskId,
  description: "将 counter 从 8位改为 16位",
})

// 3. 应用编辑并显示 DiffCard
await manager.applyEdit(session.sessionId, {
  showInChat: true,  // 会自动发送消息到 chat
})

// 4. DiffCard 会自动显示在 Chat 中
// 5. 用户可以点击 Keep 或 Undo
```

