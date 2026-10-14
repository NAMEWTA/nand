import { useRef, useState } from 'react';
import { Input } from '../input';
import { Button } from '../button';
import { useT } from '../../react/hooks';
export function InlineRename({
	value,
	onRename,
	label,
	disabled,
}: {
	value: string;
	onRename: (value: string) => void | Promise<void>;
	label?: string;
	disabled?: boolean;
}) {
	const t = useT();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const saving = useRef(false);
	const cancelled = useRef(false);
	const commit = async () => {
		if (saving.current || cancelled.current) return;
		const next = draft.trim();
		if (!next) {
			setError(t('ui.invalid'));
			return;
		}
		if (next === value) {
			setEditing(false);
			return;
		}
		saving.current = true;
		setBusy(true);
		try {
			await onRename(next);
			setEditing(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			saving.current = false;
			setBusy(false);
		}
	};
	if (!editing)
		return (
			<Button
				variant="ghost"
				disabled={disabled}
				aria-label={label ?? t('ui.rename')}
				onClick={() => {
					cancelled.current = false;
					setDraft(value);
					setError('');
					setEditing(true);
				}}
			>
				{value}
			</Button>
		);
	return (
		<div className="space-y-1">
			<Input
				autoFocus
				aria-label={label ?? t('ui.rename')}
				value={draft}
				disabled={busy}
				aria-invalid={!!error}
				onChange={(e) => setDraft(e.currentTarget.value)}
				onBlur={() => {
					void commit();
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						void commit();
					}
					if (e.key === 'Escape') {
						cancelled.current = true;
						setEditing(false);
					}
				}}
			/>
			{error && (
				<p role="alert" className="text-xs text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
