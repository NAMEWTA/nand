// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { normalizeShortcuts, type Shortcut } from './shortcuts';

export const DEFAULT_PROFILE_ID = 'default';
export const MAX_PROFILES = 12;

/** What a vault profile keeps apart: hiding rules, shortcuts and a banner image. The recent list is kept per device. */
export interface ProfileData {
	hiddenFolders: string[];
	hiddenTags: string[];
	hiddenFiles: string[];
	hiddenProperties: string[];
	shortcuts: Shortcut[];
}

export interface Profile extends ProfileData {
	id: string;
	name: string;
	/** Vault path of an image shown at the top of the navigation pane; empty for none. */
	banner: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown, max: number): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '').slice(0, max) : []);

export function emptyProfileData(): ProfileData {
	return { hiddenFolders: [], hiddenTags: [], hiddenFiles: [], hiddenProperties: [], shortcuts: [] };
}

export function normalizeProfiles(value: unknown): Profile[] {
	if (!Array.isArray(value)) return [];
	const ids = new Set<string>();
	const result: Profile[] = [];
	for (const item of value) {
		if (!isRecord(item) || typeof item['id'] !== 'string' || typeof item['name'] !== 'string') continue;
		const id = item['id'].trim();
		const name = item['name'].trim().slice(0, 60);
		if (!id || !name || ids.has(id)) continue;
		ids.add(id);
		result.push({
			id,
			name,
			banner: typeof item['banner'] === 'string' ? item['banner'].trim().slice(0, 300) : '',
			hiddenFolders: strings(item['hiddenFolders'], 300),
			hiddenTags: strings(item['hiddenTags'], 300),
			hiddenFiles: strings(item['hiddenFiles'], 300),
			hiddenProperties: strings(item['hiddenProperties'], 300),
			shortcuts: normalizeShortcuts(item['shortcuts']),
		});
	}
	return result.slice(0, MAX_PROFILES);
}

/** The profiles to show: the saved ones, with the implicit default profile first when none carries its id. */
export function listProfiles(saved: readonly Profile[], defaultName: string): Profile[] {
	return saved.some((profile) => profile.id === DEFAULT_PROFILE_ID)
		? [...saved]
		: [{ id: DEFAULT_PROFILE_ID, name: defaultName, banner: '', ...emptyProfileData() }, ...saved];
}

export function newProfileId(existing: readonly Profile[]): string {
	let id = '';
	do id = `p${Math.random().toString(36).slice(2, 8)}`; while (existing.some((entry) => entry.id === id) || id === DEFAULT_PROFILE_ID);
	return id;
}

/** Copy of a profile's data fields (used to snapshot the live settings into the profile that is being left). */
export function pickProfileData(source: ProfileData): ProfileData {
	return {
		hiddenFolders: [...source.hiddenFolders],
		hiddenTags: [...source.hiddenTags],
		hiddenFiles: [...source.hiddenFiles],
		hiddenProperties: [...source.hiddenProperties],
		shortcuts: source.shortcuts.map((shortcut) => ({ ...shortcut })),
	};
}

export interface ProfileSwitch {
	profiles: Profile[];
	data: ProfileData;
	activeId: string;
}

/**
 * Switch from the profile whose data is live in `live` to `targetId`: the live data is saved into the profile that is
 * being left (created if it was the implicit default), and the target's data becomes the live data.
 */
export function switchProfile(profiles: readonly Profile[], activeId: string, live: ProfileData, targetId: string, defaultName: string): ProfileSwitch | undefined {
	const all = listProfiles(profiles, defaultName);
	const target = all.find((profile) => profile.id === targetId);
	if (!target || targetId === activeId) return undefined;
	const saved = all.map((profile) => (profile.id === activeId ? { ...profile, ...pickProfileData(live) } : profile));
	const incoming = saved.find((profile) => profile.id === targetId)!;
	return { profiles: saved, data: pickProfileData(incoming), activeId: targetId };
}

/** The profile as a list entry, with whether it is the one in use. */
export interface ProfileSummary { id: string; name: string; banner: string; active: boolean }

export function summarizeProfiles(saved: readonly Profile[], activeId: string, defaultName: string): ProfileSummary[] {
	const all = listProfiles(saved, defaultName);
	const active = all.some((profile) => profile.id === activeId) ? activeId : DEFAULT_PROFILE_ID;
	return all.map((profile) => ({ id: profile.id, name: profile.name, banner: profile.banner, active: profile.id === active }));
}

/** A new, empty profile appended to the saved ones (the implicit default is materialized first so it keeps its place). */
export function addProfile(saved: readonly Profile[], name: string, defaultName: string): { profiles: Profile[]; id: string } {
	const all = listProfiles(saved, defaultName);
	const id = newProfileId(all);
	return { profiles: [...all, { id, name: name.trim() || defaultName, banner: '', ...emptyProfileData() }].slice(0, MAX_PROFILES), id };
}

/** Change a profile's name or banner. The implicit default profile is materialized when it is the one edited. */
export function editProfile(saved: readonly Profile[], id: string, patch: Partial<Pick<Profile, 'name' | 'banner'>>, defaultName: string): Profile[] {
	return listProfiles(saved, defaultName).map((profile) => (profile.id === id ? { ...profile, ...patch, name: (patch.name ?? profile.name).trim() || profile.name } : profile));
}

/** Remove a profile; the profile in use and the last remaining one stay. */
export function removeProfile(saved: readonly Profile[], id: string, activeId: string, defaultName: string): Profile[] {
	const all = listProfiles(saved, defaultName);
	if (id === activeId || all.length <= 1) return [...saved];
	return all.filter((profile) => profile.id !== id);
}
