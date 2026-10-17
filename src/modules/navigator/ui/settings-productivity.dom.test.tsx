// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NandProviders } from '../../../ui/react/providers';
import { setLanguage } from '../../../shared/i18n';
import { FakeVault, createTestService, note } from '../services/test-support';
import { navigatorSettingsPage } from './settings-page';
import type { NavigatorRuntime } from './runtime';

vi.mock('obsidian', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), Platform: { isMacOS: false, isPhone: false, isMobile: false } }));

async function page() {
	setLanguage('en');
	const t = await createTestService(new FakeVault([note('a.md')], ['/']));
	const runtime = { templateFiles: () => ['T/Meeting.md'], templaterInstalled: () => false, service: t.service, rebuildCache: () => Promise.resolve() } as unknown as NavigatorRuntime;
	const Page = navigatorSettingsPage(t.settings, () => runtime);
	render(<NandProviders ownerDocument={document}><div className="nand-ui"><Page /></div></NandProviders>);
	return t;
}

const blur = (element: HTMLElement, value: string) => { fireEvent.change(element, { target: { value } }); fireEvent.blur(element); };

test('period rules are edited per period and saved when a field loses focus', async () => {
	const t = await page();
	const week = document.querySelector<HTMLElement>('[data-period-rule="week"]')!;
	fireEvent.click(within(week).getByRole('switch', { name: 'Enable Weekly notes' }));
	await waitFor(() => expect(t.settings.get().periodRules.week.enabled).toBe(true));
	blur(within(week).getByRole('textbox', { name: 'Weekly notes: folder' }), 'Journal/Weekly');
	blur(within(week).getByRole('textbox', { name: 'Weekly notes: file name pattern' }), 'GGGG-[W]WW');
	await waitFor(() => expect(t.settings.get().periodRules.week).toMatchObject({ enabled: true, folder: 'Journal/Weekly', format: 'GGGG-[W]WW' }));
	// an emptied pattern falls back to the default
	blur(within(week).getByRole('textbox', { name: 'Weekly notes: file name pattern' }), '  ');
	await waitFor(() => expect(t.settings.get().periodRules.week.format).toBe('gggg-[W]ww'));
});

test('template settings, folder templates and the engine choice', async () => {
	const t = await page();
	blur(screen.getByRole('textbox', { name: 'Template folder' }), '/Templates/');
	await waitFor(() => expect(t.settings.get().templateFolder).toBe('Templates'));
	expect(screen.getByText('Templater is not installed or enabled, so the built-in engine fills every template.')).toBeTruthy();
	blur(screen.getByRole('textbox', { name: 'Date format in templates' }), 'DD.MM.YYYY');
	await waitFor(() => expect(t.settings.get().templateDateFormat).toBe('DD.MM.YYYY'));

	const add = screen.getByRole('button', { name: 'Add' });
	expect(add.hasAttribute('disabled')).toBe(true);
	const row = add.closest('div')!;
	fireEvent.change(within(row).getByRole('combobox', { name: 'Template' }), { target: { value: 'T/Meeting.md' } });
	fireEvent.change(within(row).getByRole('textbox', { name: 'Folder' }), { target: { value: '/Work/' } });
	fireEvent.click(add);
	await waitFor(() => expect(t.settings.get().folderTemplates).toEqual([{ folder: 'Work', template: 'T/Meeting.md', exact: false }]));
	const entry = await waitFor(() => { const found = document.querySelector<HTMLElement>('[data-folder-template="Work"]'); expect(found).toBeTruthy(); return found!; });
	fireEvent.click(within(entry).getByRole('switch', { name: 'This folder only (not its subfolders)' }));
	await waitFor(() => expect(t.settings.get().folderTemplates[0]?.exact).toBe(true));
	fireEvent.click(within(entry).getByRole('button', { name: 'Remove' }));
	await waitFor(() => expect(t.settings.get().folderTemplates).toEqual([]));
});

test('create-note commands can be added, edited and removed', async () => {
	const t = await page();
	fireEvent.click(screen.getByRole('button', { name: 'Add command' }));
	const card = await waitFor(() => { const found = document.querySelector<HTMLElement>('[data-create-command]'); expect(found).toBeTruthy(); return found!; });
	expect(t.settings.get().createCommands).toHaveLength(1);
	blur(within(card).getByRole('textbox', { name: 'Name' }), 'Meeting note');
	blur(within(card).getByRole('textbox', { name: 'File name pattern' }), '{{date:YYYYMMDD}} {{prompt:Title}}');
	await waitFor(() => expect(t.settings.get().createCommands[0]).toMatchObject({ name: 'Meeting note', fileName: '{{date:YYYYMMDD}} {{prompt:Title}}', location: 'selected' }));
	fireEvent.click(within(card).getByRole('button', { name: 'Remove' }));
	await waitFor(() => expect(t.settings.get().createCommands).toEqual([]));
});

test('profiles can be added, renamed, given a banner, switched to and removed', async () => {
	const t = await page();
	expect(document.querySelectorAll('[data-profile]')).toHaveLength(1);
	fireEvent.click(screen.getByRole('button', { name: 'Add profile' }));
	await waitFor(() => expect(document.querySelectorAll('[data-profile]')).toHaveLength(2));
	const second = document.querySelectorAll<HTMLElement>('[data-profile]')[1]!;
	blur(within(second).getByRole('textbox', { name: 'Name' }), 'Work');
	blur(within(second).getByRole('textbox', { name: 'Banner image' }), 'banner.png');
	await waitFor(() => expect(t.settings.get().profiles.find((profile) => profile.name === 'Work')?.banner).toBe('banner.png'));
	fireEvent.click(within(second).getByRole('button', { name: 'Use' }));
	await waitFor(() => expect(t.settings.get().activeProfile).not.toBe('default'));
	const first = document.querySelectorAll<HTMLElement>('[data-profile]')[0]!;
	expect(within(first).getByRole('button', { name: 'Remove' })).toBeTruthy();
	fireEvent.click(within(first).getByRole('button', { name: 'Remove' }));
	await waitFor(() => expect(t.settings.get().profiles.map((profile) => profile.name)).toEqual(['Work']));
});
