# genRTL SaaS 集成修复说明

## 问题描述
客户端在输入提示词后报错："[OPENROUTER] OpenRouter API key is required"

## 根本原因分析（2025-12-20 更新）

经过深入诊断，发现问题的真正原因是：

### 1. 多个输入触发点
- 用户可以在底部输入框输入
- 用户可以点击 HeaderBar 中的 **Agent/Plan 按钮**来切换模式
- 当 HeaderBar 的 `onModeToggle` 被调用时，如果输入框有内容，**会将内容作为 chatContent 发送给后端**

### 2. 原生任务创建流程
```typescript
// HeaderBar.tsx 第46-54行
const response = await StateServiceClient.togglePlanActModeProto(
    TogglePlanActModeRequest.create({
        mode: convertedProtoMode,
        chatContent: {
            message: inputValue.trim() ? inputValue : undefined,  // ← 这里！
            images: selectedImages,
            files: selectedFiles,
        },
    }),
)
```

这个调用会：
1. 通过 gRPC 调用后端扩展
2. 后端扩展创建原生任务（Task）
3. 使用配置的 API provider（OpenRouter）
4. 但 OpenRouter 没有配置 API key → 报错

### 3. 用户操作流程重现
1. 用户在输入框输入 "hi"
2. 用户点击了 Plan 或 Agent 按钮（或使用快捷键 Cmd+Shift+P）
3. `togglePlanActModeProto` 被调用，带着输入内容 "hi"
4. 后端收到请求，尝试创建任务，使用 OpenRouter
5. 报错：OpenRouter API key required

## 完整修复方案

### 1. ChatView.tsx 修改
**文件：** `cline/webview-ui/src/components/chat/ChatView.tsx`

**修改内容：**
- 移除了 `messages.length === 0` 的条件判断
- 在 SaaS 模式下，**总是**使用 `SaaSChatInput`
- Footer 中不再显示原生的 `InputSection` 和 `ActionButtons`

```typescript
// 第416-446行
{saasEnabled ? (
    // 在 SaaS 模式下，总是使用 SaaS 聊天输入
    <SaaSChatInput />
) : (
    // 原生模式
    <>
        <ActionButtons ... />
        <InputSection ... />
    </>
)}
```

### 2. HeaderBar.tsx 修改（新增）
**文件：** `cline/webview-ui/src/components/chat/HeaderBar.tsx`

**修改内容：**
- 导入 `isSaaSEnabled` 配置
- 在 `onModeToggle` 中添加 SaaS 模式检查，阻止原生任务创建
- 在 UI 中隐藏 Agent/Plan 按钮（在 SaaS 模式下）

```typescript
// 第12行：导入 SaaS 配置
import { isSaaSEnabled } from "@/config/saas-config"

// 第40-43行：阻止 SaaS 模式下的模式切换
const saasEnabled = isSaaSEnabled()

const onModeToggle = useCallback(async (targetMode?: Mode) => {
    // 在 SaaS 模式下，禁用模式切换（防止原生任务创建）
    if (saasEnabled) {
        console.log("[HeaderBar] SaaS mode: Mode toggle disabled")
        return
    }
    // ...原有逻辑
}, [mode, inputValue, selectedImages, selectedFiles, setInputValue, saasEnabled])

// 第125-154行：隐藏 Agent/Plan 按钮
{!saasEnabled && (
    <Tooltip>
        {/* Agent/Plan 切换器 */}
    </Tooltip>
)}
```

### 3. WelcomeSection.tsx 和 SaaSChatInput
**文件：** `cline/webview-ui/src/components/chat/chat-view/components/layout/WelcomeSection.tsx`

- 创建了 `SaaSChatInput` 组件
- 实现完整的回车键处理逻辑
- 导出供 ChatView 使用

## 修改文件清单

1. ✅ `cline/webview-ui/src/components/chat/ChatView.tsx`
   - 修改 footer 条件渲染：SaaS 模式总是使用 SaaSChatInput
   - 修改 messageHandlers：SaaS 模式总是使用 SaaS API

2. ✅ `cline/webview-ui/src/components/chat/HeaderBar.tsx`
   - 导入 isSaaSEnabled
   - 阻止 SaaS 模式下的模式切换
   - 隐藏 Agent/Plan 按钮

