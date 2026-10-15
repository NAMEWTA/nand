// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.; shadcn/ui (MIT).
// Original: src/renderer/src/components/ui/input.tsx
import * as React from 'react';

import { cn } from '../lib/utils';
import { useImeTextFieldProps } from '../react/ime';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
	({ className, type, ...props }, ref) => {
		const imeProps = useImeTextFieldProps<HTMLInputElement>(props);
		return (
			<input
				ref={ref}
				type={type}
				data-slot="input"
				className={cn(
					'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[transform,opacity] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
					'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
					'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
					className,
				)}
				{...props}
				{...imeProps}
			/>
		);
	},
);

Input.displayName = 'Input';

export { Input };
