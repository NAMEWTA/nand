// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useRef, useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
export function RenameTitle({
	value,
	onRename,
	className = '',
	immersive = false,
}: {
	value: string;
	onRename(this: void, value: string): Promise<void>;
	className?: string;
	immersive?: boolean;
}) {
	const t = useT(),
		[editing, setEditing] = useState(false),
		[draft, setDraft] = useState(value),
		[error, setError] = useState(''),
		cancelled = useRef(false),
		pending = useRef(false);
	const commit = async () => {
		if (cancelled.current || pending.current || !draft.trim()) return;
		pending.current = true;
		try {
			if (draft.trim() !== value) await onRename(draft.trim());
			setEditing(false);
		} catch (e) {
			setError(String(e));
		} finally {
			pending.current = false;
		}
	};
	if (editing)
		return (
			<div className="min-w-0 flex-1">
				<Input
					autoFocus
					aria-label={t('ui.rename')}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => {
						void commit();
					}}
					onKeyDown={(e) => {
						if (e.nativeEvent.isComposing) return;
						if (e.key === 'Escape') {
							cancelled.current = true;
							setEditing(false);
						}
						if (e.key === 'Enter') {
							e.preventDefault();
							void commit();
						}
					}}
				/>
				{error && <p role="alert">{error}</p>}
			</div>
		);
	return (
		<Button
			data-grid-action={immersive ? 'move' : undefined}
			variant="ghost"
			size="xs"
			className={`h-auto min-w-0 justify-start truncate p-0 text-[length:inherit] font-[inherit] leading-[inherit] text-inherit ${className}`}
			onDoubleClick={() => {
				cancelled.current = false;
				setDraft(value);
				setEditing(true);
			}}
			onKeyDown={(e) => {
				if (e.key === 'F2' || (e.key === 'Enter' && !immersive)) {
					e.preventDefault();
					cancelled.current = false;
					setDraft(value);
					setEditing(true);
				}
			}}
		>
			{value}
		</Button>
	);
}
