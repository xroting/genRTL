# 🎯 GenRTL AI Assistant Orchestrator 架构设计

## 📋 目标

将AI助手从简单的一问一答模式升级为类似高级工程师的工作方式，具备：
- 🔍 **主动调研**：深入理解代码结构和约束
- 📋 **结构化规划**：制定详细可追踪的执行计划  
- 🔄 **自动修复**：失败时自动诊断和修复
- ✅ **质量保证**：每步验证，可回滚

---

## 🏗️ 整体架构

### 核心理念

一次用户请求 = 一个 **Job**，由 **Orchestrator** 状态机驱动，自动完成从理解需求到交付成果的全流程。

### 状态机设计

```
用户请求
   ↓
┌─────────────────────────────────────────────────────────┐
│  CLASSIFY （分类）                                       │
│  - 判断请求类型（Q&A / 单文件改动 / 跨文件 / 需要MCP）  │
│  - 决定是否需要深度规划                                │
│  - 设置任务优先级和预期复杂度                         │
└─────────────────────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────────────────────┐
│  INVESTIGATE （调研）                                    │
│  - 触发deep-planning静默侦查                           │
│  - 读取相关文件、分析结构、收集约束                   │
│  - 理解现有模式、依赖关系、技术债                     │
│  - 输出：上下文知识库（Context KB）                   │
└─────────────────────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────────────────────┐
│  PLAN （规划）                                           │
│  - 基于调研结果制定结构化计划                         │
│  - 生成TODO列表（每条包含：目标、工具、验收标准）    │
│  - 识别风险点和依赖关系                               │
│  - 预估工作量和关键路径                               │
│  - 输出：可执行的ActionPlan                            │
└─────────────────────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────────────────────┐
│  PERMISSION_NEGOTIATE （权限协商）                       │
│  - 根据Action计划生成"最小权限集合"                    │
│  - 一次性向用户申请所有需要的权限                     │
│  - 支持部分批准（用户可以选择性同意）                │
│  - 记录权限决策用于后续类似任务                       │
└─────────────────────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────────────────────┐
│  EXECUTE_LOOP （执行循环）                               │
│  - 逐条执行TODO                                         │
│  - 每个TODO执行后验证结果                              │
│  - 记录执行日志和中间状态                             │
│  - 失败 → 进入REPAIR状态                               │
│  - 成功 → 继续下一个或进入FINALIZE                     │
└─────────────────────────────────────────────────────────┘
   ↓ (失败)
┌─────────────────────────────────────────────────────────┐
│  REPAIR （修复）                                         │
│  - 分析失败原因（错误日志、输出、状态）               │
│  - 自动生成修复策略                                     │
│  - 限制修复尝试次数（防止死循环）                     │
│  - 修复成功 → 返回EXECUTE_LOOP                         │
│  - 修复失败 → 升级用户或进入FINALIZE                   │
└─────────────────────────────────────────────────────────┘
   ↓ (完成)
┌─────────────────────────────────────────────────────────┐
│  FINALIZE （终结）                                       │
│  - 生成执行摘要和变更报告                             │
│  - 创建diff和回滚点                                     │
│  - 验证记录（哪些成功、哪些失败、为什么）            │
│  - 提供后续建议（测试、部署、优化）                   │
└─────────────────────────────────────────────────────────┘
   ↓
交付给用户
```

---

## 🔧 技术实现

### 1. Orchestrator核心类

