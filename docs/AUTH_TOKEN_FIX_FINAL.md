# Auth Token问题最终修复方案

## 🎯 问题描述

用户登录成功后，发送提示词时仍然报错"No auth token found"。

### 日志证据

```
✅ [GenRTL] ✅ Saved auth token to SecretStorage (extension namespace): hhuzhang@163.com
❌ [Task] safeTokenGetter: ⚠️ Token not found in SecretStorage
❌ [SaaSHandler] getAuthToken: ❌ No auth token found from any source
```

## 🔍 根本原因

**Native UI和Extension访问SecretStorage的方式不兼容！**

- **Native UI** 使用 `ISecretStorageService` (VSCode内部服务)
- **Extension** 使用 `context.secrets` (Extension API)

虽然它们都叫"SecretStorage"，但底层的存储机制和访问方式不同，导致Native UI保存的token，Extension无法读取！

## ✅ 最终解决方案

**通过Extension Command来保存/删除token**

让Native UI不再直接操作SecretStorage，而是通过Command调用Extension来操作。

### 实现原理

```
Native UI (genrtlSettingsEditor)
    ↓ commandService.executeCommand()
Extension Command Handler
    ↓ context.secrets.store()
Extension SecretStorage (✅ 正确的存储位置)
    ↑ context.secrets.get()
Task / SaaSHandler (✅ 成功读取)
```

## 📝 代码修改

### 1. 新增Extension Command

**文件：** `cline/src/registry.ts`

```typescript
SaveAuthToken: prefix + ".saveAuthToken",
```

**文件：** `cline/src/extension.ts`

```typescript
// 新增command handler
context.subscriptions.push(
    vscode.commands.registerCommand(
        commands.SaveAuthToken,
        async (token: string | null) => {
            if (token) {
                await context.secrets.store('genrtl_auth_token', token)
                console.log("[Extension] ✅ Token saved")
                return { success: true }
            } else {
                await context.secrets.delete('genrtl_auth_token')
                console.log("[Extension] ✅ Token deleted")
                return { success: true }
            }
        },
    ),
)
```

### 2. Native UI调用Command

**文件：** `vscode/src/vs/workbench/contrib/genrtl/browser/genrtlSettingsEditor.ts`

#### 保存Token

```typescript
private saveUserInfo(token: string, user: UserInfo): void {
    // 保存用户信息
    this.storageService.store('genrtl_user', JSON.stringify(user), ...);
    
    // ✅ 通过Extension Command保存token
    this.commandService.executeCommand('genRTL-cline.saveAuthToken', token)
        .then((result: any) => {
            if (result?.success) {
                console.log('[GenRTL] ✅ Token saved via Extension Command');
                // 发送状态变更通知
                return this.commandService.executeCommand(
                    'genRTL-cline.authStateChanged',
                    { event: 'login', email: user.email, plan: user.plan }
                );
            }
        });
}
```

#### 删除Token

```typescript
private handleLogout(): void {
    this.storageService.remove('genrtl_user', ...);
    
    // ✅ 通过Extension Command删除token
    this.commandService.executeCommand('genRTL-cline.saveAuthToken', null)
        .then((result: any) => {
            if (result?.success) {
                // 发送登出通知
                return this.commandService.executeCommand(
                    'genRTL-cline.authStateChanged',
                    { event: 'logout' }
                );
            }
        });
}
```

### 3. 移除Native UI的SecretStorage依赖

- ❌ 移除 `ISecretStorageService` 导入
- ❌ 移除 `secretStorageService` 字段
- ❌ 移除所有直接的SecretStorage操作

## 🚀 用户操作步骤

### 1. 重新编译客户端

由于修改了源代码，需要重新编译：

```bash
# 进入vscode目录
cd D:\xroting\avlog\genRTL\vscode

# 编译
yarn gulp compile
```

编译可能需要5-10分钟，请耐心等待。

### 2. 重启VSCode

编译完成后，关闭VSCode，然后重新打开。

### 3. 重新登录genRTL

1. 按 `Ctrl+Shift+P` 打开Command Palette
2. 输入 `genRTL: Open Settings`
3. 如果已登录，点击 **Sign Out**
4. 点击 **Sign In** 按钮
5. 在浏览器中完成OAuth登录
6. 看到"LOGIN SUCCESS"后，返回VSCode

