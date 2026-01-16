# 🚀 Orchestrator 实施指南 - Phase 1

## 🎯 Phase 1 目标

创建Orchestrator核心框架，实现基础的状态机和CLASSIFY/PLAN状态，能够运行一个简单的端到端流程。

**预计时间：** 1-2周  
**优先级：** P0（必须完成才能继续后续阶段）

---

## 📋 任务清单

### Task 1.1: 创建基础类型定义 ✅

**文件：** `cline/src/core/orchestrator/types.ts`

```bash
# 创建目录
mkdir -p cline/src/core/orchestrator

# 创建类型文件
touch cline/src/core/orchestrator/types.ts
```

**要实现的类型：**
- `OrchestratorState`
- `JobContext`
- `RequestClassification`
- `ActionPlan`
- `TodoItem`
- `ExecutionLogEntry`

**验收标准：**
- [x] 所有类型定义完整
- [x] TypeScript编译无错误
- [x] 有完整的JSDoc注释

---

### Task 1.2: 实现Orchestrator核心类 🔄

**文件：** `cline/src/core/orchestrator/Orchestrator.ts`

```typescript
// 最小可行版本（MVP）
export class Orchestrator {
    // 核心状态
    private currentState: OrchestratorState = "CLASSIFY"
    private jobContext: JobContext
    
    constructor(task: Task, controller: Controller, userRequest: string) {
        this.task = task
        this.controller = controller
        this.jobContext = {
            jobId: `job_${Date.now()}`,
            userRequest,
            // ... 初始化
        }
    }
    
    // 主循环
    async run(): Promise<void> {
        while (this.currentState !== "FINALIZE") {
            await this.executeState()
        }
        await this.finalize()
    }
    
    // 状态执行器
    private async executeState(): Promise<void> {
        switch (this.currentState) {
            case "CLASSIFY":
                await this.classify()
                break
            // ... 其他状态
        }
    }
}
```

**验收标准：**
- [ ] 类编译通过
- [ ] 能创建实例
- [ ] 能执行run()方法（即使是空实现）
- [ ] 有基本的错误处理

---

### Task 1.3: 实现CLASSIFY状态 🔄

**核心逻辑：**

```typescript
private async classify(): Promise<void> {
    // Step 1: 构建分类提示词
    const prompt = this.buildClassificationPrompt()
    
    // Step 2: 调用LLM API
    const response = await this.callLLM(prompt, "classification")
    
    // Step 3: 解析响应
    const classification = this.parseClassificationResponse(response)
    
    // Step 4: 更新上下文
    this.jobContext.requestClassification = classification
    
    // Step 5: 决定下一个状态
    this.determineNextStateFromClassification(classification)
}
```

**辅助方法：**

```typescript
private buildClassificationPrompt(): string {
    return `
<task_classification>
Analyze this user request and classify it into one of these categories:

User Request: "${this.jobContext.userRequest}"

Categories:
1. simple_qa - Simple question, no code changes needed
   Example: "What is the purpose of auth.ts?"
   
2. single_file_edit - Modify only one file
   Example: "Add a TODO comment to line 10 of auth.ts"
   
3. multi_file_edit - Changes across 2-5 files
   Example: "Add a login button to the homepage"
   
4. command_execution - Primarily needs to run commands
   Example: "Run npm test and show me the results"
   
5. mcp_tool_required - Needs external MCP tools
   Example: "Search the web for latest React patterns"
   
6. complex_project - Large refactoring or new feature (5+ files)
   Example: "Implement user authentication with OAuth"

Also determine:
- needsDeepPlanning: true if the task requires investigation of codebase
- estimatedComplexity: low/medium/high
- riskLevel: safe/moderate/risky (based on potential for breaking changes)
- suggestedTools: array of tool names that might be needed

Respond ONLY with valid JSON in this exact format:
{
  "type": "category_here",
  "needsDeepPlanning": true/false,
  "estimatedComplexity": "low/medium/high",
  "riskLevel": "safe/moderate/risky",
  "suggestedTools": ["tool1", "tool2"],
  "reasoning": "brief explanation"
}
</task_classification>
`
}

private async callLLM(prompt: string, context: string): Promise<string> {
    // 使用task.api调用LLM
    const messages: ClineStorageMessage[] = [
        { role: "user", content: prompt }
    ]
    
    const response = await this.task.api.createMessage(
        "You are a helpful AI assistant.",
        messages
    )
    
    // 收集响应
    let content = ""
    for await (const chunk of response) {
        if (chunk.type === "text") {
            content += chunk.text
        }
    }
    
    return content
}

private parseClassificationResponse(response: string): RequestClassification {
    // 提取JSON（可能被markdown包裹）
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                      response.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
        // 默认分类
        return {
            type: "multi_file_edit",
            needsDeepPlanning: true,
            estimatedComplexity: "medium",
            riskLevel: "moderate",
            suggestedTools: [],
        }
    }
    
    const json = jsonMatch[1] || jsonMatch[0]
    return JSON.parse(json)
}

private determineNextStateFromClassification(
    classification: RequestClassification
): void {
    if (classification.type === "simple_qa") {
        // 简单问答，直接执行
        this.currentState = "EXECUTE_LOOP"
    } else if (classification.needsDeepPlanning) {
        // 需要深度调研
        this.currentState = "INVESTIGATE"
    } else {
        // 直接规划
        this.currentState = "PLAN"
    }
}
```

