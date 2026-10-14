// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/note-popover-modal.ts
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { BoardStore } from '../../services/board-store';
import { Button } from '../../../../ui/components/button';
import { Textarea } from '../../../../ui/components/textarea';
import { useT } from '../../../../ui/react/hooks';
import { DashboardDialog } from './DashboardDialog';
import { MarkdownBody } from '../cards/MemoBody';
function Preview({ store, path }: { store: BoardStore; path: string }) {
	const t = useT(),
		[original, setOriginal] = useState<string | null>(null),
		[draft, setDraft] = useState(''),
		[editing, setEditing] = useState(false),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	useEffect(() => {
		let cancelled = false;
		void store
			.readNote(path)
			.then((text) => {
				if (!cancelled) {
					setOriginal(text);
					setDraft(text);
				}
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : t('home.dashboard.error'));
			});
		return () => {
			cancelled = true;
		};
	}, [store, path, t]);
	return (
		<DashboardDialog
			title={path.split('/').pop() ?? path}
			wide
			busy={busy}
			onClose={() => store.closePreview()}
			onSave={
				editing && original !== null
					? () => {
							setBusy(true);
							setError('');
							void store
								.saveNote(path, draft, original)
								.then(() => {
									setOriginal(draft);
									setEditing(false);
								})
								.catch((reason: unknown) =>
									setError(reason instanceof Error ? reason.message : t('home.dashboard.error')),
								)
								.finally(() => setBusy(false));
						}
					: undefined
			}
		>
			<div className="flex gap-2">
				<Button variant="outline" disabled={original === null || busy} onClick={() => setEditing(!editing)}>
					{t('common.edit')}
				</Button>
				<Button
					variant="outline"
					onClick={() => {
						void store.openFile(path, true).then(() => store.closePreview());
					}}
				>
					{t('home.dashboard.openTab')}
				</Button>
			</div>
			{error && (
				<p role="alert" className="text-destructive">
					{error}
				</p>
			)}
			{original === null ? (
				<div role="status">{t('home.dashboard.loading')}</div>
			) : editing ? (
				<Textarea
					aria-label={t('common.edit')}
					className="min-h-80 font-mono text-sm"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
			) : (
				<div className="min-h-40">
					<MarkdownBody store={store} text={original} sourcePath={path} />
				</div>
			)}
		</DashboardDialog>
	);
}
export function NotePreview({ store }: { store: BoardStore }) {
	const path = useStore(store.state, (state) => state.previewPath);
	return path ? <Preview key={path} store={store} path={path} /> : null;
}
