// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/recent-docs.ts
import { isRecentUserDocument } from '../../core/board/recent-doc-policy';
import { useStore } from 'zustand';
import { FileText } from 'lucide-react';
import type { BoardStore } from '../../services/board-store';
import { Button } from '../../../../ui/components/button';
import { RelativeTime } from '../../../../ui/components/nand/RelativeTime';
import { useT } from '../../../../ui/react/hooks';
export function RecentWidget({ store }: { store: BoardStore }) {
	const { files, settings, path } = useStore(store.state),
		t = useT();
	return (
		<section className="dashboard-recent-widget h-full overflow-auto p-1">
			<h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t('home.dashboard.recent')}</h3>
			{files
				.filter((file) => file.path !== path + '.md' && isRecentUserDocument(file.path, settings))
				.slice(0, settings.recentDocCount)
				.map((file) => (
					<Button
						key={file.path}
						variant="ghost"
						className="h-8 w-full justify-start gap-1 px-0 text-[.7em]"
						onClick={() => {
							void store.openFile(file.path);
						}}
					>
						<FileText className="size-3" />
						<span className="min-w-0 flex-1 truncate text-left">{file.basename}</span>
						<RelativeTime value={file.stat.mtime} />
					</Button>
				))}
		</section>
	);
}
