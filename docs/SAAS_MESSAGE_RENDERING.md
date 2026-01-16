# GenRTL AI助手 - 代码渲染功能文档

## 概述

GenRTL AI助手现在支持将LLM返回的代码以文件形式展示，类似Cursor的代码块渲染功能。

## 代码块格式

### 1. 标准代码块（无文件名）

如果LLM只返回代码而不指定文件名，会显示为匿名代码块：

````markdown
```verilog
module uart(
  input wire clk,
  input wire reset
);
  // ...
endmodule
```
````

**渲染效果：**
- 显示语法高亮的代码
- 可折叠/展开
- 无文件名标签

---

### 2. 新建文件

使用 `language:filename` 格式指定新建文件：

````markdown
```verilog:src/uart.v
module uart(
  input wire clk,
  input wire reset,
  input wire tx_data,
  output reg rx_data
);
  // UART implementation
endmodule
```
````

**渲染效果：**
```
📄 新文件
src/uart.v
[可折叠的代码块]
```

---

### 3. 编辑现有文件

使用 `startLine:endLine:filepath` 格式表示编辑现有文件：

````markdown
```45:67:src/top.v
// Updated code for lines 45-67
module top(
  input wire clk,
  input wire rst_n
);
  uart u_uart(
    .clk(clk),
    .reset(~rst_n)
  );
endmodule
```
````

**渲染效果：**
```
✏️ 编辑现有文件
src/top.v (Lines 45-67)
[可折叠的代码块，显示修改的行]
```

---

## 混合内容示例

AI可以在一个响应中混合自然语言和代码：

````markdown
我来帮你创建一个UART电路：

```verilog:src/uart_tx.v
module uart_tx(
  input wire clk,
  input wire [7:0] data,
  output reg tx
);
  // Transmitter implementation
endmodule
```

现在让我们修改顶层模块来实例化它：

```23:35:src/top.v
module top(
  input wire sys_clk,
  output wire uart_tx
);
  uart_tx u_tx(
    .clk(sys_clk),
    .tx(uart_tx)
  );
endmodule
```

这个实现完成了基本的UART发送功能。
````

**渲染效果：**

```
genRTL AI 🤖

我来帮你创建一个UART电路：

📄 新文件
src/uart_tx.v
[代码块1]

现在让我们修改顶层模块来实例化它：

✏️ 编辑现有文件
src/top.v (Lines 23-35)
[代码块2]

这个实现完成了基本的UART发送功能。
```

---

## 支持的语言

代码块支持所有主流编程语言的语法高亮：

- **HDL**: `verilog`, `systemverilog`, `vhdl`
- **Web**: `javascript`, `typescript`, `html`, `css`, `jsx`, `tsx`
- **Backend**: `python`, `java`, `go`, `rust`, `c`, `cpp`
- **配置**: `json`, `yaml`, `toml`, `xml`
- **Shell**: `bash`, `powershell`, `sh`
- 以及更多...

---

## 从文件扩展名推断语言

如果只提供文件名而不指定语言，系统会自动从扩展名推断：

````markdown
```src/main.py
def hello():
    print("Hello World")
```
````

会被识别为Python代码。

**支持的扩展名映射：**
- `.v`, `.sv` → `verilog`/`systemverilog`
- `.py` → `python`
- `.js` → `javascript`
- `.ts` → `typescript`
- `.cpp`, `.cc` → `cpp`
- 等等...

---

## 用户界面交互

### 代码块卡片

每个代码块显示为一个卡片，包含：

1. **文件头部**
   - 文件图标
   - 操作类型标签（"新文件" 或 "编辑现有文件"）
   - 文件路径
   - 行号范围（如果适用）

2. **可折叠内容**
   - 点击文件头部展开/折叠代码
   - Chevron图标指示当前状态

3. **代码区域**
   - 语法高亮显示
   - 横向滚动条（超长行）
   - 与VSCode主题一致的样式

### 用户消息

用户的消息显示为：
- 灰色背景卡片
- "You" 标签
- 保持原始格式

---

## 示例：创建完整的UART模块

**用户输入：**
```
请用verilog写一个完整的UART电路，包括发送和接收模块
```

**AI响应示例：**

````markdown
好的，我来创建一个完整的UART电路。

首先是UART发送器：

```verilog:src/uart_tx.v
module uart_tx #(
  parameter BAUD_RATE = 115200,
  parameter CLOCK_FREQ = 50000000
)(
  input wire clk,
  input wire rst_n,
  input wire [7:0] tx_data,
  input wire tx_start,
  output reg tx,
  output wire tx_busy
);
  
  localparam BAUD_DIV = CLOCK_FREQ / BAUD_RATE;
  
  reg [15:0] baud_counter;
  reg [3:0] bit_counter;
  reg [9:0] tx_shift_reg;
  
  // UART transmitter implementation
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx <= 1'b1;
      tx_shift_reg <= 10'h3FF;
      baud_counter <= 0;
      bit_counter <= 0;
    end else begin
      // ... transmission logic
    end
  end
  
  assign tx_busy = (bit_counter != 0);
  
endmodule
```

