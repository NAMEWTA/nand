import { useEffect, useState } from 'react';
import type { AgentSessionSummary } from '../../../agent/api';
import type { SkillShortcut } from '../../core/board/types/model';
import { homeServices } from '../../services/instances';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/components/button';
import { TextField } from '../skills/PromptField';

export function useSkillAgents() {
	const [revision, refresh] = useState(0);
	useEffect(() => homeServices.watchAgents?.(() => refresh((value) => value + 1)), []);
	return { agents: homeServices.agents?.() ?? [], revision };
}

/** A missing saved session remains selected and visible, never becomes a fresh target. */
export function SkillTarget({
	agentId,
	value,
	change,
	validity,
}: {
	agentId: string;
	value: SkillShortcut['destination'];
	change(this: void, value: SkillShortcut['destination']): void;
	validity?(this: void, valid: boolean): void;
}) {
	const { revision } = useSkillAgents();
	const [refresh, setRefresh] = useState(0);
	const [result, setSessions] = useState<{
		agentId: string;
		revision: number;
		refresh: number;
		rows: AgentSessionSummary[];
	} | null>(null);
	const sessions =
		result?.agentId === agentId && result.revision === revision && result.refresh === refresh ? result.rows : [];
	const loading = !(result?.agentId === agentId && result.revision === revision && result.refresh === refresh);
	useEffect(() => {
		let closed = false;
		void (homeServices.sessions?.()?.list() ?? Promise.resolve([])).then(
			(list) => {
				if (!closed)
					setSessions({ agentId, revision, refresh, rows: list.filter((row) => row.agentId === agentId) });
			},
			() => {
				if (!closed) setSessions({ agentId, revision, refresh, rows: [] });
			},
		);
		return () => {
			closed = true;
		};
	}, [agentId, revision, refresh]);
	const valid = value.kind === 'fresh' || (!loading && sessions.some((row) => row.id === value.sessionId));
	useEffect(() => validity?.(valid), [valid, validity]);
	return (
		<div className="flex flex-col gap-3">
			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">{t('home.skills.destination')}</span>
				<select
					value={value.kind}
					onChange={(event) =>
						change(
							event.currentTarget.value === 'fresh'
								? { kind: 'fresh', cwd: '' }
								: { kind: 'existing', sessionId: '' },
						)
					}
				>
					<option value="fresh">{t('home.skills.fresh')}</option>
					<option value="existing">{t('home.skills.existing')}</option>
				</select>
			</label>
			{value.kind === 'fresh' ? (
				<TextField
					label={t('home.skills.cwd')}
					hint={t('home.skills.cwdHint')}
					value={value.cwd}
					onInput={(cwd) => change({ kind: 'fresh', cwd })}
				/>
			) : (
				<>
					<label className="flex flex-col gap-1">
						<span className="text-sm font-medium">{t('home.skills.session')}</span>
						<select
							value={value.sessionId}
							onChange={(event) => change({ kind: 'existing', sessionId: event.currentTarget.value })}
						>
							<option value="">{t('home.skills.chooseSession')}</option>
							{value.sessionId && !sessions.some((row) => row.id === value.sessionId) && (
								<option value={value.sessionId}>{t('home.skills.sessionMissing')}</option>
							)}
							{sessions.map((row) => (
								<option key={row.id} value={row.id}>
									{row.title}
								</option>
							))}
						</select>
					</label>
					<Button disabled={loading} onClick={() => setRefresh((value) => value + 1)}>
						{t('home.skills.refreshSessions')}
					</Button>
					{!valid && <p role="status">{t('home.skills.sessionMissing')}</p>}
				</>
			)}
		</div>
	);
}
