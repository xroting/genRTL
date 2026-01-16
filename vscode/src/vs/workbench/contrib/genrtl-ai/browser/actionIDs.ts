// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const GENRTL_CTRL_L_ACTION_ID = 'genrtl-ai.ctrlLAction'

export const GENRTL_CTRL_K_ACTION_ID = 'genrtl-ai.ctrlKAction'

export const GENRTL_ACCEPT_DIFF_ACTION_ID = 'genrtl-ai.acceptDiff'

export const GENRTL_REJECT_DIFF_ACTION_ID = 'genrtl-ai.rejectDiff'

export const GENRTL_GOTO_NEXT_DIFF_ACTION_ID = 'genrtl-ai.goToNextDiff'

export const GENRTL_GOTO_PREV_DIFF_ACTION_ID = 'genrtl-ai.goToPrevDiff'

export const GENRTL_GOTO_NEXT_URI_ACTION_ID = 'genrtl-ai.goToNextUri'

export const GENRTL_GOTO_PREV_URI_ACTION_ID = 'genrtl-ai.goToPrevUri'

export const GENRTL_ACCEPT_FILE_ACTION_ID = 'genrtl-ai.acceptFile'

export const GENRTL_REJECT_FILE_ACTION_ID = 'genrtl-ai.rejectFile'

export const GENRTL_ACCEPT_ALL_DIFFS_ACTION_ID = 'genrtl-ai.acceptAllDiffs'

export const GENRTL_REJECT_ALL_DIFFS_ACTION_ID = 'genrtl-ai.rejectAllDiffs'
