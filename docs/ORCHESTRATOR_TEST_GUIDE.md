# 🧪 Orchestrator 快速测试指南

## 测试前准备

1. **编译项目**
   ```powershell
   powershell -ExecutionPolicy ByPass -File .\dev\build-stepwise.ps1
   ```

2. **启动VSCode/genRTL**
   - 打开genRTL
   - 确认扩展已加载

---

## 测试场景

### 场景1：简单Verilog模块创建
**目的：** 验证基础流程

**输入：**
```
创建一个4位计数器模块，包含使能信号和复位信号
```

**预期结果：**
1. 顶部显示Orchestrator状态卡片
2. 分类：`single_file_edit` 或 `simple_qa`
3. 状态流转：CLASSIFY → PLAN → EXECUTE → FINALIZE
4. 跳过INVESTIGATE（简单任务）
5. 创建1个文件
6. 显示完成报告

**观察点：**
- ✓ 状态卡片出现
- ✓ 进度条更新
- ✓ TODO状态变化（⏸️ → ▶️ → ✅）

---

### 场景2：复杂UART实现
**目的：** 验证完整状态机流转

**输入：**
```
请用verilog实现uart电路，要求数据位是8bit，支持可配置波特率
```

**预期结果：**
1. 分类：`complex_project`，高复杂度
2. 完整流转：CLASSIFY → INVESTIGATE → PLAN → PERMISSION → EXECUTE → FINALIZE
3. 调研阶段分析项目结构
4. 规划生成3-5个TODO
5. 请求创建多个文件的权限
6. 按顺序执行所有TODO
7. 最终报告包含所有变更

**观察点：**
- ✓ INVESTIGATE状态出现（调研摘要）
- ✓ 多个TODO在列表中
- ✓ 权限请求列表
- ✓ 依赖关系正确执行
- ✓ 所有TODO完成

---

### 场景3：测试失败修复
**目的：** 验证REPAIR自动修复

**方法：** 
1. 在执行过程中，如果生成代码有语法错误
2. 或手动修改生成的TODO输入参数使其失败

**预期结果：**
1. TODO状态变为 ❌ failed
2. 进入REPAIR状态
3. 显示：🔧 Attempting auto-repair (1/3)...
4. 失败分析
5. 修复策略生成
6. 重新执行
7. 成功后返回EXECUTE_LOOP

**观察点：**
- ✓ 失败检测
- ✓ REPAIR状态触发
- ✓ 修复尝试计数
- ✓ 修复成功后继续执行
- ✓ 或最多3次后升级用户

---

## 检查要点

### 1. 日志检查
打开VSCode输出面板（Output）→ 选择"Extension Host"

查找日志：
```
[Controller] Starting task with Orchestrator mode (default)
[Orchestrator] Starting job job_...
[Orchestrator:CLASSIFY] Classifying request...
[Orchestrator:PLAN] Creating execution plan...
[Orchestrator:EXECUTE_LOOP] Executing action plan...
[Orchestrator:FINALIZE] Finalizing job...
```

### 2. UI检查清单

**Orchestrator状态卡片：**
- [ ] 卡片正常显示在聊天区域顶部
- [ ] Header显示"🎯 Orchestrator"图标
- [ ] 进度条正确显示当前进度
- [ ] 状态指示器高亮当前状态
- [ ] 分类徽章显示（类型/复杂度/风险）

**TODO列表：**
- [ ] 显示所有TODO项
- [ ] 状态图标正确（⏸️/▶️/✅/❌/⏭️）
- [ ] 当前执行的TODO高亮
- [ ] 修复尝试计数显示（如有）
- [ ] 策略文本显示

**动画效果：**
- [ ] 当前状态图标有脉冲动画
- [ ] 进度条平滑过渡
- [ ] 状态切换有视觉反馈

### 3. 功能检查

- [ ] 所有新任务默认使用Orchestrator
- [ ] 历史任务恢复正常工作
- [ ] 取消任务功能正常
- [ ] 消息显示完整
- [ ] 无JavaScript错误（F12查看Console）
- [ ] 无TypeScript编译错误

---

## 常见问题

### Q: Orchestrator状态卡片不显示？
**A:** 
1. 检查编译是否成功
2. 查看浏览器Console是否有错误
3. 确认`jobContext`有数据（通过React DevTools）

### Q: 一直卡在CLASSIFY状态？
**A:**
1. 检查LLM API是否正常
2. 查看Extension Host日志是否有错误
3. 确认网络连接正常

### Q: TODO执行失败但不进入REPAIR？
**A:**
1. 检查是否超过最大修复次数
2. 查看日志中的错误信息
3. 验证executeTodo方法是否正确抛出错误

### Q: UI更新不及时？
**A:**
1. 检查sendStatusToWebview是否被调用
2. 验证postMessageToWebview方法
3. 确认useOrchestratorState Hook正确监听消息

---

## 报告问题

如果遇到问题，请提供：
1. **场景描述：** 执行的具体任务
2. **日志：** Extension Host日志（相关部分）
3. **截图：** UI显示状态
4. **浏览器Console：** 错误信息（如有）
5. **预期 vs 实际：** 期望的行为和实际发生的情况

---

## 成功标准

✅ **基础功能**
- 能正确分类请求
- 能生成执行计划
- 能执行简单任务
- 能生成完成报告

✅ **完整流程**
- 复杂任务触发调研
- 多个TODO按序执行
- 权限请求正常
- 状态流转正确

✅ **UI显示**
- Orchestrator卡片正常显示
- 状态实时更新
- 动画效果流畅
- 信息完整清晰

✅ **错误处理**
- 失败能自动修复
- 修复失败能升级用户
- 错误信息清晰
- 不会崩溃

---

**测试完成后，genRTL就可以像高级工程师一样为你服务了！** 🎉

**测试建议时间：** 15-30分钟  
**创建时间：** 2025-12-27

