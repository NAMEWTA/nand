// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/music-widget.ts
import { useVisible } from '../../../../ui/react/contexts';
import { useState } from 'react';
import { homeServices } from '../../services/instances';
import type { BoardStore } from '../../services/board-store';
import { MusicPanel } from '../music/MusicPanel';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { WidgetBackgroundEditor } from '../settings/WidgetBackgroundEditor';
import { useT } from '../../../../ui/react/hooks';
export function MusicWidget({ store }: { store: BoardStore }) {
	const [root, setRoot] = useState<HTMLDivElement | null>(null),
		[editing, setEditing] = useState(false),
		t = useT();
	const service = homeServices.music,
		visible = useVisible();
	if (!visible) return null;
	return (
		<div ref={setRoot} className="contents">
			{root && service && <MusicPanel service={service} root={root} background={() => setEditing(true)} />}
			{editing && (
				<DashboardDialog title={t('wbg.title')} onClose={() => setEditing(false)}>
					<WidgetBackgroundEditor
						app={store.host.app}
						value={store.state.getState().settings.musicBackground}
						onChange={(value) => {
							void store.settings((s) => {
								s.musicBackground = value;
							});
						}}
					/>
				</DashboardDialog>
			)}
		</div>
	);
}
