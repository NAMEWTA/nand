import { setIcon } from 'obsidian';

/** Obsidian owns the SVG content; Preact owns the surrounding element. */
export function Icon({ name, className }: { name: string; className?: string }) {
	return (
		<span
			aria-hidden="true"
			class={className}
			ref={(element) => {
				if (element) setIcon(element, name);
			}}
		/>
	);
}
