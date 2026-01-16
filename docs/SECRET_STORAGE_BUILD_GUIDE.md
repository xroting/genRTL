# 🔒 SecretStorage安全升级 - 构建说明

## ⚠️ 重要提示

由于修改了VSCode原生UI代码（`genrtlSettingsEditor.ts`），**必须进行完整构建**，快速构建脚本无法处理原生UI的修改。

## 🔧 完整构建步骤

### 步骤1: 完整构建（必须）

```powershell
cd D:\xroting\avlog\genRTL
powershell -ExecutionPolicy ByPass -File .\dev\build.ps1
```

**预计时间：** 15-30分钟

### 步骤2: 完全重启VSCode

⚠️ **必须完全重启，不能只重新加载窗口！**
- 关闭所有VSCode窗口
- 重新打开

### 步骤3: 启动后端

```powershell
cd D:\xroting\avlog\genRTL-saas
npm run dev
```

### 步骤4: 测试SecretStorage功能

1. **清除旧的认证数据（重要！）**
   ```
   打开开发者工具 (Ctrl+Shift+I)
   Console中运行:
   localStorage.removeItem('genrtl_auth_token')
   localStorage.removeItem('genrtl_user')
   ```

2. **重新登录**
   - Account & Authentication → Sign in
   - 在浏览器完成登录

3. **检查日志**
   ```
   应该看到：
   [GenRTL] ✅ Saved auth token to SecretStorage: hhuzhang@163.com
   [Extension] 🔔 Auth state changed: login
   [Extension] ✅ Login event processed: hhuzhang@163.com
   ```

4. **验证token不在日志中**
   - 在Console搜索你的token前几个字符
   - **应该找不到！** ✅

5. **测试AI助手**
   - 输入消息应该能成功发送

## 🔍 安全验证清单

- [ ] Token保存到SecretStorage（不是localStorage）
- [ ] 命令参数中不包含token
- [ ] Console日志中看不到token
- [ ] localStorage中没有token
- [ ] AI助手能正常工作
- [ ] 登出功能正常

## 📊 改进内容

### 1. 原生UI使用SecretStorage

```typescript
// ✅ 操作系统级加密
await this.secretStorageService.set('genrtl_auth_token', token)
await this.secretStorageService.get('genrtl_auth_token')
await this.secretStorageService.delete('genrtl_auth_token')
```

**存储位置：**
- **Windows:** Windows Credential Manager
- **macOS:** Keychain
- **Linux:** Secret Service API (gnome-keyring/KWallet)

### 2. 命令只传递事件通知

```typescript
// ✅ 不传递token
this.commandService.executeCommand('genRTL-cline.authStateChanged', {
    event: 'login',
    email: user.email,
    plan: user.plan
    // 没有token！
})
```

### 3. Extension按需读取

Extension需要token时，可以从 `context.secrets` 读取：

```typescript
const token = await context.secrets.get('genrtl_auth_token')
```

## 🐛 常见问题

### Q: 完整构建失败怎么办？

**A:** 检查错误信息，可能需要：
1. 清理构建缓存：删除 `vscode/.build` 和 `vscode/out` 目录
2. 重新安装依赖：在 `vscode/` 目录运行 `npm install`

### Q: 登录后还是提示未登录？

**A:** 
1. 确保完全重启了VSCode
2. 清除旧的localStorage数据
3. 检查SecretStorage是否可用（某些环境可能不支持）

### Q: 如何验证token真的在SecretStorage？

**A:** 
- **Windows:** 打开 Credential Manager → Windows Credentials → 查找 "VSCode"
- **macOS:** 打开 Keychain Access → 搜索 "vscode"
- **Linux:** 使用 `secret-tool search service vscode`

### Q: 可以回退到旧方案吗？

**A:** 可以，使用git回退到上一次提交即可。但不推荐，旧方案有安全风险。

## ⏰ 预计时间线

- **完整构建：** 15-30分钟
- **重启测试：** 5分钟
- **安全验证：** 10分钟
- **总计：** 约30-45分钟

## 📝 下一步

构建成功并测试通过后，建议：

1. ✅ 更新CHANGELOG文档
2. ✅ 提交代码到git
3. ✅ 通知团队成员新的安全改进
4. ✅ 考虑实施阶段3（token刷新、审计等）

---

**创建时间：** 2025-12-26  
**修改文件：**
- `vscode/src/vs/workbench/contrib/genrtl/browser/genrtlSettingsEditor.ts`
- `cline/src/registry.ts`
- `cline/src/extension.ts`
- `cline/package.json`

