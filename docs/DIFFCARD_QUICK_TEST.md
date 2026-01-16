# DiffCard 快速测试指南

## 🎯 测试目标

验证 DiffCard 功能是否正确集成到 Chat UI 中。

## 📋 前提条件

1. ✅ 已完成编译：`powershell -ExecutionPolicy ByPass -File .\dev\build-webview.ps1`
2. ✅ **完全重启 VSCode**（关闭所有窗口后重新打开）

## 🧪 测试步骤

### 方法 1：使用浏览器控制台（最简单）

1. **启动扩展开发环境**
   - 在 VSCode 中打开 genRTL 项目
   - 按 F5 启动调试
   - 或在 Run 菜单选择 "Start Debugging"

2. **打开 genRTL Chat**
   - 在新打开的 VSCode 窗口中
   - 点击侧边栏的 genRTL 图标
   - 或按快捷键打开 Chat

3. **打开浏览器开发者工具**
   - 按 `F12` 或 `Ctrl+Shift+I`（Windows/Linux）
   - 或 `Cmd+Option+I`（macOS）
   - 选择 `Console` 标签

4. **检查测试函数是否加载**
   在控制台中应该看到：
   ```
   [EditSession Test] 测试函数已加载
   使用方法: 在浏览器控制台执行 window.createTestDiffCardMessage()
   然后将返回的消息添加到 clineMessages 中
   ```

5. **生成测试消息**
   在控制台输入并执行：
   ```javascript
   const testMsg = window.createTestDiffCardMessage()
   console.log(testMsg)
   ```

6. **检查输出**
   你应该看到一个包含以下字段的对象：
   ```javascript
   {
     ts: 1704268800000,
     type: "say",
     say: "diff_card",
     text: "AI 已修改文件",
     diffCard: {
       sessionId: "test-session-...",
       filePath: "src/counter.v",
       diffLines: [...],
       stats: { additions: 1, deletions: 1, context: 9 },
       status: "applied",
       canUndo: true,
       ...
     }
   }
   ```

### 方法 2：模拟后端发送消息（高级）

如果你想测试完整的消息流：

1. **找到 Task 类**（`cline/src/core/task/Task.ts`）

2. **在适当位置添加测试代码**：

```typescript
// 例如在 Task 的某个方法中
await this.say("diff_card", "AI 已修改文件", undefined, undefined, {
  diffCard: {
    sessionId: "test-" + Date.now(),
    filePath: "src/test.v",
    diffLines: [
      { kind: "context", text: "module test;", oldLine: 1, newLine: 1 },
      { kind: "del", text: "  wire old_signal;", oldLine: 2 },
      { kind: "add", text: "  wire new_signal;", newLine: 2 },
      { kind: "context", text: "endmodule", oldLine: 3, newLine: 3 },
    ],
    stats: { additions: 1, deletions: 1, context: 2 },
    status: "applied",
    canUndo: true,
    description: "测试 DiffCard",
    createdAt: Date.now(),
  }
})
```

3. **触发该方法**并在 Chat 中查看效果

## ✅ 预期结果

### 在 Chat 中应该看到：

#### 1. **DiffCard 卡片**
- 左侧有文件图标 📄
- 显示文件路径：`src/counter.v`
- 显示状态徽章：`Applied`（绿色）
- 显示统计：`+1 -1`

#### 2. **Diff 内容**（可能默认折叠）
点击展开后看到：
```diff
  1  1  module counter (
  2  2    input wire clk,
  3     -  output reg [7:0] count
     3  +  output reg [15:0] count
  4  4  );
  5  5
  6  6  always @(posedge clk) begin
  7  7    count <= count + 1;
  8  8  end
  9  9
 10 10  endmodule
```

其中：
- 红色背景：删除行（`-` 前缀）
- 绿色背景：新增行（`+` 前缀）
- 无背景：上下文行

