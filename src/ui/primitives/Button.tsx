import type { ComponentChildren, TargetedMouseEvent } from 'preact';
import { Icon } from './Icon';

export interface ButtonProps {
	variant?: 'default' | 'primary' | 'ghost' | 'danger';
	size?: 'sm' | 'md';
	icon?: string;
	type?: 'button' | 'submit';
	disabled?: boolean;
	title?: string;
	className?: string;
	onClick?: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
	children?: ComponentChildren;
}

/** Text button. Use one `primary` per view for its main action. */
export function Button({ variant = 'default', size = 'md', icon, type = 'button', disabled, title, className, onClick, children }: ButtonProps) {
	const classes = ['nand-btn', variant !== 'default' && `nand-btn--${variant}`, size === 'sm' && 'nand-btn--sm', className].filter(Boolean).join(' ');
	return (
		<button type={type} class={classes} disabled={disabled} title={title} onClick={onClick}>
			{icon && <Icon name={icon} />}
			{children}
		</button>
	);
}
