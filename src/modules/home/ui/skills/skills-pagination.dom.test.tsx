import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { t } from '../../../../shared/i18n';
import type { SkillsSectionConfig } from '../../core/board/types';
import type { BoardStore } from '../../services/board-store';
import { SkillLibrary } from '../../services/skill-library';
import { SkillsSection } from './SkillsSection';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function renderSkills(names: string[], config: SkillsSectionConfig) {
	// Replace only the filesystem scan; exercise the real section, cards and pagination.
	vi.spyOn(SkillLibrary.prototype, 'refresh').mockImplementation(function (this: SkillLibrary) {
		this.state.setState({
			entries: names.map((name) => ({
				name,
				sources: [{ kind: 'vault', path: `.nand/content/NAND/技能/${name}/SKILL.md`, agents: [] }],
			})),
		});
		return Promise.resolve();
	});
	const store = { host: { app: {} }, widgets: {} } as unknown as BoardStore;
	return render(
		<TestProviders>
			<SkillsSection store={store} column={{ name: 'Skills', color: '', cards: [], skillsConfig: config }} />
		</TestProviders>,
	);
}

function cards(container: HTMLElement, group?: string): string[] {
	return Array.from(
		container.querySelectorAll(group ? `[data-group-key="${group}"] [data-skill]` : '[data-skill]'),
		(card) => card.getAttribute('data-skill')!,
	);
}

const assigned = Array.from({ length: 10 }, (_, i) => `pagin-a${i}`);
const singleUngrouped = {
	pageSize: 10,
	groups: [{ id: 'g', name: 'Assigned' }],
	assignments: Object.fromEntries(assigned.map((name) => [name, 'g'])),
};

test.each(['groups', 'kanban'] as const)(
	'%s shows 10 assigned and 1 ungrouped skill on the first page',
	(groupView) => {
		const { container } = renderSkills([...assigned, 'pagin-z'], { ...singleUngrouped, groupView });
		expect(cards(container, 'g')).toEqual(assigned);
		expect(cards(container, '_none')).toEqual(['pagin-z']);
		expect(screen.queryByRole('button', { name: t('home.p1.next') })).toBeNull();
		expect(screen.queryByRole('button', { name: t('home.p1.previous') })).toBeNull();
	},
);

test.each([
	['groups', 'asc'],
	['groups', 'desc'],
	['kanban', 'asc'],
	['kanban', 'desc'],
] as const)('%s paginates only ungrouped skills with mixed assignments, pins and %s sorting', (groupView, sortDir) => {
	const name = (i: number) => `mixed-${String(i).padStart(2, '0')}`;
	const names = Array.from({ length: 30 }, (_, i) => name(i));
	const grouped = names.filter((_, i) => i % 2 === 0);
	const { container } = renderSkills([...names].reverse(), {
		groupView,
		sortDir,
		pageSize: 10,
		groups: [{ id: 'g', name: 'Assigned' }],
		assignments: Object.fromEntries(grouped.map((value) => [value, 'g'])),
		pinned: [name(28), name(29), name(5)],
	});
	const expectedGrouped = [name(28), ...(sortDir === 'asc' ? grouped.slice(0, -1) : grouped.slice(0, -1).reverse())];
	const first = sortDir === 'asc' ? [5, 29, 1, 3, 7, 9, 11, 13, 15, 17] : [29, 5, 27, 25, 23, 21, 19, 17, 15, 13];
	const second = sortDir === 'asc' ? [19, 21, 23, 25, 27] : [11, 9, 7, 3, 1];
	expect(cards(container, 'g')).toEqual(expectedGrouped);
	expect(cards(container, '_none')).toEqual(first.map(name));
	expect(screen.getByText('1 / 2')).toBeTruthy();
	fireEvent.click(screen.getByRole('button', { name: t('home.p1.next') }));
	expect(cards(container, 'g')).toEqual(expectedGrouped);
	expect(cards(container, '_none')).toEqual(second.map(name));
	expect(screen.getByText('2 / 2')).toBeTruthy();
	expect((screen.getByRole('button', { name: t('home.p1.next') }) as HTMLButtonElement).disabled).toBe(true);
	fireEvent.click(screen.getByRole('button', { name: t('home.p1.previous') }));
	expect(cards(container, '_none')).toEqual(first.map(name));
});

test('flat view still paginates all skills regardless of their assignments', () => {
	const { container } = renderSkills([...assigned, 'pagin-z'], singleUngrouped);
	expect(cards(container)).toEqual(assigned);
	expect(screen.getByText('1 / 2')).toBeTruthy();
	fireEvent.click(screen.getByRole('button', { name: t('home.p1.next') }));
	expect(cards(container)).toEqual(['pagin-z']);
	expect(screen.getByText('2 / 2')).toBeTruthy();
});
