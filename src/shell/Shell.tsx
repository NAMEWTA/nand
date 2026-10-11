import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Ref } from 'preact';
import type { PanelModel, WorkbenchFeature, WorkbenchStatus, WorkbenchTarget } from '../app/contracts/workbench';
import { t } from '../shared/i18n';
import { Button } from '../ui/primitives/Button';
import { layoutFor, type ShellLayout } from './layout';
import { overlayAfterRail } from './rail-overlay';
import { PANEL_DEFAULT, panelWidth, PANEL_MAX, PANEL_MIN, type WorkbenchState } from './navigation-state';
import { PageHeader } from './PageHeader';
import { Rail, type RailItem } from './Rail';
import { SidePanel } from './SidePanel';
import { TabStrip, type TabStripProps } from '../ui/primitives/TabStrip';

export interface ShellProps {
	state: WorkbenchState;
	rail: readonly RailItem[];
	/** The rail item to highlight (defaults to the current feature). */
	railCurrent?: WorkbenchFeature;
	title: string;
	panelTitle: string;
	panel?: PanelModel;
	tabs?: Omit<TabStripProps, 'label'>;
	statuses: readonly WorkbenchStatus[];
	busy: boolean;
	error?: string;
	unavailable?: { message: string; action?: { label: string; run: () => void } };
	ownerWindow: Window;
	phone: boolean;
	onRail: (feature: WorkbenchFeature) => 'toggled' | 'navigated';
	onNavigate: (target: WorkbenchTarget) => void;
	onPanelOpen: (open: boolean) => void;
	onPanelWidth: (width: number) => void;
	openInWorkbench?: () => void;
	more: (event: MouseEvent) => void;
	retry: () => void;
	report: (error: unknown) => void;
	contentRef: Ref<HTMLDivElement>;
	panelCustomRef: Ref<HTMLDivElement>;
}

const MOTION_MS = 200;

/**
 * The 1-2-3 workbench: (1) module rail, (2) side panel, (3) page. Wide containers show the panel
 * inline; medium ones overlay it; narrow ones (and phones) merge rail and panel into one drawer.
 */
