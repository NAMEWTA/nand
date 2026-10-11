import { BrowserError } from './model';

export interface BrowserProfile {
	id: string;
	label: string;
	kind: 'default' | 'isolated';
	state: 'ready' | 'deleting';
}
export interface ProfilePage { id: string; title: string; url: string }
export const DEFAULT_PROFILE = 'default';
export function profileLabel(value: string): string {
	const label = value.trim();
	if (!label || label.length > 80 || [...label].some(character => character.charCodeAt(0) < 32))
		throw new BrowserError('browser_profile_label');
	return label;
}
export function profilePartition(vaultId: string, profileId: string): string {
	if (profileId !== DEFAULT_PROFILE && !/^[a-f\d-]{36}$/.test(profileId)) throw new BrowserError('browser_profile_missing');
	// Preserve the existing vault's default login bytes. Isolated accounts are also vault-scoped.
	return `persist:nand-browser-${vaultId}${profileId === DEFAULT_PROFILE ? '' : `-profile-${profileId}`}`;
}
