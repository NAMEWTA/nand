// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useEffect, useRef } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../ui/components/resizable';
import { cn } from '../../../ui/lib/utils';
import { useOwnerWindow } from '../../../ui/react/hooks';
import { ListPane } from './ListPane';
import { NavPane } from './NavPane';
import { useEnv, useNavigatorSettings } from './hooks';

/** Dual-pane layout (resizable, side by side or stacked) or a single pane that slides between navigation and list. */
export function NavigatorRoot() {
	const env = useEnv();
	const settings = useNavigatorSettings(env.service);
	return (
		<div className="h-full min-h-0 bg-sidebar text-sidebar-foreground" data-navigator-root>
			{settings.layout === 'single' ? <SinglePane view={settings.singleView} /> : <DualPane />}
		</div>
	);
}

function DualPane() {
	const env = useEnv();
	const settings = useNavigatorSettings(env.service);
	const win = useOwnerWindow();
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => win.clearTimeout(timer.current), [win]);
	const persist = (sizes: number[]) => {
		const size = sizes[0];
		if (size === undefined || Math.abs(size - env.service.settings.get().navSize) < 0.5) return;
		win.clearTimeout(timer.current);
		timer.current = win.setTimeout(() => {
			void env.service.settings.update((draft) => { draft.navSize = Math.round(size * 10) / 10; }).catch(env.report);
		}, 250);
	};
	return (
		<ResizablePanelGroup key={settings.orientation} direction={settings.orientation} onLayout={persist}>
			<ResizablePanel id="navigator-nav" order={1} defaultSize={settings.navSize} minSize={settings.orientation === 'horizontal' ? 25 : 15}>
				<NavPane />
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel id="navigator-list" order={2} minSize={settings.orientation === 'horizontal' ? 30 : 20}>
				<ListPane />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

function SinglePane({ view }: { view: 'nav' | 'list' }) {
	const slide = 'absolute inset-0 transition-transform duration-(--anim-duration-moderate) motion-reduce:transition-none';
	return (
		<div className="relative h-full overflow-hidden">
			<div className={cn(slide, view === 'nav' ? 'translate-x-0' : '-translate-x-full')} inert={view !== 'nav'}>
				<NavPane />
			</div>
			<div className={cn(slide, view === 'list' ? 'translate-x-0' : 'translate-x-full')} inert={view !== 'list'}>
				<ListPane />
			</div>
		</div>
	);
}
