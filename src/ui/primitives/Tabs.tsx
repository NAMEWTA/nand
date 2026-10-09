import type { TargetedKeyboardEvent } from 'preact';
import { useId } from 'preact/hooks';

export interface TabItem {
	id: string;
	label: string;
}

export interface TabsProps {
	items: readonly TabItem[];
	selected: string;
	label: string;
	onSelect: (id: string) => void;
	className?: string;
}

/** Pill tabs with roving focus (Left/Right/Home/End). */
export function Tabs({ items, selected, label, onSelect, className }: TabsProps) {
	const labelId = useId();
	const move = (event: TargetedKeyboardEvent<HTMLButtonElement>, index: number) => {
		const last = items.length - 1;
		const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
			: event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
				: event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
		if (next < 0) return;
		event.preventDefault();
		const target = items[next];
		if (!target) return;
		onSelect(target.id);
		event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
	};
	return (
		<div class={`nand-tabs${className ? ` ${className}` : ''}`} role="tablist" aria-labelledby={labelId}>
			<span class="nand-visually-hidden" id={labelId}>{label}</span>
			{items.map((item, index) => (
				<button
					type="button"
					role="tab"
					key={item.id}
					aria-selected={item.id === selected}
					tabIndex={item.id === selected ? 0 : -1}
					onClick={() => onSelect(item.id)}
					onKeyDown={(event) => move(event, index)}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}
