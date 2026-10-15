// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts (renderReadingWidget)
import { lazy, Suspense, useState } from 'react';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { BookInfo } from '../../core/reading/application';
import { ReadingPanel } from '../reading/ReadingPanel';
import { RecordDialog } from '../dialogs/RecordDialog';
const Search = lazy(() => import('../reading/ReadingDialogs').then((m) => ({ default: m.BookSearchPanel })));
const Edit = lazy(() => import('../reading/ReadingDialogs').then((m) => ({ default: m.EditBookPanel })));
const Finish = lazy(() => import('../reading/ReadingDialogs').then((m) => ({ default: m.EndReadingPanel })));
const Stats = lazy(() => import('../reading/ReadingDialogs').then((m) => ({ default: m.ReadingStatsPanel })));
export function ReadingWidget({ store }: { store: BoardStore }) {
	const [dialog, setDialog] = useState<'search' | 'stats' | 'edit' | 'finish' | null>(null),
		[book, setBook] = useState<BookInfo | null>(null);
	const doc = useOwnerDocument(),
		t = useT(),
		service = store.widgets.reading;
	if (!service) return null;
	const close = () => setDialog(null);
	return (
		<>
			<ReadingPanel
				service={service}
				add={() => setDialog('search')}
				statistics={() => setDialog('stats')}
				edit={(book) => {
					setBook(book);
					setDialog('edit');
				}}
				finish={(book) => {
					setBook(book);
					setDialog('finish');
				}}
			/>
			{dialog && (
				<RecordDialog
					title={t(
						dialog === 'stats'
							? 'reading.statsTitle'
							: dialog === 'search'
								? 'reading.selectBook'
								: dialog === 'finish'
									? 'reading.endTitle'
									: 'reading.editTitle',
					)}
					classes={
						dialog === 'stats'
							? 'dashboard-pomodoro-stats-modal'
							: dialog === 'search'
								? 'dashboard-reading-book-modal'
								: 'dashboard-reading-end-modal'
					}
					onClose={close}
				>
					<Suspense fallback={null}>
						{dialog === 'search' && (
							<Search
								service={service}
								close={close}
								win={doc.defaultView!}
								select={(book) => {
									void service.addActiveBook(book);
								}}
							/>
						)}
						{dialog === 'stats' && <Stats service={service} close={close} />}
						{dialog === 'edit' && book && (
							<Edit service={service} book={book} close={close} done={() => {}} />
						)}
						{dialog === 'finish' && book && (
							<Finish
								service={service}
								book={book}
								elapsed={service.getElapsedSeconds()}
								close={close}
								done={() => {}}
							/>
						)}
					</Suspense>
				</RecordDialog>
			)}
		</>
	);
}
