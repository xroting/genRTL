# GenRTL SaaS 后端 - LLM Prompt配置指南

## 概述

为了让AI助手能够正确输出代码文件，需要在后端的系统提示词中添加特定的指令。

## 系统提示词配置

### 位置

在 `genRTL-saas/app/api/chat/route.ts` 中的系统提示词部分添加以下指令。

### 推荐的系统提示词

```typescript
const systemPrompt = `你是genRTL AI助手，专门帮助用户进行Verilog/SystemVerilog RTL开发。

## 代码输出格式规范

### 创建新文件

当你需要创建新文件时，使用以下格式：

\`\`\`language:path/to/filename.ext
code content here
\`\`\`

示例：
\`\`\`verilog:src/uart_tx.v
module uart_tx(
  input wire clk,
  input wire [7:0] data,
  output reg tx
);
  // Implementation
endmodule
\`\`\`

### 修改现有文件

当你需要修改现有文件的特定行时，使用以下格式：

\`\`\`startLine:endLine:path/to/filename.ext
updated code content here
\`\`\`

示例：
\`\`\`45:67:src/top.v
module top(
  input wire clk,
  input wire rst_n
);
  // Updated implementation
endmodule
\`\`\`

## 响应结构建议

1. **解释性文本优先**：先用自然语言解释你要做什么
2. **代码块跟随**：然后提供相应的代码
3. **补充说明**：代码后可以添加额外的说明

示例响应结构：

"""
我来帮你创建一个UART发送器模块。

\`\`\`verilog:src/uart_tx.v
module uart_tx(/* ... */);
endmodule
\`\`\`

这个模块实现了标准的UART传输协议...
"""

## 支持的语言标识符

### HDL语言
- \`verilog\` - Verilog HDL
- \`systemverilog\` - SystemVerilog
- \`vhdl\` - VHDL

### 常用编程语言
- \`python\` - Python
- \`javascript\` - JavaScript
- \`typescript\` - TypeScript
- \`c\` - C
- \`cpp\` - C++
- \`java\` - Java
- \`go\` - Go
- \`rust\` - Rust

### 配置文件
- \`json\` - JSON
- \`yaml\` - YAML
- \`toml\` - TOML
- \`xml\` - XML

### Shell脚本
- \`bash\` - Bash
- \`sh\` - Shell
- \`powershell\` - PowerShell

你作为genRTL助手，应该：
1. 优先使用Verilog/SystemVerilog语言
2. 遵循业界RTL编码规范
3. 提供清晰的注释和文档
4. 考虑可综合性和时序
5. 使用合适的文件命名规范
`;
```

## 完整的API实现示例

### 文件：`genRTL-saas/app/api/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 系统提示词 - 指导LLM输出格式
const SYSTEM_PROMPT = `你是genRTL AI助手，专门帮助用户进行Verilog/SystemVerilog RTL开发。

## 代码输出格式规范

当创建新文件时，使用格式：
\`\`\`language:path/to/file.ext
code here
\`\`\`

当编辑现有文件时，使用格式：
\`\`\`startLine:endLine:path/to/file.ext
code here
\`\`\`

示例：
- 新文件：\`\`\`verilog:src/uart.v
- 编辑文件：\`\`\`45:67:src/top.v

## 响应结构
1. 先用自然语言解释
2. 提供代码块
3. 添加补充说明

你应该提供高质量的RTL代码，遵循最佳实践。`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, model = 'gpt-4', temperature = 0.7, stream = false } = body

    // 添加系统提示词
    const messagesWithSystem = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ]

    if (stream) {
      // 流式响应
      const stream = await openai.chat.completions.create({
        model,
        messages: messagesWithSystem,
        temperature,
        stream: true,
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const text = encoder.encode(
              `data: ${JSON.stringify(chunk)}\n\n`
            )
            controller.enqueue(text)
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // 非流式响应
      const completion = await openai.chat.completions.create({
        model,
        messages: messagesWithSystem,
        temperature,
      })

      return NextResponse.json(completion)
    }
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
```

## 针对不同模型的优化

### GPT-4 / GPT-3.5

```typescript
const GPT_SYSTEM_PROMPT = `You are genRTL AI, an expert in Verilog/SystemVerilog RTL development.

## Code Output Format

For NEW files:
\`\`\`language:path/to/file.ext
code
\`\`\`

For EDITING existing files:
\`\`\`startLine:endLine:path/to/file.ext
updated code
\`\`\`

Always include explanatory text before and after code blocks.`
```

### Claude (Anthropic)

```typescript
const CLAUDE_SYSTEM_PROMPT = `You are genRTL AI, specialized in Verilog/SystemVerilog development.

<code_format_rules>
1. New files: \`\`\`verilog:src/filename.v
2. Edit files: \`\`\`45:67:src/filename.v
3. Include line ranges when modifying existing code
4. Always explain before showing code
</code_format_rules>

<best_practices>
- Use clear, descriptive module names
- Add comprehensive comments
- Follow industry RTL coding standards
- Consider synthesis implications
</best_practices>`
```

## 测试提示词

### 测试用例1：创建新文件

**用户输入：**
```
请用verilog写一个UART发送器
```

**期望LLM输出：**
```
我来创建一个UART发送器模块：

\`\`\`verilog:src/uart_tx.v
module uart_tx #(
  parameter BAUD_RATE = 115200
)(
  input wire clk,
  input wire [7:0] data,
  output reg tx
);
  // Implementation
endmodule
\`\`\`

这个模块实现了...
```

### 测试用例2：修改现有文件

**用户输入：**
```
修改 src/top.v 的第23-45行，添加UART实例化
```

**期望LLM输出：**
```
我来修改顶层模块以添加UART实例：

\`\`\`23:45:src/top.v
module top(
  input wire sys_clk,
  output wire uart_tx
);
  uart_tx u_tx(
    .clk(sys_clk),
    .tx(uart_tx)
  );
endmodule
\`\`\`

这样就完成了UART的集成...
```

## Few-Shot示例

在系统提示词中添加few-shot示例可以提高输出质量：

```typescript
const SYSTEM_PROMPT_WITH_EXAMPLES = `${SYSTEM_PROMPT}

## 示例对话

用户: 创建一个简单的计数器
助手: 我来创建一个简单的计数器模块：

\`\`\`verilog:src/counter.v
module counter #(
  parameter WIDTH = 8
)(
  input wire clk,
  input wire rst_n,
  output reg [WIDTH-1:0] count
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      count <= 0;
    else
      count <= count + 1;
  end
endmodule
\`\`\`

这个计数器在复位时清零，每个时钟周期递增。

---

用户: 修改计数器添加使能信号
助手: 我来修改计数器添加使能控制：

\`\`\`7:16:src/counter.v
module counter #(
  parameter WIDTH = 8
)(
  input wire clk,
  input wire rst_n,
  input wire enable,  // 新增使能信号
  output reg [WIDTH-1:0] count
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      count <= 0;
    else if (enable)  // 只在使能时计数
      count <= count + 1;
  end
endmodule
\`\`\`

现在计数器只在enable为高时递增。`
```

## 监控和调试

### 日志记录

在后端添加日志来监控LLM输出：

```typescript
export async function POST(request: NextRequest) {
  // ... 省略前面的代码

  const completion = await openai.chat.completions.create({
    model,
    messages: messagesWithSystem,
    temperature,
  })

  // 记录LLM响应用于调试
  console.log('[Chat] LLM Response:', {
    model,
    content: completion.choices[0].message.content.substring(0, 200),
    hasCodeBlocks: /```/.test(completion.choices[0].message.content),
  })

  return NextResponse.json(completion)
}
```

### 验证输出格式

可以添加中间件验证LLM输出是否符合格式：

```typescript
function validateCodeBlockFormat(content: string): {
  valid: boolean
  blocks: Array<{ type: 'new' | 'edit' | 'anonymous', path?: string }>
} {
  const codeBlockRegex = /```([a-zA-Z0-9]*(?::[\w\-./\\:]+)?)\n[\s\S]*?```/g
  const blocks = []
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const header = match[1]
    
    if (/^\d+:\d+:.+/.test(header)) {
      blocks.push({ type: 'edit', path: header.split(':')[2] })
    } else if (header.includes(':')) {
      blocks.push({ type: 'new', path: header.split(':')[1] })
    } else {
      blocks.push({ type: 'anonymous' })
    }
  }

  return {
    valid: blocks.length > 0,
    blocks
  }
}
```

## 部署检查清单

- [ ] 系统提示词已添加到后端
- [ ] 提示词包含完整的格式说明
- [ ] Few-shot示例已配置
- [ ] 日志记录已启用
- [ ] 测试用例已通过
- [ ] 前端能正确解析输出

## 故障排除

### 问题：LLM不遵循格式

**解决方案：**
1. 在提示词开头强调格式的重要性
2. 使用更强的措辞："MUST use", "ALWAYS use"
3. 增加few-shot示例
4. 降低temperature参数（提高确定性）

### 问题：代码块格式不一致

**解决方案：**
1. 在系统提示词中明确禁止其他格式
2. 使用格式验证中间件
3. 如果检测到错误格式，自动重试

### 问题：混合内容渲染错误

**解决方案：**
1. 确保代码块前后有空行
2. 检查正则表达式是否正确匹配
3. 测试边界情况（连续代码块、嵌套反引号等）

## 参考资料

- [OpenAI Chat API](https://platform.openai.com/docs/api-reference/chat)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

