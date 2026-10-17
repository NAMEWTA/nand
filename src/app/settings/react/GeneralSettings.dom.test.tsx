import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { GeneralSettings } from './GeneralSettings';
import { appSchema } from '../app-schema';
import type DashboardPlugin from '../../main';
import { TestProviders } from '../../../ui/react/test-providers';
import { setLanguage, t } from '../../../shared/i18n';

test.each(['zh', 'en'] as const)('module switches retain saved state and recover from write/apply failures (%s)', async language => {
	setLanguage(language);
	let settings = appSchema(language).defaults();
	let failWrite = true, failApply = false;
	const listeners = new Set<() => void>();
	const plugin = {
		appSettings: { get: () => settings, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); } },
		moduleManifests: () => [{ id: 'automations', titleKey: 'automation.title', descriptionKey: 'modules.automationDesc', platforms: { mobile: true } }],
		setModuleEnabled: async (_id: string, value: boolean) => {
			if (failWrite) throw Error('disk full');
			settings = { ...settings, modules: { ...settings.modules, automations: value } };
			for (const listener of listeners) listener();
			if (failApply) throw Error('stop failed');
		},
	} as unknown as DashboardPlugin;
	settings.modules.automations = true;
	const view = render(<TestProviders><GeneralSettings plugin={plugin} navigate={vi.fn()} /></TestProviders>);
	const toggle = screen.getByRole('switch', { name: t('automation.title') });
	expect(toggle.getAttribute('aria-checked')).toBe('true');
	fireEvent.click(toggle);
	await screen.findByRole('alert');
	await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
	expect(toggle.getAttribute('aria-checked')).toBe('true');
	failWrite = false; failApply = true;
	await act(async () => fireEvent.click(toggle));
	expect(toggle.getAttribute('aria-checked')).toBe('false');
	expect(toggle.hasAttribute('disabled')).toBe(false);
	failApply = false;
	await act(async () => fireEvent.click(toggle));
	expect(toggle.getAttribute('aria-checked')).toBe('true');
	expect(screen.queryByRole('alert')).toBeNull();
	view.unmount(); expect(listeners.size).toBe(0);
});

test('status bar section only offers per-item visibility and usage preferences', async () => {
	setLanguage('en');
	let settings = appSchema('en').defaults();
	const listeners = new Set<() => void>();
	const plugin = {
		appSettings: {
			get: () => settings,
			subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
			update: async (recipe: (draft: typeof settings) => void) => {
				settings = structuredClone(settings);
				recipe(settings);
				for (const listener of listeners) listener();
			},
		},
		moduleManifests: () => [],
	} as unknown as DashboardPlugin;
	render(<TestProviders><GeneralSettings plugin={plugin} navigate={vi.fn()} /></TestProviders>);
	// The retired in-workbench bar had a master switch and a mirror switch; neither exists any more.
	expect(screen.queryByRole('switch', { name: /show status bar/i })).toBeNull();
	expect(screen.queryByText(/Obsidian status bar$/)).not.toBeNull();
	const usage = screen.getByRole('switch', { name: 'Show Usage' });
	expect(usage.getAttribute('aria-checked')).toBe('true');
	fireEvent.click(usage);
	await waitFor(() => expect(settings.statusBar.segments).toEqual({ usage: false }));
	await waitFor(() => expect(screen.getByRole('switch', { name: 'Show Usage' }).getAttribute('aria-checked')).toBe('false'));
	fireEvent.click(screen.getByRole('switch', { name: 'Show Git sync' }));
	await waitFor(() => expect(settings.statusBar.segments).toEqual({ usage: false, sync: false }));
	fireEvent.click(screen.getByRole('switch', { name: 'Show Usage' }));
	await waitFor(() => expect(settings.statusBar.segments).toEqual({ usage: true, sync: false }));
});
