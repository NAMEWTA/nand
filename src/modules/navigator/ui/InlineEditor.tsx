// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useLayoutEffect, useRef, useState } from 'react';
import { Input } from '../../../ui/components/input';
import { useT } from '../../../ui/react/hooks';
import { nameProblem } from '../core/ops';

/**
 * In-place name editor for a row. Enter or blur commits, Escape cancels; the extension of a file name is
 * not part of the edited text. A failed commit keeps the editor open with the reason.
 */
export function InlineEditor({ initial, ariaLabel, onCommit, onCancel }: {
	initial: string;
	ariaLabel: string;
	onCommit: (name: string) => Promise<void>;
	onCancel: () => void;
}) {
	const t = useT();
	const ref = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState(initial);
	const [error, setError] = useState('');
	const busy = useRef(false);
	const done = useRef(false);

	useLayoutEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);

	const commit = async () => {
		if (busy.current || done.current) return;
		const name = value.trim();
		if (name === initial) {
			done.current = true;
			onCancel();
			return;
		}
		const problem = nameProblem(name, () => false);
		if (problem) {
			setError(t(problem === 'empty' ? 'navigator.nameEmpty' : 'navigator.nameInvalid'));
			return;
		}
		busy.current = true;
		try {
			await onCommit(name);
			done.current = true;
		} catch (cause) {
			setError(cause instanceof Error && cause.message === 'exists' ? t('navigator.nameExists') : cause instanceof Error ? cause.message : String(cause));
			ref.current?.focus();
		} finally {
			busy.current = false;
		}
	};

	return (
		<span className="relative min-w-0 flex-1">
			<Input
				ref={ref}
				value={value}
				aria-label={ariaLabel}
				aria-invalid={!!error}
				title={error || undefined}
				className="h-6 px-1.5 py-0 text-[13px]"
				onChange={(event) => { setValue(event.currentTarget.value); setError(''); }}
				onClick={(event) => event.stopPropagation()}
				onDoubleClick={(event) => event.stopPropagation()}
				onBlur={() => { void commit(); }}
				onKeyDown={(event) => {
					event.stopPropagation();
					if (event.nativeEvent.isComposing) return;
					if (event.key === 'Enter') {
						event.preventDefault();
						void commit();
					} else if (event.key === 'Escape') {
						event.preventDefault();
						done.current = true;
						onCancel();
					}
				}}
			/>
			{error && <span role="alert" className="absolute left-0 top-full z-[var(--layer-menu)] mt-0.5 rounded-md border border-border bg-popover px-1.5 py-0.5 text-[11px] text-destructive shadow-floating">{error}</span>}
		</span>
	);
}
