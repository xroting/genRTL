# genRTL

1. 目标

genRTL 客户端是一个 VSCodium/VS Code 扩展（基于 Cline 改造），提供类似 Cursor 的 Agent 体验：

在本地 workspace 中自动生成/修改 RTL & TB

调用用户已安装的本地工具（Verible/iverilog/Verilator/VCS/ModelSim/Vivado/Quartus…）

抓取错误/告警 → 结构化诊断 → 调后端 LLM 迭代修复

当方案命中 CBB 时：不让 Claude 重写，而是从后端**拉取 CBB 资产包（RTL+TB+scripts+manifest）**安装到 workspace，并按 CBB 定价扣美元池

2. 客户端架构（更新：新增 CBBManager / Installer / Lockfile）

flowchart LR
  subgraph IDE[genRTL VSCode/VSCodium Extension]
    UI[Chat / Agent Panel] --> AG[Agent Orchestrator<br/>Step State Machine]
    AG --> TR[ToolRunner<br/>spawn/pty stdout+stderr]
    TR --> DIAG[DiagnosticsBridge<br/>parse -> VSCode Diagnostics]
    DIAG --> PROB[Problems Panel]

    AG --> API[Backend API Client]
    AG --> PA[PatchApplier<br/>unified diff -> workspace edits]
    AG --> EV[EvidencePackager<br/>logs+snippets+diags]

    AG --> CBBM[CBBManager]
    CBBM --> CBBI[CBBInstaller<br/>download/verify/unpack]
    CBBM --> LOCK[genRTL.lock.json]
    CBBM --> FL[filelists & include dirs<br/>for simulators]
  end

  API -->|plan/implement/repair| SaaS[(genRTL SaaS)]
  API -->|cbb resolve/checkout/deliver| SaaS

说明：

Agent Orchestrator：本地状态机，负责整个闭环（Plan→CBB→Implement→Lint/Sim→Repair loop）

ToolRunner：必须用 spawn/pty 抓 stdout/stderr（用于喂 LLM 修复）

DiagnosticsBridge：将工具输出解析为 VS Code Diagnostics，并在 Problems 面板展示。VS Code Tasks/Problem Matchers 的理念可参考，但这里我们更偏向“自解析 + diagnostics”以保证可控性。

CBBManager/CBBInstaller：新增加，负责 CBB 整包安装与 lockfile 管理

3. Workspace 目录约定（强烈建议固定）

安装后的 workspace 推荐结构：
<project_root>/
  src/                    # 用户/Agent自定义模块
  tb/                     # 用户/Agent自定义TB
  .genRTL/
    state.json            # Agent step 状态（可恢复）
    genRTL.lock.json     # CBB 安装/版本/receipt/价格/哈希
    vendor/
      cbb/<cbb_id>/<ver>/ # 下发的 CBB 资产包（只读策略）
        rtl/...
        tb/...
        scripts/...
        manifest.json
    build/
      filelist_rtl.f
      filelist_tb.f
      include_dirs.txt
      last_run/
        tool.json
        raw_stdout.log
        raw_stderr.log
        diagnostics.json

3.1 genRTL.lock.json（示例）
{
  "workspace_id": "ws_123",
  "installed": [
    {
      "cbb_id": "cbb_uart_16550",
      "version": "1.2.0",
      "receipt_id": "rcpt_abc",
      "price_usd": 0.50,
      "sha256": "....",
      "installed_at": "2025-12-19T12:00:00Z"
    }
  ]
}

4. 客户端 Step 状态机（更新：引入 CBB Resolve/Checkout/Deliver/Install）

