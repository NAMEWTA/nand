// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/folder-select-modal.ts
import { useMemo, useState } from 'react';
import type { App } from 'obsidian';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { Input } from '../../../../ui/components/input';
import { Checkbox } from '../../../../ui/components/checkbox';
import { useT } from '../../../../ui/react/hooks';
import { DashboardDialog } from './DashboardDialog';
export function DashboardFolderPicker({
	app,
	initial,
	single = false,
	onSave,
	onClose,
}: {
	app: App;
	initial: string[];
	single?: boolean;
	onSave: (paths: string[]) => void;
	onClose: () => void;
}) {
	const [selected, setSelected] = useState(initial),
		[query, setQuery] = useState(''),
		t = useT();
	const folders = useMemo(
		() =>
			[
				...new Set([
					...initial,
					...contentFiles(app)
						.getFiles()
						.flatMap((file) => {
							const pieces = file.path.split('/');
							return pieces.slice(0, -1).map((_, i) => pieces.slice(0, i + 1).join('/'));
						}),
				]),
			].sort(),
		[app, initial],
	);
	return (
		<DashboardDialog title={t('folder.selectFolders')} onClose={onClose} onSave={() => onSave(selected)}>
			<Input
				aria-label={t('ui.search')}
				placeholder={t('ui.search')}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
			/>
			<div className="grid max-h-80 gap-1 overflow-auto">
				{folders
					.filter((path) => path.toLowerCase().includes(query.toLowerCase()))
					.map((path) => (
						<label key={path} className="flex min-h-8 items-center gap-2">
							<Checkbox
								checked={selected.includes(path)}
								onCheckedChange={(checked) =>
									setSelected(
										checked
											? single
												? [path]
												: [...selected, path]
											: selected.filter((p) => p !== path),
									)
								}
							/>
							<span>{path}</span>
						</label>
					))}
			</div>
		</DashboardDialog>
	);
}
