/*--------------------------------------------------------------------------------------
 *  Copyright 2025 genRTL Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { genRTLCheckUpdateRespose } from './genrtlUpdateServiceTypes.js';



export interface IgenrtlUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<genRTLCheckUpdateRespose>;
}


export const IgenrtlUpdateService = createDecorator<IgenrtlUpdateService>('genrtlUpdateService');


// implemented by calling channel
export class genrtlUpdateService implements IgenrtlUpdateService {

	readonly _serviceBrand: undefined;
	private readonly genrtlUpdateService: IgenrtlUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.genrtlUpdateService = ProxyChannel.toService<IgenrtlUpdateService>(mainProcessService.getChannel('genrtl-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IgenrtlUpdateService['check'] = async (explicit) => {
		const res = await this.genrtlUpdateService.check(explicit)
		return res
	}
}

registerSingleton(IgenrtlUpdateService, genrtlUpdateService, InstantiationType.Eager);


