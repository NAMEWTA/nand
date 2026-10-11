import { DurableState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import { BrowserError } from '../core/model';
import { DEFAULT_PROFILE, profileLabel, type BrowserProfile } from '../core/profiles';

interface ProfileData {
	profiles: BrowserProfile[];
	permissions: Record<string, Record<string, boolean>>;
}
function decode(raw: unknown): ProfileData {
	const data = raw as ProfileData;
	if (!data || !Array.isArray(data.profiles) || !data.permissions || typeof data.permissions !== 'object' || Array.isArray(data.permissions)) throw new BrowserError('browser_profile_storage');
	const ids = new Set<string>();
	for (const profile of data.profiles) {
		if (!profile || !/^[a-f\d-]{36}$/.test(profile.id) || ids.has(profile.id) || profile.kind !== 'isolated'
			|| typeof profile.label !== 'string' || profileLabel(profile.label) !== profile.label
			|| !['ready', 'deleting'].includes(profile.state)) throw new BrowserError('browser_profile_storage');
		ids.add(profile.id);
	}
	for (const [id, grants] of Object.entries(data.permissions)) {
		if (!ids.has(id) || !grants || typeof grants !== 'object' || Array.isArray(grants) || Object.values(grants).some(value => typeof value !== 'boolean')) throw new BrowserError('browser_profile_storage');
	}
	return data;
}

/** Metadata and grants only; cookies remain in Electron's isolated persistent sessions. */
export class BrowserProfileStore {
	readonly ready: Promise<void>;
	private readonly repository: DurableState<ProfileData>;
	private edits: Promise<unknown> = Promise.resolve();
	constructor(storage: TextStorage, path: string, private readonly changed: () => void) {
		this.repository = new DurableState(storage, path, () => ({ profiles: [], permissions: {} }), decode, changed);
		this.ready = this.repository.sync(true);
		void this.ready.catch(() => undefined);
	}
	list(): BrowserProfile[] {
		return [{ id: DEFAULT_PROFILE, label: '', kind: 'default', state: 'ready' }, ...this.repository.value.profiles.map(profile => ({ ...profile }))];
	}
	get(id: string): BrowserProfile {
		const profile = this.list().find(row => row.id === id);
		if (!profile) throw new BrowserError('browser_profile_missing');
		return profile;
	}
	permissions(id: string): Record<string, boolean> { return { ...this.repository.value.permissions[id] }; }
	private edit(change: (draft: ProfileData) => void): Promise<void> {
		const next = this.edits.then(async () => {
			await this.ready;
			await this.repository.sync(true);
			const before = structuredClone(this.repository.value), draft = structuredClone(before);
			change(draft);
			this.repository.value = draft;
			this.repository.save();
			try { await this.repository.flush(); }
			catch (error) { this.repository.value = before; this.changed(); throw error; }
		});
		this.edits = next.catch(() => undefined);
		return next;
	}
	async create(label: string): Promise<BrowserProfile> {
		const profile: BrowserProfile = { id: crypto.randomUUID(), label: profileLabel(label), kind: 'isolated', state: 'ready' };
		await this.edit(draft => { draft.profiles.push(profile); });
		return { ...profile };
	}
	rename(id: string, label: string): Promise<void> {
		const name = profileLabel(label);
		return this.edit(draft => {
			const profile = draft.profiles.find(row => row.id === id && row.state === 'ready');
			if (!profile) throw new BrowserError('browser_profile_missing');
			profile.label = name;
		});
	}
	markDeleting(id: string): Promise<void> {
		return this.edit(draft => {
			const profile = draft.profiles.find(row => row.id === id);
			if (!profile) throw new BrowserError('browser_profile_missing');
			profile.state = 'deleting';
		});
	}
	remove(id: string): Promise<void> {
		return this.edit(draft => {
			if (!draft.profiles.some(row => row.id === id && row.state === 'deleting')) throw new BrowserError('browser_profile_missing');
			draft.profiles = draft.profiles.filter(row => row.id !== id);
			delete draft.permissions[id];
		});
	}
	grant(id: string, origin: string, permission: string, allowed: boolean): Promise<void> {
		return this.edit(draft => {
			if (!draft.profiles.some(row => row.id === id && row.state === 'ready')) throw new BrowserError('browser_profile_missing');
			draft.permissions[id] = { ...draft.permissions[id], [`${origin}|${permission}`]: allowed };
		});
	}
	async shutdown(): Promise<void> { await this.edits; await this.repository.shutdown(); }
}
