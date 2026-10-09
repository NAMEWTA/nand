import type { ComponentChildren, TargetedKeyboardEvent } from 'preact';
import { Icon } from './Icon';

export interface ListItemProps {
	label: string;
	icon?: string;
	meta?: string;
	active?: boolean;
	title?: string;
	/** Shown on hover/focus in place of `meta` (row menus, quick actions). */
	actions?: ComponentChildren;
	badge?: ComponentChildren;
	role?: 'option' | 'treeitem' | 'listitem' | 'link';
	onSelect: () => void;
	onContextMenu?: (event: MouseEvent) => void;
	onKeyDown?: (event: TargetedKeyboardEvent<HTMLDivElement>) => void;
	itemRef?: (element: HTMLDivElement | null) => void;
	tabIndex?: number;
}

/** A selectable row (side panel and list-detail lists). Enter/Space select it. */
export function ListItem({ label, icon, meta, active, title, actions, badge, role = 'option', onSelect, onContextMenu, onKeyDown, itemRef, tabIndex = 0 }: ListItemProps) {
	return (
		<div
			class={`nand-list-item${active ? ' is-active' : ''}`}
			role={role}
			aria-selected={role === 'option' ? !!active : undefined}
			aria-current={role === 'link' && active ? 'page' : undefined}
			tabIndex={tabIndex}
			title={title}
			ref={itemRef}
			onClick={onSelect}
			onContextMenu={(event) => {
				if (!onContextMenu) return;
				event.preventDefault();
				onContextMenu(event);
			}}
			onKeyDown={(event) => {
				if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
					event.preventDefault();
					onSelect();
					return;
				}
				onKeyDown?.(event);
			}}
		>
			{icon && <Icon name={icon} className="nand-list-item-icon" />}
			<span class="nand-list-item-label">{label}</span>
			{badge}
			{meta && <span class="nand-list-item-meta">{meta}</span>}
			{actions && (
				<span class="nand-list-item-actions" onClick={(event) => event.stopPropagation()}>
					{actions}
				</span>
			)}
		</div>
	);
}
