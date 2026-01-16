# Diff格式测试指南

## 🎯 目标
确保AI在修改现有文件时使用diff格式输出，而不是完整代码。

## ✅ 修改内容总结

### 系统提示词强化（`genRTL-saas/app/api/chat/route.ts`）

1. **在文件开头添加核心原则**
   - 最显眼的位置强调：修改文件必须用diff格式
   - 给出正确和错误的对比示例

2. **在"输出代码格式要求"部分**
   - 明确判断规则：文件存在→用diff，文件不存在→完整代码
   - 强调：修改时只显示变化的行

3. **在"修改现有文件"部分**
   - 添加❌错误示例：直接输出完整代码
   - 添加✅正确示例：使用 `+` 和 `-` 标记

4. **在"响应结构示例2"部分**
   - 添加完整的错误示例和正确示例对比
   - 使用⭐⭐⭐标记重要性

## 🔄 测试步骤

### 步骤1: 重启SaaS后端服务

```bash
cd D:\xroting\avlog\genRTL-saas

# 停止当前服务（Ctrl+C）
# 然后重新启动
npm run dev
# 或
pnpm dev
```

**重要：等待服务完全启动后再继续！**

### 步骤2: 在genRTL中新建测试任务

创建一个测试文件：

1. 在genRTL AI助手中输入：
```
请创建一个简单的counter模块，8位输出
```

2. AI应该创建一个新文件 `src/counter.v`

### 步骤3: 测试修改功能（关键）

在同一个任务中输入：
```
请将counter模块的输出从8位改为16位
```

**预期结果：**

AI应该返回**diff格式**的代码：

```verilog
module counter (
  input wire clk,
  input wire rst_n,
- output reg [7:0] count
+ output reg [15:0] count
);
```

**如果AI仍然返回完整代码（没有 `+` 和 `-`），说明系统提示词没有生效。**

### 步骤4: 检查前端渲染

如果AI正确返回了diff格式：

1. 以 `-` 开头的行应该显示**浅红色背景**
2. 以 `+` 开头的行应该显示**浅绿色背景**
3. 按F12打开控制台，应该看到：
   ```
   [CodeBlock] Line X detected as REMOVED: "- output reg [7:0] count"
   [CodeBlock] Line Y detected as ADDED: "+ output reg [15:0] count"
   [CodeBlock] Diff detected: 1 added, 1 removed
   ```

## 🐛 如果还是不工作

### 问题1: AI仍然输出完整代码
- **原因**：后端服务没有正确重启，或者缓存了旧的系统提示词
- **解决**：
  1. 完全关闭后端进程
  2. 清除Node.js缓存：`npm cache clean --force`
  3. 重新启动：`npm run dev`

### 问题2: AI使用了diff格式，但前端没有渲染
- **原因**：前端webview没有正确编译
- **解决**：
  ```powershell
  cd D:\xroting\avlog\genRTL
  powershell -ExecutionPolicy ByPass -File .\dev\build-webview.ps1
  ```
  然后重启VSCode

### 问题3: 控制台没有 `[CodeBlock]` 日志
- **原因**：webview代码没有加载最新版本
- **解决**：
  1. 在VSCode中按 `Ctrl+Shift+P`
  2. 输入 "Reload Window"
  3. 重新加载窗口

## 📊 测试用例

### 用例1: 扩展位宽
```
请将counter模块的输出从8位改为32位
```

### 用例2: 修改复位逻辑
```
请将counter模块改为同步复位
```

### 用例3: 添加新端口
```
请给counter模块添加一个enable使能信号
```

## ✅ 成功标志

**后端成功**：AI返回的代码包含 `- ` 和 `+ ` 前缀
**前端成功**：
- 删除的行显示浅红色背景
- 新增的行显示浅绿色背景
- 控制台有 `[CodeBlock] Diff detected` 日志

---

## 📝 注意事项

1. **必须在同一个任务中测试**：先创建文件，再修改文件
2. **后端服务必须完全重启**：简单的热重载可能不够
3. **VSCode必须完全重启**：不是Reload Window，而是关闭所有窗口重新打开
4. **检查文件是否真的存在**：AI会用工具检查文件是否存在，如果文件不在工作区，AI会认为是新文件

