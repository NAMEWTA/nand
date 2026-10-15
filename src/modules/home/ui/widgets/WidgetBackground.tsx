// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/widget-background.ts
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
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
					: kind === 'yearProgress'
						? s.settings.yearProgressBackground
						: undefined,
	);
	const url = useImage(store, bg?.image.trim() ?? '');
	if (!bg || !url) return { className: '', style: {}, layer: null };
	const fg =
		bg.foreground === 'light'
			? '#ffffff'
			: bg.foreground === 'dark'
				? '#111111'
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
					<div className="absolute inset-0 bg-black" style={{ opacity: clamp(bg.dim, 100) / 100 }} />
				</div>
				{kind !== 'quickActions' && (
					<div
						aria-hidden
						className="dashboard-widget-frame pointer-events-none absolute inset-[6px] -z-10 rounded-[calc(var(--db-radius-md,10px)-4px)] border border-[color-mix(in_srgb,var(--db-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--db-bg-card)_65%,transparent)] shadow-[inset_0_1px_0_rgb(255_255_255/.16),0_2px_10px_rgb(0_0_0/.14)] backdrop-blur-[7px] backdrop-saturate-[1.15]"
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
	const background = useWidgetBackground(store, kind),
		ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const title = ref.current?.querySelector<HTMLElement>(
			'h3, .dashboard-sidebar-anniversary-title, .dashboard-sidebar-year-progress-header',
		);
		if (!title) return;
		const previous = ['data-grid-action', 'tabindex', 'role'].map(
			(name) => [name, title.getAttribute(name)] as const,
		);
		title.dataset.gridAction = 'move';
		title.tabIndex = 0;
		title.setAttribute('role', 'button');
		return () => {
			for (const [name, value] of previous) {
				if (value === null) title.removeAttribute(name);
				else title.setAttribute(name, value);
			}
		};
	}, [kind]);
	return (
		<div ref={ref} className={`dashboard-sidebar-widget p-3 ${background.className}`} style={background.style}>
			{background.layer}
			{children}
		</div>
	);
}
