// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/album-widget.ts
import { useVisible } from '../../../../ui/react/contexts';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import type { BoardStore } from '../../services/board-store';
import { AlbumPanel, albumControllers } from './AlbumPanel';
import { listAlbumImages } from './album-model';
export function AlbumWidget({ store, entryId }: { store: BoardStore; entryId?: string }) {
	const settings = useStore(store.state, (s) => s.settings),
		config = settings.albums.find((a) => String(a.id) === entryId) ?? settings.albums[0],
		[root, setRoot] = useState<HTMLDivElement | null>(null);
	const app = store.host.app,
		visible = useVisible();
	useEffect(() => {
		if (!root || !config) return;
		return contentFiles(app).subscribe(() =>
			albumControllers.get(root)?.setImages(listAlbumImages(app, config.folder, config.recursive)),
		);
	}, [app, config, root]);
	if (!config || !visible) return null;
	const adapted = {
		...settings,
		widgetAlbumFolder: config.folder,
		widgetAlbumRecursive: config.recursive,
		widgetAlbumIntervalSec: config.intervalSec,
		widgetAlbumRatio: config.ratio,
		widgetAlbumTransition: config.transition,
	};
	return (
		<div
			ref={setRoot}
			className="dashboard-album-content"
			data-ratio={config.ratio}
			style={{ aspectRatio: config.ratio === '3:4' ? '3 / 4' : '1 / 1' }}
		>
			{root && (
				<AlbumPanel
					key={`${config.id}:${config.folder}:${config.recursive}`}
					root={root}
					app={app}
					settings={adapted}
					focal={config.focal}
					onFocal={(focal) => {
						void store.settings((s) => {
							s.albums = s.albums.map((a) => (a.id === config.id ? { ...a, focal } : a));
						});
					}}
				/>
			)}
		</div>
	);
}
