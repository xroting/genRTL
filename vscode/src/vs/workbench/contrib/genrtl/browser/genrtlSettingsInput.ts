/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';

export class GenRTLSettingsInput extends EditorInput {
	static readonly ID = 'workbench.input.genrtlSettings';
	static readonly RESOURCE = URI.from({ scheme: Schemas.vscodeSettings, path: 'genrtl' });

	override get typeId(): string {
		return GenRTLSettingsInput.ID;
	}

	override get resource(): URI {
		return GenRTLSettingsInput.RESOURCE;
	}

	override getName(): string {
		return localize('genrtlSettingsName', "genRTL Settings");
	}

	override matches(other: unknown): boolean {
		return other instanceof GenRTLSettingsInput;
	}
}