```typescript
// cline/src/core/orchestrator/Orchestrator.ts

import { Task } from "@/core/task"
import { Controller } from "@/core/controller"
import type { OrchestratorState, JobContext, ActionPlan } from "./types"

/**
 * Orchestrator - AI助手的指挥系统
 * 将用户请求转化为结构化的、可追踪的、自动修复的执行流程
 */
export class Orchestrator {
    private currentState: OrchestratorState
    private jobContext: JobContext
    private task: Task
    private controller: Controller
    private actionPlan?: ActionPlan
    private maxRepairAttempts = 3
    private repairAttempts = 0

    constructor(task: Task, controller: Controller, userRequest: string) {
        this.task = task
        this.controller = controller
        this.jobContext = {
            jobId: task.taskId,
            userRequest,
            requestClassification: null,
            contextKB: {},
            actionPlan: null,
            executionLog: [],
            permissions: new Set(),
            startTime: Date.now(),
        }
        this.currentState = "CLASSIFY"
    }

    /**
     * 主执行循环 - 驱动状态机
     */
    async run(): Promise<void> {
        console.log(`[Orchestrator] Starting job ${this.jobContext.jobId}`)
        
        while (this.currentState !== "FINALIZE") {
            console.log(`[Orchestrator] State: ${this.currentState}`)
            
            try {
                await this.executeState()
            } catch (error) {
                console.error(`[Orchestrator] Error in state ${this.currentState}:`, error)
                // 严重错误直接进入终结状态
                this.currentState = "FINALIZE"
                this.jobContext.executionLog.push({
                    type: "fatal_error",
                    state: this.currentState,
                    error: error.message,
                    timestamp: Date.now(),
                })
            }
        }
        
        // 最后的终结状态
        await this.finalize()
    }

    /**
     * 执行当前状态的逻辑
     */
    private async executeState(): Promise<void> {
        switch (this.currentState) {
            case "CLASSIFY":
                await this.classify()
                break
            case "INVESTIGATE":
                await this.investigate()
                break
            case "PLAN":
                await this.plan()
                break
            case "PERMISSION_NEGOTIATE":
                await this.negotiatePermissions()
                break
            case "EXECUTE_LOOP":
                await this.executeLoop()
                break
            case "REPAIR":
                await this.repair()
                break
            default:
                throw new Error(`Unknown state: ${this.currentState}`)
        }
    }

    /**
     * CLASSIFY - 分类请求
     */
    private async classify(): Promise<void> {
        console.log("[Orchestrator] Classifying request...")
        
        // 使用LLM分类用户请求
        const classificationPrompt = `
Analyze this user request and classify it:

User Request: "${this.jobContext.userRequest}"

Classify into one of:
1. simple_qa - Simple question that doesn't require code changes
2. single_file_edit - Modify a single file
3. multi_file_edit - Changes across multiple files
4. command_execution - Needs to run commands
5. mcp_tool_required - Requires external MCP tools
6. complex_project - Large refactoring or new feature

Also determine:
- needsDeepPlanning: boolean (if investigation is required)
- estimatedComplexity: "low" | "medium" | "high"
- riskLevel: "safe" | "moderate" | "risky"

Respond in JSON format.
`
        
        // 调用API获取分类结果
        const classification = await this.callClassificationAPI(classificationPrompt)
        
        this.jobContext.requestClassification = classification
        
        console.log("[Orchestrator] Classification:", classification)
        
        // 根据分类决定下一个状态
        if (classification.type === "simple_qa") {
            // 简单问答直接跳到执行
            this.currentState = "EXECUTE_LOOP"
        } else if (classification.needsDeepPlanning) {
            // 需要深度规划
            this.currentState = "INVESTIGATE"
        } else {
            // 中等复杂度，直接规划
            this.currentState = "PLAN"
        }
    }

    /**
     * INVESTIGATE - 调研阶段（集成deep-planning）
     */
    private async investigate(): Promise<void> {
        console.log("[Orchestrator] Starting investigation (deep-planning)...")
        
        // 触发Cline的deep-planning模式
        // 这里复用现有的deep-planning实现
        const deepPlanningPrompt = await this.generateDeepPlanningPrompt()
        
        // 执行静默调研
        const investigationResult = await this.runDeepPlanning(deepPlanningPrompt)
        
        // 存储调研结果到上下文知识库
        this.jobContext.contextKB = {
            fileStructure: investigationResult.files,
            dependencies: investigationResult.dependencies,
            patterns: investigationResult.patterns,
            constraints: investigationResult.constraints,
            technicalDebt: investigationResult.technicalDebt,
        }
        
        console.log("[Orchestrator] Investigation complete, found:", {
            files: Object.keys(this.jobContext.contextKB.fileStructure || {}).length,
            dependencies: this.jobContext.contextKB.dependencies?.length || 0,
        })
        
        // 进入规划阶段
        this.currentState = "PLAN"
    }

    /**
     * PLAN - 制定执行计划
     */
    private async plan(): Promise<void> {
        console.log("[Orchestrator] Creating execution plan...")
        
        const planningPrompt = `
