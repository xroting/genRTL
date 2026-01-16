# Auth Token 问题修复指南

## 🎯 问题描述

在使用Orchestrator组件发送提示词时，前端Console报错：

```
[Task] safeTokenGetter: ⚠️ Token not found in SecretStorage
[SaaSHandler] getAuthToken: ❌ No auth token found from any source
ERR [Extension Host] [SaaSHandler] Error: 🔐 genRTL SaaS Authentication Required
```

## 🔍 问题根源

**VSCode Extension的SecretStorage使用命名空间隔离机制！**

### 技术细节

1. **Extension API读取方式**
   ```typescript
   // Extension中使用
   context.secrets.get('genrtl_auth_token')
   ```
   实际查找的key是：
   ```json
   {"extensionId":"genRTL-cline","key":"genrtl_auth_token"}
   ```

2. **之前Native UI的错误实现**
   ```typescript
   // ❌ 错误：直接使用字符串
   secretStorageService.set('genrtl_auth_token', token)
   ```
   存储的key是：`'genrtl_auth_token'` （缺少命名空间）

3. **结果**
   - Native UI保存的token和Extension读取的key不匹配
   - Extension无法获取到authentication token
   - 所有SaaS API调用失败

## ✅ 解决方案

### 1. 代码已修复

文件 `vscode/src/vs/workbench/contrib/genrtl/browser/genrtlSettingsEditor.ts` 已更新：

```typescript
// ✅ 正确：使用Extension命名空间格式
const extensionSecretKey = JSON.stringify({ 
    extensionId: 'genRTL-cline', 
    key: 'genrtl_auth_token' 
});

// 保存
this.secretStorageService.set(extensionSecretKey, token)

// 读取
this.secretStorageService.get(extensionSecretKey)

// 删除
this.secretStorageService.delete(extensionSecretKey)
```

### 2. 自动迁移逻辑

代码包含了自动迁移功能（`genrtlSettingsEditor.ts` Line 74-84）：

```typescript
// 如果新格式不存在，检查旧格式
const oldToken = await this.secretStorageService.get('genrtl_auth_token');
if (oldToken) {
    console.log('[GenRTL] 🔄 Found old format token, migrating...');
    // 保存到新格式
    await this.secretStorageService.set(extensionSecretKey, oldToken);
    // 删除旧格式
    await this.secretStorageService.delete('genrtl_auth_token');
    console.log('[GenRTL] ✅ Token migration completed');
}
```

## 🚀 用户操作步骤

### 步骤1：重启VSCode
确保代码修改生效

### 步骤2：重新登录genRTL

1. 打开genRTL Settings
   - 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
   - 输入 `genRTL: Open Settings`

2. 如果已登录，先点击 **Sign Out**

3. 点击 **Sign In** 按钮

4. 在浏览器中完成OAuth登录流程

5. 登录成功后，token将自动保存到正确的命名空间

### 步骤3：验证修复

1. 在cline中发送一个测试提示词
   例如："请用verilog实现一个uart电路，数据位是8 bit"

2. 打开Developer Tools Console (F12)
   查看日志输出

3. **修复成功的标志**：
   ```
   ✅ [Task] safeTokenGetter: ✅ Token found (length: ...)
   ✅ [SaaSHandler] getAuthToken: ✅ Retrieved token from SecretStorage
   ```

4. **如果还有问题**，检查：
   - SecretStorage服务是否正常
   - 网络连接是否正常
   - SaaS后端是否运行（http://localhost:3005）

## 📋 问题诊断

如果问题仍然存在，请检查以下日志：

### 正常的日志流程

```
[GenRTL Settings] ========== SIGN IN START ==========
[GenRTL Settings] Session ID: session_...
[GenRTL Settings] Opening: http://localhost:3005/auth/login?sessionId=...
[GenRTL Settings] Poll #1/150
...
[GenRTL Settings] ========== LOGIN SUCCESS ==========
[GenRTL Settings] ✅ User: your@email.com
[GenRTL] ✅ Saved auth token to SecretStorage (extension namespace)
[GenRTL] ✅ Auth state change notification sent
```

### Extension读取token

```
[Task] 🎯 Enabling SaaS mode for user: your@email.com
[Task] safeTokenGetter: Reading token from SecretStorage...
[Task] safeTokenGetter: ✅ Token found (length: 68)
[SaaSHandler] getAuthToken: Trying SecretStorage via getter...
[SaaSHandler] getAuthToken: ✅ Retrieved token from SecretStorage
```

## 🔐 安全性说明

此修复方案完全安全：

1. ✅ **OS级加密**：Token存储在操作系统的安全存储中
   - Windows: Credential Manager
   - macOS: Keychain
   - Linux: Secret Service API

2. ✅ **标准机制**：遵循VSCode Extension API设计

3. ✅ **命名空间隔离**：Extension之间的secrets相互隔离

4. ✅ **无网络传输**：Token只在本地进程间共享

## 📚 技术参考

- VSCode SecretStorage API: `mainThreadSecretState.ts` Line 90-92
- Extension Context Secrets: VSCode Extension API
- genRTL Settings Editor: `genrtlSettingsEditor.ts`
- SaaS Handler: `cline/src/core/api/providers/saas.ts`
- Task Token Getter: `cline/src/core/task/index.ts` Line 502-519

## ❓ 常见问题

### Q: 为什么需要重新登录？
A: 因为之前保存的token使用了错误的key格式，Extension无法读取。重新登录会使用正确的命名空间格式。

### Q: 自动迁移不工作吗？
A: 自动迁移会在下次登录时触发。但如果旧token已经过期或无效，建议直接重新登录。

### Q: 这个改动会影响已有功能吗？
A: 不会。代码包含了向后兼容的迁移逻辑，会自动处理旧格式token。

### Q: 需要修改Extension代码吗？
A: 不需要。Extension的读取代码（`context.secrets.get()`）一直是正确的。只是Native UI的保存代码需要修正。