**验收标准：**
- [ ] 能正确分类简单请求
- [ ] 能正确分类复杂请求
- [ ] 能处理LLM响应格式错误
- [ ] 有日志输出

---

### Task 1.4: 实现简化版PLAN状态 🔄

**核心逻辑：**

```typescript
private async plan(): Promise<void> {
    console.log("[Orchestrator] Creating execution plan...")
    
    // Step 1: 构建规划提示词
    const prompt = this.buildPlanningPrompt()
    
    // Step 2: 调用LLM生成计划
    const response = await this.callLLM(prompt, "planning")
    
    // Step 3: 解析计划
    const plan = this.parsePlanResponse(response)
    
    // Step 4: 存储计划
    this.actionPlan = plan
    this.jobContext.actionPlan = plan
    
    // Step 5: 向用户展示计划（MVP：通过ask机制）
    await this.presentPlanToUser(plan)
    
    // Step 6: 暂时跳过权限协商，直接执行
    this.currentState = "EXECUTE_LOOP"
}

private buildPlanningPrompt(): string {
    const { userRequest, requestClassification, contextKB } = this.jobContext
    
    return `
<task_planning>
Create a detailed execution plan for this task.

User Request: "${userRequest}"

Classification: ${JSON.stringify(requestClassification, null, 2)}

${contextKB ? `Context: ${JSON.stringify(contextKB, null, 2)}` : ""}

Create a plan with these sections:

1. **Strategy**: High-level approach (2-3 sentences)

2. **TODO Items**: List of concrete steps, each with:
   - goal: What this step achieves
   - tools: Which tools to use (e.g., "read_file", "edit_file", "execute_command")
   - inputs: What information/files are needed
   - acceptanceCriteria: How to verify this step succeeded

3. **Risks**: Potential issues and mitigation strategies

4. **Dependencies**: Which TODOs depend on which others

5. **Estimated Effort**: Rough time estimate

Respond in this JSON format:
{
  "strategy": "...",
  "todos": [
    {
      "id": "todo_1",
      "goal": "...",
      "tools": ["tool1", "tool2"],
      "inputs": {"file": "path/to/file"},
      "acceptanceCriteria": ["criterion 1", "criterion 2"],
      "dependencies": []
    }
  ],
  "risks": [
    {
      "description": "...",
      "mitigation": "..."
    }
  ],
  "estimatedEffort": {
    "time": "5-10 minutes",
    "complexity": "medium"
  }
}
</task_planning>
`
}

private parsePlanResponse(response: string): ActionPlan {
    // 类似parseClassificationResponse
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                      response.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
        throw new Error("Failed to parse plan response")
    }
    
    const json = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(json)
    
    // 初始化TODO状态
    parsed.todos = parsed.todos.map((todo: any) => ({
        ...todo,
        status: "pending",
    }))
    
    return parsed
}

private async presentPlanToUser(plan: ActionPlan): Promise<void> {
    // MVP: 使用task的ask机制展示计划
    const planText = this.formatPlanForDisplay(plan)
    
    await this.task.ask(
        "plan_approval",
        `I've created this execution plan:\n\n${planText}\n\nShall I proceed?`
    )
    
    // 等待用户响应
    const response = await this.waitForUserResponse()
    
    if (response.response !== "yesButtonClicked") {
        // 用户拒绝，终止
        this.currentState = "FINALIZE"
    }
}

