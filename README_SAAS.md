1. 目标
genRTL-SaaS是基于现有的一个AI 图片或视频生成SaaS模板，目的是实现自动进行硬件verilog/SV编程的SaaS后端，通过与客户端配合完成根据客户输入的自然语言实现verilog/SV编程，后端整体采用Next.js API Routes架构，前后端采用HTTP/REST通信，用户在前端输入自然语言的提示词到后端，后端调用OpenAI或Claude的API接口调用OpenAI和Claude 的LLM，并将LLM的输出结果返回到前端。

Auth/Subscription：订阅档位、Included 美元池、On-Demand 计费
Model Router：Plan 用 GPT-5.1；Implement/Repair 用 Claude Sonnet
CBB Registry：存“设计文件 + 仿真文件 + scripts + manifest”的版本化资产包
CBB Commerce：每个 CBB 定价；每次 checkout 扣用户美元池，并写入账本
Usage Ledger：统一记录 LLM token 消耗 + CBB 商品消耗，形成 Cursor 风格明细

（可选）云端 ToolRunner：给新手提供“无本地工具也能跑”的云端验证

2. 后端架构（更新：CBB Resolve/Checkout/Deliver + CBB Ledger）
flowchart LR
  Client[genRTL Client Agent] --> API[API Gateway]

  API --> AUTH[Auth & Subscription]
  API --> JOB[Job APIs<br/>plan/implement/repair]
  API --> CBBAPI[CBB APIs<br/>resolve/checkout/deliver]

  JOB --> MR[Model Router]
  MR --> GPT[GPT-5.1]
  MR --> CLAUDE[Claude Sonnet]

  CBBAPI --> CBBR[CBB Registry]
  CBBAPI --> POOL[USD Pool Manager<br/>included + on_demand]
  POOL --> LEDGER[Usage Ledger]

  JOB --> LEDGER
  LEDGER --> BILL[Billing Processor]

  CBBR --> STORAGE[Object Storage<br/>private bucket + signed url]
  CBBAPI --> STORAGE
说明：

Stripe 提供 usage-based billing 的整体方案（记录用量、监控阈值、支持 credits）。
VS Code 客户端会把所有 LLM/CBB 消耗都映射成账单行；后端必须能按 job/step 精确归因

3. CBB Registry：资产包与元数据
3.1 CBB 包内容规范

每个 CBB 是一个版本化包（zip/tar.gz）：

rtl/：设计文件

tb/：仿真文件（最少 smoke TB）

scripts/：filelist、iverilog/verilator/vcs/modelsim/vivado/quartus 的示例脚本（越多越好）

manifest.json：机器可读元数据（含定价）

LICENSE：授权说明

3.2 manifest.json（示例）
{
  "id": "cbb_uart_16550",
  "version": "1.2.0",
  "name": "UART 16550 Compatible",
  "tags": ["UART", "APB", "FIFO"],
  "entrypoints": {
    "rtl_top": "uart_top",
    "tb_top": "tb_uart_basic",
    "filelist_rtl": "scripts/filelist_rtl.f",
    "filelist_tb": "scripts/filelist_tb.f"
  },
  "compat": {
    "sv": "2012",
    "simulators": ["iverilog", "verilator", "vcs", "modelsim"]
  },
  "price_usd": 0.50,
  "sha256": "..."
}

4. CBB 三段式 API（Resolve → Checkout → Deliver）
4.1 Resolve（不扣费）

POST /api/cbb/resolve

输入：cbb_requirements[]（来自 Plan JSON）

输出：候选列表（包含价格、推荐版本、兼容性、entrypoints）

4.2 Checkout（扣费，幂等）

POST /api/cbb/checkout

输入：{ user_id, workspace_id, job_id, items:[{cbb_id, version}], idempotency_key }

行为：

校验订阅状态（能否购买/是否允许 On-Demand）

从 included_usd_balance 扣；不足则进入 on_demand_usd

写 usage_ledger（kind=cbb）

返回 receipt（用于 deliver）

输出：{ receipt_id, charged: [{cbb_id, version, bucket, price_usd}], balances_after }

4.3 Deliver（发放下载凭证）

POST /api/cbb/deliver

输入：{ receipt_id }

输出：每个 CBB 包的下载信息（短期有效 url + sha256 + size + expires_in）

交付建议使用“私有对象存储 + 短期有效下载链接”的模式（你可以用 Supabase Storage 或任意 S3 兼容存储）。由于链接有时效，客户端需支持过期刷新（重新 deliver）。

5. Job APIs：Plan / Implement / Repair（CBB 优先策略）
5.1 Plan（GPT-5.1）

POST /api/jobs/plan

输入：Spec + 工程约束

输出：严格结构化 Plan JSON，必须包含：

modules[]（标明 type=cbb/custom）

cbb_requirements[]

verification_plan（tb/断言/覆盖点）

5.2 Implement（Claude）

POST /api/jobs/implement

输入：

Plan JSON

resolved CBB manifests（告诉 Claude 哪些已由 CBB 覆盖）

Workspace policy（禁止修改 vendor/cbb）

输出：patch（unified diff）

约束：Claude 只能输出 glue/top + missing modules + TB aggregator；不能重写 CBB

5.3 Repair（Claude）

POST /api/jobs/repair

输入：EvidenceBundle（工具日志 + diagnostics + snippets + lockfile摘要）

输出：最小修复 patch（unified diff）

约束：同上，禁止触碰 vendor/cbb

6. Usage Ledger：统一记账（LLM + CBB）

表结构建议：

id

user_id

timestamp

kind: llm | cbb

bucket: included | on_demand

job_id, step_id, workspace_id

usd_cost

若 kind=llm：

provider, model

input_tokens, output_tokens, cached_input_tokens

若 kind=cbb：

cbb_id, cbb_version, cbb_price_usd

receipt_id

idempotency_key

Stripe 的 usage-based billing 文档强调“记录用量以正确出账、监控用量阈值、支持 credits”等基本能力；你的 ledger/扣池/阈值告警都可以对齐这个思路。

7. Billing：Included + On-Demand
7.1 Included（订阅内美元池）

每个订阅周期给用户发放 included_usd_balance

LLM token 成本、CBB checkout 价格都优先从 included 扣

7.2 On-Demand（超额按量）

included 用尽后允许 On-Demand：累积 on_demand_usd

支持用户设置 spend limit：超过则拒绝新 checkout / 拒绝高价模型

8. 安全与合规（默认最小化上传）

客户端 Repair 上传默认只包含：diagnostics + 报错附近 snippet + 必要 diff

不上传完整工程（除非用户显式允许）

CBB 包属于你后端资产：Deliver 使用短时效下载链接，避免公开泄露

9. 你需要改造 monna-saas 的落地点（最小清单）

新增 cbb_registry（表/元数据/版本/价格/sha256）

新增 cbb_resolve, cbb_checkout, cbb_deliver API

扩展 usage_ledger 支持 kind=cbb 行

扩展“扣池逻辑”：included/on-demand 同时覆盖 LLM 与 CBB

客户端侧增加 CBBInstaller + lockfile + vendor 只读策略