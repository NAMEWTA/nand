import type { PanelModel, WorkbenchTarget } from '../contracts/workbench';
import type { CommentedNote } from '../../modules/comments/api';
import { t } from '../../shared/i18n';

/** Comments column 2: open / all, then the commented notes (most recently updated first). */
export function commentsPanel(notes: readonly CommentedNote[], target: WorkbenchTarget): PanelModel {
	const section = target.section === 'all' ? 'all' : 'open';
	const shown = section === 'open' ? notes.filter((note) => note.open > 0) : notes;
	const name = (path: string) => path.split('/').pop()?.replace(/\.md$/, '') ?? path;
	return {
		searchable: true,
		sections: [
			{
				id: 'filter',
				items: [
					{ id: 'open', label: t('workbench.commentsOpen'), icon: 'message-square-dot', badge: notes.filter((note) => note.open > 0).length || undefined, target: { feature: 'comments', section: 'open' }, active: section === 'open' && !target.resourceId },
					{ id: 'all', label: t('workbench.commentsAll'), icon: 'messages-square', target: { feature: 'comments', section: 'all' }, active: section === 'all' && !target.resourceId },
				],
			},
			{
				id: 'notes',
				title: t('workbench.commentsNotes'),
				emptyText: t(section === 'open' ? 'workbench.commentsNoneOpen' : 'workbench.commentsNone'),
				items: shown.map((note) => ({
					id: note.path,
					label: name(note.path),
					icon: 'file-text',
					meta: note.open ? `${note.open}/${note.total}` : String(note.total),
					target: { feature: 'comments', section, resourceId: note.path },
				})),
			},
		],
	};
}
