import type { ComponentChildren } from 'preact';

export function Badge({ tone, children, label }: { tone?: 'accent' | 'error' | 'success' | 'warning'; children: ComponentChildren; label?: string }) {
	return (
		<span class={`nand-badge${tone ? ` nand-badge--${tone}` : ''}`} aria-label={label}>
			{children}
		</span>
	);
}
