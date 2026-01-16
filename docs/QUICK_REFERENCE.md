# GenRTL AI助手代码渲染 - 快速参考

## 📦 新增文件

```
cline/webview-ui/src/components/chat/
└── SaaSMessageRenderer.tsx          ✅ 核心渲染组件

docs/
├── SAAS_MESSAGE_RENDERING.md        ✅ 用户文档
├── SAAS_PROMPT_CONFIG.md            ✅ 后端配置指南
├── IMPLEMENTATION_SUMMARY.md        ✅ 实现总结
└── QUICK_REFERENCE.md               ✅ 快速参考
```

## 🔧 修改文件

```
cline/webview-ui/src/components/chat/chat-view/components/layout/
└── WelcomeSection.tsx               ✅ 集成新渲染器

CHANGELOG.md                         ✅ 记录变更
```

## 🚀 编译命令

```powershell
# 完整构建 (必需 - 因为修改了TypeScript代码)
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1

# 重启VSCode后生效
```

## 📋 支持的代码块格式

### 1. 匿名代码块
```
\`\`\`verilog
module uart();
endmodule
\`\`\`
```

### 2. 新建文件
```
\`\`\`verilog:src/uart.v
module uart();
endmodule
\`\`\`
```

### 3. 编辑文件
```
\`\`\`45:67:src/top.v
module top();
endmodule
\`\`\`
```

## 🎯 测试场景

### 场景1: 创建新文件
```
用户: "请用verilog写一个UART电路"
预期: LLM返回 ```verilog:src/uart.v...```
结果: 显示为 "📄 新文件" 卡片
```

### 场景2: 编辑文件
```
用户: "修改uart.v的第45-67行"
预期: LLM返回 ```45:67:src/uart.v...```
结果: 显示为 "✏️ 编辑现有文件 (Lines 45-67)"
```

### 场景3: 混合内容
```
用户: "创建UART并解释原理"
预期: 文本 + 代码块 + 文本
结果: 正确的混合渲染
```

## 🔑 关键组件

### SaaSMessageRenderer
- **位置**: `cline/webview-ui/src/components/chat/SaaSMessageRenderer.tsx`
- **功能**: 解析和渲染混合内容（文本+代码）
- **API**: `<SaaSMessageRenderer role="user|assistant" content={string} />`

### parseMessageContent
- **功能**: 将字符串解析为ContentBlock数组
- **返回**: `Array<TextBlock | CodeBlock>`

### CodeBlockRenderer
- **功能**: 渲染单个代码块
- **特性**: 可折叠、语法高亮、文件信息

## 📚 文档链接

| 文档 | 用途 | 读者 |
|------|------|------|
| `SAAS_MESSAGE_RENDERING.md` | 功能说明和使用指南 | 用户 |
| `SAAS_PROMPT_CONFIG.md` | 后端配置和Prompt设计 | 开发者 |
| `IMPLEMENTATION_SUMMARY.md` | 完整实现总结 | 开发者 |
| `SaaSMessageRenderer.test.ts` | 测试用例 | 开发者 |

## ⚠️ 重要提示

1. **必须完整编译**: 由于修改了TypeScript代码，必须运行完整构建
2. **必须重启VSCode**: 编译后需要完全重启VSCode才能生效
3. **配置后端Prompt**: 需要在后端配置系统提示词（见`SAAS_PROMPT_CONFIG.md`）

## 🐛 常见问题

### Q: 代码块没有渲染为文件卡片
**A**: 检查格式是否正确：
- 使用三个反引号 ``` 
- 格式: `language:filename` 或 `startLine:endLine:filepath`
- 没有额外空格

### Q: 语法高亮不正确
**A**: 检查：
- 语言标识符是否正确（如 `javascript` 而不是 `js`）
- 文件扩展名是否支持

### Q: 新旧代码混在一起
**A**: 确保：
- 已完整编译
- 已重启VSCode
- 清除了浏览器缓存

## 📞 获取帮助

1. 查看 `CHANGELOG.md` 了解最新变更
2. 阅读 `docs/SAAS_MESSAGE_RENDERING.md` 了解详细用法
3. 运行测试: `npm test SaaSMessageRenderer.test.ts`

---

**快速开始**: 编译 → 重启 → 测试  
**文档**: `docs/` 文件夹  
**测试**: `__tests__/` 文件夹

