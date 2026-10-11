import type { DocumentCollectionCodec } from '../../../../shared/storage/document-collection';
import { BrowserError } from '../model';
import type { TargetBinding } from '../workspace/model';
import { officialWorkspaceOrigin } from './official-url';
import { WORKSPACE_PROVIDERS, type WorkspaceProvider } from './ids';
import { snapshotJson } from '../workspace/snapshot';

export interface AdapterSelectors { composer: string; submit: string; answer: string }
export interface AdapterDefinition {
	title: string; provider: WorkspaceProvider; origin: string; profileScope: string;
	/** Exact pathname, or a pathname prefix followed by one final *. Queries never widen scope. */
	pathPattern: string; selectors: AdapterSelectors;
}
export interface AdapterVerification {
	verifiedAt: number; version: number; material: string; scenario: string; taskId: string; turnId: string; exchangeId: string; captureId: string;
}
export interface UserAdapter extends AdapterDefinition {
	id: string; version: number; createdAt: number; updatedAt: number;
	state: 'candidate' | 'enabled' | 'disabled'; verification?: AdapterVerification;
}
export interface UserAdapterData { version: 1; rules: UserAdapter[] }
export interface ProviderOverride { rule: UserAdapter; admit(): void; commit(): void }
const invalid = (): never => { throw new BrowserError('browser_adapter_invalid'); };
const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const adapterVersion = (rule: UserAdapter): string => `nand-user-${rule.id}-v${rule.version}`;
export const adapterMaterial = (rule: AdapterDefinition): string => snapshotJson({ title: rule.title, provider: rule.provider, origin: rule.origin,
	profileScope: rule.profileScope, pathPattern: rule.pathPattern, selectors: rule.selectors })!;
export function validateAdapterDefinition(value: AdapterDefinition): void {
	if (!value || !text(value.title, 200) || !WORKSPACE_PROVIDERS.includes(value.provider) || !id(value.profileScope)
		|| officialWorkspaceOrigin(value.provider, value.origin) !== value.origin
		|| !text(value.pathPattern, 500) || !/^\/[^?#\\\s*]*(?:\*)?$/.test(value.pathPattern)) invalid();
	const path = value.pathPattern.replace(/\*$/, '');
	if (new URL(path, value.origin).origin !== value.origin || new URL(path, value.origin).pathname !== path) invalid();
	if (!value.selectors || Object.keys(value.selectors).sort().join(',') !== 'answer,composer,submit'
		|| !Object.values(value.selectors).every(selector => text(selector, 4000))) invalid();
}
export function adapterMatches(rule: AdapterDefinition, binding: Pick<TargetBinding, 'provider' | 'profileId'>, url: string): boolean {
	try {
		const page = new URL(url), pattern = rule.pathPattern;
		return rule.provider === binding.provider && rule.profileScope === binding.profileId
			&& officialWorkspaceOrigin(rule.provider, url) === rule.origin
			&& (pattern.endsWith('*') ? page.pathname.startsWith(pattern.slice(0, -1)) : page.pathname === pattern);
	} catch { return false; }
}
export function validateUserAdapters(value: unknown): UserAdapterData {
	const data = value as UserAdapterData;
	if (!data || data.version !== 1 || !Array.isArray(data.rules) || new Set(data.rules.map(rule => rule?.id)).size !== data.rules.length) invalid();
	for (const rule of data.rules) {
		validateAdapterDefinition(rule);
		if (!id(rule.id) || !Number.isSafeInteger(rule.version) || rule.version < 1 || !time(rule.createdAt) || !time(rule.updatedAt)
			|| !['candidate', 'enabled', 'disabled'].includes(rule.state)) invalid();
		const proof = rule.verification;
		if (proof && (!time(proof.verifiedAt) || proof.version !== rule.version || proof.material !== adapterMaterial(rule) || !text(proof.scenario, 2000)
			|| ![proof.taskId, proof.turnId, proof.exchangeId, proof.captureId].every(id))) invalid();
		if (rule.state === 'enabled' && !proof) invalid();
	}
	return data;
}
export const emptyUserAdapters = (): UserAdapterData => ({ version: 1, rules: [] });
export function userAdapterDocuments(root: string): DocumentCollectionCodec<UserAdapterData> {
	return { root, ownedTypes: ['browser-user-adapter'], managedProperties: ['nand-user-adapter'], empty: emptyUserAdapters,
		encode: value => validateUserAdapters(value).rules.map(rule => ({ id: rule.id, path: `${root}/适配规则/${rule.id}.md`,
			properties: { 'nand-type': 'browser-user-adapter', 'nand-id': rule.id, 'nand-user-adapter': rule } })),
		decode: documents => validateUserAdapters({ version: 1, rules: documents.filter(row => row.properties['nand-type'] === 'browser-user-adapter').map(row => {
			const rule = row.properties['nand-user-adapter'] as UserAdapter;
			if (rule?.id !== row.id) invalid(); return rule;
		}) }),
	};
}
