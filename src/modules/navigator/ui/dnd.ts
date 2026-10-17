// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Drag payload type shared by both panes: a JSON array of vault paths. */
export const NAVIGATOR_DND = 'application/x-nand-navigator';

export function startDrag(event: { dataTransfer: DataTransfer | null }, paths: readonly string[], asLinks: boolean): void {
	const transfer = event.dataTransfer;
	if (!transfer) return;
	transfer.effectAllowed = 'copyMove';
	transfer.setData(NAVIGATOR_DND, JSON.stringify(paths));
	// Dropping into an editor inserts links to the notes.
	transfer.setData('text/plain', asLinks ? paths.map((path) => `[[${path.replace(/\.md$/, '')}]]`).join('\n') : paths.join('\n'));
}

export function hasDragPaths(transfer: DataTransfer | null): boolean {
	return !!transfer && [...transfer.types].includes(NAVIGATOR_DND);
}

export function readDragPaths(transfer: DataTransfer | null): string[] {
	if (!transfer) return [];
	try {
		const parsed: unknown = JSON.parse(transfer.getData(NAVIGATOR_DND));
		return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
	} catch {
		return [];
	}
}

/** A pinned entry being reordered: the shortcut id. */
export const SHORTCUT_DND = 'application/x-nand-navigator-shortcut';
/** A root section being reordered: the section id. */
export const SECTION_DND = 'application/x-nand-navigator-section';
/** A navigation target (folder, tag or property) being dragged: JSON `{kind, key}`, droppable onto the shortcuts. */
export const TARGET_DND = 'application/x-nand-navigator-target';

export function hasDragType(transfer: DataTransfer | null, type: string): boolean {
	return !!transfer && [...transfer.types].includes(type);
}

export function startPayloadDrag(event: { dataTransfer: DataTransfer | null }, type: string, value: string): void {
	const transfer = event.dataTransfer;
	if (!transfer) return;
	transfer.effectAllowed = 'move';
	transfer.setData(type, value);
}

/** Add a target payload to an ongoing drag so the shortcuts section can pin it. */
export function addTargetPayload(event: { dataTransfer: DataTransfer | null }, target: { kind: 'folder' | 'tag' | 'property'; key: string }): void {
	event.dataTransfer?.setData(TARGET_DND, JSON.stringify(target));
}

export function readTargetPayload(transfer: DataTransfer | null): { kind: 'folder' | 'tag' | 'property'; key: string } | undefined {
	if (!transfer) return undefined;
	try {
		const parsed = JSON.parse(transfer.getData(TARGET_DND)) as { kind?: unknown; key?: unknown };
		const kind = parsed.kind;
		return (kind === 'folder' || kind === 'tag' || kind === 'property') && typeof parsed.key === 'string' ? { kind, key: parsed.key } : undefined;
	} catch {
		return undefined;
	}
}

/** Whether a pointer is in the upper half of its target: where a dragged row would be inserted. */
export function upperHalf(event: { clientY: number; currentTarget: EventTarget }): boolean {
	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	return event.clientY < rect.top + rect.height / 2;
}
