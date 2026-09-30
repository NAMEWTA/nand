import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../shared/i18n/terminal-accessor';
import { Icon } from '../primitives/Icon';
import { sidebarWidth, type WorkbenchChange, type WorkbenchState } from './workbench-state';

export interface TerminalWorkbenchProps {
	state: WorkbenchState;
	onStateChange: WorkbenchChange;
	sessions?: ComponentChildren;
	newConversation?: ComponentChildren;
	history?: ComponentChildren;
	usage?: ComponentChildren;
	header?: ComponentChildren;
	preview?: ComponentChildren;
	rootRef?: Ref<HTMLDivElement>;
	ownerWindow?: Window;
	terminalRef: Ref<HTMLDivElement>;
	searchRef: Ref<HTMLDivElement>;
	inputRef: Ref<HTMLInputElement>;
	search: () => void;
	previous: () => void;
	next: () => void;
	closeSearch: () => void;
	focusTerminal?: () => void;
}

/** Preact never reconciles children inside the persistent xterm container. */
export function TerminalWorkbench(props: TerminalWorkbenchProps) {
	const { state, onStateChange, sessions, newConversation, history, usage, header, preview } = props;
	const root = useRef<HTMLDivElement>(null);
	const navigation = useRef<HTMLElement>(null);
	const drag = useRef<{ x: number; width: number }>();
	const [compact, setCompact] = useState(false);
	const drawerVisible = compact && state.drawerOpen;
	useEffect(() => {
		const element = root.current;
		const win = props.ownerWindow ?? element?.ownerDocument.defaultView;
		const Observer = (win as Window & { ResizeObserver?: typeof ResizeObserver } | null)?.ResizeObserver;
		if (!element || !Observer) return;
		const measure = () => setCompact(element.getBoundingClientRect().width < 800);
		measure();
		const observer = new Observer(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [props.ownerWindow]);
	useEffect(() => {
		if (!drawerVisible) return;
		const previous = root.current?.ownerDocument.activeElement as HTMLElement | null;
		navigation.current?.querySelector<HTMLElement>('button, input, select')?.focus();
		return () => { if (previous?.isConnected) previous.focus(); };
	}, [drawerVisible, props.ownerWindow]);
	const closeDrawer = () => onStateChange({ drawerOpen: false });
	return (
		<div
			className={`terminal-workbench-shell${state.wideSidebarOpen ? '' : ' is-sidebar-collapsed'}${state.drawerOpen ? ' is-drawer-open' : ''}${state.showHistory ? ' is-history-preview' : ''}`}
			style={{ '--terminal-sidebar-width': `${sidebarWidth(state.sidebarWidth)}px` }}
			ref={(element) => {
				root.current = element;
				if (typeof props.rootRef === 'function') props.rootRef(element);
				else if (props.rootRef) props.rootRef.current = element;
			}}
			onKeyDown={(event) => {
				if (!drawerVisible) return;
				if (event.key === 'Escape') {
					event.preventDefault(); event.stopPropagation(); closeDrawer();
				} else if (event.key === 'Tab') {
					const controls = Array.from(navigation.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') ?? []).filter((element) => !element.closest('[hidden]'));
					const first = controls[0], last = controls[controls.length - 1];
					if (event.shiftKey && event.currentTarget.ownerDocument.activeElement === first) {
						event.preventDefault(); last?.focus();
					} else if (!event.shiftKey && event.currentTarget.ownerDocument.activeElement === last) {
						event.preventDefault(); first?.focus();
					}
				}
			}}
		>
			<button className="terminal-drawer-backdrop" tabIndex={-1} aria-label={t('workbench.closeNavigation')} onClick={closeDrawer} />
			<aside className="nand-agent-sidebar" ref={navigation} aria-label={t('workbench.navigation')} role={drawerVisible ? 'dialog' : undefined} aria-modal={drawerVisible ? true : undefined} inert={compact ? !state.drawerOpen : !state.wideSidebarOpen}>
				<div className="terminal-navigation-title">
					<h3 className="nand-agent-workbench-title">{t('workbench.title')}</h3>
					<button className="nand-ui-icon-btn terminal-drawer-close" aria-label={t('workbench.closeNavigation')} onClick={closeDrawer}><Icon name="x" /></button>
				</div>
				{newConversation}
				<div className="nand-ui-segmented terminal-navigation-tabs" aria-label={t('workbench.navigation')}>
					{(['running', 'history'] as const).map((tab) => (
						<button key={tab} aria-pressed={state.navigation === tab} onClick={() => onStateChange({ navigation: tab })}><Icon name={tab === 'running' ? 'terminal' : 'history'} />{t(tab === 'running' ? 'workbench.openSessions' : 'workbench.history')}</button>
					))}
				</div>
				<div className="terminal-navigation-panels">
					<div className="nand-agent-session-controls" hidden={state.navigation !== 'running'}>{sessions}</div>
					<div className="nand-agent-history" hidden={state.navigation !== 'history'}>{history}</div>
				</div>
				<div className="nand-agent-usage">{usage}</div>
			</aside>
			<button
				className="terminal-sidebar-resizer" role="separator" aria-orientation="vertical" aria-label={t('workbench.resizeNavigation')} aria-valuemin={240} aria-valuemax={360} aria-valuenow={sidebarWidth(state.sidebarWidth)}
				onKeyDown={(event) => {
					let width: number;
					if (event.key === 'ArrowLeft') width = state.sidebarWidth - 8;
					else if (event.key === 'ArrowRight') width = state.sidebarWidth + 8;
					else if (event.key === 'Home') width = 240;
					else if (event.key === 'End') width = 360;
					else return;
					event.preventDefault(); event.stopPropagation(); onStateChange({ sidebarWidth: sidebarWidth(width) });
				}}
				onPointerDown={(event) => {
					if (event.button !== 0) return;
					drag.current = { x: event.clientX, width: state.sidebarWidth };
					event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
				}}
				onPointerMove={(event) => { if (drag.current) onStateChange({ sidebarWidth: sidebarWidth(drag.current.width + event.clientX - drag.current.x) }); }}
				onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}
				onLostPointerCapture={() => { drag.current = undefined; }}
			/>
			<div className="nand-agent-center">
				<div className="terminal-workbench-header">{header}</div>
				<div className="terminal-workbench-main">
					<div className="terminal-live-pane" aria-hidden={state.showHistory} inert={state.showHistory}>
						<div className="terminal-search-container" ref={props.searchRef}>
							<Icon name="search" className="terminal-search-icon" />
							<input type="text" className="terminal-search-input" placeholder={t('terminal.search.placeholder')} aria-label={t('terminal.search.placeholder')} ref={props.inputRef} onInput={props.search} onKeyDown={(event) => {
								if (event.key === 'Enter') { event.preventDefault(); if (event.shiftKey) props.previous(); else props.next(); }
								else if (event.key === 'Escape') props.closeSearch();
							}} />
							{([['chevron-up', 'previous', props.previous], ['chevron-down', 'next', props.next], ['x', 'close', props.closeSearch]] as const).map(([icon, label, action]) => (
								<button key={label} type="button" className="terminal-search-btn clickable-icon" title={t(`terminal.search.${label}`)} aria-label={t(`terminal.search.${label}`)} onClick={action}><Icon name={icon} /></button>
							))}
						</div>
						<div className="terminal-container" ref={props.terminalRef} />
					</div>
					<div className="terminal-history-pane" hidden={!state.showHistory}>{preview}</div>
				</div>
			</div>
		</div>
	);
}
