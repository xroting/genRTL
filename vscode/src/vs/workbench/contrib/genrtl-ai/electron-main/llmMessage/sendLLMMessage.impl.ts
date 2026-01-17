/*--------------------------------------------------------------------------------------
 *  Copyright 2025 genRTL Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * genRTL SaaS LLM Message Implementation
 * 
 * All LLM calls are routed through the genRTL SaaS backend,
 * which handles authentication, billing, model routing, and rate limiting.
 * This replaces the original genRTL direct-provider implementation.
 */

import { LLMChatMessage, LLMFIMMessage, ModelListParams, /* OllamaModelResponse, */ OnError, OnFinalMessage, OnText, RawToolCallObj /* , RawToolParamsObj */ } from '../../common/sendLLMMessageTypes.js';
import { ChatMode, ProviderName, SettingsOfProvider, ModelSelectionOptions, OverridesOfModel } from '../../common/genrtlSettingsTypes.js';
import { InternalToolInfo } from '../../common/prompt/prompts.js';
import { generateUuid } from '../../../../../base/common/uuid.js';

// SaaS Configuration
const SAAS_BASE_URL = 'https://api.genrtl.com';
const SAAS_DEV_URL = 'http://localhost:3005';

type InternalCommonMessageParams = {
	onText: OnText;
	onFinalMessage: OnFinalMessage;
	onError: OnError;
	providerName: ProviderName;
	settingsOfProvider: SettingsOfProvider;
	modelSelectionOptions: ModelSelectionOptions | undefined;
	overridesOfModel: OverridesOfModel | undefined;
	modelName: string;
	_setAborter: (aborter: () => void) => void;
	// SaaS-specific
	saasAuthToken?: string;
}

type SendChatParams_Internal = InternalCommonMessageParams & {
	messages: LLMChatMessage[];
	separateSystemMessage: string | undefined;
	chatMode: ChatMode | null;
	mcpTools: InternalToolInfo[] | undefined;
}

type SendFIMParams_Internal = InternalCommonMessageParams & {
	messages: LLMFIMMessage;
	separateSystemMessage: string | undefined;
}

export type ListParams_Internal<ModelResponse> = ModelListParams<ModelResponse>

/**
 * Get SaaS base URL based on environment
 */
function getSaaSBaseUrl(): string {
	// Check for development mode
	const isDev = process.env.GENRTL_DEV === 'true' || process.env.NODE_ENV === 'development';
	return isDev ? SAAS_DEV_URL : SAAS_BASE_URL;
}

/**
 * Convert internal tool format to OpenAI-compatible format for SaaS
 * 🚨 已禁用：不再使用tools功能，强制LLM直接输出Markdown代码块
 */
/**
 * Convert tools to OpenAI format for SaaS (按照OpenCode最佳实践)
 */
function convertToolsForSaaS(mcpTools: InternalToolInfo[] | undefined, chatMode: ChatMode | null): any[] | undefined {
	if (!mcpTools || mcpTools.length === 0) return undefined;

	return mcpTools.map(tool => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: 'object',
				properties: Object.entries(tool.params).reduce((acc, [key, value]) => {
					acc[key] = {
						type: 'string',
						description: value.description
					};
					return acc;
				}, {} as Record<string, any>)
			}
		}
	}));
}

/**
 * Convert LLMChatMessage to OpenAI format for SaaS
 */
function convertMessagesForSaaS(messages: LLMChatMessage[], systemMessage?: string): any[] {
	const result: any[] = [];

	// Add system message if provided
	if (systemMessage) {
		result.push({
			role: 'system',
			content: systemMessage
		});
	}

	// Convert messages
	for (const msg of messages) {
		if ('role' in msg && 'content' in msg) {
			result.push({
				role: msg.role,
				content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
			});
		}
	}

	return result;
}

/**
 * Parse tool call from SSE response
 */
function parseToolCall(toolCall: any): RawToolCallObj | null {
	if (!toolCall || !toolCall.function) return null;

	try {
		const args = typeof toolCall.function.arguments === 'string'
			? JSON.parse(toolCall.function.arguments)
			: toolCall.function.arguments || {};

		return {
			id: toolCall.id || generateUuid(),
			name: toolCall.function.name,
			rawParams: args,
			doneParams: Object.keys(args),
			isDone: true
		};
	} catch (e) {
		console.error('[genRTL] Failed to parse tool call:', e);
		return null;
	}
}

/**
 * Send chat message through genRTL SaaS
 */
