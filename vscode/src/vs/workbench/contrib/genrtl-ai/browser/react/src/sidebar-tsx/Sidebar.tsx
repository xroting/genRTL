/*--------------------------------------------------------------------------------------
 *  Copyright 2025 genRTL Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useIsDark } from '../util/services.js';
// import { SidebarThreadSelector } from './SidebarThreadSelector.js';
// import { SidebarChat } from './SidebarChat.js';

import '../styles.css'
import { SidebarChat } from './SidebarChat.js';
import ErrorBoundary from './ErrorBoundary.js';

export const Sidebar = ({ className }: { className: string }) => {
	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/4eeaa7bf-5db4-4a40-89b4-4cbbaffa678d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Sidebar.tsx:14',message:'Sidebar component mounted',data:{className},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
	// #endregion

	const isDark = useIsDark()
	return <div
		className={`@@genrtl-ai-scope ${isDark ? 'dark' : ''}`}
		style={{ width: '100%', height: '100%' }}
	>
		<div
			// default background + text styles for sidebar
			className={`
				w-full h-full
				bg-genrtl-ai-bg-2
				text-genrtl-ai-fg-1
			`}
		>

			<div className={`w-full h-full`}>
				<ErrorBoundary>
					<SidebarChat />
				</ErrorBoundary>

			</div>
		</div>
	</div>


}

