# 🧪 测试指南 - 代码文件渲染功能

## ✅ 已完成的修改

### 前端
- ✅ `cline/webview-ui/src/components/chat/SaaSMessageRenderer.tsx` 
  - 显示代码行数
  - 显示编程语言
  - 默认展开代码块
  - 增强的文件信息头部

### 后端 ⚠️ **关键修复**
- ✅ `D:\xroting\avlog\genRTL-saas\app\api\chat\route.ts`
  - **修复系统提示词未使用的BUG**
  - 添加消息拼接逻辑
  - 优化系统提示词内容

---

## 🚀 部署步骤

### 步骤1: 重启后端（必须！）

后端代码已修改，但需要重启服务才能生效：

```bash
# 1. 打开后端终端
cd D:\xroting\avlog\genRTL-saas

# 2. 如果服务正在运行，按 Ctrl+C 停止

# 3. 重新启动
npm run dev

# 4. 等待看到启动成功的日志：
#    ✓ Ready in XXXms
#    ○ Local:    http://localhost:3005
```

**验证后端正常运行：**
- 终端没有错误
- 端口3005已监听

### 步骤2: 编译前端（必须！）

```powershell
# 1. 打开前端终端
cd D:\xroting\avlog\genRTL

# 2. 运行完整构建
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1

# 3. 等待编译完成（可能需要5-10分钟）
#    预期输出：
#    ✓ Cline build completed successfully
```

### 步骤3: 重启VSCode（必须！）

```
1. 完全关闭VSCode（File → Exit）
2. 重新打开VSCode
3. 打开genRTL项目
```

---

## 🧪 测试步骤

### 测试1: 验证后端系统提示词生效

**操作：**
1. 查看后端终端日志

**预期日志：**
```
📥 Received chat request: { messageCount: 1, model: 'gpt-4', stream: true }
✅ System prompt added, total messages: 2
🤖 Calling OpenAI API via SDK with undici ProxyAgent...
✅ OpenAI stream started
```

**关键点：**
- ✅ 必须看到 `✅ System prompt added, total messages: 2`
- ✅ `total messages: 2` 表示系统提示词 + 用户消息

如果没有看到这行日志：
- ❌ 后端代码未更新
- ❌ 后端未重启

---

### 测试2: 基础功能测试

**用户输入：**
```
请用verilog写一个UART电路，要求8bit数据位
```

**预期LLM输出（查看后端日志）：**
```
我来创建一个UART模块：

```verilog:src/uart.v
module uart (
  input wire clk,
  ...
);
```

这个模块实现了...
```

**前端显示验证：**

1. **文件卡片头部：**
   ```
   📄 新建文件  src/uart.v    XX lines  verilog
   ```
   - ✅ 有文件图标
   - ✅ 显示"新建文件"
   - ✅ 显示文件路径
   - ✅ 显示行数
   - ✅ 显示语言

2. **代码区域：**
   - ✅ 默认展开状态
   - ✅ 语法高亮
   - ✅ 可以点击折叠

3. **底部提示：**
   ```
   💡 提示: 未来版本将支持一键保存到工作区
   ```

---

### 测试3: 编辑现有文件

**用户输入：**
```
修改uart.v的第10-25行，添加奇偶校验功能
```

**预期LLM输出：**
```
我来添加奇偶校验：

```10:25:src/uart.v
module uart (
  input wire parity_enable,  // 新增
  ...
);
```
```

**前端显示验证：**
```
✏️ 编辑文件  src/uart.v (Lines 10-25)    XX lines  verilog
```
- ✅ 显示"编辑文件"（而不是"新建文件"）
- ✅ 显示行号范围

---

### 测试4: 混合内容测试

**用户输入：**
```
创建一个UART发送器和接收器，并解释工作原理
```

**预期输出：**
1. 自然语言说明
2. 第一个代码文件（uart_tx.v）
3. 自然语言说明
4. 第二个代码文件（uart_rx.v）
5. 总结说明

**验证：**
- ✅ 文本和代码正确分离
- ✅ 多个代码块都正确显示
- ✅ 每个代码块都有独立的文件信息

---

## ❌ 常见问题排查

### 问题1: 代码仍显示为纯文本（没有文件卡片）

**症状：**
```
module uart (
  input wire clk,
  ...
);
```
没有文件卡片包装。

**原因：** 系统提示词未生效

**检查步骤：**

