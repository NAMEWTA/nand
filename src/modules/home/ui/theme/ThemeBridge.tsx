// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/appearance.ts
import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { immersiveClasses } from './immersive-classes';
import { applyAppearance } from '../appearance/appearance';
import type { HomeHost } from '../../services/home-host';
import type { DashboardSettings } from '../../core/board/types';
import type { BoardStore } from '../../services/board-store';

const Appearance = createContext<{ host: HomeHost; settings: DashboardSettings } | null>(null);
/** Decor overrides only (background image, blur, opacity, radius); colors come from NAND's global tokens. */
export function useDashboardAppearance(mirrorBoard = false) {
	const value = useContext(Appearance),
		ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || !value) return;
		el.dataset.themeFont = String(value.settings.useThemeFont);
		const root = mirrorBoard
			? [...el.ownerDocument.querySelectorAll<HTMLElement>('.nand-dashboard-root[data-layout]')].find(
					(node) => node !== el && node.getBoundingClientRect().width > 0,
				)
			: undefined;
		const refresh = () => {
			el.querySelectorAll(':scope > .nand-dashboard-bg').forEach((node) => node.remove());
			applyAppearance(el, value.host.app, value.settings);
			const computed = root && el.ownerDocument.defaultView?.getComputedStyle(root);
			if (computed) {
				for (const name of ['--db-radius-sm', '--db-radius-md', '--db-radius-lg', '--db-backdrop-blur'])
					if (root.style.getPropertyValue(name)) el.style.setProperty(name, computed.getPropertyValue(name));
			}
		};
		refresh();
		// Live appearance edits rewrite the board root's inline overrides while a portal stays open.
		const observer =
			root && el.ownerDocument.defaultView
				? new el.ownerDocument.defaultView.MutationObserver(refresh)
				: undefined;
		if (root) observer?.observe(root, { attributes: true, attributeFilter: ['style'] });
		return () => {
			observer?.disconnect();
			el.querySelectorAll(':scope > .nand-dashboard-bg').forEach((node) => node.remove());
		};
	}, [value, mirrorBoard]);
	return ref;
}
export type DashboardLayoutKind = 'canvas' | 'mobile';
const Layout = createContext<string>('canvas');
export const useDashboardLayout = (): string => useContext(Layout);
export function ThemeBridge({ store, children, layout }: { store: BoardStore; children: ReactNode; layout: string }) {
	const settings = useStore(store.state, (s) => s.settings);
	return (
		<Appearance value={{ host: store.host, settings }}>
			<Layout value={layout}>
				<AppearanceRoot
					className={`nand-dashboard-root relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground ${immersiveClasses}`}
					data-layout={layout}
					data-dashboard-layout={layout}
					data-theme-font={settings.useThemeFont}
				>
					{children}
				</AppearanceRoot>
			</Layout>
		</Appearance>
	);
}

function AppearanceRoot(props: import('react').ComponentProps<'div'>) {
	const ref = useDashboardAppearance();
	return <div {...props} ref={ref} />;
}

export function DashboardAppearanceProvider({
	host,
	settings,
	children,
}: {
	host: HomeHost;
	settings: DashboardSettings;
	children: ReactNode;
}) {
	return <Appearance value={{ host, settings }}>{children}</Appearance>;
}
