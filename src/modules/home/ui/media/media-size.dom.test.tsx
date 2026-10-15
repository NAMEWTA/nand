import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { bindTestPreferences } from '../../../../../test/fixtures/vault-storage';
import { TestProviders } from '../../../../ui/react/test-providers';
import { MediaPanel } from './MediaPanel';
import { THUMB_SIZE_STORAGE_KEY } from './media-model';
import { t } from '../../../../shared/i18n';
afterEach(cleanup);
test.each([undefined, 'large', 'garbage'])(
	'media size %s initializes without writes and persists a selection',
	async (stored) => {
		const vault = memoryVault({ 'Images/one.png': 'image' }, window),
			values: Record<string, unknown> = {};
		if (stored !== undefined) values[THUMB_SIZE_STORAGE_KEY] = stored;
		bindTestPreferences(vault.app, values);
		const view = render(
			<TestProviders>
				<MediaPanel app={vault.app} column={{ name: 'Images', cards: [], color: '', sectionType: 'images' }} />
			</TestProviders>,
		);
		const expected = stored === 'large' ? 'large' : 'medium';
		expect(view.container.querySelector(`.dashboard-media-grid--${expected}`)).toBeTruthy();
		expect(values[THUMB_SIZE_STORAGE_KEY]).toBe(stored);
		fireEvent.pointerDown(
			screen.getByRole('button', { name: t(expected === 'large' ? 'media.sizeLarge' : 'media.sizeMedium') }),
			{ button: 0, ctrlKey: false },
		);
		fireEvent.click(await screen.findByRole('menuitem', { name: t('media.sizeSmall') }));
		await waitFor(() => expect(values[THUMB_SIZE_STORAGE_KEY]).toBe('small'));
		expect(view.container.querySelector('.dashboard-media-grid--small')).toBeTruthy();
		view.unmount();
		render(
			<TestProviders>
				<MediaPanel app={vault.app} column={{ name: 'Images', cards: [], color: '', sectionType: 'images' }} />
			</TestProviders>,
		);
		expect(screen.getByRole('button', { name: t('media.sizeSmall') })).toBeTruthy();
	},
);