Based on the user request and investigation results, create a detailed execution plan.

User Request: "${this.jobContext.userRequest}"

Context: ${JSON.stringify(this.jobContext.contextKB, null, 2)}

Create a structured plan with:
1. High-level strategy
2. TODO items (each with: goal, tools, inputs, acceptance criteria)
3. Risk assessment
4. Dependencies between tasks
5. Estimated effort

Respond in structured JSON format.
`
        
        // 调用LLM生成计划
        const plan = await this.callPlanningAPI(planningPrompt)
        
        this.actionPlan = plan
        this.jobContext.actionPlan = plan
        
        // 向用户展示计划
        await this.presentPlanToUser(plan)
        
        console.log("[Orchestrator] Plan created with", plan.todos.length, "todos")
        
        // 进入权限协商
        this.currentState = "PERMISSION_NEGOTIATE"
    }

    /**
     * PERMISSION_NEGOTIATE - 权限协商
     */
    private async negotiatePermissions(): Promise<void> {
        console.log("[Orchestrator] Negotiating permissions...")
        
        if (!this.actionPlan) {
            throw new Error("No action plan available for permission negotiation")
        }
        
        // 分析计划中需要的权限
        const requiredPermissions = this.analyzeRequiredPermissions(this.actionPlan)
        
        // 一次性向用户申请所有权限
        const permissionRequest = {
            message: "This task requires the following permissions:",
            permissions: requiredPermissions.map(p => ({
                type: p.type,
                description: p.description,
                risk: p.risk,
                files: p.files,
            })),
        }
        
        // 等待用户批准
        const approvedPermissions = await this.requestUserPermissions(permissionRequest)
        
        // 存储批准的权限
        approvedPermissions.forEach(p => this.jobContext.permissions.add(p))
        
        console.log("[Orchestrator] Permissions granted:", approvedPermissions.length)
        
        // 如果用户拒绝了关键权限，可能需要重新规划
        if (approvedPermissions.length < requiredPermissions.length) {
            const missingCritical = requiredPermissions.filter(
                p => p.critical && !approvedPermissions.includes(p.type)
            )
            
            if (missingCritical.length > 0) {
                // 关键权限被拒绝，需要重新规划
                await this.notifyUser({
                    type: "warning",
                    message: "Some critical permissions were denied. Adjusting plan...",
                })
                this.currentState = "PLAN" // 返回规划状态
                return
            }
        }
        
        // 进入执行循环
        this.currentState = "EXECUTE_LOOP"
    }

    /**
     * EXECUTE_LOOP - 执行TODO循环
     */
    private async executeLoop(): Promise<void> {
        console.log("[Orchestrator] Executing action plan...")
        
        if (!this.actionPlan) {
            throw new Error("No action plan to execute")
        }
        
        // 逐条执行TODO
        for (const todo of this.actionPlan.todos) {
            if (todo.status === "completed") continue
            
            console.log("[Orchestrator] Executing TODO:", todo.goal)
            
            // 检查是否有权限
            if (!this.hasPermissionForTodo(todo)) {
                console.log("[Orchestrator] No permission for TODO, skipping")
                todo.status = "skipped"
                todo.skipReason = "permission_denied"
                continue
            }
            
            // 执行TODO
            todo.status = "in_progress"
            await this.updatePlanDisplay()
            
            try {
                const result = await this.executeTodo(todo)
                
                // 验证结果
                const validation = await this.validateTodoResult(todo, result)
                
                if (validation.passed) {
                    todo.status = "completed"
                    todo.result = result
                    console.log("[Orchestrator] TODO completed successfully")
                } else {
                    // 验证失败，进入修复
                    todo.status = "failed"
                    todo.error = validation.reason
                    this.repairAttempts = 0
                    this.currentState = "REPAIR"
                    return
                }
            } catch (error) {
                // 执行失败
                console.error("[Orchestrator] TODO execution failed:", error)
                todo.status = "failed"
                todo.error = error.message
                this.repairAttempts = 0
                this.currentState = "REPAIR"
                return
            }
            
            await this.updatePlanDisplay()
        }
        
        // 所有TODO执行完成
        console.log("[Orchestrator] All TODOs completed")
        this.currentState = "FINALIZE"
    }

    /**
     * REPAIR - 自动修复
     */
    private async repair(): Promise<void> {
        console.log("[Orchestrator] Attempting repair, attempt", this.repairAttempts + 1)
        
        if (this.repairAttempts >= this.maxRepairAttempts) {
            console.log("[Orchestrator] Max repair attempts reached, escalating to user")
            await this.escalateToUser()
            this.currentState = "FINALIZE"
            return
        }
        
        this.repairAttempts++
        
        // 找到失败的TODO
        const failedTodo = this.actionPlan?.todos.find(t => t.status === "failed")
        if (!failedTodo) {
            throw new Error("No failed TODO found in REPAIR state")
        }
        
        console.log("[Orchestrator] Analyzing failure for TODO:", failedTodo.goal)
        
        // 分析失败原因
        const failureAnalysis = await this.analyzeFailure(failedTodo)
        
        // 生成修复策略
        const repairStrategy = await this.generateRepairStrategy(failedTodo, failureAnalysis)
        
        console.log("[Orchestrator] Repair strategy:", repairStrategy.approach)
        
        // 执行修复
        try {
            await this.executeRepair(repairStrategy, failedTodo)
            
            // 修复成功，返回执行循环
            failedTodo.status = "in_progress"
            failedTodo.error = undefined
            failedTodo.repairAttempts = this.repairAttempts
            this.currentState = "EXECUTE_LOOP"
        } catch (error) {
            console.error("[Orchestrator] Repair failed:", error)
            // 记录修复失败，继续尝试
            failedTodo.repairHistory = failedTodo.repairHistory || []
            failedTodo.repairHistory.push({
                attempt: this.repairAttempts,
                strategy: repairStrategy.approach,
                error: error.message,
            })
            // 继续修复循环
        }
    }

    /**
     * FINALIZE - 终结并生成报告
     */
    private async finalize(): Promise<void> {
        console.log("[Orchestrator] Finalizing job...")
        
        const endTime = Date.now()
        const duration = endTime - this.jobContext.startTime
        
        // 统计执行结果
        const stats = {
            total: this.actionPlan?.todos.length || 0,
            completed: this.actionPlan?.todos.filter(t => t.status === "completed").length || 0,
            failed: this.actionPlan?.todos.filter(t => t.status === "failed").length || 0,
            skipped: this.actionPlan?.todos.filter(t => t.status === "skipped").length || 0,
            duration,
        }
        
        // 生成执行摘要
        const summary = await this.generateExecutionSummary(stats)
        
        // 创建变更报告和diff
        const changes = await this.generateChangesReport()
        
        // 创建回滚点（如果有文件修改）
        const checkpointId = await this.createCheckpoint()
        
        // 生成后续建议
        const recommendations = await this.generateRecommendations()
        
        // 展示给用户
        await this.presentFinalReport({
            summary,
            stats,
            changes,
            checkpointId,
            recommendations,
        })
        
        console.log("[Orchestrator] Job completed:", stats)
    }

    // ============================================================
    // Helper Methods (Implementation details)
    // ============================================================

    private async callClassificationAPI(prompt: string): Promise<any> {
        // TODO: 调用LLM API进行分类
        // 可以使用task.api.createMessage()
        return {}
    }

    private async generateDeepPlanningPrompt(): Promise<string> {
        // TODO: 生成deep-planning提示词
        // 复用 cline/src/core/prompts/commands/deep-planning/
        return ""
    }

    private async runDeepPlanning(prompt: string): Promise<any> {
        // TODO: 执行deep-planning
        // 使用task的silent模式执行调研
        return {}
    }

    private async presentPlanToUser(plan: ActionPlan): Promise<void> {
        // TODO: 向webview发送计划展示
        // 使用task.messageStateHandler
    }

    private async requestUserPermissions(request: any): Promise<string[]> {
        // TODO: 通过ask机制请求用户批准权限
        return []
    }

    private async executeTodo(todo: any): Promise<any> {
        // TODO: 执行具体的TODO
        // 调用task.toolExecutor
        return {}
    }

    private async validateTodoResult(todo: any, result: any): Promise<any> {
        // TODO: 验证执行结果
        return { passed: true }
    }

    private async analyzeFailure(todo: any): Promise<any> {
        // TODO: 分析失败原因
        return {}
    }

    private async generateRepairStrategy(todo: any, analysis: any): Promise<any> {
        // TODO: 生成修复策略
        return {}
    }

    private async executeRepair(strategy: any, todo: any): Promise<void> {
        // TODO: 执行修复
    }

    private async generateExecutionSummary(stats: any): Promise<string> {
        // TODO: 生成执行摘要
        return ""
    }

    private async generateChangesReport(): Promise<any> {
        // TODO: 生成变更报告
        return {}
    }

    private async createCheckpoint(): Promise<string | null> {
        // TODO: 创建回滚点
        // 使用task.checkpointManager
        return null
    }

    private async generateRecommendations(): Promise<string[]> {
        // TODO: 生成后续建议
        return []
    }

    private async presentFinalReport(report: any): Promise<void> {
        // TODO: 展示最终报告
    }

    private analyzeRequiredPermissions(plan: ActionPlan): any[] {
        // TODO: 分析需要的权限
        return []
    }

    private hasPermissionForTodo(todo: any): boolean {
        // TODO: 检查是否有权限执行TODO
        return true
    }

    private async updatePlanDisplay(): Promise<void> {
        // TODO: 更新计划显示
    }

    private async escalateToUser(): Promise<void> {
        // TODO: 升级给用户处理
    }

    private async notifyUser(notification: any): Promise<void> {
        // TODO: 通知用户
    }
}
```

