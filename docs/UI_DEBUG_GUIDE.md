# genRTL AI UI 调试指南

## 如何查看控制台日志

### VSCode/VSCodium开发者工具

1. **打开开发者工具**
   - 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
   - 输入 "Developer: Toggle Developer Tools"
   - 按 Enter

2. **查看Console标签**
   - 在开发者工具窗口中，点击"Console"标签
   - 这里会显示所有JavaScript日志

3. **过滤相关日志**
   - 在Console的过滤框中输入 `[ChatTabBar]` 或 `[HistoryDropdown]`
   - 这样可以只看到相关组件的日志

---

## 诊断Tab显示问题

### 查看ChatTabBar日志

在Console中查找类似这样的日志：

```
[ChatTabBar] Tabs: {
  currentTaskId: "1735660800000",
  currentTaskText: "AI assistant chat interface optimization",
  recentTasksCount: 10,
  tabsCount: 5,
  tabs: [...]
}
```

### 预期行为

**正常情况：**
- `currentTaskId`: 应该是一个时间戳字符串
- `currentTaskText`: 应该是任务的描述文本
- `recentTasksCount`: 应该大于0（如果有历史任务）
- `tabsCount`: 应该至少为1（当前任务）

**异常情况及解决方案：**

#### 情况1：currentTaskText为空或undefined
```javascript
currentTaskText: undefined  // 或 ""
```
**原因**：task对象没有text属性
**解决**：代码已自动使用"New Task"作为默认值

#### 情况2：recentTasksCount为0
```javascript
recentTasksCount: 0
```
**原因**：taskHistory为空，没有历史记录
**解决**：这是正常的，如果是第一次使用或清空了历史

#### 情况3：tabsCount为0
```javascript
tabsCount: 0
```
**原因**：没有当前任务
**解决**：ChatTabBar不会显示（这是预期行为）

---

## 诊断History按钮问题

### 查看HistoryDropdown日志

在Console中查找类似这样的日志：

```
[HistoryDropdown] Task history: {
  totalCount: 10,
  recentCount: 10,
  recent: [
    { id: "task123", task: "AI assistant chat interface optimization" },
    { id: "task456", task: "Cline 页面 UI 改造" },
    ...
  ]
}
```

### 预期行为

**正常情况：**
- `totalCount`: 历史任务总数
- `recentCount`: 显示在下拉菜单的任务数（最多10个）
- `recent`: 包含id和task文本的数组

**异常情况及解决方案：**

#### 情况1：totalCount为0
```javascript
totalCount: 0
```
**原因**：没有历史任务
**表现**：点击History下拉按钮会显示"No history yet"
**解决**：这是正常的，需要先完成一些任务

#### 情况2：History按钮点击无反应
**可能原因：**
1. taskHistory数据没有正确传递
2. Menu组件没有正确初始化
3. Z-index问题导致菜单被遮挡

**调试步骤：**
1. 检查Console是否有错误日志
2. 确认HistoryDropdown日志是否输出
3. 检查Menu组件的z-index设置（应该是z-50）

#### 情况3：点击历史项目无反应
**可能原因：**
- TaskServiceClient.showTaskWithId调用失败
- 网络或gRPC通信问题

**调试步骤：**
1. 查看Console是否有"Error showing task:"错误
2. 检查gRPC服务是否正常运行

---

## 数据结构参考

### Task对象结构
```typescript
interface ClineMessage {
  ts: number          // 时间戳，用作任务ID
  type: "ask" | "say"
  text?: string       // 任务描述文本
  // ... 其他属性
}
```

### TaskHistory项目结构
```typescript
interface TaskItem {
  id: string          // 任务ID
  task: string        // 任务描述
  ts: number          // 时间戳
  isFavorited: boolean // 是否收藏
  modelId?: string    // 使用的模型
}
```

---

## 常见问题排查

### Q1: Tab栏不显示
**检查清单：**
- [ ] 是否有当前任务（task对象存在）
- [ ] ChatTabBar组件是否被渲染（查看React DevTools）
- [ ] 控制台是否有错误
- [ ] ChatTabBar日志显示的数据

### Q2: History下拉菜单不显示
**检查清单：**
- [ ] taskHistory是否有数据
- [ ] 点击按钮时Console是否有日志输出
- [ ] Menu组件是否被正确渲染
- [ ] 是否有CSS或z-index冲突

### Q3: 点击Tab或History项目无法切换
**检查清单：**
- [ ] Console是否有"Error switching to task:"或"Error showing task:"
- [ ] gRPC服务是否运行正常
- [ ] TaskServiceClient是否正确初始化

---

## 手动测试流程

### 测试Tab功能

1. **创建第一个任务**
   ```
   步骤：在输入框输入一个问题并发送
   预期：ChatTabBar出现，显示一个tab
   验证：检查Console的[ChatTabBar]日志
   ```

2. **创建第二个任务**
   ```
   步骤：点击New Chat按钮，输入新问题
   预期：新任务tab出现，旧任务变成非活动状态
   验证：tabsCount应该增加
   ```

3. **切换Tab**
   ```
   步骤：点击非活动的tab
   预期：切换到对应的历史任务
   验证：任务内容改变
   ```

### 测试History功能

1. **查看History下拉菜单**
   ```
   步骤：点击History旁边的下拉箭头
   预期：显示最近10条任务
   验证：检查Console的[HistoryDropdown]日志
   ```

2. **选择历史任务**
   ```
   步骤：点击下拉菜单中的某个任务
   预期：加载该任务的对话内容
   验证：对话内容改变
   ```

3. **查看完整历史**
   ```
   步骤：点击"View All History"
   预期：跳转到历史页面（全屏显示）
   验证：看到完整的历史列表
   ```

---

## 收集调试信息

如果问题仍然存在，请收集以下信息：

1. **控制台日志**
   - 复制所有[ChatTabBar]和[HistoryDropdown]日志
   - 复制任何错误信息

2. **环境信息**
   - VSCode/VSCodium版本
   - genRTL扩展版本
   - 操作系统

3. **重现步骤**
   - 详细描述如何触发问题
   - 预期行为 vs 实际行为

4. **截图**
   - UI界面截图
   - Console日志截图
   - React DevTools截图（如果可能）

---

## 下一步

如果通过上述调试发现了具体问题，请根据问题类型：

1. **数据问题**：检查后端API和数据存储
2. **UI问题**：检查组件渲染和CSS
3. **交互问题**：检查事件处理和gRPC通信

欢迎将调试信息反馈给开发团队！