private formatPlanForDisplay(plan: ActionPlan): string {
    let text = `**Strategy**: ${plan.strategy}\n\n`
    text += `**TODO Items** (${plan.todos.length} steps):\n`
    
    plan.todos.forEach((todo, i) => {
        text += `${i + 1}. ${todo.goal}\n`
        text += `   Tools: ${todo.tools.join(", ")}\n`
    })
    
    if (plan.risks.length > 0) {
        text += `\n**Risks**:\n`
        plan.risks.forEach((risk, i) => {
            text += `${i + 1}. ${risk.description}\n`
            text += `   Mitigation: ${risk.mitigation}\n`
        })
    }
    
    text += `\n**Estimated Effort**: ${plan.estimatedEffort.time}`
    
    return text
}
```

**验收标准：**
- [ ] 能生成合理的执行计划
- [ ] 计划包含TODO列表
- [ ] 能向用户展示计划
- [ ] 能处理用户批准/拒绝

---

### Task 1.5: 实现简化版EXECUTE_LOOP 🔄

**MVP版本：** 只执行第一个TODO，验证流程

```typescript
private async executeLoop(): Promise<void> {
    console.log("[Orchestrator] Executing action plan...")
    
    if (!this.actionPlan) {
        throw new Error("No action plan to execute")
    }
    
    // MVP: 只执行第一个TODO
    const firstTodo = this.actionPlan.todos[0]
    
    if (!firstTodo) {
        console.log("[Orchestrator] No TODOs to execute")
        this.currentState = "FINALIZE"
        return
    }
    
    console.log("[Orchestrator] Executing TODO:", firstTodo.goal)
    
    firstTodo.status = "in_progress"
    
    try {
        // 执行TODO
        const result = await this.executeTodo(firstTodo)
        
        firstTodo.status = "completed"
        firstTodo.result = result
        
        console.log("[Orchestrator] TODO completed successfully")
    } catch (error) {
        console.error("[Orchestrator] TODO execution failed:", error)
        firstTodo.status = "failed"
        firstTodo.error = error.message
    }
    
    // MVP: 完成后直接终结
    this.currentState = "FINALIZE"
}

private async executeTodo(todo: TodoItem): Promise<any> {
    // MVP: 简单的工具执行
    console.log("[Orchestrator] Executing with tools:", todo.tools)
    
    // 根据工具类型执行
    const results: any[] = []
    
    for (const tool of todo.tools) {
        switch (tool) {
            case "read_file":
                if (todo.inputs.path) {
                    const content = await this.task.toolExecutor.readFile(todo.inputs.path)
                    results.push({ tool, content })
                }
                break
                
            case "edit_file":
                // TODO: 实现文件编辑
                break
                
            case "execute_command":
                if (todo.inputs.command) {
                    const output = await this.task.terminalManager.runCommand(
                        todo.inputs.command
                    )
                    results.push({ tool, output })
                }
                break
                
            default:
                console.warn("[Orchestrator] Unknown tool:", tool)
        }
    }
    
    return results
}
```

**验收标准：**
- [ ] 能执行简单的TODO
- [ ] 能读取文件
- [ ] 能运行命令
- [ ] 有错误处理

---

### Task 1.6: 实现FINALIZE状态 🔄

```typescript
private async finalize(): Promise<void> {
    console.log("[Orchestrator] Finalizing job...")
    
    const endTime = Date.now()
    const duration = endTime - this.jobContext.startTime
    
    // 统计结果
    const stats = {
        total: this.actionPlan?.todos.length || 0,
        completed: this.actionPlan?.todos.filter(t => t.status === "completed").length || 0,
        failed: this.actionPlan?.todos.filter(t => t.status === "failed").length || 0,
        duration,
    }
    
    // 生成摘要
    const summary = this.generateSimpleSummary(stats)
    
    // 通过task.say向用户展示
    await this.task.say(
        "task_completion",
        `Job completed!\n\n${summary}`
    )
    
    console.log("[Orchestrator] Job finished:", stats)
}

private generateSimpleSummary(stats: any): string {
    let summary = `**Execution Summary**\n\n`
    summary += `- Total TODOs: ${stats.total}\n`
    summary += `- Completed: ${stats.completed}\n`
    summary += `- Failed: ${stats.failed}\n`
    summary += `- Duration: ${Math.round(stats.duration / 1000)}s\n`
    
    if (this.actionPlan) {
        summary += `\n**Details:**\n`
        this.actionPlan.todos.forEach((todo, i) => {
            const icon = todo.status === "completed" ? "✅" : 
                        todo.status === "failed" ? "❌" : "⏸️"
            summary += `${icon} ${i + 1}. ${todo.goal}\n`
        })
    }
    
    return summary
}
```

**验收标准：**
- [ ] 能生成执行摘要
- [ ] 能向用户展示结果
- [ ] 有统计信息

---

### Task 1.7: 集成到Task类 🔄

**文件：** `cline/src/core/task/index.ts`

```typescript
import { Orchestrator } from "@/core/orchestrator/Orchestrator"

