/*--------------------------------------------------------------------------------------
 *  Copyright 2025 genRTL Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * genRTL AI Settings Service
 * 
 * Manages settings for the genRTL AI features.
 * All LLM calls go through the SaaS backend, so provider-specific configuration
 * is handled server-side. This service primarily manages:
 * - Feature toggles (Autocomplete, Chat, Ctrl+K, Apply, SCM)
 * - Global settings (chatMode, autoApprove, etc.)
 * - MCP server states
 */

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { deepClone } from '../../../../base/common/objects.js';
import { IEncryptionService } from '../../../../platform/encryption/common/encryptionService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IMetricsService } from './metricsService.js';
import { defaultProviderSettings, getModelCapabilities, ModelOverrides } from './modelCapabilities.js';
import { GENRTL_SETTINGS_STORAGE_KEY } from './storageKeys.js';
import { defaultSettingsOfProvider, FeatureName, ProviderName, ModelSelectionOfFeature, SettingsOfProvider, SettingName, providerNames, ModelSelection, modelSelectionsEqual, featureNames, genRTLStatefulModelInfo, GlobalSettings, GlobalSettingName, defaultGlobalSettings, ModelSelectionOptions, OptionsOfModelSelection, ChatMode, OverridesOfModel, defaultOverridesOfModel, MCPUserStateOfName as MCPUserStateOfName, MCPUserState } from './genrtlSettingsTypes.js';


// name is the name in the dropdown
export type ModelOption = { name: string, selection: ModelSelection }



type SetSettingOfProviderFn = <S extends SettingName>(
	providerName: ProviderName,
	settingName: S,
	newVal: SettingsOfProvider[ProviderName][S extends keyof SettingsOfProvider[ProviderName] ? S : never],
) => Promise<void>;

type SetModelSelectionOfFeatureFn = <K extends FeatureName>(
	featureName: K,
	newVal: ModelSelectionOfFeature[K],
) => Promise<void>;

type SetGlobalSettingFn = <T extends GlobalSettingName>(settingName: T, newVal: GlobalSettings[T]) => void;

type SetOptionsOfModelSelection = (featureName: FeatureName, providerName: ProviderName, modelName: string, newVal: Partial<ModelSelectionOptions>) => void


export type genrtlSettingsState = {
	readonly settingsOfProvider: SettingsOfProvider; // optionsOfProvider
	readonly modelSelectionOfFeature: ModelSelectionOfFeature; // stateOfFeature
	readonly optionsOfModelSelection: OptionsOfModelSelection;
	readonly overridesOfModel: OverridesOfModel;
	readonly globalSettings: GlobalSettings;
	readonly mcpUserStateOfName: MCPUserStateOfName; // user-controlled state of MCP servers

	readonly _modelOptions: ModelOption[] // computed based on the two above items
}

// type RealgenrtlSettings = Exclude<keyof genrtlSettingsState, '_modelOptions'>
// type EventProp<T extends RealgenrtlSettings = RealgenrtlSettings> = T extends 'globalSettings' ? [T, keyof genrtlSettingsState[T]] : T | 'all'


export interface IgenrtlSettingsService {
	readonly _serviceBrand: undefined;
	readonly state: genrtlSettingsState; // in order to play nicely with react, you should immutably change state
	readonly waitForInitState: Promise<void>;

	onDidChangeState: Event<void>;

	setSettingOfProvider: SetSettingOfProviderFn;
	setModelSelectionOfFeature: SetModelSelectionOfFeatureFn;
	setOptionsOfModelSelection: SetOptionsOfModelSelection;
	setGlobalSetting: SetGlobalSettingFn;
	// setMCPServerStates: (newStates: MCPServerStates) => Promise<void>;

	// setting to undefined CLEARS it, unlike others:
	setOverridesOfModel(providerName: ProviderName, modelName: string, overrides: Partial<ModelOverrides> | undefined): Promise<void>;

	dangerousSetState(newState: genrtlSettingsState): Promise<void>;
	resetState(): Promise<void>;

	setAutodetectedModels(providerName: ProviderName, modelNames: string[], logging: object): void;
	toggleModelHidden(providerName: ProviderName, modelName: string): void;
	addModel(providerName: ProviderName, modelName: string): void;
	deleteModel(providerName: ProviderName, modelName: string): boolean;

