import type { TargetedKeyboardEvent } from 'preact';
import { useId } from 'preact/hooks';
import type { WorkbenchFeature } from '../app/contracts/workbench';
import { t } from '../shared/i18n';
import { IconButton } from '../ui/primitives/IconButton';

export interface RailItem {
	id: WorkbenchFeature;
	label: string;
	icon: string;
	slot: 'top' | 'bottom';
	badge?: number;
	/** The module failed to start; shown with a warning dot. */
	failed?: boolean;
}

export interface RailProps {
	items: readonly RailItem[];
	current: WorkbenchFeature;
	panelOpen: boolean;
	onSelect: (id: WorkbenchFeature) => void;
	orientation?: 'vertical' | 'horizontal';
}

/** Column 1: one icon per module. Up/Down (or Left/Right) move focus; Home/End jump to the ends. */
export function Rail({ items, current, panelOpen, onSelect, orientation = 'vertical' }: RailProps) {
	const labelId = useId();
	const ordered = [...items.filter((item) => item.slot === 'top'), ...items.filter((item) => item.slot === 'bottom')];
	const move = (event: TargetedKeyboardEvent<HTMLButtonElement>, index: number) => {
		const next = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: ordered.length - 1 }[event.key];
		if (next === undefined) return;
		if (orientation === 'vertical' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
		event.preventDefault();
		const buttons = event.currentTarget.closest('.nand-rail')?.querySelectorAll<HTMLButtonElement>('button.nand-rail-button');
		buttons?.[(next + ordered.length) % ordered.length]?.focus();
	};
	const button = (item: RailItem) => {
		const index = ordered.indexOf(item);
		const active = item.id === current;
		return (
			<div class={`nand-rail-item${active ? ' is-active' : ''}`} key={item.id} data-feature={item.id}>
				<IconButton
					icon={item.icon}
					label={item.label}
					className="nand-rail-button"
					active={active}
					ariaCurrent={active ? 'page' : undefined}
					ariaExpanded={active ? panelOpen : undefined}
					tooltipPlacement={orientation === 'vertical' ? 'right' : 'bottom'}
					tabIndex={active ? 0 : -1}
					onClick={() => onSelect(item.id)}
					onKeyDown={(event) => move(event, index)}
				/>
				{!!item.badge && <span class="nand-rail-badge" aria-label={t('workbench.unreadCount', { count: item.badge })}>{item.badge > 99 ? '99+' : item.badge}</span>}
				{item.failed && <span class="nand-rail-warning" aria-label={t('workbench.moduleFailed')} />}
			</div>
		);
	};
	return (
		<nav class={`nand-rail nand-rail--${orientation}`} aria-labelledby={labelId}>
			<span class="nand-visually-hidden" id={labelId}>{t('workbench.navigation')}</span>
			<div class="nand-rail-group">{ordered.filter((item) => item.slot === 'top').map(button)}</div>
			<div class="nand-rail-group nand-rail-group--bottom">{ordered.filter((item) => item.slot === 'bottom').map(button)}</div>
		</nav>
	);
}
