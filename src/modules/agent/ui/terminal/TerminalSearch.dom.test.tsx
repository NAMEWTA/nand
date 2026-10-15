import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../../ui/react/test-providers';
import { registerMessages, setLanguage, t } from '../../../../shared/i18n';
import { messages } from '../../i18n';
import { TerminalSearch } from './TerminalSearch';

// Discard the all-module dictionaries installed by test setup. This surface must work with home off.
vi.hoisted(() => {
	vi.resetModules();
});
registerMessages(messages);

test('case/regex toggle alters matching, previous/next preserve options, IME and close keep their contracts', async () => {
	const find = vi.fn(
			(query: string, _direction: 'next' | 'previous', options: { regex: boolean; caseSensitive: boolean }) =>
				options.regex
					? new RegExp(query, options.caseSensitive ? '' : 'i').test('Hello 42')
					: options.caseSensitive
						? 'Hello 42'.includes(query)
						: 'hello 42'.includes(query.toLowerCase()),
		),
		close = vi.fn();
	render(
		<TestProviders>
			<TerminalSearch find={find} close={close} />
		</TestProviders>,
	);
	const user = userEvent.setup(),
		input = screen.getByRole('textbox');
	await user.type(input, 'hello');
	await user.keyboard('{Enter}');
	expect(screen.queryByRole('status')).toBeNull();
	await user.click(screen.getByRole('button', { name: t('agent.matchCase') }));
	expect(screen.getByRole('status').textContent).toBe(t('agent.searchNoMatch'));
	await user.clear(input);
	await user.type(input, 'H.*42');
	await user.click(screen.getByRole('button', { name: t('agent.regex') }));
	expect(screen.queryByRole('status')).toBeNull();
	await user.click(screen.getByRole('button', { name: t('agent.searchPrevious') }));
	expect(find).toHaveBeenLastCalledWith('H.*42', 'previous', { caseSensitive: true, regex: true });
	await user.click(screen.getByRole('button', { name: t('agent.searchNext') }));
	expect(find).toHaveBeenLastCalledWith('H.*42', 'next', { caseSensitive: true, regex: true });
	const count = find.mock.calls.length;
	fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
	expect(find).toHaveBeenCalledTimes(count);
	fireEvent.keyDown(input, { key: 'Escape' });
	expect(close).toHaveBeenCalledOnce();
});

test.each(['{Enter}', ' '])('search buttons retain native %s activation after tabbing from the input', async (key) => {
	const find = vi.fn(() => true),
		close = vi.fn(),
		bubbled = vi.fn();
	render(
		<TestProviders>
			<div onKeyDown={bubbled}>
				<TerminalSearch find={find} close={close} />
			</div>
		</TestProviders>,
	);
	const user = userEvent.setup();
	await user.type(screen.getByRole('textbox'), 'needle');
	await user.keyboard('{Enter}');
	expect(find).toHaveBeenLastCalledWith('needle', 'next', { caseSensitive: false, regex: false });
	await user.keyboard('{Shift>}{Enter}{/Shift}');
	expect(find).toHaveBeenLastCalledWith('needle', 'previous', { caseSensitive: false, regex: false });
	for (const label of ['agent.matchCase', 'agent.regex']) {
		await user.tab();
		const button = screen.getByRole('button', { name: t(label) });
		expect(document.activeElement).toBe(button);
		await user.keyboard(key);
		expect(button.getAttribute('aria-pressed')).toBe('true');
	}
	for (const [label, direction] of [
		['agent.searchPrevious', 'previous'],
		['agent.searchNext', 'next'],
	]) {
		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: t(label!) }));
		find.mockClear();
		await user.keyboard(key);
		expect(find).toHaveBeenCalledExactlyOnceWith('needle', direction, { caseSensitive: true, regex: true });
	}
	await user.tab();
	expect(document.activeElement).toBe(screen.getByRole('button', { name: t('agent.close') }));
	find.mockClear();
	await user.keyboard(key);
	expect(close).toHaveBeenCalledOnce();
	expect(find).not.toHaveBeenCalled();
	await user.keyboard('{Escape}');
	expect(close).toHaveBeenCalledTimes(2);
	expect(bubbled).not.toHaveBeenCalled();
});

test.each([
	['en', 'Close'],
	['zh', '关闭'],
] as const)('close is localized in %s with only agent and shared UI dictionaries', (language, label) => {
	setLanguage(language);
	expect(t('common.close')).toBe('common.close');
	render(
		<TestProviders>
			<TerminalSearch find={() => true} close={() => {}} />
		</TestProviders>,
	);
	expect(screen.getByRole('button', { name: label })).toBeTruthy();
});
