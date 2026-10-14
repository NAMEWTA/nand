// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationCustomCronPanel.tsx
import { useState } from 'react';
import type { ScheduleSpec } from '../../../../shared/automation/types';
import { nextOccurrence } from '../../core/schedule';
import { Input } from '../../../../ui/components/input';
import { Field } from '../parts';
import { useT, useLanguage } from '../../../../ui/react/hooks';
export function CronField({
	schedule,
	onChange,
}: {
	schedule: Extract<ScheduleSpec, { kind: 'recurring' }>;
	onChange: (expression: string) => void;
}) {
	const t = useT(),
		language = useLanguage(),
		[now] = useState(Date.now);
	let error = '',
		times: number[] = [];
	try {
		let after = now;
		for (let i = 0; i < 3; i++) {
			const next = nextOccurrence(schedule, after);
			if (next === null) break;
			times.push(next);
			after = next;
		}
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	return (
		<Field label={t('automation.expression')}>
			{(id) => (
				<>
					<Input
						id={id}
						className="font-mono text-xs"
						value={schedule.expression}
						onChange={(e) => onChange(e.target.value)}
						aria-invalid={!!error}
						aria-describedby={`${id}-preview`}
					/>
					<div
						id={`${id}-preview`}
						className="text-xs text-muted-foreground"
						role={error ? 'alert' : 'status'}
					>
						{error || (
							<>
								{t('automation.nextThree')}
								<ul className="mt-1 space-y-1">
									{times.map((time) => (
										<li key={time}>
											{new Date(time).toLocaleString(language, { timeZone: schedule.timezone })}
										</li>
									))}
								</ul>
							</>
						)}
					</div>
				</>
			)}
		</Field>
	);
}
