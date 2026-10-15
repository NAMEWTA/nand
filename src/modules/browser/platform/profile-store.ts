import { DurableState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import { BrowserError } from '../core/model';
import { DEFAULT_PROFILE, profileLabel, type BrowserProfile } from '../core/profiles';

interface ProfileData {
	profiles: BrowserProfile[];
	defaultSource?: string;
}
function decode(raw: unknown): ProfileData {
	const data = raw as ProfileData;
	if (!data || !Array.isArray(data.profiles)) throw new BrowserError('browser_profile_storage');
	const ids = new Set<string>();
	for (const profile of data.profiles) {
		if (
			!profile ||
			!/^[a-f\d-]{36}$/.test(profile.id) ||
			ids.has(profile.id) ||
			profile.kind !== 'isolated' ||
			typeof profile.label !== 'string' ||
			profileLabel(profile.label) !== profile.label ||
			!['ready', 'deleting'].includes(profile.state)
		)
			throw new BrowserError('browser_profile_storage');
		ids.add(profile.id);
	}
	return data;
}

/** Profile metadata; permissions live in state.json and Cookies in Electron sessions. */
export class BrowserProfileStore {
	readonly ready: Promise<void>;
	private readonly repository: DurableState<ProfileData>;
	private edits: Promise<unknown> = Promise.resolve();
	constructor(
		storage: TextStorage,
		path: string,
		private readonly changed: () => void,
	) {
		this.repository = new DurableState<ProfileData>(storage, path, () => ({ profiles: [] }), decode, changed);
		this.ready = this.repository.sync(true);
		void this.ready.catch(() => undefined);
	}
	list(): BrowserProfile[] {
		return [
			{
				id: DEFAULT_PROFILE,
				label: '',
				kind: 'default',
				state: 'ready',
				importSource: this.repository.value.defaultSource,
			},
			...this.repository.value.profiles.map((profile) => ({ ...profile })),
		];
	}
	get(id: string): BrowserProfile {
		const profile = this.list().find((row) => row.id === id);
		if (!profile) throw new BrowserError('browser_profile_missing');
		return profile;
	}
	private edit(change: (draft: ProfileData) => void): Promise<void> {
		const next = this.edits.then(async () => {
			await this.ready;
			await this.repository.sync(true);
			const before = structuredClone(this.repository.value),
				draft = structuredClone(before);
			change(draft);
			this.repository.value = draft;
			this.repository.save();
			try {
				await this.repository.flush();
			} catch (error) {
				this.repository.value = before;
				this.changed();
				throw error;
			}
		});
		this.edits = next.catch(() => undefined);
		return next;
	}
	async create(label: string): Promise<BrowserProfile> {
		const profile: BrowserProfile = {
			id: crypto.randomUUID(),
			label: profileLabel(label),
			kind: 'isolated',
			state: 'ready',
			createdAt: Date.now(),
		};
		await this.edit((draft) => {
			draft.profiles.push(profile);
		});
		return { ...profile };
	}
	setSource(id: string, source: string): Promise<void> {
		return this.edit((draft) => {
			if (id === DEFAULT_PROFILE) draft.defaultSource = source;
			const row = draft.profiles.find((p) => p.id === id);
			if (row) row.importSource = source;
		});
	}
	rename(id: string, label: string): Promise<void> {
		const name = profileLabel(label);
		return this.edit((draft) => {
			const profile = draft.profiles.find((row) => row.id === id && row.state === 'ready');
			if (!profile) throw new BrowserError('browser_profile_missing');
			profile.label = name;
		});
	}
	markDeleting(id: string): Promise<void> {
		return this.edit((draft) => {
			const profile = draft.profiles.find((row) => row.id === id);
			if (!profile) throw new BrowserError('browser_profile_missing');
			profile.state = 'deleting';
		});
	}
	remove(id: string): Promise<void> {
		return this.edit((draft) => {
			if (!draft.profiles.some((row) => row.id === id && row.state === 'deleting'))
				throw new BrowserError('browser_profile_missing');
			draft.profiles = draft.profiles.filter((row) => row.id !== id);
		});
	}
	async shutdown(): Promise<void> {
		await this.edits;
		await this.repository.shutdown();
	}
}
