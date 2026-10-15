// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/weread-section.ts
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { RefreshCw, Settings } from 'lucide-react';
import type { BoardStore } from '../../services/board-store';
import type { DashboardColumn } from '../../core/board/types';
import { useT } from '../../../../ui/react/hooks';
import { useVisible } from '../../../../ui/react/contexts';
import { IconButton } from '../board/controls';
import { WereadPanel } from './WereadPanel';
import { WereadConfigDialog } from './WereadConfigDialog';
import { p2Classes as c } from '../theme/p2-classes';
export function WereadSection({
	store,
	column,
	actions,
}: {
	store: BoardStore;
	column: DashboardColumn;
	actions?: HTMLElement | null;
}) {
	const t = useT(),
		visible = useVisible(),
		settings = useStore(store.state, (s) => s.settings),
		[config, setConfig] = useState(false),
		reload = useRef<() => void>(() => {}),
		ready = useCallback((fn: () => void) => {
			reload.current = fn;
		}, []);
	if (!visible) return null;
	return (
		<div className={c('dashboard-weread-widgets')}>
			{actions &&
				createPortal(
					<>
						<IconButton label={t('weread.refresh')} onClick={() => reload.current()}>
							<RefreshCw />
						</IconButton>
						<IconButton label={t('weread.configure')} onClick={() => setConfig(true)}>
							<Settings />
						</IconButton>
					</>,
					actions,
				)}
			<WereadPanel
				app={store.host.app}
				apiKey={settings.wereadApiKey}
				importPath={settings.wereadImportPath}
				config={column.wereadConfig}
				onReloadReady={ready}
			/>
			{config && (
				<WereadConfigDialog
					config={column.wereadConfig}
					onClose={() => setConfig(false)}
					onSave={(value) =>
						store.edit((board) => {
							const col = board.columns.find((x) => (x.id ?? x.name) === (column.id ?? column.name));
							if (col) col.wereadConfig = value;
						})
					}
				/>
			)}
		</div>
	);
}
