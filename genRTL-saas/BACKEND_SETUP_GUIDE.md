# GenRTL SaaS 后端配置指南 - 代码文件输出

## 🚨 重要：必须配置系统提示词

如果LLM输出的代码没有按照文件格式显示，说明**系统提示词未正确配置**。

### 问题现象

**❌ 错误输出（没有文件名）：**
```
module uart (
  input wire clk,
  ...
);
```

**✅ 正确输出（带文件名）：**
```verilog:src/uart.v
module uart (
  input wire clk,
  ...
);
```

---

## 📝 配置步骤

### 步骤1: 编辑聊天API文件

**文件位置**: `genRTL-saas/app/api/chat/route.ts`

### 步骤2: 添加系统提示词

在文件开头添加以下常量：

```typescript
// 系统提示词 - 指导LLM输出正确的代码格式
const SYSTEM_PROMPT = `你是genRTL AI助手，专门帮助用户进行Verilog/SystemVerilog RTL开发。

## 🎯 重要：代码输出格式规范

### 创建新文件时，必须使用以下格式：

\`\`\`language:path/to/filename.ext
代码内容
\`\`\`

### 修改现有文件时，必须使用以下格式：

\`\`\`startLine:endLine:path/to/filename.ext
修改后的代码内容
\`\`\`

## 📋 示例

### 示例1: 创建Verilog文件

用户: "请用verilog写一个UART电路，要求8bit数据位"

助手回答:
\`\`\`
我来创建一个UART发送接收模块：

\`\`\`verilog:src/uart.v
module uart (
  input wire clk,
  input wire reset,
  input wire [7:0] tx_data,
  output reg tx,
  input wire rx,
  output reg [7:0] rx_data
);
  // UART implementation
endmodule
\`\`\`

这个UART模块实现了8位数据传输...
\`\`\`

### 示例2: 修改文件

用户: "修改uart.v的第10-25行，添加奇偶校验"

助手回答:
\`\`\`
我来添加奇偶校验功能：

\`\`\`10:25:src/uart.v
module uart (
  input wire clk,
  input wire reset,
  input wire [7:0] tx_data,
  input wire parity_enable,  // 新增
  output reg tx,
  output reg parity_error    // 新增
);
  // Updated implementation with parity
endmodule
\`\`\`

现在模块支持奇偶校验了...
\`\`\`

## ⚠️ 关键规则

1. **总是包含文件名**: 即使用户没有明确要求，也要自动生成合理的文件名
2. **使用正确的语言标识符**: verilog, systemverilog, python, javascript等
3. **文件路径要合理**: 通常放在 src/, rtl/, tb/ 等目录
4. **修改时包含行号**: 如果是修改现有文件，必须指定行号范围

## 支持的语言标识符

### HDL语言
- verilog - Verilog HDL
- systemverilog - SystemVerilog  
- vhdl - VHDL

### 常用语言
- python, javascript, typescript, c, cpp, java, go, rust

### 配置文件
- json, yaml, toml, xml

你必须严格遵守这些格式规范，否则前端无法正确显示代码文件。`
```

### 步骤3: 在API处理中使用系统提示词

找到 `POST` 函数，修改为：

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, model = 'gpt-4', temperature = 0.7, stream = false } = body

    // ✅ 添加系统提示词到消息列表开头
    const messagesWithSystem = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ]

    console.log('[Chat API] 📥 Request:', {
      model,
      messageCount: messages.length,
      hasSystemPrompt: true,  // 确认已添加
    })

    if (stream) {
      const stream = await openai.chat.completions.create({
        model,
        messages: messagesWithSystem,  // ← 使用带系统提示词的消息
        temperature,
        stream: true,
      })

      // ... 流式响应处理
    } else {
      const completion = await openai.chat.completions.create({
        model,
        messages: messagesWithSystem,  // ← 使用带系统提示词的消息
        temperature,
      })

      // ... 非流式响应处理
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

---

## 🧪 测试配置

### 1. 重启后端服务

```bash
cd genRTL-saas
# 停止当前服务 (Ctrl+C)
npm run dev
```

### 2. 清空聊天历史

在前端清除之前的对话，重新开始。

### 3. 测试输入

```
请用verilog写一个UART电路，要求8bit数据位
```

### 4. 检查LLM输出

在后端终端查看日志，确认：
- ✅ 系统提示词已添加
- ✅ LLM响应包含 ```verilog:文件名

