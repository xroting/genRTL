import { URI } from '../../../../base/common/uri.js';

export type genRTLDirectoryItem = {
	uri: URI;
	name: string;
	isSymbolicLink: boolean;
	children: genRTLDirectoryItem[] | null;
	isDirectory: boolean;
	isGitIgnoredDirectory: false | { numChildren: number }; // if directory is gitignored, we ignore children
}
