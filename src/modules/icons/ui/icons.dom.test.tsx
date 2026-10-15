import { expect, test, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../ui/react/test-providers';
import { setLanguage, t } from '../../../shared/i18n';
import { DEFAULT_ICONIC_SETTINGS } from '../core/settings/model';
import type IconicController from '../platform/host/controller';
import type { RuleItem } from '../platform/managers/rule-manager';
import { IconicSettings, ICONIC_SETTINGS_PAGES } from './settings/sections';
import { RuleEditorContent, conditionOperators } from './dialogs/rule-editor';
import { IconPickerContent } from './dialogs/icon-picker';
vi.mock('obsidian', async (importOriginal) => ({
	...(await importOriginal<object>()),
	prepareFuzzySearch: (query: string) => (text: string) =>
		text.toLowerCase().includes(query.toLowerCase()) ? { score: 1, matches: [] } : null,
}));
afterEach(() => setLanguage('zh'));
function controller() {
	const settings = structuredClone(DEFAULT_ICONIC_SETTINGS);
	return {
		settings,
		updatePreference: vi.fn(async (key: keyof typeof settings, value: never) => {
			settings[key] = value;
		}),
		updateDialogState: vi.fn((patch) => Object.assign(settings.dialogState, patch)),
		saveSettings: vi.fn(async () => {}),
		refreshBody: vi.fn(),
		refreshManagers: vi.fn(),
		isSettingEnabled: (key: keyof typeof settings) => settings[key] === 'on' || settings[key] === 'desktop',
		getPropertyItems: () => [{ id: 'flag', type: 'checkbox' }],
		getPropertyItem: () => ({ type: 'checkbox' }),
		app: { vault: { getFiles: () => [], getAllFolders: () => [], adapter: { exists: async () => true } } },
		ruleManager: {
			getPageIcon: () => 'lucide-file',
			getRules: () => [],
			judgeFiles: vi.fn(() => []),
			judgeFolders: vi.fn(() => []),
			checkRuling: () => null,
		},
	} as unknown as IconicController;
}
test('all 24 Iconic settings rows render in both languages and use the domain store', async () => {
	const plugin = controller(),
		user = userEvent.setup();
	for (const language of ['en', 'zh'] as const) {
		act(() => setLanguage(language));
		let count = 0;
		for (const section of ICONIC_SETTINGS_PAGES) {
			const view = render(
				<TestProviders>
					<IconicSettings plugin={plugin} section={section} />
				</TestProviders>,
			);
			count += view.container.querySelectorAll('[data-slot=settings-row]').length;
			if (section === 'iconic-sidebars') {
				await user.click(screen.getByRole('switch', { name: t('iconic.settings.showAllFolderIcons.name') }));
				expect(plugin.updatePreference).toHaveBeenCalledWith('showAllFolderIcons', expect.any(Boolean));
				expect(plugin.refreshManagers).toHaveBeenCalledWith('folder');
			}
			view.unmount();
		}
		expect(count).toBe(24);
	}
});
test('rule edits preserve cancel isolation, typed conditions, and save the edited draft', async () => {
	const plugin = controller(),
		accept = vi.fn(),
		close = vi.fn(),
		initial: RuleItem = {
			id: 'rule',
			category: 'rule',
			name: 'Rule',
			icon: null,
			color: null,
			iconDefault: 'lucide-file',
			match: 'all',
			enabled: true,
			conditions: [{ source: 'name', operator: 'contains', value: 'Report' }],
		};
	render(
		<TestProviders>
			<RuleEditorContent plugin={plugin} page="file" initial={initial} accept={accept} close={close} />
		</TestProviders>,
	);
	const user = userEvent.setup(),
		name = screen.getByRole('combobox', { name: t('iconic.ruleEditor.enterName') });
	await user.clear(name);
	await user.type(name, 'New name');
	expect(initial.name).toBe('Rule');
	await user.click(screen.getByRole('button', { name: t('iconic.ruleEditor.addCondition') }));
	expect(initial.conditions).toHaveLength(1);
	await user.click(screen.getByRole('button', { name: t('iconic.iconPicker.save') }));
	expect(accept.mock.calls[0]?.[0]).toMatchObject({
		name: 'New name',
		conditions: [{ value: 'Report' }, { value: '' }],
	});
	expect(close).toHaveBeenCalledOnce();
	const before = conditionOperators(plugin, 'property:flag');
	expect(before).toContain('hasProperty');
	expect(conditionOperators(plugin, 'property:flag')).toEqual(before);
});
test('mixed icon selection retains undefined values on save and supports search Enter', async () => {
	const plugin = controller(),
		accept = vi.fn(),
		close = vi.fn(),
		items = [
			{ id: 'a', name: 'A', category: 'file' as const, icon: 'lucide-star', color: 'red', iconDefault: null },
			{ id: 'b', name: 'B', category: 'file' as const, icon: null, color: 'blue', iconDefault: null },
		];
	const view = render(
			<TestProviders>
				<IconPickerContent plugin={plugin} items={items} accept={accept} close={close} />
			</TestProviders>,
		),
		user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: t('iconic.iconPicker.save') }));
	expect(accept).toHaveBeenCalledWith(undefined, undefined);
	view.unmount();
	render(
		<TestProviders>
			<IconPickerContent plugin={plugin} items={[items[0]!]} accept={accept} close={close} />
		</TestProviders>,
	);
	const search = screen.getByRole('searchbox');
	await user.clear(search);
	await user.type(search, 'star{Enter}');
	await waitFor(() => expect(accept).toHaveBeenCalledWith(expect.stringContaining('star'), 'red'));
});