export function Shell(props: ShellProps) {
	const overlayLabel = useId();
	const root = useRef<HTMLDivElement>(null);
	const [layout, setLayout] = useState<ShellLayout>('wide');
	const [overlay, setOverlay] = useState(false);
	const [motion, setMotion] = useState<'' | 'opening' | 'closing'>('');
	const [announcement, setAnnouncement] = useState('');
	const returnFocus = useRef<HTMLElement | null>(null);
	const { state } = props;
	const focus = state.focus;
	const inline = layout === 'wide' && !focus;
	const panelVisible = !focus && (inline ? state.panelOpen : overlay);

	useLayoutEffect(() => {
		const element = root.current;
		const Observer = (props.ownerWindow as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
		if (!element || !Observer) return;
		const measure = () => setLayout(layoutFor(element.getBoundingClientRect().width, props.phone));
		const observer = new Observer(measure);
		observer.observe(element);
		measure();
		return () => observer.disconnect();
	}, [props.ownerWindow, props.phone]);

	// Leaving the overlay layouts closes the transient overlay.
	useEffect(() => {
		if (layout === 'wide') setOverlay(false);
	}, [layout]);

	useEffect(() => {
		setAnnouncement(props.title);
	}, [props.title]);

	// Drawer and overlay: Escape closes; focus moves in and is restored when they close.
	useEffect(() => {
		if (inline || !overlay) return;
		const previous = returnFocus.current;
		root.current?.querySelector<HTMLElement>('.nand-shell-overlay input, .nand-shell-overlay button')?.focus();
		return () => {
			if (previous?.isConnected) previous.focus();
		};
	}, [inline, overlay]);

	const animate = (next: boolean) => {
		if (!inline || props.ownerWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
		setMotion(next ? 'opening' : 'closing');
		props.ownerWindow.setTimeout(() => setMotion(''), MOTION_MS);
	};
	const togglePanel = () => {
		if (inline) {
			animate(!state.panelOpen);
			props.onPanelOpen(!state.panelOpen);
		} else {
			if (!overlay) returnFocus.current = root.current?.ownerDocument.activeElement as HTMLElement | null;
			setOverlay(!overlay);
		}
	};
	const selectRail = (feature: WorkbenchFeature) => {
		const result = props.onRail(feature);
		const next = overlayAfterRail(layout, inline, result === 'toggled' ? 'toggled' : 'navigated', overlay);
		if (next === 'toggle') togglePanel();
		else setOverlay(next);
	};
	const navigate = (target: WorkbenchTarget) => {
		if (!inline) setOverlay(false);
		props.onNavigate(target);
	};

	// Resize: the width follows the pointer through a CSS variable and is committed on release.
	const resize = useRef<{ x: number; width: number; current: number } | null>(null);
	const setWidthVar = (width: number) => root.current?.style.setProperty('--nand-panel-width', `${width}px`);

	const regions = () => [...(root.current?.querySelectorAll<HTMLElement>('.nand-rail, .nand-panel, .nand-shell-main') ?? [])];
	const cycleRegion = (event: KeyboardEvent) => {
		if (event.key !== 'F6') return;
		const list = regions();
		const current = list.findIndex((region) => region.contains(root.current?.ownerDocument.activeElement ?? null));
		const next = list[(current + (event.shiftKey ? -1 : 1) + list.length) % list.length];
		if (!next) return;
		event.preventDefault();
		next.querySelector<HTMLElement>('[tabindex="0"], button, input, [tabindex="-1"]')?.focus();
	};

	const panel = (onClose?: () => void) => (
		<SidePanel title={props.panelTitle} model={props.panel} current={state.target} customRef={props.panelCustomRef} onNavigate={navigate} onClose={onClose} report={props.report} />
	);
	const railItems = props.rail;
	const current = props.railCurrent ?? state.target.feature;
	const classes = ['nand-shell', `nand-shell--${layout}`, focus && 'is-focus', panelVisible && 'is-panel-open', motion && `is-${motion}`].filter(Boolean).join(' ');
	return (
		<div
			ref={root}
			class={classes}
			style={{ '--nand-panel-width': `${panelWidth(state.panelWidth)}px` }}
			onKeyDown={(event) => {
				if (event.key === 'Escape' && overlay && !inline) {
					event.preventDefault();
					event.stopPropagation();
					setOverlay(false);
					return;
				}
				cycleRegion(event);
			}}
		>
			{!focus && layout !== 'narrow' && <Rail items={railItems} current={current} panelOpen={panelVisible} onSelect={selectRail} />}
			{inline && state.panelOpen && panel()}
			{inline && state.panelOpen && (
				<div
					class="nand-shell-resizer"
					role="separator"
					tabIndex={0}
					aria-label={t('workbench.resizeNavigation')}
					aria-orientation="vertical"
					aria-valuemin={PANEL_MIN}
					aria-valuemax={PANEL_MAX}
					aria-valuenow={panelWidth(state.panelWidth)}
					onDblClick={() => props.onPanelWidth(PANEL_DEFAULT)}
					onKeyDown={(event) => {
						const step = { ArrowLeft: -8, ArrowRight: 8 }[event.key];
						const width = event.key === 'Home' ? PANEL_MIN : event.key === 'End' ? PANEL_MAX : step !== undefined ? state.panelWidth + step : undefined;
						if (width === undefined) return;
						event.preventDefault();
						props.onPanelWidth(panelWidth(width));
					}}
					onPointerDown={(event) => {
						if (event.button !== 0) return;
						resize.current = { x: event.clientX, width: state.panelWidth, current: state.panelWidth };
						event.currentTarget.setPointerCapture(event.pointerId);
						root.current?.classList.add('is-resizing');
						event.preventDefault();
					}}
					onPointerMove={(event) => {
						if (!resize.current) return;
						resize.current.current = panelWidth(resize.current.width + event.clientX - resize.current.x);
						setWidthVar(resize.current.current);
					}}
					onPointerUp={() => {
						const done = resize.current;
						resize.current = null;
						root.current?.classList.remove('is-resizing');
						if (done && done.current !== done.width) props.onPanelWidth(done.current);
					}}
					onLostPointerCapture={() => {
						resize.current = null;
						root.current?.classList.remove('is-resizing');
					}}
				/>
			)}
			{!inline && overlay && !focus && (
				<>
					<button type="button" class="nand-shell-scrim" tabIndex={-1} aria-label={t('workbench.closeNavigation')} onClick={() => setOverlay(false)} />
					<div class={`nand-shell-overlay nand-shell-overlay--${layout}`} role="dialog" aria-modal={layout === 'narrow' ? true : undefined} aria-labelledby={overlayLabel}>
						<span class="nand-visually-hidden" id={overlayLabel}>{props.panelTitle}</span>
						{layout === 'narrow' && <Rail items={railItems} current={current} panelOpen orientation="horizontal" onSelect={selectRail} />}
						{panel(() => setOverlay(false))}
					</div>
				</>
			)}
			<main class="nand-shell-main" inert={!inline && overlay ? true : undefined}>
				<PageHeader
					title={props.title}
					busy={props.busy}
					panelToggle={focus ? undefined : inline && state.panelOpen ? undefined : { open: panelVisible, icon: layout === 'narrow' ? 'menu' : 'panel-left', label: t('workbench.toggleNavigation'), onToggle: togglePanel }}
					statuses={props.statuses}
					openStatus={(status) => navigate(status.target)}
					openInWorkbench={props.openInWorkbench}
					more={props.more}
				/>
				{props.tabs && <TabStrip label={props.title} {...props.tabs} />}
				{props.error && (
					<div class="nand-shell-message is-error" role="alert">
						<span>{t('workbench.failed')}: {props.error}</span>
						<Button size="sm" onClick={props.retry}>{t('workbench.retry')}</Button>
					</div>
				)}
				{props.unavailable && (
					<div class="nand-shell-message" role="status">
						<span>{props.unavailable.message}</span>
						{props.unavailable.action && <Button size="sm" variant="primary" onClick={props.unavailable.action.run}>{props.unavailable.action.label}</Button>}
					</div>
				)}
				<div class="nand-shell-pages" ref={props.contentRef} />
			</main>
			<div class="nand-visually-hidden" aria-live="polite">{announcement}</div>
		</div>
	);
}
