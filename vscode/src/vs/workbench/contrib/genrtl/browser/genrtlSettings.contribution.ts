/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorSerializer, IEditorFactoryRegistry } from '../../../common/editor.js';
import { GenRTLSettingsEditor } from './genrtlSettingsEditor.js';
import { GenRTLSettingsInput } from './genrtlSettingsInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';

// Register the GenRTL Settings editor pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		GenRTLSettingsEditor,
		GenRTLSettingsEditor.ID,
		localize('genrtlSettings', "genRTL Settings")
	),
	[new SyncDescriptor(GenRTLSettingsInput)]
);

// Register the editor input serializer
class GenRTLSettingsInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '';
	}

	deserialize(instantiationService: IInstantiationService): GenRTLSettingsInput {
		return instantiationService.createInstance(GenRTLSettingsInput);
	}
}

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(GenRTLSettingsInput.ID, GenRTLSettingsInputSerializer);

// Register command to open genRTL Settings
class OpenGenRTLSettingsAction extends Action2 {
	static readonly ID = 'workbench.action.openGenRTLSettings';

	constructor() {
		super({
			id: OpenGenRTLSettingsAction.ID,
			title: localize2('openGenRTLSettings', "genRTL Settings"),
			category: Categories.Preferences,
			icon: Codicon.settingsGear,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Comma
			},
			menu: [
				{
					id: MenuId.CommandPalette
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		
		const input = instantiationService.createInstance(GenRTLSettingsInput);
		await editorService.openEditor(input, { pinned: true });
	}
}

registerAction2(OpenGenRTLSettingsAction);