接下来是UART接收器：

```verilog:src/uart_rx.v
module uart_rx #(
  parameter BAUD_RATE = 115200,
  parameter CLOCK_FREQ = 50000000
)(
  input wire clk,
  input wire rst_n,
  input wire rx,
  output reg [7:0] rx_data,
  output reg rx_valid
);
  
  localparam BAUD_DIV = CLOCK_FREQ / BAUD_RATE;
  
  // UART receiver implementation
  // ...
  
endmodule
```

最后是顶层模块整合：

```verilog:src/uart_top.v
module uart_top #(
  parameter BAUD_RATE = 115200,
  parameter CLOCK_FREQ = 50000000
)(
  input wire clk,
  input wire rst_n,
  
  // TX interface
  input wire [7:0] tx_data,
  input wire tx_start,
  output wire tx,
  output wire tx_busy,
  
  // RX interface
  input wire rx,
  output wire [7:0] rx_data,
  output wire rx_valid
);
  
  uart_tx #(
    .BAUD_RATE(BAUD_RATE),
    .CLOCK_FREQ(CLOCK_FREQ)
  ) u_tx (
    .clk(clk),
    .rst_n(rst_n),
    .tx_data(tx_data),
    .tx_start(tx_start),
    .tx(tx),
    .tx_busy(tx_busy)
  );
  
  uart_rx #(
    .BAUD_RATE(BAUD_RATE),
    .CLOCK_FREQ(CLOCK_FREQ)
  ) u_rx (
    .clk(clk),
    .rst_n(rst_n),
    .rx(rx),
    .rx_data(rx_data),
    .rx_valid(rx_valid)
  );
  
endmodule
```

这个UART实现提供了：
- 可配置的波特率
- 标准的8-N-1格式（8位数据，无校验，1位停止位）
- 发送/接收状态指示
- 完整的握手信号

你可以根据需要调整参数。
````

---

## 技术实现

### 代码解析器

位于 `cline/webview-ui/src/components/chat/SaaSMessageRenderer.tsx`

```typescript
function parseMessageContent(content: string): ContentBlock[]
```

**工作流程：**
1. 使用正则表达式匹配所有代码块
2. 解析每个代码块的标记（语言、文件名、行号）
3. 将内容分割为文本块和代码块
4. 返回结构化的内容数组

### 渲染组件

**主要组件：**
- `SaaSMessageRenderer`: 主渲染器，处理用户和AI消息
- `CodeBlockRenderer`: 渲染单个代码块
- `CodeAccordian`: 可折叠的代码容器（复用现有组件）
- `MarkdownBlock`: Markdown文本渲染器（复用现有组件）

---

## 最佳实践

### 对于LLM Prompt设计

在系统提示词中建议LLM使用以下格式：

```
当创建新文件时，使用格式：
```language:path/to/file.ext
code here
```

当编辑现有文件时，使用格式：
```startLine:endLine:path/to/file.ext
code here
```

示例：
- 新文件：```verilog:src/uart.v
- 编辑文件：```45:67:src/top.v
```

### 对于用户

- 明确指出需要创建或修改的文件
- 提供足够的上下文让AI理解文件结构
- 使用准确的文件路径

---

## 故障排除

### 代码块没有正确识别

**问题：** 代码块显示为纯文本

**检查：**
1. 是否使用了三个反引号 ` ``` `
2. 开始和结束标记是否匹配
3. 是否有额外的空格或字符

### 文件名没有显示

**问题：** 代码块没有文件名标签

**检查：**
1. 格式是否正确：`language:filename` 或 `startLine:endLine:filepath`
2. 冒号前后没有空格
3. 文件路径没有特殊字符问题

### 语法高亮不正确

**问题：** 代码没有正确的颜色高亮

**检查：**
1. 语言标识符是否正确（如 `javascript` 而不是 `js`）
2. 文件扩展名是否被正确识别
3. VSCode主题是否支持该语言

---

## 未来功能

### 计划中的功能

- [ ] **Apply按钮**: 一键应用代码到工作区
- [ ] **Copy按钮**: 复制代码到剪贴板
- [ ] **Open in Editor**: 在VSCode中打开文件
- [ ] **Diff视图**: 显示修改前后的对比
- [ ] **Keep/Undo**: 版本控制集成
- [ ] **多文件预览**: 并排显示多个文件

---

## 参考资料

- [Markdown代码块语法](https://www.markdownguide.org/extended-syntax/#fenced-code-blocks)
- [VSCode主题颜色](https://code.visualstudio.com/api/references/theme-color)
- [Highlight.js支持的语言](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md)