async function sendSaaSChat({
	messages,
	separateSystemMessage,
	onText,
	onFinalMessage,
	onError,
	modelName,
	_setAborter,
	mcpTools,
	chatMode,
	saasAuthToken
}: SendChatParams_Internal): Promise<void> {
	const baseUrl = getSaaSBaseUrl();
	const abortController = new AbortController();
	_setAborter(() => abortController.abort());

	try {
		// Prepare request body
		const openAiMessages = convertMessagesForSaaS(messages, separateSystemMessage);
		// ✅ 启用tools功能：按照OpenCode最佳实践，允许LLM使用read_file等工具
		const tools = convertToolsForSaaS(mcpTools, chatMode);
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sendLLMMessage.impl.ts:166',message:'前端准备发送请求',data:{mcpToolsCount:mcpTools?.length||0,mcpToolsIsArray:Array.isArray(mcpTools),chatMode,toolsAfterConvert:tools?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
		// #endregion

		const requestBody: any = {
			messages: openAiMessages,
			model: modelName,
			stream: true,
			max_tokens: 8192, // Default, can be configured
		};

		// ✅ 启用tools功能：传递tools参数给后端
		if (tools && tools.length > 0) {
			requestBody.tools = tools;
		}

		// Prepare headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (saasAuthToken) {
			headers['Authorization'] = `Bearer ${saasAuthToken}`;
		}

		console.log(`[genRTL SaaS] Sending chat request to ${baseUrl}/api/chat`);
		console.log(`[genRTL SaaS] Model: ${modelName}, Messages: ${messages.length}`);

		// Make request
		const response = await fetch(`${baseUrl}/api/chat`, {
			method: 'POST',
			headers,
			body: JSON.stringify(requestBody),
			signal: abortController.signal
		});

		if (!response.ok) {
			let errorMessage = `SaaS API error: ${response.status} ${response.statusText}`;
			try {
				const errorData = await response.json();
				if (errorData.error) {
					errorMessage = errorData.error;
				}
				if (errorData.details) {
					errorMessage += `\n\nDetails: ${errorData.details}`;
				}
			} catch (e) {
				// Ignore parse error
			}
			onError({ message: errorMessage, fullError: new Error(errorMessage) });
			return;
		}

		// Parse SSE stream
		const contentType = response.headers.get('content-type');
		
		if (contentType?.includes('text/event-stream')) {
			await parseSSEStream(response, onText, onFinalMessage, onError);
		} else if (contentType?.includes('application/json')) {
			// Handle non-streaming response
			const data = await response.json();
			if (data.choices && data.choices.length > 0) {
				const content = data.choices[0].message?.content || '';
				const toolCalls = data.choices[0].message?.tool_calls;
				
				let toolCall: RawToolCallObj | null = null;
				if (toolCalls && toolCalls.length > 0) {
					toolCall = parseToolCall(toolCalls[0]);
				}

				onFinalMessage({
					fullText: content,
					fullReasoning: '',
					anthropicReasoning: null,
					...(toolCall ? { toolCall } : {})
				});
			}
		} else {
			onError({ message: `Unexpected content type: ${contentType}`, fullError: null });
		}

	} catch (error: any) {
		if (error.name === 'AbortError') {
			console.log('[genRTL SaaS] Request aborted');
			return;
		}
		console.error('[genRTL SaaS] Error:', error);
		onError({ message: error.message || String(error), fullError: error });
	}
}

/**
 * Parse SSE stream from SaaS response
 */
async function parseSSEStream(
	response: Response,
	onText: OnText,
	onFinalMessage: OnFinalMessage,
	onError: OnError
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) {
		onError({ message: 'No response body', fullError: null });
		return;
	}

	const decoder = new TextDecoder();
	let fullText = '';
	let fullReasoning = '';
	let buffer = '';
	let toolCall: RawToolCallObj | null = null;
	let toolName = '';
	let toolArgs = '';
	let toolId = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (!line.startsWith('data: ')) continue;

				const data = line.slice(6);
				if (data === '[DONE]') {
					// Stream complete
					if (toolName) {
						try {
							const args = toolArgs ? JSON.parse(toolArgs) : {};
							toolCall = {
								id: toolId || generateUuid(),
								name: toolName,
								rawParams: args,
								doneParams: Object.keys(args),
								isDone: true
							};
						} catch (e) {
							console.error('[genRTL SaaS] Failed to parse final tool args:', e);
						}
					}
					
					onFinalMessage({
						fullText,
						fullReasoning,
						anthropicReasoning: null,
						...(toolCall ? { toolCall } : {})
					});
					return;
				}

				try {
					const parsed = JSON.parse(data);
					const delta = parsed.choices?.[0]?.delta;

					if (delta) {
						// Content
						if (delta.content) {
							fullText += delta.content;
						}

						// Tool calls
						if (delta.tool_calls) {
							for (const tc of delta.tool_calls) {
								if (tc.function?.name) {
									toolName += tc.function.name;
								}
								if (tc.function?.arguments) {
									toolArgs += tc.function.arguments;
								}
								if (tc.id) {
									toolId += tc.id;
								}
							}
						}

						// Reasoning (if supported)
						if (delta.reasoning_content) {
							fullReasoning += delta.reasoning_content;
						}

						// Call onText with current state
						onText({
							fullText,
							fullReasoning,
							toolCall: toolName ? {
								id: toolId || 'pending',
								name: toolName,
								rawParams: {},
								doneParams: [],
								isDone: false
							} : undefined
						});
					}
				} catch (e) {
					// Ignore parse errors for incomplete chunks
				}
			}
		}

		// Handle case where stream ends without [DONE]
		if (fullText || fullReasoning || toolName) {
			if (toolName) {
				try {
					const args = toolArgs ? JSON.parse(toolArgs) : {};
					toolCall = {
						id: toolId || generateUuid(),
						name: toolName,
						rawParams: args,
						doneParams: Object.keys(args),
						isDone: true
					};
				} catch (e) {
					console.error('[genRTL SaaS] Failed to parse tool args:', e);
				}
			}

			onFinalMessage({
				fullText,
				fullReasoning,
				anthropicReasoning: null,
				...(toolCall ? { toolCall } : {})
			});
		} else {
			onError({ message: 'genRTL: Response from SaaS was empty.', fullError: null });
		}

	} finally {
		reader.releaseLock();
	}
}