---

## 📊 数据结构

```typescript
// cline/src/core/orchestrator/types.ts

export type OrchestratorState = 
    | "CLASSIFY"
    | "INVESTIGATE"
    | "PLAN"
    | "PERMISSION_NEGOTIATE"
    | "EXECUTE_LOOP"
    | "REPAIR"
    | "FINALIZE"

export interface JobContext {
    jobId: string
    userRequest: string
    requestClassification: RequestClassification | null
    contextKB: ContextKnowledgeBase
    actionPlan: ActionPlan | null
    executionLog: ExecutionLogEntry[]
    permissions: Set<string>
    startTime: number
}

export interface RequestClassification {
    type: "simple_qa" | "single_file_edit" | "multi_file_edit" | "command_execution" | "mcp_tool_required" | "complex_project"
    needsDeepPlanning: boolean
    estimatedComplexity: "low" | "medium" | "high"
    riskLevel: "safe" | "moderate" | "risky"
    suggestedTools: string[]
}

export interface ContextKnowledgeBase {
    fileStructure?: Record<string, FileInfo>
    dependencies?: Dependency[]
    patterns?: Pattern[]
    constraints?: Constraint[]
    technicalDebt?: TechnicalDebtItem[]
}

export interface ActionPlan {
    strategy: string
    todos: TodoItem[]
    risks: RiskItem[]
    dependencies: DependencyGraph
    estimatedEffort: {
        time: string
        complexity: string
    }
}

export interface TodoItem {
    id: string
    goal: string
    tools: string[]
    inputs: Record<string, any>
    acceptanceCriteria: string[]
    dependencies: string[] // IDs of other todos
    status: "pending" | "in_progress" | "completed" | "failed" | "skipped"
    result?: any
    error?: string
    skipReason?: string
    repairAttempts?: number
    repairHistory?: RepairAttempt[]
}

export interface RepairAttempt {
    attempt: number
    strategy: string
    error: string
    timestamp: number
}

export interface ExecutionLogEntry {
    type: "info" | "warning" | "error" | "fatal_error"
    state: OrchestratorState
    message?: string
    error?: string
    timestamp: number
    data?: any
}

// ... more types
```

