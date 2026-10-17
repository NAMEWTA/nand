// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/app-shell/AppWorkspaceShell.tsx
import {
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type Ref,
	type RefObject,
	type KeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import type {
	PageChrome,
	PanelModel,
	StatusSegment,
	WorkbenchFeature,
	WorkbenchTarget,
} from '../app/contracts/workbench';
import { t } from '../shared/i18n';
import { Button } from '../ui/components/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/components/sheet';
import { layoutFor, type ShellLayout } from './layout';
import { overlayAfterRail } from './rail-overlay';
import { PANEL_DEFAULT, panelWidth, PANEL_MAX, PANEL_MIN, type WorkbenchState } from './navigation-state';
import { PageHeader } from './page/PageHeader';
import { PageFrame } from './page/PageFrame';
import { PageSlot } from './page/PageSlot';
import { ResourceTabs, type ResourceTabsProps } from './page/ResourceTabs';
import { Rail, type RailItem } from './rail/Rail';
import { SidePanel } from './panel/SidePanel';
import { ShellInteractionContext } from './interaction-lifetime';
export interface ShellProps {
	visible?: boolean;
	state: WorkbenchState;
	rail: readonly RailItem[];
	railCurrent?: WorkbenchFeature;
	title: string;
	panelTitle: string;
	panel?: PanelModel;
	navigationContext?: boolean;
	chrome?: PageChrome;
	tabs?: ResourceTabsProps;
	statuses: readonly StatusSegment[];
	busy: boolean;
	error?: string;
	unavailable?: { message: string; action?: { label: string; run: () => void } };
	ownerWindow: Window;
	phone: boolean;
	mobile?: boolean;
	onRail: (feature: WorkbenchFeature) => 'toggled' | 'navigated';
	onOpen: (feature: WorkbenchFeature, placement: 'tab' | 'split') => void;
	onNavigate: (target: WorkbenchTarget) => void;
	onPanelOpen: (open: boolean) => void;
	onPanelWidth: (width: number) => void;
	openInWorkbench?: () => void;
	more: (event: MouseEvent) => void;
	retry: () => void;
	report: (error: unknown) => void;
	contentRef: Ref<HTMLDivElement>;
	panelCustomRef: Ref<HTMLDivElement>;
	navigationActions?: RefObject<{ open: () => void; toggle: () => void } | null>;
}
export function cycleRegion(event: KeyboardEvent, regions: HTMLElement[], active: Element | null) {
	if (event.defaultPrevented || event.key !== 'F6' || !regions.length) return;
	const index = regions.findIndex((region) => region.contains(active));
	const next =
		regions[
			(index < 0
				? event.shiftKey
					? regions.length - 1
					: 0
				: index + (event.shiftKey ? -1 : 1) + regions.length) % regions.length
		];
	event.preventDefault();
	(
		next?.querySelector<HTMLElement>('[tabindex="0"], button:not([disabled]), input:not([disabled])') ?? next
	)?.focus();
}
export function ShellRoot(props: ShellProps) {
	const visible = props.visible !== false;
	const lifetime = useRef({ visible, generation: 0 });
	const [generation, setGeneration] = useState(0);
	const canRestoreFocus = () => lifetime.current.visible && lifetime.current.generation === generation;
	const root = useRef<HTMLDivElement>(null);
	const overlayRoot = useRef<HTMLDivElement>(null);
	const [bounds, setBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
	const [layout, setLayout] = useState<ShellLayout>('wide');
	const [overlay, setOverlay] = useState(false);
	const returnFocus = useRef<HTMLElement | null>(null);
	const [previousVisible, setPreviousVisible] = useState(visible);
	if (previousVisible !== visible) {
		setPreviousVisible(visible);
		if (!visible) {
			setOverlay(false);
			setGeneration(generation + 1);
		}
	}
	useLayoutEffect(() => {
		lifetime.current = { visible, generation };
		if (!visible) returnFocus.current = null;
	}, [visible, generation]);
	const { state } = props;
	const hasPanel = !!props.panel || !!props.navigationContext;
	const inline = layout === 'wide' && !state.focus;
	const overlayOpen = visible && !inline && !state.focus && overlay;
	const panelVisible = hasPanel && !state.focus && (inline ? state.panelOpen : overlayOpen);
	useLayoutEffect(() => {
		const el = root.current;
		const Observer = (props.ownerWindow as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
		if (!el || !Observer) return;
		const measure = () => {
			const rect = el.getBoundingClientRect();
			setBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
			const next = layoutFor(rect.width, props.phone);
			setLayout(next);
			if (next === 'wide') setOverlay(false);
		};
		const observer = new Observer(measure);
		observer.observe(el);
		measure();
		return () => observer.disconnect();
	}, [props.ownerWindow, props.phone]);
	const toggle = () => {
		if (!visible || state.focus) return;
		if (inline) {
			if (hasPanel) props.onPanelOpen(!state.panelOpen);
		} else {
			if (!overlay) returnFocus.current = root.current?.ownerDocument.activeElement as HTMLElement | null;
			setOverlay(!overlay);
		}
	};
	const open = () => {
		if (!visible || state.focus) return;
		if (inline) {
			if (hasPanel) props.onPanelOpen(true);
		} else {
			returnFocus.current = root.current?.ownerDocument.activeElement as HTMLElement | null;
			setOverlay(true);
		}
	};
	useImperativeHandle(props.navigationActions, () => ({ open, toggle }));
	const selectRail = (feature: WorkbenchFeature) => {
		const result = props.onRail(feature);
		const next = overlayAfterRail(layout, inline, result, overlay);
		if (next === 'toggle') {
			if (hasPanel) toggle();
		} else setOverlay(next);
	};
	const navigate = (target: WorkbenchTarget) => {
		setOverlay(false);
		props.onNavigate(target);
	};
	const openLeaf = (feature: WorkbenchFeature, placement: 'tab' | 'split') => {
		returnFocus.current = null;
		// Unmount menus and the Sheet (including exit animations) before activating another leaf.
		// A generation also invalidates deferred Radix close-autofocus callbacks.
		flushSync(() => {
			setOverlay(false);
			setGeneration(generation + 1);
		});
		props.onOpen(feature, placement);
	};
	const rail = (
		<Rail
			key={`rail-${generation}`}
			items={props.rail}
			current={props.railCurrent ?? state.target.feature}
			panelOpen={panelVisible}
			onSelect={selectRail}
			onOpen={openLeaf}
		/>
	);
	const panel = (close?: () => void) => (
		<SidePanel
			key={`${state.target.feature}-${generation}`}
			title={props.panelTitle}
			custom={props.navigationContext && !props.panel}
			model={props.panel}
			current={state.target}
			customRef={props.panelCustomRef}
			onNavigate={navigate}
			onClose={close}
			report={props.report}
		/>
	);
	const resize = useRef<{ x: number; width: number; current: number } | null>(null);
	const keyboard = (event: KeyboardEvent) => {
		const scope = overlayOpen ? overlayRoot.current : root.current;
		cycleRegion(
			event,
			[...(scope?.querySelectorAll<HTMLElement>('[data-shell-region]') ?? [])],
			scope?.ownerDocument.activeElement ?? null,
		);
	};
	return (
		<ShellInteractionContext value={canRestoreFocus}>
			<div
				ref={root}
				data-layout={layout}
				className={`nand-shell nand-shell--${layout} relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground`}
				style={{ '--nand-panel-width': `${panelWidth(state.panelWidth)}px` } as CSSProperties}
				onKeyDown={keyboard}
			>
				<div className="flex flex-row flex-1 min-h-0 overflow-hidden">
					{visible &&
						!state.focus &&
						layout !== 'narrow' &&
						(overlayOpen ? <div aria-hidden="true" className="w-[52px] shrink-0" /> : rail)}
					{visible && inline && panelVisible && (
						<div className="relative min-h-0 w-[var(--nand-panel-width)] shrink-0">
							{panel()}
							<div
								role="separator"
								tabIndex={0}
								aria-label={t('workbench.resizeNavigation')}
								aria-orientation="vertical"
								aria-valuemin={PANEL_MIN}
								aria-valuemax={PANEL_MAX}
								aria-valuenow={panelWidth(state.panelWidth)}
								className="absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none focus-visible:ring-[3px] focus-visible:ring-ring/50 after:absolute after:inset-y-0 after:left-1.5 after:w-px hover:after:bg-ring/50 active:after:bg-ring"
								onDoubleClick={() => props.onPanelWidth(PANEL_DEFAULT)}
								onKeyDown={(e) => {
									const step = { ArrowLeft: -8, ArrowRight: 8 }[e.key];
									const width =
										e.key === 'Home'
											? PANEL_MIN
											: e.key === 'End'
												? PANEL_MAX
												: step !== undefined
													? state.panelWidth + step
													: undefined;
									if (width !== undefined) {
										e.preventDefault();
										props.onPanelWidth(panelWidth(width));
									}
								}}
								onPointerDown={(e) => {
									if (e.button !== 0) return;
									resize.current = {
										x: e.clientX,
										width: state.panelWidth,
										current: state.panelWidth,
									};
									e.currentTarget.setPointerCapture(e.pointerId);
									e.preventDefault();
								}}
								onPointerMove={(e) => {
									if (resize.current) {
										resize.current.current = panelWidth(
											resize.current.width + e.clientX - resize.current.x,
										);
										root.current?.style.setProperty(
											'--nand-panel-width',
											`${resize.current.current}px`,
										);
									}
								}}
								onPointerUp={() => {
									if (resize.current) props.onPanelWidth(resize.current.current);
									resize.current = null;
								}}
								onLostPointerCapture={() => {
									resize.current = null;
									root.current?.style.setProperty(
										'--nand-panel-width',
										`${panelWidth(state.panelWidth)}px`,
									);
								}}
							/>
						</div>
					)}
					<PageFrame>
						{visible && props.chrome !== 'none' && (
							<PageHeader
								key={`header-${generation}`}
								title={props.title}
								busy={props.busy}
								panelToggle={
									!state.focus && (layout === 'narrow' || (hasPanel && (!inline || !panelVisible)))
										? {
												open: panelVisible,
												icon: layout === 'narrow' ? 'menu' : 'panel-left',
												onToggle: toggle,
											}
										: undefined
								}
								statuses={props.mobile ? props.statuses : []}
								openStatus={(s) => {
									if (s.target) navigate(s.target);
								}}
								openInWorkbench={props.openInWorkbench}
								more={props.more}
							/>
						)}
						{props.tabs && <ResourceTabs {...props.tabs} />}
						{props.error && (
							<div
								role="alert"
								className="m-4 flex items-center justify-between rounded-md bg-destructive/10 p-3 text-destructive"
							>
								<span>
									{t('workbench.failed')}: {props.error}
								</span>
								<Button size="sm" onClick={props.retry}>
									{t('workbench.retry')}
								</Button>
							</div>
						)}
						{props.unavailable && (
							<div
								role="status"
								className="m-4 flex items-center justify-between rounded-md bg-muted p-3 text-muted-foreground"
							>
								<span>{props.unavailable.message}</span>
								{props.unavailable.action && (
									<Button size="sm" onClick={props.unavailable.action.run}>
										{props.unavailable.action.label}
									</Button>
								)}
							</div>
						)}
						<PageSlot contentRef={props.contentRef} />
					</PageFrame>
				</div>
				{/* Keep the visible rail inside the same focus scope as the drawer in both overlay layouts.
			    A stable modal Content also preserves focus and panel state across breakpoint changes. */}
				{visible && (
					<Sheet key={`sheet-${generation}`} open={overlayOpen} onOpenChange={setOverlay}>
						<SheetContent
							side="left"
							showCloseButton={false}
							onOpenAutoFocus={(event) => {
								event.preventDefault();
								const scope = overlayRoot.current;
								(
									scope?.querySelector<HTMLElement>('input') ??
									scope?.querySelector<HTMLElement>(
										'[data-shell-region="panel"], [data-shell-region="rail"]',
									)
								)?.focus();
							}}
							className="gap-0 p-0"
							style={{
								left: bounds.left,
								top: bounds.top,
								height: bounds.height,
								width:
									layout === 'medium'
										? 52 + Math.min(panelWidth(state.panelWidth), bounds.width * 0.88)
										: Math.min(332, bounds.width * 0.88),
							}}
							overlayStyle={{
								left: bounds.left + (layout === 'medium' ? 52 : 0),
								top: bounds.top,
								width: bounds.width - (layout === 'medium' ? 52 : 0),
								height: bounds.height,
								right: 'auto',
								bottom: 'auto',
							}}
							onCloseAutoFocus={(e) => {
								e.preventDefault();
								if (!canRestoreFocus()) return;
								const trigger = returnFocus.current;
								if (trigger?.isConnected) trigger.focus();
								else if (trigger?.dataset.feature) {
									// Opening from the medium rail moves its controls into the Sheet; restore the new copy.
									const railTrigger = [
										...(root.current?.querySelectorAll<HTMLElement>('[data-feature]') ?? []),
									].find((button) => button.dataset.feature === trigger.dataset.feature);
									(
										railTrigger ??
										root.current?.querySelector<HTMLElement>('.nand-page-panel-toggle') ??
										root.current?.querySelector<HTMLElement>('[data-shell-region="page"]')
									)?.focus();
								}
							}}
						>
							<SheetTitle className="sr-only">{props.panelTitle}</SheetTitle>
							<SheetDescription className="sr-only">{t('workbench.navigation')}</SheetDescription>
							<div ref={overlayRoot} className="flex h-full min-h-0" onKeyDown={keyboard}>
								<div className="flex h-full shrink-0">{rail}</div>
								<div className="min-w-0 flex-1">
									{hasPanel ? (
										panel(() => setOverlay(false))
									) : (
										<Button className="m-3" variant="ghost" onClick={() => setOverlay(false)}>
											{t('workbench.closeNavigation')}
										</Button>
									)}
								</div>
							</div>
						</SheetContent>
					</Sheet>
				)}
				<div className="sr-only" aria-live="polite">
					{props.title}
				</div>
			</div>
		</ShellInteractionContext>
	);
}