/**
 * Send FIM (Fill-in-the-Middle) request through SaaS
 */
async function sendSaaSFIM({
	messages,
	onFinalMessage,
	onError,
	modelName,
	_setAborter,
	saasAuthToken
}: SendFIMParams_Internal): Promise<void> {
	const baseUrl = getSaaSBaseUrl();
	const abortController = new AbortController();
	_setAborter(() => abortController.abort());

	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (saasAuthToken) {
			headers['Authorization'] = `Bearer ${saasAuthToken}`;
		}

		const requestBody = {
			model: modelName,
			prompt: messages.prefix,
			suffix: messages.suffix,
			stop: messages.stopTokens,
			max_tokens: 300
		};

		console.log(`[genRTL SaaS] Sending FIM request to ${baseUrl}/api/fim`);

		const response = await fetch(`${baseUrl}/api/fim`, {
			method: 'POST',
			headers,
			body: JSON.stringify(requestBody),
			signal: abortController.signal
		});

		if (!response.ok) {
			let errorMessage = `SaaS FIM API error: ${response.status} ${response.statusText}`;
			try {
				const errorData = await response.json();
				if (errorData.error) {
					errorMessage = errorData.error;
				}
			} catch (e) {
				// Ignore parse error
			}
			onError({ message: errorMessage, fullError: new Error(errorMessage) });
			return;
		}

		const data = await response.json();
		const fullText = data.choices?.[0]?.text || '';

		onFinalMessage({
			fullText,
			fullReasoning: '',
			anthropicReasoning: null
		});

	} catch (error: any) {
		if (error.name === 'AbortError') {
			console.log('[genRTL SaaS] FIM request aborted');
			return;
		}
		console.error('[genRTL SaaS] FIM Error:', error);
		onError({ message: error.message || String(error), fullError: error });
	}
}

/**
 * List available models from SaaS
 */
async function listSaaSModels<T>({
	onSuccess,
	onError,
	saasAuthToken
}: ModelListParams<T> & { saasAuthToken?: string }): Promise<void> {
	const baseUrl = getSaaSBaseUrl();

	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (saasAuthToken) {
			headers['Authorization'] = `Bearer ${saasAuthToken}`;
		}

		const response = await fetch(`${baseUrl}/api/models`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			onError({ error: `Failed to list models: ${response.status}` });
			return;
		}

		const data = await response.json();
		onSuccess({ models: data.models || data.data || [] });

	} catch (error: any) {
		onError({ error: error.message || String(error) });
	}
}

// ============== PROVIDER IMPLEMENTATION MAP ==============

type CallFnOfProvider = {
	[providerName in ProviderName]: {
		sendChat: (params: SendChatParams_Internal) => Promise<void>;
		sendFIM: ((params: SendFIMParams_Internal) => void) | null;
		list: ((params: ListParams_Internal<any>) => void) | null;
	}
}

/**
 * All providers route through SaaS backend
 * The SaaS backend handles the actual provider routing based on model/configuration
 */
const saasProvider = {
	sendChat: sendSaaSChat,
	sendFIM: sendSaaSFIM,
	list: listSaaSModels,
};

export const sendLLMMessageToProviderImplementation: CallFnOfProvider = {
	// All providers use SaaS routing
	anthropic: saasProvider,
	openAI: saasProvider,
	xAI: saasProvider,
	gemini: saasProvider,
	mistral: saasProvider,
	ollama: saasProvider,
	openAICompatible: saasProvider,
	openRouter: saasProvider,
	vLLM: saasProvider,
	deepseek: saasProvider,
	groq: saasProvider,
	lmStudio: saasProvider,
	liteLLM: saasProvider,
	googleVertex: saasProvider,
	microsoftAzure: saasProvider,
	awsBedrock: saasProvider,
	genrtlSaaS: saasProvider,
};