### 4. 验证修复

1. 在cline中发送一个测试提示词：
   ```
   请用verilog实现一个uart电路，数据位是8 bit
   ```

2. 按 `F12` 打开Developer Tools Console

3. 查看日志，应该看到：

```
✅ [Extension] 🔑 saveAuthToken called, token: 68 chars
✅ [Extension] ✅ Token saved to SecretStorage
✅ [GenRTL] ✅ Token saved via Extension Command
✅ [Extension] ✅ Auth state change notification sent
✅ [Task] safeTokenGetter: ✅ Token found (length: 68)
✅ [SaaSHandler] getAuthToken: ✅ Retrieved token from SecretStorage
✅ [Orchestrator:CLASSIFY] Starting job execution
```

4. 如果看到上述日志，说明修复成功！

## ❌ 如果还有问题

### 检查Extension是否加载

在Console中查找：

```
Cline extension activated
genRTL service initialized
```

如果没有，说明Extension没有正确加载。

### 检查Command是否注册

在Command Palette中搜索：

```
genRTL: Open Settings
```

如果找不到，说明Extension注册失败。

### 检查编译是否成功

查看编译输出，确保没有错误：

```
[XX:XX:XX] Finished compilation with 0 errors
```

### 检查SaaS后端是否运行

确保后端服务在运行：

```
http://localhost:3005
```

在浏览器中访问应该能看到响应。

## 📊 完整的Token流转流程

```
┌────────────────────────────┐
│   用户在浏览器中登录         │
│   (OAuth流程)              │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  Native UI轮询检查登录状态  │
│  获取token和user信息        │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  调用Extension Command      │
│  saveAuthToken(token)      │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  Extension处理Command       │
│  context.secrets.store()   │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  Token保存到                │
│  Extension SecretStorage   │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  发送authStateChanged通知  │
│  Controller更新UI状态       │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  用户发送提示词             │
│  Task启动                  │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  safeTokenGetter()读取     │
│  context.secrets.get()     │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  SaaSHandler获取token      │
│  添加到API请求header       │
└──────────┬─────────────────┘
           ↓
┌────────────────────────────┐
│  成功调用SaaS后端API       │
│  ✅ 完成！                 │
└────────────────────────────┘
```

## 🔐 安全性说明

1. ✅ **OS级加密**：Token存储在操作系统的安全存储中
   - Windows: Credential Manager
   - macOS: Keychain
   - Linux: Secret Service API

2. ✅ **Extension命名空间隔离**：不同Extension的secrets相互隔离

3. ✅ **Command通信安全**：Command调用在VSCode进程内部，无网络传输

4. ✅ **最小权限原则**：Native UI只能通过Command操作，无法直接访问

## 🎓 技术要点

### Extension SecretStorage API

```typescript
// Extension中使用
const context: vscode.ExtensionContext = ...

// 保存 (异步)
await context.secrets.store(key: string, value: string): Promise<void>

// 读取 (异步)
const value: string | undefined = await context.secrets.get(key: string): Promise<string | undefined>

// 删除 (异步)
await context.secrets.delete(key: string): Promise<void>

// 监听变化
context.secrets.onDidChange((e: SecretStorageChangeEvent) => {
    console.log('Secret changed:', e.key);
})
```

### VSCode Command通信

```typescript
// 注册Command (Extension)
vscode.commands.registerCommand('extension.myCommand', async (arg1, arg2) => {
    // 处理逻辑
    return { success: true, data: ... };
})

// 调用Command (任何地方)
const result = await vscode.commands.executeCommand('extension.myCommand', arg1, arg2);
```

### 为什么ISecretStorageService不work？

`ISecretStorageService` 是VSCode内部服务，用于Native UI访问SecretStorage。

但是：
1. 它的存储机制与Extension API不完全兼容
2. 命名空间管理方式不同
3. 即使手动构造命名空间key也无法匹配Extension API的格式

因此，跨进程访问SecretStorage的正确方式是：**通过Command通信！**

## ✅ 总结

这次修复的核心是：

1. ❌ **错误方案**：Native UI直接操作SecretStorage
2. ✅ **正确方案**：Native UI通过Command调用Extension操作SecretStorage

这样才能保证Token被保存到Extension的SecretStorage中，Extension才能成功读取！

