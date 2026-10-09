import { setTooltip } from 'obsidian';
import type { TargetedKeyboardEvent, TargetedMouseEvent } from 'preact';
import { Icon } from './Icon';

export interface IconButtonProps {
	icon: string;
	/** Accessible name and tooltip. */
	label: string;
	size?: 'sm' | 'md';
	active?: boolean;
	/** Toggle buttons expose their state with aria-pressed. */
	pressed?: boolean;
	disabled?: boolean;
	className?: string;
	tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
	onClick?: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
	onKeyDown?: (event: TargetedKeyboardEvent<HTMLButtonElement>) => void;
	buttonRef?: (element: HTMLButtonElement | null) => void;
	tabIndex?: number;
	ariaCurrent?: 'page' | 'true';
	ariaExpanded?: boolean;
}

/** Icon-only button with an accessible name and Obsidian tooltip. */
export function IconButton({ icon, label, size = 'md', active, pressed, disabled, className, tooltipPlacement = 'bottom', onClick, onKeyDown, buttonRef, tabIndex, ariaCurrent, ariaExpanded }: IconButtonProps) {
	const classes = ['nand-icon-btn', size === 'sm' && 'nand-icon-btn--sm', active && 'is-active', className].filter(Boolean).join(' ');
	return (
		<button
			type="button"
			class={classes}
			aria-label={label}
			aria-pressed={pressed}
			aria-current={ariaCurrent}
			aria-expanded={ariaExpanded}
			disabled={disabled}
			tabIndex={tabIndex}
			onClick={onClick}
			onKeyDown={onKeyDown}
			ref={(element) => {
				if (element) setTooltip(element, label, { placement: tooltipPlacement });
				buttonRef?.(element);
			}}
		>
			<Icon name={icon} />
		</button>
	);
}
