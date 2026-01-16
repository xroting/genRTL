# 🔒 安全改进方案：使用SecretStorage保护认证Token

## 📋 当前方案的安全风险评估

### ⚠️ 已识别的风险

#### 1. 高风险：Token通过命令参数明文传递

**当前实现：**
```typescript
// genrtlSettingsEditor.ts
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', token, user)
```

**风险：**
- ❌ VSCode命令参数可能被其他扩展监听/拦截
- ❌ 命令执行历史可能记录参数到日志
- ❌ 恶意扩展可以调用此命令注入假token
- ❌ 调试时token可能暴露在控制台

**影响：** 如果恶意扩展获取token，可以冒充用户访问后端API

#### 2. 中风险：Token存储在普通Storage

**当前实现：**
```typescript
this.storageService.store('genrtl_auth_token', token, StorageScope.PROFILE, StorageTarget.USER)
```

**风险：**
- ⚠️ `IStorageService`不是为敏感数据设计的
- ⚠️ 数据可能以明文或弱加密存储在磁盘
- ⚠️ 其他扩展理论上可以访问同一存储

**对比：** `ISecretStorageService`使用操作系统级加密（Windows Credential Manager、macOS Keychain、Linux Secret Service）

#### 3. 低-中风险：命令可被任意扩展调用

**当前实现：**
```json
{
  "command": "genRTL-cline.syncGenRTLAuth",
  "title": "Sync GenRTL Auth State",
  "category": "Cline"
}
```

**风险：**
- ⚠️ 任何扩展都可以调用此命令
- ⚠️ 没有调用者身份验证
- ⚠️ 理论上可以被滥用注入假登录状态

#### 4. 低风险：Token生命周期管理不明确

- ⚠️ Token何时过期？
- ⚠️ 如何刷新Token？
- ⚠️ 如何撤销Token？

---

## ✅ 改进方案：SecretStorage + 事件通知架构

### 核心原则

1. **最小权限** - Webview只知道"已登录"状态，不接触token
2. **加密存储** - 所有敏感数据使用`ISecretStorageService`
3. **事件驱动** - 命令只传递事件通知，不传递敏感数据
4. **按需读取** - Extension需要时才从SecretStorage读取

### 改进后的架构

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 原生UI登录成功                                           │
│    ├─ ISecretStorageService.set('genrtl_auth_token', token) │ ← 加密存储
│    ├─ IStorageService.store('genrtl_user', user)           │ ← 公开信息
│    └─ commandService.executeCommand(                        │
│         'genRTL-cline.authStateChanged',                    │
│         { event: 'login', email: user.email }               │ ← 只传事件，不传token
│       )                                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Extension接收事件                                         │
│    ├─ 验证事件合法性                                        │
│    ├─ 从IStorageService读取用户信息（公开数据）            │
│    └─ 更新StateManager（只存储userInfo，不存储token）      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Extension → Webview                                       │
│    └─ postStateToWebview({ userInfo: { email, plan } })    │ ← 不含token
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Webview发起API请求                                        │
│    └─ 通过gRPC调用Extension端的服务                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Extension处理API请求                                      │
│    ├─ context.secrets.get('genrtl_auth_token')             │ ← 从加密存储读取
│    ├─ 添加Authorization header                              │
│    └─ 调用后端API                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 具体实现方案

### 方案A：完全重构（推荐，最安全）

#### 1. 原生UI改进

**文件：** `vscode/src/vs/workbench/contrib/genrtl/browser/genrtlSettingsEditor.ts`

```typescript
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';

export class GenRTLSettingsEditor extends EditorPane {
    constructor(
        group: IEditorGroup,
        @ITelemetryService telemetryService: ITelemetryService,
        @IThemeService themeService: IThemeService,
        @IStorageService private readonly storageService: IStorageService,
        @ISecretStorageService private readonly secretStorageService: ISecretStorageService, // ✅ 新增
        @IOpenerService private readonly openerService: IOpenerService,
        @IRequestService private readonly requestService: IRequestService,
        @ICommandService private readonly commandService: ICommandService
    ) {
        super(GenRTLSettingsEditor.ID, group, telemetryService, themeService, storageService);
        this.loadUserInfo();
    }

    private async saveUserInfo(token: string, user: UserInfo): Promise<void> {
        try {
            this._authToken = token;
            this.userInfo = user;
            
            // ✅ Step 1: 保存token到SecretStorage（操作系统级加密）
            await this.secretStorageService.set('genrtl_auth_token', token);
            
            // ✅ Step 2: 保存用户公开信息到普通Storage
            this.storageService.store('genrtl_user', JSON.stringify(user), 
                StorageScope.PROFILE, StorageTarget.USER);
            
            console.log('[GenRTL] Saved auth token to SecretStorage:', user.email);
            
            // ✅ Step 3: 发送事件通知（不含token！）
            await this.commandService.executeCommand('genRTL-cline.authStateChanged', {
                event: 'login',
                email: user.email,
                plan: user.plan
            });
            
            console.log('[GenRTL] ✅ Auth state change notification sent');
        } catch (e) {
            console.error('[GenRTL] Failed to save user info:', e);
        }
    }

    private async handleLogout(): Promise<void> {
        this._authToken = null;
        this.userInfo = null;
        
        try {
            // ✅ 从SecretStorage删除token
            await this.secretStorageService.delete('genrtl_auth_token');
            
            // 从普通Storage删除用户信息
            this.storageService.remove('genrtl_user', StorageScope.PROFILE);
            
            console.log('[GenRTL] Cleared auth data');
            
            // ✅ 发送登出事件
            await this.commandService.executeCommand('genRTL-cline.authStateChanged', {
                event: 'logout'
            });
            
            console.log('[GenRTL] ✅ Logout notification sent');
        } catch (e) {
            console.error('[GenRTL] Failed to clear user info:', e);
        }
        
        this.renderContent();
    }

    private async loadUserInfo(): Promise<void> {
        try {
            // ✅ 从SecretStorage读取token
            const token = await this.secretStorageService.get('genrtl_auth_token');
            const userStr = this.storageService.get('genrtl_user', StorageScope.PROFILE);
            
            if (token && userStr) {
                this._authToken = token;
                this.userInfo = JSON.parse(userStr);
                console.log('[GenRTL] Loaded auth from SecretStorage:', this.userInfo?.email);
            }
        } catch (e) {
            console.error('[GenRTL] Failed to load user info:', e);
        }
    }
}
```

