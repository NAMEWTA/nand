const dialogs = new Set<() => void>();
export function trackRecordDialog(close: () => void): () => void {
	dialogs.add(close);
	return () => {
		dialogs.delete(close);
	};
}
export function closeRecordDialogs(): void {
	for (const close of [...dialogs]) close();
}