const finiteConditions = [
	['clock', 'weekdayIs', '2', '1'],
	['clock', 'monthIs', '12', '1'],
	['color', 'colorIs', 'blue', 'red'],
] as const;
test.each(finiteConditions)(
	'adding %s/%s initializes a legal value without changing the preceding row',
	(source, operator, value, fallback) => {
		const accept = vi.fn(),
			plugin = controller();
		const initial: RuleItem = {
			id: 'rule',
			category: 'rule',
			name: 'Rule',
			icon: null,
			color: null,
			iconDefault: null,
			match: 'all',
			enabled: true,
			conditions: [{ source, operator, value }],
		};
		render(
			<TestProviders>
				<RuleEditorContent plugin={plugin} page="file" initial={initial} accept={accept} close={vi.fn()} />
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button', { name: t('iconic.ruleEditor.addCondition') }));
		fireEvent.click(screen.getByRole('button', { name: t('iconic.iconPicker.save') }));
		expect(accept.mock.calls[0]?.[0].conditions).toEqual([
			{ source, operator, value },
			{ source, operator, value: fallback },
		]);
		expect(initial.conditions).toEqual([{ source, operator, value }]);
	},
);
test.each(finiteConditions)(
	'loading %s/%s normalizes invalid values in the isolated draft',
	(source, operator, _value, fallback) => {
		const accept = vi.fn(),
			plugin = controller();
		const initial: RuleItem = {
			id: 'rule',
			category: 'rule',
			name: 'Rule',
			icon: null,
			color: null,
			iconDefault: null,
			match: 'all',
			enabled: true,
			conditions: [{ source, operator, value: 'invalid' }],
		};
		render(
			<TestProviders>
				<RuleEditorContent plugin={plugin} page="file" initial={initial} accept={accept} close={vi.fn()} />
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button', { name: t('iconic.iconPicker.save') }));
		expect(accept.mock.calls[0]?.[0].conditions[0].value).toBe(fallback);
		expect(initial.conditions[0]?.value).toBe('invalid');
	},
);
test.each([
	['list', 'rgb'],
	['rgb', 'list'],
] as const)(
	'secondary %s/%s picker leaves primary mode and subsequent clicks intact',
	async (primaryMode, secondaryMode) => {
		const plugin = controller(),
			accept = vi.fn();
		plugin.settings.colorPicker1 = primaryMode;
		plugin.settings.colorPicker2 = secondaryMode;
		const view = render(
			<TestProviders>
				<IconPickerContent
					plugin={plugin}
					items={[{ id: 'a', name: 'A', category: 'file', icon: null, color: 'red', iconDefault: null }]}
					accept={accept}
					close={vi.fn()}
				/>
			</TestProviders>,
		);
		const swatch = view.container.querySelector<HTMLInputElement>('input[type=color]')!;
		swatch.showPicker = vi.fn();
		const primary = screen.getByRole('combobox', { name: t('iconic.settings.colorPicker1.name') });
		for (let round = 0; round < 2; round++) {
			fireEvent.contextMenu(swatch);
			expect(primary.textContent).toContain(t(`iconic.settings.values.${primaryMode}`));
			if (secondaryMode === 'list') {
				await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
				fireEvent.click(screen.getByRole('option', { name: t('iconic.iconPicker.colors.blue') }));
			}
			fireEvent.click(swatch);
			if (primaryMode === 'list') {
				await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
				fireEvent.click(screen.getByRole('option', { name: t('iconic.iconPicker.colors.blue') }));
			}
			expect(swatch.showPicker).toHaveBeenCalledTimes(round + 1);
			expect(primary.textContent).toContain(t(`iconic.settings.values.${primaryMode}`));
		}
		fireEvent.click(screen.getByRole('button', { name: t('iconic.iconPicker.save') }));
		expect(accept).toHaveBeenLastCalledWith(null, 'blue');
	},
);

test('changing a condition operator and source applies the same finite defaults', async () => {
	const plugin = controller(),
		accept = vi.fn(),
		user = userEvent.setup();
	const initial: RuleItem = {
		id: 'rule',
		category: 'rule',
		name: 'Rule',
		icon: null,
		color: null,
		iconDefault: null,
		match: 'all',
		enabled: true,
		conditions: [{ source: 'clock', operator: 'weekdayIs', value: '2' }],
	};
	render(
		<TestProviders>
			<RuleEditorContent plugin={plugin} page="file" initial={initial} accept={accept} close={vi.fn()} />
		</TestProviders>,
	);
	await user.click(screen.getAllByRole('combobox', { name: t('iconic.ruleEditor.matchConditions.name') })[1]!);
	await user.click(screen.getByRole('option', { name: t('iconic.ruleEditor.operator.monthIs') }));
	expect(screen.getByRole('combobox', { name: t('iconic.ruleEditor.enterValue') }).textContent).toBe(
		t('iconic.ruleEditor.month.1'),
	);
	await user.click(screen.getByRole('combobox', { name: t('iconic.ruleEditor.conditions') }));
	await user.click(screen.getByRole('option', { name: t('iconic.ruleEditor.source.color') }));
	expect(screen.getByRole('combobox', { name: t('iconic.ruleEditor.enterValue') }).textContent).toBe(
		t('iconic.iconPicker.colors.red'),
	);
	await user.click(screen.getByRole('button', { name: t('iconic.iconPicker.save') }));
	expect(accept.mock.calls[0]?.[0].conditions).toEqual([{ source: 'color', operator: 'colorIs', value: 'red' }]);
	expect(initial.conditions).toEqual([{ source: 'clock', operator: 'weekdayIs', value: '2' }]);
});