#### 2. Extension命令处理改进

**文件：** `cline/src/registry.ts`

```typescript
const ClineCommands = {
    // ... existing commands
    // ❌ 移除: SyncGenRTLAuth: prefix + ".syncGenRTLAuth",
    // ✅ 新增: 更安全的事件通知命令
    AuthStateChanged: prefix + ".authStateChanged",
}
```

**文件：** `cline/src/extension.ts`

```typescript
// ✅ 注册新的安全命令处理器
context.subscriptions.push(
    vscode.commands.registerCommand(
        commands.AuthStateChanged, 
        async (eventData: { event: 'login' | 'logout'; email?: string; plan?: string }) => {
            try {
                console.log('[Extension] 🔔 Auth state changed:', eventData.event);
                
                const controller = webview.controller;
                if (!controller) {
                    console.error('[Extension] ❌ Controller not available');
                    return;
                }
                
                if (eventData.event === 'login') {
                    // ✅ 只传递必要的用户信息，不传递token
                    await controller.syncGenRTLAuthFromCommand({
                        email: eventData.email,
                        plan: eventData.plan
                    });
                } else {
                    // 登出
                    await controller.syncGenRTLAuthFromCommand(undefined);
                }
                
                console.log('[Extension] ✅ Auth state synced to webview');
            } catch (error) {
                console.error('[Extension] ❌ Failed to sync auth state:', error);
            }
        }
    ),
);
```

#### 3. Extension获取Token（按需读取）

**文件：** `cline/src/services/genrtl/api-client.ts` (新建)

```typescript
import * as vscode from 'vscode';

/**
 * 安全的API客户端 - 从SecretStorage读取token
 */
export class GenRTLApiClient {
    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * 获取认证token（从SecretStorage）
     * ✅ 只在需要时读取，不长期存储在内存
     */
    private async getAuthToken(): Promise<string | undefined> {
        try {
            return await this.context.secrets.get('genrtl_auth_token');
        } catch (error) {
            console.error('[GenRTLApiClient] Failed to get auth token:', error);
            return undefined;
        }
    }

    /**
     * 发送认证请求到后端
     */
    async sendAuthenticatedRequest(endpoint: string, data: any): Promise<any> {
        const token = await this.getAuthToken();
        
        if (!token) {
            throw new Error('Not authenticated');
        }

        // ✅ 使用token发送请求
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, // ✅ Token只在这里使用
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return await response.json();
    }
}
```

#### 4. Webview改进（保持不变，更安全）

**文件：** `cline/webview-ui/src/hooks/useSaaSChat.ts`

```typescript
export function useSaaSChat(): UseSaaSChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    // ✅ Webview只知道用户状态，不接触token
    const { userInfo } = useExtensionState()

    const sendMessageStream = useCallback(
        async (content: string) => {
            if (!content.trim()) return

            // ✅ 检查登录状态（不需要token）
            if (!userInfo) {
                setError("Please log in via Account & Authentication settings")
                return
            }
            
            console.log("[useSaaSChat] ✅ User authenticated:", userInfo.email)

            // ✅ 通过Extension的API发送（Extension负责添加token）
            // 不是直接调用后端API，而是通过gRPC调用Extension服务
            try {
                // 调用Extension端的服务，Extension会自动添加token
                await vscodeApi.postMessage({
                    type: 'sendChatMessage',
                    content: content,
                    // ✅ 不传token！Extension会从SecretStorage读取
                })
            } catch (error) {
                setError("Failed to send message")
            }
        },
        [userInfo],
    )

    return { messages, isLoading, error, sendMessageStream, /* ... */ }
}
```

---

### 方案B：最小改动（折中方案）

如果完全重构工作量太大，可以采用最小改动方案：

#### 改动1: 命令不传token，只传事件

