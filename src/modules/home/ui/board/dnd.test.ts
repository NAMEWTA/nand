import { expect, test, vi } from 'vitest';
import { commitDrop } from './dnd';
import type { BoardStore } from '../../services/board-store';
test('every supported drop calls exactly one persistence operation', async () => {
	const sync = { moveColumn: vi.fn(), moveCard: vi.fn(), moveTaskToCard: vi.fn(), moveDocToCard: vi.fn() },
		settings = vi.fn();
	const store = { sync, settings } as unknown as BoardStore;
	await commitDrop(store, { kind: 'section', index: 0 }, { kind: 'section', index: 1 });
	await commitDrop(
		store,
		{ kind: 'card', id: 'A', column: 'A', index: 0 },
		{ kind: 'card', id: 'B', column: 'B', index: 0 },
	);
	await commitDrop(store, { kind: 'task', card: 'A', path: [0] }, { kind: 'task', card: 'B', path: [0] }, 'nest');
	await commitDrop(store, { kind: 'doc', card: 'A', path: [0] }, { kind: 'doc', card: 'B', path: [0] });
	await commitDrop(store, { kind: 'widget', id: 'weather' }, { kind: 'widget', id: 'habit' });
	for (const method of [...Object.values(sync), settings]) expect(method).toHaveBeenCalledTimes(1);
	expect(sync.moveTaskToCard).toHaveBeenCalledWith('A', [0], 'B', [0], 'nest');
});

test('same-card destinations follow removal and dropping a parent into its descendant is inert', async () => {
	const moveTaskToCard = vi.fn(),
		moveDocToCard = vi.fn();
	const store = { sync: { moveTaskToCard, moveDocToCard } } as unknown as BoardStore;
	await commitDrop(store, { kind: 'task', card: 'A', path: [0] }, { kind: 'task', card: 'A', path: [1] }, 'after');
	expect(moveTaskToCard).toHaveBeenLastCalledWith('A', [0], 'A', [0], 'after');
	await commitDrop(store, { kind: 'doc', card: 'A', path: [0] }, { kind: 'doc', card: 'A', path: [1, 0] }, 'nest');
	expect(moveDocToCard).toHaveBeenLastCalledWith('A', [0], 'A', [0, 0], 'nest');
	await commitDrop(store, { kind: 'task', card: 'A', path: [0] }, { kind: 'task', card: 'A', path: [0, 1] }, 'nest');
	await commitDrop(store, { kind: 'doc', card: 'A', path: [0] }, { kind: 'doc', card: 'A', path: [0, 1] }, 'after');
	expect(moveTaskToCard).toHaveBeenCalledTimes(1);
	expect(moveDocToCard).toHaveBeenCalledTimes(1);
});
