// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/widget-background.ts
import { p2Classes } from '../theme/p2-classes';
import { type CSSProperties, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { BoardStore } from '../../services/board-store';
import { useImage } from '../board/hooks';

export function useWidgetBackground(
	store: BoardStore,
	kind: string,
): { className: string; style: CSSProperties; layer: ReactNode } {
	const bg = useStore(store.state, (s) =>
		kind === 'quickActions'
			? s.settings.quickActionsBackground
			: kind === 'pomodoro'
				? s.settings.pomodoroBackground
				: kind === 'habit'
					? s.settings.habitBackground
					: kind === 'music'
						? s.settings.musicBackground
						: kind === 'yearProgress'
							? s.settings.yearProgressBackground
							: undefined,
	);
	const url = useImage(store, bg?.image.trim() ?? '');
	if (!bg || !url) return { className: '', style: {}, layer: null };
	const fg =
		bg.foreground === 'light'
			? 'var(--on-image)'
			: bg.foreground === 'dark'
				? 'var(--scrim)'
				: /^#[0-9a-f]{3,8}$/i.test(bg.foreground ?? '')
					? bg.foreground
					: undefined;
	const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
	return {
		className: 'dashboard-sidebar-widget--has-bg relative isolate overflow-hidden',
		style: fg
			? ({
					'--wbg-fg': fg,
					'--db-text': fg,
					'--db-text-muted': `color-mix(in srgb, ${fg} 72%, transparent)`,
					'--db-text-faint': `color-mix(in srgb, ${fg} 50%, transparent)`,
					'--db-accent': fg,
					color: fg,
				} as CSSProperties)
			: {},
		layer: (
			<>
				<div
					aria-hidden
					className="dashboard-widget-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
				>
					<div
						className="absolute inset-0 bg-cover bg-center"
						style={{
							backgroundImage: `url(${JSON.stringify(url)})`,
							opacity: clamp(bg.opacity, 100) / 100,
							filter: `blur(${clamp(bg.blur, 20)}px)`,
							transform: `scale(${1 + clamp(bg.blur, 20) * 0.05})`,
						}}
					/>
					<div className="absolute inset-0 bg-[var(--scrim)]" style={{ opacity: clamp(bg.dim, 100) / 100 }} />
				</div>
				{kind !== 'quickActions' && (
					<div
						aria-hidden
						className="dashboard-widget-frame pointer-events-none absolute inset-[6px] -z-10 rounded-[calc(var(--db-radius-md,10px)-4px)] border border-[color-mix(in_srgb,var(--db-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--db-bg-card)_65%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--on-image)_16%,transparent),0_2px_10px_color-mix(in_srgb,var(--scrim)_14%,transparent)] backdrop-blur-[7px] backdrop-saturate-[1.15]"
					/>
				)}
			</>
		),
	};
}
export function ImmersiveWidgetFrame({
	store,
	kind,
	children,
}: {
	store: BoardStore;
	kind: string;
	children: ReactNode;
}) {
	const background = useWidgetBackground(store, kind);
	return (
		<div
			className={p2Classes(
				`dashboard-sidebar-widget h-full ${kind === 'album' ? 'p-0' : 'p-3'} ${kind === 'music' ? 'dashboard-sidebar-music' : ''} ${background.className}`,
			)}
			style={background.style}
		>
			{background.layer}
			{children}
		</div>
	);
}