### 5. 前端验证

在前端AI助手中查看：
- ✅ 代码显示为文件卡片
- ✅ 有"新建文件"标签
- ✅ 显示文件名和行数
- ✅ 可以折叠/展开

---

## 🔍 故障排除

### 问题1: LLM仍然不输出文件名

**解决方案：**

1. **检查系统提示词是否生效**：在后端添加日志
   ```typescript
   console.log('[Chat API] System prompt length:', SYSTEM_PROMPT.length)
   console.log('[Chat API] First message role:', messagesWithSystem[0].role)
   ```

2. **增强提示词**：在系统提示词开头加强调
   ```typescript
   const SYSTEM_PROMPT = `‼️ 重要规则：所有代码块必须包含文件名！
   
   你是genRTL AI助手...
   `
   ```

3. **降低temperature**：使输出更确定性
   ```typescript
   temperature: 0.3,  // 从0.7降低到0.3
   ```

### 问题2: 文件名格式不对

**常见错误：**
```
```verilog src/uart.v  ❌ (缺少冒号)
```verilog: src/uart.v  ❌ (冒号后有空格)
```verilog:src/uart.v   ✅ (正确)
```

**解决：** 在系统提示词中添加反例：

```typescript
## ❌ 错误格式（不要使用）

\`\`\`verilog src/uart.v  ← 错误：缺少冒号
\`\`\`verilog: src/uart.v  ← 错误：冒号后有空格

## ✅ 正确格式

\`\`\`verilog:src/uart.v  ← 正确
```

### 问题3: 代码仍显示为纯文本

**检查：**
1. 前端是否已重新编译？
2. VSCode是否已重启？
3. 浏览器缓存是否已清除？

**清除缓存：**
- 完全关闭VSCode
- 删除 `~/.vscode` 或 `%APPDATA%\Code` 中的缓存
- 重新启动

---

## 📊 验证清单

配置完成后，确认以下各项：

- [ ] 系统提示词已添加到 `route.ts`
- [ ] 系统提示词被正确注入到消息列表
- [ ] 后端已重启
- [ ] 测试消息：LLM输出包含 ```language:filename
- [ ] 前端显示：代码显示为文件卡片
- [ ] 前端显示：有文件名、行数、语言标签
- [ ] 前端显示：可以折叠/展开

---

## 📝 完整示例代码

如果您的 `route.ts` 文件结构与上面不同，这里是一个完整的参考实现：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 系统提示词
const SYSTEM_PROMPT = `你是genRTL AI助手，专门帮助用户进行Verilog/SystemVerilog RTL开发。

## 代码输出格式规范（必须遵守）

创建新文件：\`\`\`verilog:src/filename.v
修改文件：\`\`\`45:67:src/filename.v

必须包含文件名，否则前端无法正确显示！`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, model = 'gpt-4', temperature = 0.7, stream = false } = body

    const messagesWithSystem = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ]

    if (stream) {
      const stream = await openai.chat.completions.create({
        model,
        messages: messagesWithSystem,
        temperature,
        stream: true,
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              controller.enqueue(text)
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          }
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

---

## 🎓 额外提示

### 使用Few-Shot Examples

在系统提示词中添加更多示例可以提高LLM输出质量：

```typescript
const SYSTEM_PROMPT = `${basePrompt}

## 更多示例

用户: 创建一个计数器
助手: \`\`\`verilog:src/counter.v
module counter(/*...*/);
endmodule
\`\`\`

用户: 添加使能信号
助手: \`\`\`12:20:src/counter.v
module counter(
  input wire enable,  // 新增
  /*...*/
);
endmodule
\`\`\``
```

### 监控LLM输出

添加日志来监控LLM是否遵守格式：

```typescript
const content = completion.choices[0].message.content
const codeBlocks = content.match(/```[\s\S]*?```/g) || []
console.log('[Chat API] Code blocks found:', codeBlocks.length)
codeBlocks.forEach((block, i) => {
  const hasFilename = /:/.test(block.split('\n')[0])
  console.log(`[Chat API] Block ${i+1} has filename:`, hasFilename)
})
```

---

配置完成后，请重新测试。如有问题，检查后端日志确认系统提示词是否生效。

