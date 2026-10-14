// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/appearance.ts
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { BoardStore } from '../../services/board-store';

const Theme = createContext('mono');
const Layout = createContext('side');
export const useDashboardLayout = (): string => useContext(Layout);
export const useDashboardTheme = (): string => useContext(Theme);
export function ThemeBridge({ store, children, layout }: { store: BoardStore; children: ReactNode; layout: string }) {
	const settings = useStore(store.state, (s) => s.settings);
	return (
		<Theme value={settings.stylePreset}>
			<Layout value={layout}>
				<div
					className="nand-dashboard-root flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
					data-theme={settings.stylePreset}
					data-layout={layout}
					data-dashboard-layout={layout}
					data-theme-font={settings.useThemeFont}
				>
					{children}
				</div>
			</Layout>
		</Theme>
	);
}
export function dashboardThemeProps(theme: string) {
	return { 'data-theme': theme, 'data-dashboard-theme': theme, className: 'nand-dashboard-root' };
}