---

## 🔌 集成到现有系统

### 1. 在Task中集成Orchestrator

```typescript
// cline/src/core/task/index.ts

import { Orchestrator } from "@/core/orchestrator/Orchestrator"

export class Task {
    // 现有代码...
    
    private orchestrator?: Orchestrator
    
    /**
     * 启动带Orchestrator的任务执行
     */
    async startWithOrchestrator(userRequest: string): Promise<void> {
        // 创建Orchestrator
        this.orchestrator = new Orchestrator(this, this.controller, userRequest)
        
        // 运行Orchestrator
        await this.orchestrator.run()
    }
    
    // 现有代码...
}
```

### 2. 在SaaS模式中使用

```typescript
// cline/webview-ui/src/hooks/useSaaSChat.ts

export function useSaaSChat(): UseSaaSChatReturn {
    // 现有代码...
    
    const sendMessageWithOrchestrator = useCallback(
        async (content: string) => {
            if (!userInfo) {
                setError("Please log in")
                return
            }
            
            // 发送到后端，标记使用Orchestrator模式
            const response = await saasApi.sendMessage({
                content,
                mode: "orchestrator", // ✅ 新增orchestrator模式
                userInfo,
            })
            
            // 处理响应...
        },
        [userInfo],
    )
    
    return {
        // ...
        sendMessageWithOrchestrator,
    }
}
```

