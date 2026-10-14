// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationSessionField.tsx
import { useEffect, useState } from 'react';
import type { AgentSessionRef } from '../../../../shared/automation/types';
import type { AutomationsApi } from '../../core/api';
import { SegmentedControl } from '../../../../ui/components/nand/SegmentedControl';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { Field, SearchChoice } from '../parts';
import type { DraftProps } from './SchedulePicker';
export function SessionField({ draft, onChange, service }: DraftProps & { service: AutomationsApi }) {
	const t = useT(),
		action = draft.action;
	const [sessions, setSessions] = useState<AgentSessionRef[]>([]),
		[error, setError] = useState(''),
		[loadedKey, setLoadedKey] = useState(''),
		[refresh, setRefresh] = useState(0);
	const agentId = action.kind === 'agent' ? action.agentId : '',
		cwd = action.kind === 'agent' ? action.cwd : '',
		specific = action.kind === 'agent' && action.sessionMode === 'specific';
	const loadKey = `${agentId}:${cwd}:${refresh}`,
		loading = specific && loadKey !== loadedKey;
	useEffect(() => {
		if (!specific) return;
		let disposed = false;
		void (service.agent()?.listSessions(cwd) ?? Promise.resolve([]))
			.then(
				(rows) => {
					if (!disposed) {
						setSessions(rows.filter((row) => row.agentId === agentId));
						setError('');
					}
				},
				(e) => {
					if (!disposed) setError(String(e));
				},
			)
			.finally(() => {
				if (!disposed) setLoadedKey(loadKey);
			});
		return () => {
			disposed = true;
		};
	}, [agentId, cwd, specific, service, loadKey]);
	if (action.kind !== 'agent') return null;
	return (
		<Field label={t('automation.sessionMode')}>
			{(id) => (
				<div id={id} className="space-y-2">
					<SegmentedControl
						ariaLabel={t('automation.sessionMode')}
						value={action.sessionMode}
						options={(['fresh', 'reuse', 'specific'] as const).map((value) => ({
							value,
							label: t(`automation.${value}`),
						}))}
						onChange={(value) =>
							onChange((d) => {
								if (d.action.kind === 'agent') {
									d.action.sessionMode = value;
									if (value === 'reuse') d.action.extraArgs = '';
								}
							})
						}
					/>
					{specific && (
						<>
							<SearchChoice
								label={t('automation.sessions')}
								disabled={loading}
								value={action.session ? `${action.session.sessionId}:${action.session.accountKey}` : ''}
								options={sessions.map((row) => ({
									value: `${row.sessionId}:${row.accountKey}`,
									label: row.title || row.sessionId,
								}))}
								onChange={(value) =>
									onChange((d) => {
										if (d.action.kind === 'agent') {
											const session = sessions.find(
												(row) => `${row.sessionId}:${row.accountKey}` === value,
											);
											if (session) {
												d.action.session = session;
												d.action.cwd = session.cwd;
											}
										}
									})
								}
							/>
							<Button
								variant="ghost"
								size="sm"
								disabled={loading}
								onClick={() => setRefresh((v) => v + 1)}
							>
								{t('automation.loadSessions')}
							</Button>
							{!loading && !sessions.length && (
								<p className="text-xs text-muted-foreground">{t('automation.noSessions')}</p>
							)}
							{error && (
								<p role="alert" className="text-xs text-destructive">
									{error}
								</p>
							)}
						</>
					)}
				</div>
			)}
		</Field>
	);
}