3. ✅ `cline/webview-ui/src/components/chat/chat-view/components/layout/WelcomeSection.tsx`
   - 创建 SaaSChatInput 组件

4. ✅ `cline/webview-ui/src/components/chat/chat-view/components/layout/index.ts`
   - 导出 SaaSChatInput

## 使用说明

### 1. 确保后端正在运行
```bash
cd D:\xroting\avlog\genRTL-saas
npm run dev
```

后端将在 http://localhost:3005 启动

验证后端运行：
```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3005/api/auth/status" -UseBasicParsing
```

### 2. 确认后端配置
确保 `D:\xroting\avlog\genRTL-saas\.env.local` 包含：
```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. 重新编译前端
```bash
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
```

### 4. 测试步骤
1. 启动 genRTL 客户端
2. 观察界面：
   - 应该**只看到 "genRTL AI" 标题**，没有 Agent/Plan 按钮
   - 底部有一个简单的输入框
3. 在输入框输入 "hi" 并按回车
4. 观察：
   - 前端应该显示用户消息 "hi"
   - 后端日志应该显示：
     ```
     📥 Received chat request: { messageCount: 1, model: 'gpt-4', stream: true }
     🤖 Calling OpenAI API...
     ✅ OpenAI API response received
     ```
   - 前端应该显示 AI 的流式回复

### 5. 检查后端日志
在终端6 (genRTL-saas) 中查看：
```
c:\Users\Administrator\.cursor\projects\d-xroting-avlog-genRTL-saas\terminals\6.txt
```

应该能看到 POST 请求到 `/api/chat`

## 架构说明

### SaaS 模式下的完整流程
```
用户输入 "hi" 并按回车
  ↓
SaaSChatInput 组件 (handleKeyDown)
  ↓
useSaaSChat().sendMessageStream("hi")
  ↓
saasApi.chatStream()
  ↓
HTTP POST → http://localhost:3005/api/chat
  {
    messages: [{ role: "user", content: "hi" }],
    model: "gpt-4",
    stream: true
  }
  ↓
后端 Next.js API Route (app/api/chat/route.ts)
  ↓
OpenAI API (https://api.openai.com/v1/chat/completions)
  ↓
流式响应返回前端
  ↓
前端显示 AI 回复
```

### 被阻止的原生任务流程
```
❌ 用户点击 Agent/Plan 按钮（已被禁用）
❌ StateServiceClient.togglePlanActModeProto()
❌ 后端 gRPC 创建原生任务
❌ 使用配置的 API provider (OpenRouter)
❌ 报错：OpenRouter API key required
```

## 配置检查清单

### 前端配置 ✅
- [x] `cline/webview-ui/src/config/saas-config.ts` 中 `enabled: true`
- [x] `apiBaseUrl: "http://localhost:3005"`

### 后端配置 ✅
- [x] 后端在端口 3005 运行
- [x] `/api/chat` 路由正确实现
- [x] `.env.local` 中配置了 `OPENAI_API_KEY`

### UI 行为 ✅
- [x] SaaS 模式下隐藏 Agent/Plan 按钮
- [x] 底部只显示 SaaSChatInput
- [x] 回车键能正常发送消息

## 故障排除

### 如果还报 OpenRouter 错误：
1. **检查是否有多个 genRTL 实例在运行**
   - 关闭所有 VSCode/Cursor 窗口
   - 重新打开

2. **清除浏览器缓存**（如果是 webview）
   - 重启 Cursor/VSCode

3. **检查后端日志**
   - 确认请求确实到达了 `/api/chat`
   - 如果没有，说明前端还在调用原生 API

4. **验证 SaaS 配置已生效**
   - 在前端代码中添加 console.log
   ```typescript
   console.log("[DEBUG] saasEnabled:", isSaaSEnabled())
   ```

5. **检查编译是否成功**
   - 确保 build.ps1 没有报错
   - 检查是否需要重启 Cursor/VSCode

## 下一步计划
根据 README_SAAS.md 的架构：
1. ✅ 实现基本 chat API（已完成）
2. 📋 实现 Model Router：Plan 用 GPT，Implement/Repair 用 Claude
3. 📋 实现 jobs API：`/api/jobs/plan`, `/api/jobs/implement`, `/api/jobs/repair`
4. 📋 实现 CBB Registry 和相关 API
5. 📋 实现 Usage Ledger 记账系统
6. 📋 集成 Stripe 订阅和计费

