/*--------------------------------------------------------------------------------------
 *  Copyright 2025 genRTL Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { GenrtlCommandBarMain } from './genrtlCommandBar.js'
import { GenrtlSelectionHelperMain } from './genrtlSelectionHelper.js'

export const mountgenrtlCommandBar = mountFnGenerator(GenrtlCommandBarMain)

export const mountgenrtlSelectionHelper = mountFnGenerator(GenrtlSelectionHelperMain)

