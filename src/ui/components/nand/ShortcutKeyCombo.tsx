// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: components/ShortcutKeyCombo.tsx
// Original: src/renderer/src/components/ShortcutKeyCombo.tsx
import React from 'react';
import { cn } from '../../lib/utils';
import { Platform } from 'obsidian';

function KeyCap({ label, className }: { label: string; className?: string }): React.JSX.Element {
	return (
		<span
			className={cn(
				'inline-flex min-w-6 items-center justify-center rounded border border-border/80 bg-secondary/70 px-1.5 py-0.5 text-xs font-medium text-muted-foreground shadow-xs',
				className,
			)}
		>
			{label}
		</span>
	);
}

type ShortcutKeyComboProps = {
	keys: string[];
	className?: string;
	separatorClassName?: string;
	// Override cap colors when chips sit on a non-default surface (e.g. a filled primary card).
	keyCapClassName?: string;
	// When true the chips render a double-tap gesture: no "+" separator (reads
	// "Shift Shift"), with a title clarifying the gesture. Note: the title uses
	// the displayed label, so on Mac it reads as the glyph (e.g. 'Double-tap ⇧').
	doubleTap?: boolean;
};

export function ShortcutKeyCombo({
	keys,
	className,
	separatorClassName,
	keyCapClassName,
	doubleTap = false,
}: ShortcutKeyComboProps): React.JSX.Element {
	const isMac = Platform.isMacOS;

	return (
		<span className={cn('inline-flex items-center gap-1', className)}>
			{keys.map((key, index) => (
				<React.Fragment key={`${key}-${index}`}>
					<KeyCap
						label={
							isMac
								? ({ Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' }[key] ?? key)
								: key === 'Mod'
									? 'Ctrl'
									: key
						}
						className={keyCapClassName}
					/>
					{/* Why: Orca renders Mac shortcuts as adjacent glyphs, but Windows/Linux
              shortcuts read more naturally with explicit "+" separators. A
              double-tap reads as the same key twice, so it gets a space, not "+". */}
					{!isMac && !doubleTap && index < keys.length - 1 ? (
						<span className={separatorClassName ?? 'mx-0.5 text-xs text-muted-foreground'}>+</span>
					) : null}
				</React.Fragment>
			))}
		</span>
	);
}
