import type { TFile } from 'obsidian';
import type {
	CardSize,
	DashboardCard,
	DataviewConfig,
	LibraryConfig,
	PinnedNote,
	QuickCommand,
	QuickNotePreset,
} from '../../core/dashboard/types/model';

export interface RenderCallbacks {
	settingsAccess?: import('./settings-access').DashboardSettingsAccess;
	onCardEdit(card: DashboardCard): void;
	/** subpath is the raw `#heading` / `#^block` fragment of a wikilink, when present. */
	onOpenNoteInPopover(this: void, file: TFile, subpath?: string): void;
	/** Open a note scrolled to a 1-based line (calendar section/agenda task jumps). */
	onOpenNoteAtLine?(this: void, file: TFile, line?: number): void;
	onCardDelete(cardId: string): void;
	onCheckboxToggle(cardId: string, taskPath: number[], checked: boolean): void;
	onTaskAdd(cardId: string, text: string, parentPath?: number[]): void;
	onTaskDelete(cardId: string, taskPath: number[]): void;
	onTaskReorder(cardId: string, fromPath: number[], toPath: number[], before: boolean): void;
	onTaskMoveToCard(
		srcCardId: string,
		fromPath: number[],
		destCardId: string,
		destPath: number[],
		mode: 'before' | 'after' | 'nest',
	): void;
	onTaskEdit(cardId: string, taskPath: number[], newText: string): void;
	onCardAdd(columnName: string): void;
	onColumnAdd(name: string, sectionType?: string): void;
	onRequestAddSection(): void;
	onColumnMove(fromIndex: number, toIndex: number): void;
	/** Pair the dragged section beside the target (its ex-partner, if any,
	 *  falls back to a full-width row). Indices in current-array space. */
	onColumnMoveBeside(fromIndex: number, targetIndex: number, side: 'left' | 'right'): void;
	onColumnHeightChange(name: string, height: number): void;
	/** Persist a dragged pair-divider split (left member's share, percent). */
	onColumnWidthChange(name: string, widthPct: number): void;
	onBannerEdit(): void;
	onQuickActionAdd(): void;
	onQuickActionRemove(index: number): void;
	onMoveCard(cardId: string, targetColumn: string, targetIndex: number): void;
	onMemoUpdate(
		card: DashboardCard,
		updates: Pick<DashboardCard, 'body' | 'blockquote'> &
			Partial<Pick<DashboardCard, 'tasks' | 'docs' | 'wikiLink' | 'url' | 'type'>>,
	): void;
	onMemoSaveAsNote(card: DashboardCard): void;
	onTaskSaveToDaily(card: DashboardCard): void;
	onDocAdd(cardId: string, path: string): void;
	/** Per-card "new note" (notes/projects sections): create a vault note and
	 *  attach it to the card's doc list. */
	onCardNewNote(cardId: string): void;
	onDocDelete(cardId: string, docPath: number[]): void;
	onDocReorder(cardId: string, fromPath: number[], toPath: number[], before: boolean): void;
	onDocMoveToCard(
		srcCardId: string,
		fromPath: number[],
		destCardId: string,
		destPath: number[],
		mode: 'before' | 'after' | 'nest',
	): void;
	onDocNest(cardId: string, docPath: number[]): void;
	onDocToggleCollapse(cardId: string, docPath: number[]): void;
	onMemoColorChange(card: DashboardCard, color: string): void;
	onProjectCoverChange(card: DashboardCard, imagePath: string): void;
	onCardTitleEdit(cardId: string, newTitle: string): void;
	onCardWidthChange(cardId: string, width: number): void;
	onCardSizeChange(cardId: string, size: CardSize): void;
	onCardGridChange(cardId: string, gridCols: number, gridRows: number): void;
	onCardGridMove(cardId: string, gridCol: number, gridRow: number): void;
	onFileDrop(cardId: string, filePath: string): void;
	/** columnIndex is the identity of the exact section the user acted on; with
	 *  duplicate names it disambiguates which same-named column is meant. */
	onColumnRename(oldName: string, newName: string, columnIndex?: number): void;
	onColumnDelete(columnName: string, columnIndex?: number): void;
	onTaskReminderEdit(cardId: string, taskPath: number[], reminder: string | undefined): void;
	onTaskAutomationEdit?(cardId: string, taskPath: number[]): void;
	onTaskNest(cardId: string, taskPath: number[]): void;
	onTaskNestInto(cardId: string, srcPath: number[], destPath: number[]): void;
	onTaskUnnest(cardId: string, taskPath: number[]): void;
	onTaskToggleCollapse(cardId: string, taskPath: number[]): void;
	onAddFromTemplate(columnName: string): void;
	onArchiveTasks(columnName: string): void;
	onLibraryConfigChange(columnName: string, config: LibraryConfig): void;
	onDataviewConfigChange(columnName: string, config: DataviewConfig): void;
	onQuickNoteCreate(preset: QuickNotePreset): void;
	onQuickNoteCapture(text: string): void;
	onOpenPinnedNote(note: PinnedNote): void;
	onQuickCommand(cmd: QuickCommand): void;
	onQuickNoteDaily(): void;
	onQuickNoteConfig(): void;
}