---

## 🎨 UI展示

### 状态机可视化

在webview中展示Orchestrator的状态：

```typescript
// cline/webview-ui/src/components/orchestrator/OrchestratorStatus.tsx

export function OrchestratorStatus({ jobContext }: { jobContext: JobContext }) {
    return (
        <div className="orchestrator-status">
            {/* 状态进度条 */}
            <StateProgress currentState={jobContext.currentState} />
            
            {/* 当前阶段详情 */}
            <StateDetails
                state={jobContext.currentState}
                contextKB={jobContext.contextKB}
                actionPlan={jobContext.actionPlan}
            />
            
            {/* TODO列表（如果在执行阶段） */}
            {jobContext.actionPlan && (
                <TodoList todos={jobContext.actionPlan.todos} />
            )}
        </div>
    )
}
```

---

## 🚀 实施路线图

### Phase 1: 核心框架（1-2周）
- [ ] 创建Orchestrator类和状态机框架
- [ ] 实现CLASSIFY和PLAN状态
- [ ] 集成到Task类
- [ ] 基础UI展示

### Phase 2: Deep Planning集成（1周）
- [ ] 集成现有deep-planning实现到INVESTIGATE状态
- [ ] 优化调研结果的结构化存储
- [ ] 上下文知识库设计

### Phase 3: 执行和修复（2周）
- [ ] 实现EXECUTE_LOOP状态
- [ ] 实现REPAIR自动修复逻辑
- [ ] TODO执行和验证
- [ ] 错误诊断和修复策略生成

### Phase 4: 权限和UI（1周）
- [ ] 实现PERMISSION_NEGOTIATE
- [ ] 完善UI可视化
- [ ] 权限管理系统

### Phase 5: 优化和测试（1-2周）
- [ ] 性能优化
- [ ] 边界情况处理
- [ ] 完整的端到端测试
- [ ] 文档完善

**总计：6-8周**

---

## 📈 预期效果

### Before（当前）
```
用户: "帮我添加一个登录功能"
AI: "好的，我会修改login.ts文件"
   → 直接修改，可能遗漏相关文件
   → 没有完整规划
   → 失败时需要用户手动介入
```

### After（Orchestrator）
```
用户: "帮我添加一个登录功能"
AI: 
   [CLASSIFY] 这是一个跨文件的复杂任务
   [INVESTIGATE] 正在分析现有认证系统...
                发现：使用JWT、已有auth.ts、需要UI组件
   [PLAN] 制定计划：
          1. 修改auth.ts添加登录API
          2. 创建LoginForm.tsx组件
          3. 更新路由配置
          4. 添加测试
   [PERMISSION] 需要权限：
                - 修改2个文件
                - 创建1个新文件
                - 运行npm命令
   [EXECUTE] 执行中...
             ✅ auth.ts修改完成
             ✅ LoginForm.tsx创建完成
             ❌ 路由配置失败
   [REPAIR] 诊断：路由格式不匹配
            修复：使用正确的路由格式
            ✅ 路由配置完成
   [FINALIZE] 完成！
              - 修改了2个文件
              - 创建了1个文件
              - 创建了回滚点checkpoint_abc123
              - 建议：运行npm test验证
```

---

## 🔗 相关文件

- 实现代码：`cline/src/core/orchestrator/`
- 类型定义：`cline/src/core/orchestrator/types.ts`
- UI组件：`cline/webview-ui/src/components/orchestrator/`
- 集成示例：`cline/src/core/task/index.ts`

---

**创建时间：** 2025-12-26  
**状态：** 设计提案  
**优先级：** 高（核心功能改进）

