# 🚨 紧急安全修复 - 移除命令参数中的Token传递

## 问题

当前实现中，认证token通过VSCode命令参数明文传递，存在被拦截的风险。

## 快速修复（30分钟）

### 修改1: 原生UI - 只发送事件通知

**文件：** `vscode/src/vs/workbench/contrib/genrtl/browser/genrtlSettingsEditor.ts`

```typescript
// 在 saveUserInfo 方法中

// ❌ 当前实现（第72-80行）
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', token, user)
    .then(() => {
        console.log('[GenRTL] ✅ Successfully notified extension of auth change');
    })
    .catch((error) => {
        console.error('[GenRTL] ❌ Failed to notify extension:', error);
    });

// ✅ 修改为（不传递token）
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', {
    event: 'login',
    email: user.email,
    plan: user.plan
    // ✅ 不传token！
}).then(() => {
    console.log('[GenRTL] ✅ Successfully notified extension of auth change');
}).catch((error) => {
    console.error('[GenRTL] ❌ Failed to notify extension:', error);
});
```

```typescript
// 在 handleLogout 方法中

// ❌ 当前实现（第94-100行）
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', null, null)

// ✅ 修改为
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', {
    event: 'logout'
})
```

### 修改2: Extension - 接收事件通知

**文件：** `cline/src/extension.ts`

```typescript
// 在注册命令处理器的地方（约第407行）

// ❌ 当前实现
context.subscriptions.push(
    vscode.commands.registerCommand(
        commands.SyncGenRTLAuth, 
        async (token: string | null, user: { email: string; plan?: string } | null) => {
            // ...
        }
    ),
)

// ✅ 修改为
context.subscriptions.push(
    vscode.commands.registerCommand(
        commands.SyncGenRTLAuth, 
        async (eventData: { event: 'login' | 'logout'; email?: string; plan?: string }) => {
            try {
                console.log('[Extension] 🔔 Auth event:', eventData.event);
                
                const controller = webview.controller;
                if (!controller) {
                    console.error('[Extension] ❌ Controller not available');
                    return;
                }
                
                // ✅ 只处理事件，不接触token
                if (eventData.event === 'login' && eventData.email) {
                    await controller.syncGenRTLAuthFromCommand({
                        email: eventData.email,
                        plan: eventData.plan
                    });
                    console.log('[Extension] ✅ Login event processed:', eventData.email);
                } else if (eventData.event === 'logout') {
                    await controller.syncGenRTLAuthFromCommand(undefined);
                    console.log('[Extension] ✅ Logout event processed');
                }
            } catch (error) {
                console.error('[Extension] ❌ Failed to process auth event:', error);
            }
        }
    ),
)
```

### 修改3: 类型定义更新

**文件：** `cline/src/shared/UserInfo.ts` (已经正确，无需修改)

```typescript
export interface UserInfo {
    displayName?: string
    email?: string
    photoUrl?: string
    apiBaseUrl?: string
    plan?: string // ✅ 已有
}
// ✅ 不包含token - 正确！
```

## 测试验证

### 1. 重新构建

```powershell
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\quick-build-cline.ps1
```

### 2. 检查日志

登录后应该看到：

```
[GenRTL] Saved user info to storage: hhuzhang@163.com
[GenRTL] ✅ Successfully notified extension of auth change
[Extension] 🔔 Auth event: login
[Controller] 🔄 Syncing GenRTL auth state via command: hhuzhang@163.com
[Extension] ✅ Login event processed: hhuzhang@163.com
```

**关键：** 不应该在日志中看到token字符串！

### 3. 验证安全性

1. 打开开发者工具 (Ctrl+Shift+I)
2. 在Console中搜索 "Bearer" 或 token的前几个字符
3. **应该找不到！** ✅

## 后续改进

这只是紧急修复。后续还需要：

1. **阶段2（计划中）：** 使用 `ISecretStorageService` 替换 `IStorageService`
2. **阶段3（长期）：** 实现完整的token生命周期管理

详见：`docs/SECURITY_IMPROVEMENT_PROPOSAL.md`

## 修改文件清单

- [x] `vscode/src/vs/workbench/contrib/genrtl/browser/genrtlSettingsEditor.ts`
- [x] `cline/src/extension.ts`

**预计工作时间：** 30分钟  
**测试时间：** 15分钟  
**总计：** 45分钟