#### 3. **操作按钮**
- ✅ `Keep` 按钮（绿色）
- ↩️ `Undo` 按钮（红色）
- 🔍 `在 VSCode 中打开 diff`（可选）

## 🐛 故障排查

### 问题 1：控制台没有显示测试函数加载信息

**可能原因**：
- 未在开发模式下运行
- `main.tsx` 中的测试工具加载代码未生效

**解决方法**：
1. 确认 `import.meta.env.DEV` 为 `true`
2. 手动在控制台加载：
   ```javascript
   // 直接定义测试函数
   window.createTestDiffCardMessage = function() {
     return {
       ts: Date.now(),
       type: "say",
       say: "diff_card",
       text: "AI 已修改文件",
       diffCard: {
         sessionId: "test-" + Date.now(),
         filePath: "src/counter.v",
         diffLines: [
           { kind: "context", text: "module counter (", oldLine: 1, newLine: 1 },
           { kind: "del", text: "  output reg [7:0] count", oldLine: 3 },
           { kind: "add", text: "  output reg [15:0] count", newLine: 3 },
           { kind: "context", text: ");", oldLine: 4, newLine: 4 },
         ],
         stats: { additions: 1, deletions: 1, context: 2 },
         status: "applied",
         canUndo: true,
         createdAt: Date.now(),
       }
     }
   }
   ```

### 问题 2：消息生成了但 Chat 中没有显示

**检查清单**：

1. **检查 `isVisibleMessage` 函数**
   在控制台执行：
   ```javascript
   // 测试消息是否可见
   const msg = window.createTestDiffCardMessage()
   console.log("Message type:", msg.type, msg.say)
   // 应该输出: "say" "diff_card"
   ```

2. **检查 Chat 组件是否渲染**
   在 Chat.tsx 的 `renderMessage` 中添加日志：
   ```typescript
   console.log(`[renderMessage] type=${msg.type}, say=${msg.say}, isDiffCard=${isDiffCard}`)
   ```

3. **检查 Redux State**
   如果使用 Redux DevTools：
   - 查看 `state.clineMessages` 是否包含测试消息
   - 确认消息的 `say` 字段为 `"diff_card"`

### 问题 3：DiffCard 组件报错

**检查 Props**：
```javascript
// 验证 diffCard 数据结构
const msg = window.createTestDiffCardMessage()
console.log("DiffCard data:", msg.diffCard)

// 确保包含必要字段
console.log("Has required fields:", 
  msg.diffCard.sessionId,
  msg.diffCard.filePath,
  msg.diffCard.diffLines,
  msg.diffCard.stats
)
```

**检查 Console 错误**：
- 查看是否有 React 组件错误
- 查看是否有类型错误

## 📸 截图参考

测试成功后，DiffCard 应该类似这样：

```
┌─────────────────────────────────────────────────┐
│ 📄 src/counter.v                    Applied  +1 -1 │
├─────────────────────────────────────────────────┤
│   1  1  module counter (                        │
│   2  2    input wire clk,                       │
│   3     -  output reg [7:0] count  [红色背景]  │
│      3  +  output reg [15:0] count [绿色背景]  │
│   4  4  );                                      │
│   ...                                           │
├─────────────────────────────────────────────────┤
│  [✅ Keep]  [↩️ Undo]  [🔍 在 VSCode 中打开]    │
└─────────────────────────────────────────────────┘
```

## 📞 需要帮助？

如果测试遇到问题：

1. 检查编译输出是否有错误
2. 确认完全重启了 VSCode
3. 查看浏览器控制台的错误信息
4. 检查 `DIFFCARD_INTEGRATION_SUMMARY.md` 确认所有步骤都完成了

## ✨ 下一步

测试成功后，可以：

1. 将 DiffCard 集成到 AI 文件修改流程中
2. 在 `PatchApplier` 中调用 `EditSessionManager`
3. 实现真实的 Keep/Undo 功能
4. 添加冲突检测和三方合并

---

**祝测试顺利！🚀**

