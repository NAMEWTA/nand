// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationSchedulePicker.tsx, AutomationTimeField.tsx
import { useState } from 'react';
import type { AutomationDefinition, ScheduleSpec } from '../../../../shared/automation/types';
import { systemTimeZone } from '../../core/schedule';
import { Input } from '../../../../ui/components/input';
import { Choice, Field, SearchChoice } from '../parts';
import { useT, useLanguage } from '../../../../ui/react/hooks';
import { CronField } from './CronField';

export interface DraftProps {
	draft: AutomationDefinition;
	onChange: (change: (draft: AutomationDefinition) => void) => void;
}
export function schedulePreset(schedule: ScheduleSpec): string {
	if (schedule.kind !== 'recurring') return schedule.kind;
	const f = schedule.expression.trim().split(/\s+/);
	if (f.length !== 5 || !/^\d+$/.test(f[0]!) || f[2] !== '*' || f[3] !== '*') return 'custom';
	if (f[1] === '*' && f[4] === '*') return 'hourly';
	if (!/^\d+$/.test(f[1]!)) return 'custom';
	return f[4] === '*' ? 'daily' : f[4] === '1-5' ? 'weekdays' : /^[0-6]$/.test(f[4]!) ? 'weekly' : 'custom';
}
export function SchedulePicker({ draft, onChange }: DraftProps) {
	const t = useT(),
		language = useLanguage();
	const [preset, setPreset] = useState(() => schedulePreset(draft.schedule));
	const schedule = draft.schedule;
	const parts = schedule.kind === 'recurring' ? schedule.expression.split(/\s+/) : ['0', '9', '*', '*', '1'];
	const time = `${(parts[1] === '*' ? '9' : (parts[1] ?? '9')).padStart(2, '0')}:${(parts[0] ?? '0').padStart(2, '0')}`;
	const changePart = (index: number, value: string) =>
		onChange((d) => {
			if (d.schedule.kind === 'recurring') {
				const fields = d.schedule.expression.split(/\s+/);
				fields[index] = value;
				d.schedule.expression = fields.join(' ');
			}
		});
	const zones = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
		'timeZone',
	) ?? ['UTC', 'Asia/Shanghai', 'America/New_York', 'Europe/London'];
	const zone = schedule.kind === 'recurring' ? (schedule.timezone ?? systemTimeZone()) : systemTimeZone();
	return (
		<div className="space-y-4">
			<Field label={t('automation.schedule')}>
				{(id) => (
					<Choice
						id={id}
						label={t('automation.schedule')}
						value={preset}
						options={['manual', 'once', 'hourly', 'daily', 'weekdays', 'weekly', 'custom'].map((value) => ({
							value,
							label: t(`automation.${value}`),
						}))}
						onChange={(value) => {
							setPreset(value);
							onChange((d) => {
								d.schedule =
									value === 'manual'
										? { kind: 'manual' }
										: value === 'once'
											? { kind: 'once', at: Date.now() + 3_600_000 }
											: {
													kind: 'recurring',
													expression:
														value === 'hourly'
															? '0 * * * *'
															: value === 'weekdays'
																? '0 9 * * 1-5'
																: value === 'weekly'
																	? '0 9 * * 1'
																	: '0 9 * * *',
													timezone: zone,
													start: Date.now(),
												};
							});
						}}
					/>
				)}
			</Field>
			{schedule.kind === 'once' && (
				<Field label={t('automation.time')}>
					{(id) => (
						<Input
							id={id}
							type="datetime-local"
							value={
								Number.isFinite(schedule.at)
									? new Date(schedule.at - new Date(schedule.at).getTimezoneOffset() * 60_000)
											.toISOString()
											.slice(0, 16)
									: ''
							}
							onChange={(e) =>
								onChange((d) => {
									d.schedule = { kind: 'once', at: new Date(e.target.value).getTime() };
								})
							}
						/>
					)}
				</Field>
			)}
			{schedule.kind === 'recurring' && (
				<>
					{preset === 'hourly' ? (
						<Field label={t('automation.minute')}>
							{(id) => (
								<Input
									id={id}
									type="number"
									min={0}
									max={59}
									value={parts[0]}
									onChange={(e) => changePart(0, e.target.value)}
								/>
							)}
						</Field>
					) : (
						preset !== 'custom' && (
							<Field label={t('automation.clockTime')}>
								{(id) => (
									<Input
										id={id}
										type="time"
										value={time}
										onChange={(e) => {
											const [hour, minute] = e.target.value.split(':');
											onChange((d) => {
												if (d.schedule.kind === 'recurring') {
													const f = d.schedule.expression.split(/\s+/);
													f[0] = String(Number(minute));
													f[1] = String(Number(hour));
													d.schedule.expression = f.join(' ');
												}
											});
										}}
									/>
								)}
							</Field>
						)
					)}
					{preset === 'weekly' && (
						<Field label={t('automation.dayOfWeek')}>
							{(id) => (
								<Choice
									id={id}
									label={t('automation.dayOfWeek')}
									value={parts[4] ?? '1'}
									onChange={(v) => changePart(4, v)}
									options={Array.from({ length: 7 }, (_, day) => ({
										value: String(day),
										label: new Date(Date.UTC(2026, 0, 4 + day)).toLocaleDateString(language, {
											weekday: 'long',
											timeZone: 'UTC',
										}),
									}))}
								/>
							)}
						</Field>
					)}
					<Field label={t('automation.timezone')}>
						{(id) => (
							<SearchChoice
								id={id}
								label={t('automation.timezone')}
								value={zone}
								options={[...new Set([zone, 'UTC', ...zones])].map((value) => ({
									value,
									label: value,
								}))}
								onChange={(v) =>
									onChange((d) => {
										if (d.schedule.kind === 'recurring') d.schedule.timezone = v;
									})
								}
							/>
						)}
					</Field>
					{preset === 'custom' && (
						<CronField
							schedule={schedule}
							onChange={(v) =>
								onChange((d) => {
									if (d.schedule.kind === 'recurring') d.schedule.expression = v;
								})
							}
						/>
					)}
				</>
			)}
		</div>
	);
}
