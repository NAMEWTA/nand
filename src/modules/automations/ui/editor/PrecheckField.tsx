// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationPrecheckFields.tsx
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import { Field, Choice } from '../parts';
import type { DraftProps } from './SchedulePicker';
export function PrecheckField({ draft, onChange }: DraftProps) {
	const t = useT();
	return (
		<div className="space-y-3">
			<Field label={t('automation.precheck')} help={t('automation.precheckHelp')}>
				{(id) => (
					<Input
						id={id}
						className="font-mono text-xs"
						value={draft.precheck?.command ?? ''}
						onChange={(e) =>
							onChange((d) => {
								d.precheck = e.target.value
									? { command: e.target.value, shell: d.precheck?.shell ?? 'bash' }
									: undefined;
							})
						}
					/>
				)}
			</Field>
			{draft.precheck && (
				<Choice
					label={t('automation.precheckShell')}
					value={draft.precheck.shell}
					options={[
						{ value: 'bash', label: 'Bash' },
						{ value: 'powershell', label: 'PowerShell' },
					]}
					onChange={(value) =>
						onChange((d) => {
							if (d.precheck) d.precheck.shell = value as 'bash' | 'powershell';
						})
					}
				/>
			)}
		</div>
	);
}