下面是一次 rtl_job 的标准执行序列（你前面定义的 1~5 步流程增强版）：
flowchart TD
  S[Step0: 用户输入Spec] --> P[Step1: Plan (GPT-5.1)]
  P --> R[Step2: CBB Resolve (后端确定命中与版本/价格)]
  R --> D{需要安装CBB?}
  D -- Yes --> CK[Step3: CBB Checkout 扣美元池]
  CK --> DL[Step4: CBB Deliver 返回CBB包URLs]
  DL --> INS[Step5: 本地Install/Verify/Lockfile/Filelist]
  D -- No --> IMPL

  INS --> IMPL[Step6: Implement (Claude)<br/>仅 glue + missing modules]
  IMPL --> APPLY[Apply Patch]
  APPLY --> L[Step7: Lint]
  L --> E1{Lint errors?}
  E1 -- Yes --> REP[Repair (Claude)<br/>证据包]
  E1 -- No --> SIM[Step8: Sim]
  SIM --> E2{Sim/Assertions pass?}
  E2 -- No --> REP
  REP --> APPLY
  E2 -- Yes --> DONE[Done]

5. CBB 生命周期（客户端要做的事）
5.1 CBB Resolve（不扣费）

客户端把 Plan JSON 中的 cbb_requirements[] 发后端：

输入：接口类型、协议标签（UART/SPI/AXI-Lite/FIFO）、位宽/深度/时钟域、是否需要 TB 等

输出：命中的 CBB 列表、推荐版本、价格、兼容性说明、entrypoints（top/tb/filelist）

5.2 CBB Checkout（扣费，必须幂等）

当 Agent 决定“要用这些 CBB”时，调用 checkout：

必须传 idempotency_key = hash(job_id + cbb_id + version + workspace_id)

后端返回 receipt_id

客户端把 receipt 写入 lockfile，避免后续重复扣费

5.3 CBB Deliver（获取可下载链接）

输入 receipt_id

输出每个 CBB 包的：download_url（短期有效）、sha256、size、expires_in

5.4 本地 Install（下载→校验→解压→写 filelist）

CBBInstaller 规则：

下载包到临时目录

校验 sha256

解压到 .genRTL/vendor/cbb/<id>/<ver>/

生成/更新：

.genRTL/build/filelist_rtl.f

.genRTL/build/filelist_tb.f

.genRTL/build/include_dirs.txt

更新 lockfile

5.5 “CBB 只读策略”（关键）

默认禁止 Agent/Claude 修改 .genRTL/vendor/cbb/**

若 CBB 自带问题：走“升级版本/替换CBB/反馈维护者”的策略，而不是让 LLM 改 vendor

6. 本地工具调用与诊断抓取（重点：可喂给 LLM 的证据）
6.1 ToolRunner：统一接口（建议）

每个工具一个 adapter：

detect()：探测是否安装、版本

buildCommand(ctx)：输出 cmd/args/cwd/env

run()：spawn/pty 运行并捕获 stdout/stderr

parse()：输出 Diagnostic[]

6.2 DiagnosticsBridge：推送 Problems 面板

将 Diagnostic[] 映射到 VS Code Diagnostics

参考 VS Code “Problem Matchers”的设计思想（从外部工具输出提取问题）。
code.visualstudio.com

6.3 EvidenceBundle（发后端 Repair 的最小证据）

建议结构：
{
  "job_id": "job_123",
  "step_id": "lint_1",
  "tool": "verible",
  "cmd": "verible-verilog-lint -f .genrtl/build/filelist_rtl.f ...",
  "diagnostics": [
    {"file":"src/top.sv","line":123,"col":9,"severity":"error","message":"..."}
  ],
  "snippets": [
    {"file":"src/top.sv","start":110,"end":140,"text":"..."}
  ],
  "notes": {
    "cbb_installed": ["cbb_uart_16550@1.2.0"],
    "policy": "DO_NOT_EDIT_VENDOR_CBB"
  }
}

7. 客户端鉴权与密钥存储

客户端只保存短期访问 token（或 refresh token）

使用 VS Code SecretStorage 存储敏感信息（不要写 settings.json）。

8. UI（Cursor 风格用量明细）
整体UI架构采用全新的UI架构 (AppNew.tsx + React Router)，入口点是 AppNew.tsx
客户端提供 Usage 面板（或 Webview）展示：

Included / On-Demand

LLM：模型名、input/output tokens、成本

CBB：cbb_id@ver、价格、扣费 bucket

归因到 job/step