```typescript
// genrtlSettingsEditor.ts
// ❌ 当前：
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', token, user)

// ✅ 改进：
this.commandService.executeCommand('genRTL-cline.syncGenRTLAuth', {
    event: 'login',
    email: user.email,
    plan: user.plan
    // 不传token！
})
```

#### 改动2: Extension从Storage读取（如果真的需要）

```typescript
// extension.ts
context.subscriptions.push(
    vscode.commands.registerCommand(
        commands.SyncGenRTLAuth, 
        async (eventData: { event: string; email?: string; plan?: string }) => {
            // ✅ 如果需要token，从GlobalState读取
            // const token = context.globalState.get<string>('genrtl_auth_token')
            
            // 但最好是：webview根本不需要token，只需要知道"已登录"
            await controller.syncGenRTLAuthFromCommand({
                email: eventData.email,
                plan: eventData.plan
            });
        }
    ),
);
```

---

## 📊 方案对比

| 方面 | 当前方案 | 方案B（最小改动） | 方案A（完全重构） |
|------|---------|------------------|------------------|
| **Token传递** | ❌ 通过命令参数 | ✅ 不传递 | ✅ 不传递 |
| **Token存储** | ⚠️ IStorageService | ⚠️ IStorageService | ✅ ISecretStorageService |
| **Webview安全** | ⚠️ 可能接触token | ✅ 不接触token | ✅ 不接触token |
| **实现复杂度** | 简单 | 低（1小时） | 中（4-6小时） |
| **安全性** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **维护性** | 一般 | 好 | 优秀 |
| **破坏性变更** | - | 小 | 中 |

---

## 🎯 推荐的实施路径

### 阶段1: 紧急修复（立即实施）

**目标：** 消除命令参数传递token的风险

1. ✅ 修改命令只传递事件通知（不含token）
2. ✅ Extension接收事件后从Storage读取（如果需要）
3. ✅ 确保webview不接触token

**工作量：** 1-2小时  
**风险：** 低  

### 阶段2: 安全加固（计划实施）

**目标：** 使用SecretStorage保护token

1. ✅ 原生UI切换到ISecretStorageService
2. ✅ Extension从context.secrets读取token
3. ✅ 实现按需读取机制

**工作量：** 4-6小时  
**风险：** 中（需要测试跨平台兼容性）

### 阶段3: 架构优化（长期目标）

**目标：** 建立标准的认证服务

1. ✅ 统一的AuthService
2. ✅ Token刷新机制
3. ✅ Token撤销支持
4. ✅ 审计日志

**工作量：** 2-3天  
**风险：** 高（涉及多个组件）

---

## 🔐 额外的安全建议

### 1. Token过期和刷新

```typescript
interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp
}

async function refreshTokenIfNeeded(): Promise<string> {
    const tokenData = await getTokenData();
    
    if (Date.now() > tokenData.expiresAt) {
        // Token过期，使用refreshToken获取新的
        const newTokenData = await refreshAccessToken(tokenData.refreshToken);
        await saveTokenData(newTokenData);
        return newTokenData.accessToken;
    }
    
    return tokenData.accessToken;
}
```

### 2. 命令权限控制

```typescript
// 只允许特定来源调用敏感命令
function validateCommandSource(source: string): boolean {
    const allowedSources = ['genRTL.settings', 'genRTL.native-ui'];
    return allowedSources.includes(source);
}
```

### 3. Token使用审计

```typescript
// 记录所有token使用
async function useToken(purpose: string): Promise<string> {
    const token = await getAuthToken();
    
    // 审计日志
    logSecurityEvent({
        event: 'token_used',
        purpose,
        timestamp: Date.now(),
        user: userInfo.email
    });
    
    return token;
}
```

### 4. 自动登出机制

```typescript
// 设置自动登出定时器（如30天）
const AUTO_LOGOUT_DAYS = 30;
const lastActivity = await getLastActivity();

if (Date.now() - lastActivity > AUTO_LOGOUT_DAYS * 24 * 60 * 60 * 1000) {
    await logout('inactivity_timeout');
}
```

---

## ✅ 验证清单

实施改进后，验证以下安全要求：

- [ ] Token不通过命令参数传递
- [ ] Token存储在SecretStorage（或至少不在命令参数中）
- [ ] Webview无法直接访问token
- [ ] 命令调用有基本的来源验证
- [ ] Token有过期机制
- [ ] 有登出和撤销功能
- [ ] 敏感操作有审计日志
- [ ] 已测试跨平台兼容性（Windows/macOS/Linux）

---

## 📚 参考资料

1. **VSCode Secret Storage API**
   - [API文档](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
   - [最佳实践](https://code.visualstudio.com/api/extension-guides/secrets-storage)

2. **安全标准**
   - OWASP Top 10
   - CWE-312: Cleartext Storage of Sensitive Information
   - CWE-319: Cleartext Transmission of Sensitive Information

3. **类似项目参考**
   - GitHub Copilot扩展的认证实现
   - Azure Account扩展的token管理

---

**创建日期：** 2025-12-26  
**状态：** 提案待审核  
**优先级：** 高（安全问题）

