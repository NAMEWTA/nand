import { useLayoutEffect, useRef } from 'react';
import { setIcon } from 'obsidian';
import { cn } from '../../lib/utils';
export function ObsidianIcon({ name, className, label }: { name: string; className?: string; label?: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		setIcon(el, name);
		return () => el.replaceChildren();
	}, [name]);
	return (
		<span
			ref={ref}
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn('inline-flex size-4 shrink-0 [&_svg]:size-full', className)}
		/>
	);
}