	addMCPUserStateOfNames(userStateOfName: MCPUserStateOfName): Promise<void>;
	removeMCPUserStateOfNames(serverNames: string[]): Promise<void>;
	setMCPServerState(serverName: string, state: MCPUserState): Promise<void>;
}




const _modelsWithSwappedInNewModels = (options: { existingModels: genRTLStatefulModelInfo[], models: string[], type: 'autodetected' | 'default' }) => {
	const { existingModels, models, type } = options

	const existingModelsMap: Record<string, genRTLStatefulModelInfo> = {}
	for (const existingModel of existingModels) {
		existingModelsMap[existingModel.modelName] = existingModel
	}

	const newDefaultModels = models.map((modelName, i) => ({ modelName, type, isHidden: !!existingModelsMap[modelName]?.isHidden, }))

	return [
		...newDefaultModels, // swap out all the models of this type for the new models of this type
		...existingModels.filter(m => {
			const keep = m.type !== type
			return keep
		})
	]
}


export const modelFilterOfFeatureName: {
	[featureName in FeatureName]: {
		filter: (
			o: ModelSelection,
			opts: { chatMode: ChatMode, overridesOfModel: OverridesOfModel }
		) => boolean;
		emptyMessage: null | { message: string, priority: 'always' | 'fallback' }
	} } = {
	'Autocomplete': { filter: (o, opts) => getModelCapabilities(o.providerName, o.modelName, opts.overridesOfModel).supportsFIM, emptyMessage: { message: 'No models support FIM', priority: 'always' } },
	'Chat': { filter: o => true, emptyMessage: null, },
	'Ctrl+K': { filter: o => true, emptyMessage: null, },
	'Apply': { filter: o => true, emptyMessage: null, },
	'SCM': { filter: o => true, emptyMessage: null, },
}


const _stateWithMergedDefaultModels = (state: genrtlSettingsState): genrtlSettingsState => {
	let newSettingsOfProvider = state.settingsOfProvider

	// recompute default models
	for (const providerName of providerNames) {
		const defaultModels = defaultSettingsOfProvider[providerName]?.models ?? []
		const currentModels = newSettingsOfProvider[providerName]?.models ?? []
		const defaultModelNames = defaultModels.map(m => m.modelName)
		const newModels = _modelsWithSwappedInNewModels({ existingModels: currentModels, models: defaultModelNames, type: 'default' })
		newSettingsOfProvider = {
			...newSettingsOfProvider,
			[providerName]: {
				...newSettingsOfProvider[providerName],
				models: newModels,
			},
		}
	}
	return {
		...state,
		settingsOfProvider: newSettingsOfProvider,
	}
}

