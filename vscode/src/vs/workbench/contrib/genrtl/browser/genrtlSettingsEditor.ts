/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { GenRTLSettingsInput } from './genrtlSettingsInput.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { URI } from '../../../../base/common/uri.js';
import { IRequestService, asText } from '../../../../platform/request/common/request.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

interface UserInfo {
	email: string;
	plan?: string;
}

export class GenRTLSettingsEditor extends EditorPane {
	static readonly ID = 'workbench.editor.genrtlSettings';

	private container: HTMLElement | undefined;
	private userInfo: UserInfo | null = null;
	private _authToken: string | null = null;

	// Getter for auth token (reserved for future API calls)
	public get authToken(): string | null {
		return this._authToken;
	}

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly storageService: IStorageService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IRequestService private readonly requestService: IRequestService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(GenRTLSettingsEditor.ID, group, telemetryService, themeService, storageService);
		this.loadUserInfo();
	}

	private loadUserInfo(): void {
		// Load from VSCode storage service (shared across all processes)
		try {
			// Note: We load from storage service synchronously for initial UI render
			// Token will be loaded asynchronously when needed
			const userStr = this.storageService.get('genrtl_user', -1 /* StorageScope.PROFILE */);
			if (userStr) {
				this.userInfo = JSON.parse(userStr);
				console.log('[GenRTL] Loaded user info from storage:', this.userInfo?.email);
				
				// 🔑 Token由Extension的SecretStorage管理
				// Native UI不需要直接读取token
				// Extension会通过context.secrets.get('genrtl_auth_token')来获取
				console.log('[GenRTL] Token is managed by Extension SecretStorage');
			}
		} catch (e) {
			console.error('[GenRTL] Failed to load user info:', e);
		}
	}

	private saveUserInfo(token: string, user: UserInfo): void {
		try {
			this._authToken = token;
			this.userInfo = user;
			
			// Save user info (public data) to VSCode storage service
			this.storageService.store('genrtl_user', JSON.stringify(user), -1 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
			
			// 🔑 关键修复：通过Extension Command保存token
			// 这样可以确保token被保存到Extension的SecretStorage中
			// Extension会使用context.secrets.store()来保存
			console.log('[GenRTL] Saving token via Extension Command...');
			
			this.commandService.executeCommand('genRTL-cline.saveAuthToken', token).then((result: any) => {
				if (result?.success) {
					console.log('[GenRTL] ✅ Token saved via Extension Command');
					
					// Notify extension of auth state change (event only, no token!)
					this.commandService.executeCommand('genRTL-cline.authStateChanged', {
						event: 'login',
						email: user.email,
						plan: user.plan
					}).then(() => {
						console.log('[GenRTL] ✅ Auth state change notification sent');
					}).catch((error) => {
						console.error('[GenRTL] ❌ Failed to send auth state change:', error);
					});
				} else {
					console.error('[GenRTL] ❌ Failed to save token via Extension Command:', result?.error);
				}
			}).catch((error) => {
				console.error('[GenRTL] ❌ Failed to execute saveAuthToken command:', error);
			});
		} catch (e) {
			console.error('[GenRTL] Failed to save user info:', e);
		}
	}

	private handleLogout(): void {
		// Clear user info and re-render
		this._authToken = null;
		this.userInfo = null;
		try {
			// Remove from VSCode storage service
			this.storageService.remove('genrtl_user', -1 /* StorageScope.PROFILE */);
			
			// 🔑 通过Extension Command删除token
			console.log('[GenRTL] Deleting token via Extension Command...');
			
			this.commandService.executeCommand('genRTL-cline.saveAuthToken', null).then((result: any) => {
				if (result?.success) {
					console.log('[GenRTL] ✅ Token deleted via Extension Command');
					
					// Notify extension of logout
					this.commandService.executeCommand('genRTL-cline.authStateChanged', {
						event: 'logout'
					}).then(() => {
						console.log('[GenRTL] ✅ Logout notification sent');
					}).catch((error) => {
						console.error('[GenRTL] ❌ Failed to send logout notification:', error);
					});
				} else {
					console.error('[GenRTL] ❌ Failed to delete token via Extension Command:', result?.error);
				}
			}).catch((error) => {
				console.error('[GenRTL] ❌ Failed to execute saveAuthToken command:', error);
			});
		} catch (e) {
			console.error('[GenRTL] Failed to clear user info:', e);
		}
		this.renderContent();
	}

	protected override createEditor(parent: HTMLElement): void {
		this.container = parent;
		this.renderContent();
	}

	private renderContent(): void {
		if (!this.container) {
			return;
		}

		clearNode(this.container);

		// Main container with styling
		const mainContainer = append(this.container, $('.genrtl-settings-container'));
		mainContainer.style.padding = '40px';
		mainContainer.style.maxWidth = '1200px';
		mainContainer.style.margin = '0 auto';
		mainContainer.style.fontFamily = 'var(--vscode-font-family)';

		// Header section
		const header = append(mainContainer, $('.genrtl-settings-header'));
		const title = append(header, $('h1'));
		title.textContent = 'genRTL Settings';
		title.style.fontSize = '32px';
		title.style.fontWeight = '600';
		title.style.marginBottom = '40px';
		title.style.color = 'var(--vscode-foreground)';

		// General section
		const accountItems = this.userInfo 
			? [
				{ 
					label: 'Account & Authentication', 
					description: `${this.userInfo.email} · ${this.userInfo.plan || 'Pro'} Plan`, 
					action: 'Dashboard', 
					actionId: 'dashboard',
					showAvatar: true,
					userInitial: this.userInfo.email.charAt(0).toUpperCase()
				},
				{
					label: 'Sign Out',
					description: 'Log out from your account',
					action: 'Log out',
					actionId: 'logout'
				}
			]
			: [
				{ 
					label: 'Account & Authentication', 
					description: 'Manage your account and billing', 
					action: 'Sign in', 
					actionId: 'signin' 
				}
			];

		this.renderSection(mainContainer, 'General', [
			...accountItems,
			{ label: 'Upgrade to Ultra', description: 'Get maximum value with 20x usage limits and early access to advanced features', action: 'Upgrade', isPrimary: true }
		]);

		// Preferences section
		this.renderSection(mainContainer, 'Preferences', [
			{ label: 'Default Layout', description: 'Modify your default layout to focus Agent or the editor', options: ['Agent', 'Editor'] },
			{ label: 'Editor Settings', description: 'Configure font, formatting, minimap and more', action: 'Open' },
			{ label: 'Keyboard Shortcuts', description: 'Configure keyboard shortcuts', action: 'Open' }
		]);

		// Agents section
		this.renderSection(mainContainer, 'Agents', [
			{ label: 'AI Models', description: 'Configure which AI models to use', action: 'Configure' }
		]);

		// Tools & MCP section
		this.renderSection(mainContainer, 'Tools & MCP', [
			{ label: 'MCP Servers', description: 'Manage Model Context Protocol servers', action: 'Configure' }
		]);

		// Beta Features section
		this.renderSection(mainContainer, 'Beta', [
			{ label: 'Experimental Features', description: 'Enable or disable beta features', action: 'Configure' }
		]);
	}

	private renderSection(parent: HTMLElement, title: string, items: Array<{
		label: string;
		description: string;
		action?: string;
		actionId?: string;
		isPrimary?: boolean;
		options?: string[];
		showAvatar?: boolean;
		userInitial?: string;
	}>): void {
		const section = append(parent, $('.genrtl-settings-section'));
		section.style.marginBottom = '40px';

		// Section title
		const sectionTitle = append(section, $('h2'));
		sectionTitle.textContent = title;
		sectionTitle.style.fontSize = '20px';
		sectionTitle.style.fontWeight = '600';
		sectionTitle.style.marginBottom = '20px';
		sectionTitle.style.color = 'var(--vscode-foreground)';

		// Section items
		items.forEach(item => {
			const itemContainer = append(section, $('.genrtl-settings-item'));
			itemContainer.style.display = 'flex';
			itemContainer.style.justifyContent = 'space-between';
			itemContainer.style.alignItems = 'center';
			itemContainer.style.padding = '20px';
			itemContainer.style.marginBottom = '12px';
			itemContainer.style.backgroundColor = 'var(--vscode-editor-background)';
			itemContainer.style.borderRadius = '8px';
			itemContainer.style.border = '1px solid var(--vscode-widget-border)';

			// Left side: label and description
			const leftSide = append(itemContainer, $('.item-left'));
			const label = append(leftSide, $('div'));
			label.textContent = item.label;
			label.style.fontSize = '16px';
			label.style.fontWeight = '500';
			label.style.marginBottom = '4px';
			label.style.color = 'var(--vscode-foreground)';

			const description = append(leftSide, $('div'));
			description.textContent = item.description;
			description.style.fontSize = '14px';
			description.style.color = 'var(--vscode-descriptionForeground)';

			// Right side: action button or options
			const rightSide = append(itemContainer, $('.item-right'));
			rightSide.style.display = 'flex';
			rightSide.style.alignItems = 'center';
			rightSide.style.gap = '12px';
			
			// Show avatar if user is logged in
			if (item.showAvatar && item.userInitial) {
				const avatar = append(rightSide, $('.user-avatar'));
				avatar.textContent = item.userInitial;
				avatar.style.width = '40px';
				avatar.style.height = '40px';
				avatar.style.borderRadius = '50%';
				avatar.style.backgroundColor = 'var(--vscode-button-background)';
				avatar.style.color = 'var(--vscode-button-foreground)';
				avatar.style.display = 'flex';
				avatar.style.alignItems = 'center';
				avatar.style.justifyContent = 'center';
				avatar.style.fontSize = '18px';
				avatar.style.fontWeight = '600';
				avatar.style.cursor = 'pointer';
			}
			
			if (item.options) {
				// Render radio buttons or toggles
				const optionsContainer = append(rightSide, $('.options-container'));
				optionsContainer.style.display = 'flex';
				optionsContainer.style.gap = '12px';

				item.options.forEach((option, index) => {
					const optionButton = append(optionsContainer, $('button'));
					optionButton.textContent = option;
					optionButton.style.padding = '8px 16px';
					optionButton.style.border = '1px solid var(--vscode-button-border)';
					optionButton.style.borderRadius = '4px';
					optionButton.style.backgroundColor = index === 0 ? 'var(--vscode-button-background)' : 'transparent';
					optionButton.style.color = index === 0 ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)';
					optionButton.style.cursor = 'pointer';
					optionButton.style.fontSize = '13px';
					optionButton.style.fontFamily = 'var(--vscode-font-family)';

					optionButton.onmouseenter = () => {
						if (index !== 0) {
							optionButton.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
						}
					};
					optionButton.onmouseleave = () => {
						if (index !== 0) {
							optionButton.style.backgroundColor = 'transparent';
						}
					};
				});
			} else if (item.action) {
				// Render action button
				const actionButton = append(rightSide, $('button'));
				actionButton.textContent = item.action;
				actionButton.style.padding = '8px 16px';
				actionButton.style.border = 'none';
				actionButton.style.borderRadius = '4px';
				actionButton.style.cursor = 'pointer';
				actionButton.style.fontSize = '13px';
				actionButton.style.fontFamily = 'var(--vscode-font-family)';
				actionButton.style.fontWeight = '500';

				if (item.isPrimary) {
					actionButton.style.backgroundColor = 'var(--vscode-button-background)';
					actionButton.style.color = 'var(--vscode-button-foreground)';
				} else {
					actionButton.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
					actionButton.style.color = 'var(--vscode-button-secondaryForeground)';
					actionButton.style.border = '1px solid var(--vscode-button-border)';
				}

				actionButton.onmouseenter = () => {
					actionButton.style.backgroundColor = item.isPrimary 
						? 'var(--vscode-button-hoverBackground)' 
						: 'var(--vscode-button-secondaryHoverBackground)';
				};
				actionButton.onmouseleave = () => {
					actionButton.style.backgroundColor = item.isPrimary 
						? 'var(--vscode-button-background)' 
						: 'var(--vscode-button-secondaryBackground)';
				};

				// Add click event handler
				actionButton.onclick = () => {
					if (item.actionId === 'signin') {
						this.handleSignIn();
					} else if (item.actionId === 'dashboard') {
						// Open dashboard
						const dashboardUrl = 'http://localhost:3005/dashboard';
						this.openerService.open(URI.parse(dashboardUrl));
					} else if (item.actionId === 'logout') {
						// Log out and refresh UI
						this.handleLogout();
					}
				};
			}
		});
	}

	private async handleSignIn(): Promise<void> {
		console.log('[GenRTL Settings] ========== SIGN IN START ==========');
		
		try {
			// Generate unique session ID
			const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			console.log('[GenRTL Settings] Session ID:', sessionId);
			
			// Open login page with session ID
			const loginUrl = `http://localhost:3005/auth/login?sessionId=${sessionId}`;
			console.log('[GenRTL Settings] Opening:', loginUrl);
			await this.openerService.open(URI.parse(loginUrl));
			
			// Start polling for authentication
			let pollCount = 0;
			const maxPolls = 150; // 5 minutes (150 * 2 seconds)
			
			const pollInterval = setInterval(async () => {
				pollCount++;
				console.log(`[GenRTL Settings] Poll #${pollCount}/${maxPolls}`);
				
				try {
					const checkUrl = `http://localhost:3005/api/auth/login-session?sessionId=${sessionId}`;
					console.log(`[GenRTL Settings] Poll #${pollCount} - Requesting:`, checkUrl);
					
					// Use IRequestService instead of fetch to bypass CSP
					const response = await this.requestService.request({
						type: 'GET',
						url: checkUrl,
						headers: {
							'Accept': 'application/json'
						}
					}, CancellationToken.None);
					
					if (response.res.statusCode !== 200) {
						console.log(`[GenRTL Settings] Poll #${pollCount} - Response not OK: ${response.res.statusCode}`);
						return;
					}
					
					const responseText = await asText(response);
					if (!responseText) {
						console.log(`[GenRTL Settings] Poll #${pollCount} - Empty response`);
						return;
					}
					
					const data = JSON.parse(responseText);
					console.log(`[GenRTL Settings] Poll #${pollCount} - Data:`, data);
					
					if (data.authenticated && data.token && data.user) {
						console.log('[GenRTL Settings] ========== LOGIN SUCCESS ==========');
						console.log('[GenRTL Settings] ✅ User:', data.user.email);
						
						// Save user info
						this.saveUserInfo(data.token, {
							email: data.user.email,
							plan: data.user.plan || 'Pro'
						});
						
						// Clear interval
						clearInterval(pollInterval);
						
						// Re-render UI
						console.log('[GenRTL Settings] Re-rendering UI...');
						this.renderContent();
						console.log('[GenRTL Settings] UI updated!');
					}
				} catch (error) {
					console.error(`[GenRTL Settings] Poll #${pollCount} - Error:`, error);
				}
				
				// Stop polling after max attempts
				if (pollCount >= maxPolls) {
					console.log('[GenRTL Settings] ⏱️ Polling timeout');
					clearInterval(pollInterval);
				}
			}, 2000); // Poll every 2 seconds
			
		} catch (error) {
			console.error('[GenRTL Settings] ❌ Sign in error:', error);
		}
	}

	override async setInput(input: GenRTLSettingsInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this.renderContent();
	}

	override focus(): void {
		if (this.container) {
			this.container.focus();
		}
	}

	override layout(): void {
		// Layout is handled by flexbox
	}
}

