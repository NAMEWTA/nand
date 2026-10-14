import { expect, it, vi } from 'vitest';
import { PageHandle, type BrowserEngine } from './host';
import { newPageState } from '../core/model';
it('switches an inactive page profile lazily without requiring an existing guest', async () => {
	const host = {
		requireProfile: vi.fn((id: string) => {
			if (id === 'missing') throw Error('missing profile');
		}),
	} as unknown as BrowserEngine;
	const page = new PageHandle(host, newPageState('page', { url: 'https://example.com', profileId: 'default' }));
	await expect(page.setProfile('secondary')).resolves.toBeUndefined();
	expect(page.profileId).toBe('secondary');
	expect(page.native).toBeUndefined();
	await expect(page.setProfile('missing')).rejects.toThrow('missing profile');
	expect(page.profileId).toBe('secondary');
});