const _validatedModelState = (state: Omit<genrtlSettingsState, '_modelOptions'>): genrtlSettingsState => {

	let newSettingsOfProvider = state.settingsOfProvider

	// recompute _didFillInProviderSettings
	for (const providerName of providerNames) {
		const settingsAtProvider = newSettingsOfProvider[providerName]

		const didFillInProviderSettings = Object.keys(defaultProviderSettings[providerName]).every(key => !!settingsAtProvider[key as keyof typeof settingsAtProvider])
		// #region agent log
		if (providerName === 'genrtlSaaS' && typeof fetch !== 'undefined') {
			const keys = Object.keys(defaultProviderSettings[providerName]);
			const keyValues: {[key: string]: any} = {};
			keys.forEach(k => keyValues[k] = settingsAtProvider[k as keyof typeof settingsAtProvider]);
			fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:165',message:'_validatedModelState recomputing _didFillInProviderSettings',data:{providerName,didFillInProviderSettings,keyValues,keys},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v3',hypothesisId:'I'})}).catch(()=>{});
		}
		// #endregion

		if (didFillInProviderSettings === settingsAtProvider._didFillInProviderSettings) continue

		newSettingsOfProvider = {
			...newSettingsOfProvider,
			[providerName]: {
				...settingsAtProvider,
				_didFillInProviderSettings: didFillInProviderSettings,
			},
		}
	}

	// update model options
	let newModelOptions: ModelOption[] = []
	for (const providerName of providerNames) {
		const providerTitle = providerName // displayInfoOfProviderName(providerName).title.toLowerCase() // looks better lowercase, best practice to not use raw providerName
		// #region agent log
		if (providerName === 'genrtlSaaS' && typeof fetch !== 'undefined') {
			fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:182',message:'_validatedModelState building modelOptions',data:{providerName,didFillIn:newSettingsOfProvider[providerName]._didFillInProviderSettings,modelsCount:newSettingsOfProvider[providerName].models.length},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v3',hypothesisId:'I'})}).catch(()=>{});
		}
		// #endregion
		if (!newSettingsOfProvider[providerName]._didFillInProviderSettings) continue // if disabled, don't display model options
		for (const { modelName, isHidden } of newSettingsOfProvider[providerName].models) {
			if (isHidden) continue
			newModelOptions.push({ name: `${modelName} (${providerTitle})`, selection: { providerName, modelName } })
		}
	}
	// #region agent log
	if (typeof fetch !== 'undefined') {
		fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:194',message:'_validatedModelState final modelOptions',data:{totalOptions:newModelOptions.length,options:newModelOptions.map(o=>o.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v3',hypothesisId:'I'})}).catch(()=>{});
	}
	// #endregion

	// now that model options are updated, make sure the selection is valid
	// if the user-selected model is no longer in the list, update the selection for each feature that needs it to something relevant (the 0th model available, or null)
	let newModelSelectionOfFeature = state.modelSelectionOfFeature
	for (const featureName of featureNames) {

		const { filter } = modelFilterOfFeatureName[featureName]
		const filterOpts = { chatMode: state.globalSettings.chatMode, overridesOfModel: state.overridesOfModel }
		const modelOptionsForThisFeature = newModelOptions.filter((o) => filter(o.selection, filterOpts))

		const modelSelectionAtFeature = newModelSelectionOfFeature[featureName]
		const selnIdx = modelSelectionAtFeature === null ? -1 : modelOptionsForThisFeature.findIndex(m => modelSelectionsEqual(m.selection, modelSelectionAtFeature))

		if (selnIdx !== -1) continue // no longer in list, so update to 1st in list or null

		newModelSelectionOfFeature = {
			...newModelSelectionOfFeature,
			[featureName]: modelOptionsForThisFeature.length === 0 ? null : modelOptionsForThisFeature[0].selection
		}
	}


	const newState = {
		...state,
		settingsOfProvider: newSettingsOfProvider,
		modelSelectionOfFeature: newModelSelectionOfFeature,
		overridesOfModel: state.overridesOfModel,
		_modelOptions: newModelOptions,
	} satisfies genrtlSettingsState

	return newState
}





const defaultState = () => {
	const d: genrtlSettingsState = {
		settingsOfProvider: deepClone(defaultSettingsOfProvider),
		modelSelectionOfFeature: {
			'Chat': { providerName: 'genrtlSaaS', modelName: 'gpt-4.1-mini-2025-04-14' },
			'Ctrl+K': { providerName: 'genrtlSaaS', modelName: 'gpt-4.1-mini-2025-04-14' },
			'Autocomplete': { providerName: 'genrtlSaaS', modelName: 'gpt-4.1-mini-2025-04-14' }, 
			'Apply': { providerName: 'genrtlSaaS', modelName: 'gpt-4.1-mini-2025-04-14' },
			'SCM': { providerName: 'genrtlSaaS', modelName: 'gpt-4.1-mini-2025-04-14' } 
		},
		globalSettings: deepClone(defaultGlobalSettings),
		optionsOfModelSelection: { 'Chat': {}, 'Ctrl+K': {}, 'Autocomplete': {}, 'Apply': {}, 'SCM': {} },
		overridesOfModel: deepClone(defaultOverridesOfModel),
		_modelOptions: [], // computed later
		mcpUserStateOfName: {},
	}
	return d
}


export const IgenrtlSettingsService = createDecorator<IgenrtlSettingsService>('genrtlSettingsService');
class genrtlSettingsService extends Disposable implements IgenrtlSettingsService {
	_serviceBrand: undefined;

	private readonly _onDidChangeState = new Emitter<void>();
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event; // this is primarily for use in react, so react can listen + update on state changes

	state: genrtlSettingsState;

