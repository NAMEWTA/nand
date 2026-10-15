import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { SkillCard } from './SkillCard';
import type { BoardStore } from '../../services/board-store';
import { t } from '../../../../shared/i18n';
afterEach(cleanup);
test('populated skill cards expose descriptions, sources, keyboard detail and invocation preview', () => {
	const detail = vi.fn(),
		pin = vi.fn(),
		assign = vi.fn();
	const store = {
		widgets: { skills: () => ({ targets: () => [{ id: 'codex', title: 'Codex' }] }) },
	} as unknown as BoardStore;
	render(
		<TestProviders>
			<SkillCard
				store={store}
				entry={{
					name: 'review',
					description: 'Review a change',
					sources: [
						{ kind: 'vault', path: '.codex/skills/review/SKILL.md', agents: ['codex'] },
						{ kind: 'vault', path: '.nand/content/NAND/技能/review/SKILL.md', agents: [] },
					],
				}}
				config={{ groupView: 'kanban' }}
				pinned={false}
				pin={pin}
				detail={detail}
				reveal={() => {}}
				remove={() => {}}
				assign={assign}
			/>
		</TestProviders>,
	);
	expect(screen.getByText('Review a change')).toBeTruthy();
	expect(screen.getByTitle('.codex/skills/review/SKILL.md')).toBeTruthy();
	expect(screen.getByText('F')).toBeTruthy();
	const card = screen.getByRole('button', { name: /review X F/ });
	fireEvent.keyDown(card, { key: 'Enter' });
	expect(detail).toHaveBeenCalledOnce();
	fireEvent.click(screen.getByRole('button', { name: t('skills.pin') }));
	expect(pin).toHaveBeenCalledOnce();
	expect(detail).toHaveBeenCalledOnce();
	fireEvent.click(screen.getByRole('button', { name: t('skills.launch', { agent: 'codex' }) }));
	expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('$review');
});
test('skill invocation previews first and sends the edited prompt through the agent public dispatch port', async () => {
	const dispatch = vi.fn(async (_request: unknown, _options: unknown) => ({ delivery: 'started' }));
	const store = {
		widgets: {
			skills: () => ({ targets: () => [{ id: 'codex', title: 'Codex' }] }),
			acquireDispatch: async () => ({ dispatch }),
		},
		state: { getState: () => ({ path: '.nand/content/dashboard' }) },
	} as unknown as BoardStore;
	render(
		<TestProviders>
			<SkillCard
				store={store}
				entry={{
					name: 'review',
					sources: [{ kind: 'vault', path: '.codex/skills/review/SKILL.md', agents: ['codex'] }],
				}}
				config={{}}
				pinned={false}
				pin={() => {}}
				detail={() => {}}
				reveal={() => {}}
				remove={() => {}}
				assign={() => {}}
			/>
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('skills.launch', { agent: 'codex' }) }));
	expect(dispatch).not.toHaveBeenCalled();
	fireEvent.change(screen.getByRole('textbox'), { target: { value: '$review Verify only the current patch' } });
	fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
	await waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
	expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
		agentId: 'codex',
		finalPrompt: '$review Verify only the current patch',
		destination: { kind: 'fresh', cwd: '' },
	});
});