1. **检查后端日志**
   ```bash
   # 查找这一行
   ✅ System prompt added, total messages: 2
   ```
   
   - ✅ 如果有这行：系统提示词已添加
   - ❌ 如果没有：后端未重启或代码未更新

2. **检查LLM输出**
   
   在后端终端查看OpenAI返回的内容：
   - ✅ 正确：包含 ```verilog:src/uart.v
   - ❌ 错误：只有 ```verilog 或 ```

3. **解决方法：**
   ```bash
   # 重启后端
   cd D:\xroting\avlog\genRTL-saas
   # Ctrl+C 停止
   npm run dev  # 重新启动
   
   # 清空聊天历史，重新发送消息
   ```

---

### 问题2: 没有显示行数和语言

**症状：**
文件卡片显示，但是缺少行数和语言信息。

**原因：** 前端代码未更新

**解决：**
```powershell
# 1. 重新编译
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1

# 2. 完全关闭VSCode（File → Exit）

# 3. 重新打开VSCode

# 4. 清除浏览器缓存（如果在webview中）
```

---

### 问题3: LLM仍然不输出文件名

**症状：**
LLM输出：
```
```verilog
module uart...
```
```
没有文件名。

**原因1：** 系统提示词未生效（见问题1）

**原因2：** LLM没有学会新格式（历史对话影响）

**解决：**
1. **清空对话历史**
   - 在AI助手中清除所有消息
   - 重新开始对话

2. **明确要求文件名**
   ```
   用户: 请创建 src/uart.v 文件，用verilog实现UART
   ```

3. **降低temperature（更确定性）**
   ```typescript
   // 在 route.ts 中
   const { messages, model = "gpt-4", stream = false, temperature = 0.3 } // ← 改为0.3
   ```

---

### 问题4: 编译错误

**症状：**
```
error TS2307: Cannot find module...
```

**原因：** 依赖问题

**解决：**
```powershell
# 1. 清理node_modules
cd D:\xroting\avlog\genRTL\cline\webview-ui
Remove-Item -Recurse -Force node_modules
npm install

# 2. 重新编译
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
```

---

## 📋 测试检查清单

完成测试后，确认以下各项：

### 后端
- [ ] 后端已重启
- [ ] 日志显示 `✅ System prompt added`
- [ ] LLM输出包含文件名（```verilog:filename）

### 前端
- [ ] 前端已重新编译
- [ ] VSCode已完全重启
- [ ] 代码显示为文件卡片
- [ ] 显示文件名
- [ ] 显示行数（XX lines）
- [ ] 显示语言（verilog）
- [ ] 默认展开状态
- [ ] 可以折叠/展开
- [ ] 底部有提示信息

### 功能
- [ ] 新建文件：显示"新建文件"标签
- [ ] 编辑文件：显示"编辑文件"和行号
- [ ] 混合内容：文本和代码正确分离
- [ ] 多个代码块：每个都独立显示

---

## 🎯 预期最终效果

**用户：** 请用verilog写一个UART电路，要求8bit数据位

**AI（正确渲染）：**

```
genRTL AI 🤖

我来创建一个UART模块，支持8位数据传输：

┌──────────────────────────────────────────────┐
│ 📄 新建文件  src/uart.v    53 lines  verilog │
├──────────────────────────────────────────────┤
│ module uart (                                │
│   input wire clk,                            │
│   input wire reset,                          │
│   input wire [7:0] tx_data,                  │
│   input wire tx_start,                       │
│   output reg tx,                             │
│   output wire tx_busy,                       │
│   input wire rx,                             │
│   output reg [7:0] rx_data,                  │
│   output reg rx_valid                        │
│ );                                           │
│                                              │
│ parameter BAUD_RATE = 115200;                │
│ parameter CLOCK_FREQ = 50000000;             │
│                                              │
│ // Implementation here...                   │
│                                              │
│ endmodule                                    │
└──────────────────────────────────────────────┘
💡 提示: 未来版本将支持一键保存到工作区

这个UART模块实现了：
1. 8位数据传输
2. 可配置波特率
3. 发送和接收功能
```

---

## 📞 如果仍有问题

1. **查看后端日志** - 确认系统提示词是否添加
2. **查看LLM输出** - 确认是否包含文件名
3. **检查前端编译** - 确认是否成功
4. **清除缓存** - 完全重启VSCode

如果以上都正常但仍有问题，可能需要：
- 检查OpenAI API是否正常
- 检查网络代理设置
- 查看更详细的错误日志

---

**最后一步：清空对话历史，发送测试消息，享受新功能！** 🚀