	private readonly _resolver: () => void
	waitForInitState: Promise<void> // await this if you need a valid state initially

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
		@IEncryptionService private readonly _encryptionService: IEncryptionService,
		@IMetricsService private readonly _metricsService: IMetricsService,
		// could have used this, but it's clearer the way it is (+ slightly different eg StorageTarget.USER)
		// @ISecretStorageService private readonly _secretStorageService: ISecretStorageService,
	) {
		super()

		// at the start, we haven't read the partial config yet, but we need to set state to something
		this.state = defaultState()
		let resolver: () => void = () => { }
		this.waitForInitState = new Promise((res, rej) => resolver = res)
		this._resolver = resolver

		this.readAndInitializeState()
	}




	dangerousSetState = async (newState: genrtlSettingsState) => {
		this.state = _validatedModelState(newState)
		await this._storeState()
		this._onDidChangeState.fire()
		this._onUpdate_syncApplyToChat()
		this._onUpdate_syncSCMToChat()
	}
	async resetState() {
		await this.dangerousSetState(defaultState())
	}




	async readAndInitializeState() {
		let readS: genrtlSettingsState
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:293',message:'readAndInitializeState start',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'F'})}).catch(()=>{});
		// #endregion
		try {
			readS = await this._readState();
			// #region agent log
			fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:297',message:'After _readState',data:{hasgenrtlSaaS:!!readS.settingsOfProvider?.genrtlSaaS,genrtlSaaSModelsCount:readS.settingsOfProvider?.genrtlSaaS?.models?.length || 0,genrtlSaaSDidFillIn:readS.settingsOfProvider?.genrtlSaaS?._didFillInProviderSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'F'})}).catch(()=>{});
			// #endregion
			// 1.0.3 addition, remove when enough users have had this code run
			if (readS.globalSettings.includeToolLintErrors === undefined) readS.globalSettings.includeToolLintErrors = true

			// autoapprove is now an obj not a boolean (1.2.5)
			if (typeof readS.globalSettings.autoApprove === 'boolean') readS.globalSettings.autoApprove = {}

			// 1.3.5 add source control feature
			if (readS.modelSelectionOfFeature && !readS.modelSelectionOfFeature['SCM']) {
				readS.modelSelectionOfFeature['SCM'] = deepClone(readS.modelSelectionOfFeature['Chat'])
				readS.optionsOfModelSelection['SCM'] = deepClone(readS.optionsOfModelSelection['Chat'])
			}
			// add disableSystemMessage feature
			if (readS.globalSettings.disableSystemMessage === undefined) readS.globalSettings.disableSystemMessage = false;
			
			// add autoAcceptLLMChanges feature
			if (readS.globalSettings.autoAcceptLLMChanges === undefined) readS.globalSettings.autoAcceptLLMChanges = false;
		}
		catch (e) {
			// #region agent log
			fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:319',message:'_readState threw error, using defaultState',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'F'})}).catch(()=>{});
			// #endregion
			readS = defaultState()
		}

		// the stored data structure might be outdated, so we need to update it here
		try {
			const defaultS = defaultState();
			readS = {
				...defaultS,
				...readS,
				// no idea why this was here, seems like a bug
				// ...defaultSettingsOfProvider,
				// ...readS.settingsOfProvider,
			}
			// #region agent log
			fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:330',message:'After merging with defaultState',data:{hasgenrtlSaaS:!!readS.settingsOfProvider?.genrtlSaaS,genrtlSaaSModelsCount:readS.settingsOfProvider?.genrtlSaaS?.models?.length || 0,genrtlSaaSDidFillIn:readS.settingsOfProvider?.genrtlSaaS?._didFillInProviderSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'F'})}).catch(()=>{});
			// #endregion

			// Fix: Restore null modelSelections to default values for genrtlSaaS
			for (const featureName of featureNames) {
				if (readS.modelSelectionOfFeature[featureName] === null && defaultS.modelSelectionOfFeature[featureName] !== null) {
					readS.modelSelectionOfFeature[featureName] = defaultS.modelSelectionOfFeature[featureName];
					// #region agent log
					fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:340',message:'Restored null modelSelection to default',data:{featureName,defaultSelection:defaultS.modelSelectionOfFeature[featureName]},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'I'})}).catch(()=>{});
					// #endregion
				}
			}

			for (const providerName of providerNames) {
				readS.settingsOfProvider[providerName] = {
					...defaultSettingsOfProvider[providerName],
					...readS.settingsOfProvider[providerName],
				} as any
				
				// Fix: For genrtlSaaS, if apiKey is empty string, use default value
				if (providerName === 'genrtlSaaS' && readS.settingsOfProvider[providerName].apiKey === '') {
					readS.settingsOfProvider[providerName].apiKey = defaultSettingsOfProvider.genrtlSaaS.apiKey as string;
					// #region agent log
					fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:353',message:'Fixed empty apiKey for genrtlSaaS',data:{newApiKey:readS.settingsOfProvider.genrtlSaaS.apiKey},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v3',hypothesisId:'I'})}).catch(()=>{});
					// #endregion
				}
				
				// Fix: For genrtlSaaS, if models exist but _didFillInProviderSettings is false, set it to true
				if (providerName === 'genrtlSaaS' && 
					readS.settingsOfProvider[providerName].models.length > 0 && 
					!readS.settingsOfProvider[providerName]._didFillInProviderSettings) {
					readS.settingsOfProvider[providerName]._didFillInProviderSettings = true;
					// #region agent log
					fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:364',message:'Fixed genrtlSaaS _didFillInProviderSettings',data:{modelsCount:readS.settingsOfProvider.genrtlSaaS.models.length,didFillIn:readS.settingsOfProvider.genrtlSaaS._didFillInProviderSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'I'})}).catch(()=>{});
					// #endregion
				}
				// #region agent log
				if (providerName === 'genrtlSaaS') {
					fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:369',message:'After merging genrtlSaaS with default',data:{modelsCount:readS.settingsOfProvider.genrtlSaaS.models.length,didFillIn:readS.settingsOfProvider.genrtlSaaS._didFillInProviderSettings,apiKey:readS.settingsOfProvider.genrtlSaaS.apiKey,defaultModelsCount:defaultSettingsOfProvider.genrtlSaaS.models.length},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'I'})}).catch(()=>{});
				}
				// #endregion

				// conversion from 1.0.3 to 1.2.5 (can remove this when enough people update)
				for (const m of readS.settingsOfProvider[providerName].models) {
					if (!m.type) {
						const old = (m as { isAutodetected?: boolean; isDefault?: boolean })
						if (old.isAutodetected)
							m.type = 'autodetected'
						else if (old.isDefault)
							m.type = 'default'
						else m.type = 'custom'
					}
				}

				// remove when enough people have had it run (default is now {})
				if (providerName === 'openAICompatible' && !readS.settingsOfProvider[providerName].headersJSON) {
					readS.settingsOfProvider[providerName].headersJSON = '{}'
				}
			}
		}

		catch (e) {
			// #region agent log
			fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:365',message:'Error during merge, falling back to defaultState',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'F'})}).catch(()=>{});
			// #endregion
			readS = defaultState()
		}

		this.state = readS
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:372',message:'Before _stateWithMergedDefaultModels',data:{genrtlSaaSModelsCount:readS.settingsOfProvider?.genrtlSaaS?.models?.length || 0,modelSelectionChat:readS.modelSelectionOfFeature?.Chat},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'I'})}).catch(()=>{});
		// #endregion
		this.state = _stateWithMergedDefaultModels(this.state)
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:377',message:'After _stateWithMergedDefaultModels',data:{genrtlSaaSModelsCount:this.state.settingsOfProvider?.genrtlSaaS?.models?.length || 0,modelSelectionChat:this.state.modelSelectionOfFeature?.Chat},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'I'})}).catch(()=>{});
		// #endregion
		this.state = _validatedModelState(this.state);
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'genrtlSettingsService.ts:382',message:'After _validatedModelState (FINAL)',data:{genrtlSaaSModelsCount:this.state.settingsOfProvider?.genrtlSaaS?.models?.length || 0,genrtlSaaSDidFillIn:this.state.settingsOfProvider?.genrtlSaaS?._didFillInProviderSettings,modelSelectionChat:this.state.modelSelectionOfFeature?.Chat},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-v2',hypothesisId:'I'})}).catch(()=>{});
		// #endregion


		this._resolver();
		this._onDidChangeState.fire();

	}


	private async _readState(): Promise<genrtlSettingsState> {
		const encryptedState = this._storageService.get(GENRTL_SETTINGS_STORAGE_KEY, StorageScope.APPLICATION)

		if (!encryptedState)
			return defaultState()

		const stateStr = await this._encryptionService.decrypt(encryptedState)
		const state = JSON.parse(stateStr)
		return state
	}


	private async _storeState() {
		const state = this.state
		const encryptedState = await this._encryptionService.encrypt(JSON.stringify(state))
		this._storageService.store(GENRTL_SETTINGS_STORAGE_KEY, encryptedState, StorageScope.APPLICATION, StorageTarget.USER);
	}

	setSettingOfProvider: SetSettingOfProviderFn = async (providerName, settingName, newVal) => {

		const newModelSelectionOfFeature = this.state.modelSelectionOfFeature

		const newOptionsOfModelSelection = this.state.optionsOfModelSelection

		const newSettingsOfProvider: SettingsOfProvider = {
			...this.state.settingsOfProvider,
			[providerName]: {
				...this.state.settingsOfProvider[providerName],
				[settingName]: newVal,
			}
		}

		const newGlobalSettings = this.state.globalSettings
		const newOverridesOfModel = this.state.overridesOfModel
		const newMCPUserStateOfName = this.state.mcpUserStateOfName

		const newState = {
			modelSelectionOfFeature: newModelSelectionOfFeature,
			optionsOfModelSelection: newOptionsOfModelSelection,
			settingsOfProvider: newSettingsOfProvider,
			globalSettings: newGlobalSettings,
			overridesOfModel: newOverridesOfModel,
			mcpUserStateOfName: newMCPUserStateOfName,
		}

		this.state = _validatedModelState(newState)

		await this._storeState()
		this._onDidChangeState.fire()

	}


	private _onUpdate_syncApplyToChat() {
		// if sync is turned on, sync (call this whenever Chat model or !!sync changes)
		this.setModelSelectionOfFeature('Apply', deepClone(this.state.modelSelectionOfFeature['Chat']))
	}

	private _onUpdate_syncSCMToChat() {
		this.setModelSelectionOfFeature('SCM', deepClone(this.state.modelSelectionOfFeature['Chat']))
	}

	setGlobalSetting: SetGlobalSettingFn = async (settingName, newVal) => {
		const newState: genrtlSettingsState = {
			...this.state,
			globalSettings: {
				...this.state.globalSettings,
				[settingName]: newVal
			}
		}
		this.state = _validatedModelState(newState)
		await this._storeState()
		this._onDidChangeState.fire()

		// hooks
		if (this.state.globalSettings.syncApplyToChat) this._onUpdate_syncApplyToChat()
		if (this.state.globalSettings.syncSCMToChat) this._onUpdate_syncSCMToChat()

	}


	setModelSelectionOfFeature: SetModelSelectionOfFeatureFn = async (featureName, newVal) => {
		const newState: genrtlSettingsState = {
			...this.state,
			modelSelectionOfFeature: {
				...this.state.modelSelectionOfFeature,
				[featureName]: newVal
			}
		}

		this.state = _validatedModelState(newState)

		await this._storeState()
		this._onDidChangeState.fire()

		// hooks
		if (featureName === 'Chat') {
			// When Chat model changes, update synced features
			this._onUpdate_syncApplyToChat()
			this._onUpdate_syncSCMToChat()
		}
	}


	setOptionsOfModelSelection = async (featureName: FeatureName, providerName: ProviderName, modelName: string, newVal: Partial<ModelSelectionOptions>) => {
		const newState: genrtlSettingsState = {
			...this.state,
			optionsOfModelSelection: {
				...this.state.optionsOfModelSelection,
				[featureName]: {
					...this.state.optionsOfModelSelection[featureName],
					[providerName]: {
						...this.state.optionsOfModelSelection[featureName][providerName],
						[modelName]: {
							...this.state.optionsOfModelSelection[featureName][providerName]?.[modelName],
							...newVal
						}
					}
				}
			}
		}
		this.state = _validatedModelState(newState)

		await this._storeState()
		this._onDidChangeState.fire()
	}

	setOverridesOfModel = async (providerName: ProviderName, modelName: string, overrides: Partial<ModelOverrides> | undefined) => {
		const newState: genrtlSettingsState = {
			...this.state,
			overridesOfModel: {
				...this.state.overridesOfModel,
				[providerName]: {
					...this.state.overridesOfModel[providerName],
					[modelName]: overrides === undefined ? undefined : {
						...this.state.overridesOfModel[providerName][modelName],
						...overrides
					},
				}
			}
		};

		this.state = _validatedModelState(newState);
		await this._storeState();
		this._onDidChangeState.fire();

		this._metricsService.capture('Update Model Overrides', { providerName, modelName, overrides });
	}




	setAutodetectedModels(providerName: ProviderName, autodetectedModelNames: string[], logging: object) {

		const { models } = this.state.settingsOfProvider[providerName]
		const oldModelNames = models.map(m => m.modelName)

		const newModels = _modelsWithSwappedInNewModels({ existingModels: models, models: autodetectedModelNames, type: 'autodetected' })
		this.setSettingOfProvider(providerName, 'models', newModels)

		// if the models changed, log it
		const new_names = newModels.map(m => m.modelName)
		if (!(oldModelNames.length === new_names.length
			&& oldModelNames.every((_, i) => oldModelNames[i] === new_names[i]))
		) {
			this._metricsService.capture('Autodetect Models', { providerName, newModels: newModels, ...logging })
		}
	}
	toggleModelHidden(providerName: ProviderName, modelName: string) {


		const { models } = this.state.settingsOfProvider[providerName]
		const modelIdx = models.findIndex(m => m.modelName === modelName)
		if (modelIdx === -1) return
		const newIsHidden = !models[modelIdx].isHidden
		const newModels: genRTLStatefulModelInfo[] = [
			...models.slice(0, modelIdx),
			{ ...models[modelIdx], isHidden: newIsHidden },
			...models.slice(modelIdx + 1, Infinity)
		]
		this.setSettingOfProvider(providerName, 'models', newModels)

		this._metricsService.capture('Toggle Model Hidden', { providerName, modelName, newIsHidden })

	}
	addModel(providerName: ProviderName, modelName: string) {
		const { models } = this.state.settingsOfProvider[providerName]
		const existingIdx = models.findIndex(m => m.modelName === modelName)
		if (existingIdx !== -1) return // if exists, do nothing
		const newModels = [
			...models,
			{ modelName, type: 'custom', isHidden: false } as const
		]
		this.setSettingOfProvider(providerName, 'models', newModels)

		this._metricsService.capture('Add Model', { providerName, modelName })

	}
	deleteModel(providerName: ProviderName, modelName: string): boolean {
		const { models } = this.state.settingsOfProvider[providerName]
		const delIdx = models.findIndex(m => m.modelName === modelName)
		if (delIdx === -1) return false
		const newModels = [
			...models.slice(0, delIdx), // delete the idx
			...models.slice(delIdx + 1, Infinity)
		]
		this.setSettingOfProvider(providerName, 'models', newModels)

		this._metricsService.capture('Delete Model', { providerName, modelName })

		return true
	}

	// MCP Server State
	private _setMCPUserStateOfName = async (newStates: MCPUserStateOfName) => {
		const newState: genrtlSettingsState = {
			...this.state,
			mcpUserStateOfName: {
				...this.state.mcpUserStateOfName,
				...newStates
			}
		};
		this.state = _validatedModelState(newState);
		await this._storeState();
		this._onDidChangeState.fire();
		this._metricsService.capture('Set MCP Server States', { newStates });
	}

	addMCPUserStateOfNames = async (newMCPStates: MCPUserStateOfName) => {
		const { mcpUserStateOfName: mcpServerStates } = this.state
		const newMCPServerStates = {
			...mcpServerStates,
			...newMCPStates,
		}
		await this._setMCPUserStateOfName(newMCPServerStates)
		this._metricsService.capture('Add MCP Servers', { servers: Object.keys(newMCPStates).join(', ') });
	}

	removeMCPUserStateOfNames = async (serverNames: string[]) => {
		const { mcpUserStateOfName: mcpServerStates } = this.state
		const newMCPServerStates = {
			...mcpServerStates,
		}
		serverNames.forEach(serverName => {
			if (serverName in newMCPServerStates) {
				delete newMCPServerStates[serverName]
			}
		})
		await this._setMCPUserStateOfName(newMCPServerStates)
		this._metricsService.capture('Remove MCP Servers', { servers: serverNames.join(', ') });
	}

	setMCPServerState = async (serverName: string, state: MCPUserState) => {
		const { mcpUserStateOfName } = this.state
		const newMCPServerStates = {
			...mcpUserStateOfName,
			[serverName]: state,
		}
		await this._setMCPUserStateOfName(newMCPServerStates)
		this._metricsService.capture('Update MCP Server State', { serverName, state });
	}

}


registerSingleton(IgenrtlSettingsService, genrtlSettingsService, InstantiationType.Eager);
