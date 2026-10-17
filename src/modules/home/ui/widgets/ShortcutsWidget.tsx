import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../ui/components/button';
import { EmptyState } from '../../../../ui/components/nand/EmptyState';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { ShortcutKeyCombo } from '../../../../ui/components/nand/ShortcutKeyCombo';
import { useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { shortcutLayout, type ShortcutButton } from '../../core/board/shortcut-buttons';
import type { BoardStore } from '../../services/board-store';
import { runShortcut } from '../../services/shortcut-run';
import { IconButton } from '../board/controls';
import { ShortcutsConfig } from './ShortcutsConfig';
import { useBox } from './use-box';
import { WidgetHeader } from './WidgetHeader';

/** A configurable set of buttons: open a note, run an Obsidian command, run a saved automation or start an agent. */
export function ShortcutsWidget({ store }: { store: BoardStore }) {
	const t = useT(),
		visible = useVisible(),
		buttons = useStore(store.state, (state) => state.settings.shortcutButtons),
		[ref, box] = useBox<HTMLDivElement>(),
		[config, setConfig] = useState(false),
		[running, setRunning] = useState<ReadonlySet<string>>(new Set()),
		controller = useRef(new AbortController()),
		layout = shortcutLayout(box);
	useEffect(() => {
		const current = new AbortController();
		controller.current = current;
		return () => current.abort();
	}, []);
	const run = (button: ShortcutButton) => {
		const { signal } = controller.current;
		if (running.has(button.id)) return;
		setRunning((prev) => new Set(prev).add(button.id));
		const widgets = store.widgets,
			automation = store.host.automationHost;
		void runShortcut(button, {
			current: () => store.isCurrent(),
			hasFile: (path) => store.hasFile(path),
			openFile: (path) => store.openFile(path),
			hasCommand: (id) => store.hasCommand(id),
			runCommand: (id) => store.runCommand(id),
			automations: () =>
				automation?.actions && automation.runAction
					? { actions: () => automation.actions!(), run: (id) => automation.runAction!(id) }
					: undefined,
			quickCommands: () => widgets.quickCommands?.(),
			agents: () => widgets.agents?.() ?? [],
			dispatch: widgets.acquireDispatch ?? (async () => undefined),
			notify: (message) => toast(message),
			boardPath: store.state.getState().path + '.md',
			signal,
		}).finally(() => {
			if (signal.aborted) return;
			setRunning((prev) => {
				const next = new Set(prev);
				next.delete(button.id);
				return next;
			});
		});
	};
	const label = (button: ShortcutButton) => button.label || button.target || t('home.widget.shortcuts');
	return (
		<div ref={ref} data-shortcuts-layout={layout} className="flex h-full min-h-0 flex-col">
			<WidgetHeader
				icon="command"
				title={t('home.widget.shortcuts')}
				actions={
					<IconButton label={t('shortcuts.configure')} className="size-5" onClick={() => setConfig(true)}>
						<Settings className="size-3" />
					</IconButton>
				}
			/>
			{buttons.length === 0 ? (
				<EmptyState
					className="p-2"
					title={t('shortcuts.empty')}
					description={layout === 'icons' ? undefined : t('shortcuts.emptyHint')}
					action={
						<Button size="xs" variant="outline" onClick={() => setConfig(true)}>
							{t('shortcuts.add')}
						</Button>
					}
				/>
			) : (
				<ul
					className={`m-0 min-h-0 flex-1 list-none overflow-auto p-0 ${
						layout === 'rows'
							? 'flex flex-col gap-1'
							: layout === 'icons'
								? 'flex flex-wrap content-start gap-1.5'
								: 'grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] content-start gap-1.5'
					}`}
				>
					{buttons.map((button) => {
						const keys = button.type === 'command' ? store.hotkeysOf(button.target) : [];
						return (
							<li key={button.id} className="min-w-0">
								<Button
									size={layout === 'icons' ? 'icon-sm' : 'xs'}
									variant="secondary"
									disabled={running.has(button.id)}
									aria-label={label(button)}
									title={label(button)}
									data-shortcut={button.id}
									className={
										layout === 'icons'
											? ''
											: 'h-8 w-full min-w-0 justify-start gap-1.5 rounded-[4px] border border-[var(--db-border-btn)] bg-[var(--db-bg-btn)] px-2 text-[.75em]'
									}
									onClick={() => run(button)}
								>
									<ObsidianIcon name={button.icon} className="size-3.5" />
									{layout !== 'icons' && <span className="min-w-0 flex-1 truncate text-left">{label(button)}</span>}
									{layout === 'rows' && keys.length > 0 && <ShortcutKeyCombo keys={keys} />}
								</Button>
							</li>
						);
					})}
				</ul>
			)}
			{visible && config && <ShortcutsConfig store={store} close={() => setConfig(false)} />}
		</div>
	);
}