export class Task {
    // 现有代码...
    
    private orchestrator?: Orchestrator
    
    /**
     * 使用Orchestrator模式启动任务
     * @param userRequest 用户请求
     */
    async startWithOrchestrator(userRequest: string): Promise<void> {
        console.log("[Task] Starting with Orchestrator mode")
        
        try {
            // 创建Orchestrator实例
            this.orchestrator = new Orchestrator(this, this.controller, userRequest)
            
            // 运行
            await this.orchestrator.run()
            
            console.log("[Task] Orchestrator completed")
        } catch (error) {
            console.error("[Task] Orchestrator failed:", error)
            // 回退到普通模式？
            throw error
        }
    }
    
    // 现有代码...
}
```

**验收标准：**
- [ ] Task类编译通过
- [ ] 能创建Orchestrator实例
- [ ] 能调用orchestrator.run()
- [ ] 有错误处理

---

### Task 1.8: 添加测试用例 🔄

**文件：** `cline/src/core/orchestrator/__tests__/Orchestrator.test.ts`

```typescript
import { Orchestrator } from "../Orchestrator"
import { Task } from "@/core/task"
import { Controller } from "@/core/controller"

describe("Orchestrator", () => {
    let mockTask: Task
    let mockController: Controller
    
    beforeEach(() => {
        // 创建mock对象
        mockTask = {} as Task
        mockController = {} as Controller
    })
    
    test("should create instance", () => {
        const orch = new Orchestrator(mockTask, mockController, "test request")
        expect(orch).toBeDefined()
    })
    
    test("should start in CLASSIFY state", () => {
        const orch = new Orchestrator(mockTask, mockController, "test request")
        expect(orch.getCurrentState()).toBe("CLASSIFY")
    })
    
    // 更多测试...
})
```

**验收标准：**
- [ ] 至少5个测试用例
- [ ] 所有测试通过
- [ ] 覆盖主要流程

---

## 🎯 Phase 1 验收标准

完成Phase 1后，应该能够：

1. ✅ **端到端流程**
   - 用户发送请求
   - Orchestrator自动分类
   - 生成执行计划
   - 执行第一个TODO
   - 生成完成报告

2. ✅ **日志输出**
   ```
   [Orchestrator] Starting job job_123456
   [Orchestrator] State: CLASSIFY
   [Orchestrator] Classification: { type: "multi_file_edit", ... }
   [Orchestrator] State: PLAN
   [Orchestrator] Plan created with 3 todos
   [Orchestrator] State: EXECUTE_LOOP
   [Orchestrator] Executing TODO: Read auth.ts
   [Orchestrator] TODO completed successfully
   [Orchestrator] State: FINALIZE
   [Orchestrator] Job completed: { total: 3, completed: 1, ... }
   ```

3. ✅ **用户可见**
   - 能看到分类结果
   - 能看到执行计划
   - 能看到每个TODO的状态
   - 能看到最终报告

4. ✅ **代码质量**
   - TypeScript无错误
   - 有完整注释
   - 有基础测试
   - 遵循现有代码风格

---

## 🚀 如何开始

### 1. 创建分支

```bash
git checkout -b feature/orchestrator-phase1
```

### 2. 按顺序实施任务

从Task 1.1开始，逐个完成。每完成一个任务，提交代码：

```bash
git add .
git commit -m "feat(orchestrator): Task 1.X - [任务描述]"
```

### 3. 测试验证

每完成一个任务，立即测试：

```bash
# 编译检查
npm run check-types

# 运行测试
npm test

# 手动测试
# 启动VSCode，发送测试请求
```

### 4. 文档更新

更新 `docs/ORCHESTRATOR_DESIGN.md` 的实施状态。

---

## 📝 注意事项

1. **MVP原则**
   - Phase 1只实现最小可行版本
   - 不要过度设计
   - 先跑通流程，再优化

2. **复用现有代码**
   - 使用task.api调用LLM
   - 使用task.say/ask与用户交互
   - 使用task.toolExecutor执行工具

3. **渐进式开发**
   - 先让简单case工作
   - 再处理复杂情况
   - 最后处理边界条件

4. **日志很重要**
   - 每个关键步骤都要记录日志
   - 方便调试和追踪
   - 用户也能看到进度

---

## 🆘 遇到问题？

1. **LLM调用失败** → 检查task.api是否正确初始化
2. **状态转换混乱** → 添加更多日志，追踪状态变化
3. **测试难写** → 先写集成测试，再补单元测试
4. **性能问题** → Phase 1先别优化，能跑就行

---

**创建时间：** 2025-12-26  
**预计完成：** 2周  
**负责人：** TBD

