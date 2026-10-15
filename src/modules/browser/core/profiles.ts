import { BrowserError } from './model';

export interface BrowserProfile {
	id: string;
	label: string;
	kind: 'default' | 'isolated';
	state: 'ready' | 'deleting';
	createdAt?: number;
	importSource?: string;
}
export interface ProfilePage {
	id: string;
	title: string;
	url: string;
}
export const DEFAULT_PROFILE = 'default';
export function profileLabel(value: string): string {
	const label = value.trim();
	if (!label || label.length > 40 || [...label].some((character) => character.charCodeAt(0) < 32))
		throw new BrowserError('browser_profile_label');
	return label;
}
