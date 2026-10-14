import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../ui/react/test-providers';
import { ResourceTabs } from './ResourceTabs';

function fixture() {
	const select = vi.fn(),
		close = vi.fn();
	function Fixture() {
		const [active, setActive] = useState('a');
		return (
			<ResourceTabs
				label="Browser pages"
				tabs={[
					{ id: 'a', title: 'Alpha' },
					{ id: 'b', title: 'Beta' },
					{ id: 'c', title: 'Gamma' },
				]}
				active={active}
				onSelect={(id) => {
					select(id);
					setActive(id);
				}}
				onClose={close}
				onNew={vi.fn()}
				newLabel="New"
			/>
		);
	}
	render(
		<TestProviders>
			<Fixture />
		</TestProviders>,
	);
	return { select, close };
}
test('tabs have a named list, active styling and one tab stop; arrows and Home/End select and focus', async () => {
	const { select } = fixture();
	const user = userEvent.setup();
	expect(screen.getByRole('tablist', { name: 'Browser pages' })).toBeTruthy();
	screen.getByRole('tab', { name: 'Alpha' }).focus();
	for (const [key, id, name] of [
		['ArrowRight', 'b', 'Beta'],
		['End', 'c', 'Gamma'],
		['ArrowRight', 'a', 'Alpha'],
		['ArrowLeft', 'c', 'Gamma'],
		['Home', 'a', 'Alpha'],
	]) {
		await user.keyboard(`{${key}}`);
		expect(select).toHaveBeenLastCalledWith(id);
		const active = screen.getByRole('tab', { name, selected: true });
		expect(document.activeElement).toBe(active);
		expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toEqual([active]);
		expect(active.parentElement?.dataset.current).toBe('true');
		expect(active.parentElement?.className).toContain('data-[current=true]:bg-background');
	}
});
test('Delete, middle click and the close control close the intended tab without selecting another', async () => {
	const { select, close } = fixture();
	const alpha = screen.getByRole('tab', { name: 'Alpha' });
	fireEvent.keyDown(alpha, { key: 'Delete' });
	expect(close).toHaveBeenLastCalledWith('a');
	fireEvent(screen.getByRole('tab', { name: 'Beta' }), new MouseEvent('auxclick', { button: 1, bubbles: true }));
	expect(close).toHaveBeenLastCalledWith('b');
	const closeButton = alpha.parentElement?.querySelectorAll('button')[1];
	expect(closeButton?.tabIndex).toBe(-1);
	await userEvent.setup().click(closeButton!);
	expect(close).toHaveBeenCalledTimes(3);
	expect(select).not.toHaveBeenCalled();
});
