export function repaintLocalizedForm(root: HTMLElement, paint: () => void): void {
	const selector = 'input, textarea, select, button';
	type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;
	const before = Array.from(root.querySelectorAll<Control>(selector));
	const activeBefore = root.ownerDocument.activeElement as HTMLElement | null;
	const focused = before.findIndex((element) => element === root.ownerDocument.activeElement);
	const values = before.map((element) => ({
		tag: element.tagName,
		type: element.type,
		value: element.value,
		checked: 'checked' in element ? element.checked : undefined,
		start: 'selectionStart' in element ? element.selectionStart : null,
		end: 'selectionEnd' in element ? element.selectionEnd : null,
	}));
	const scrolling = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
		.filter((element) => element.scrollTop || element.scrollLeft)
		.map((element) => ({
			className: element.className,
			top: element.scrollTop,
			left: element.scrollLeft,
			root: element === root,
		}));
	paint();
	const after = Array.from(root.querySelectorAll<Control>(selector));
	for (let index = 0; index < after.length; index++) {
		const element = after[index]!,
			previous = values[index];
		if (!previous || previous.tag !== element.tagName || previous.type !== element.type) continue;
		if (element.tagName !== 'BUTTON' && element.type !== 'file') element.value = previous.value;
		if ('checked' in element && previous.checked !== undefined) element.checked = previous.checked;
		if (index === focused) {
			element.focus({ preventScroll: true });
			if ('setSelectionRange' in element && previous.start !== null && previous.end !== null)
				element.setSelectionRange(previous.start, previous.end);
		}
	}
	for (const position of scrolling) {
		const element = position.root
			? root
			: Array.from(root.querySelectorAll<HTMLElement>('*')).find(
					(candidate) => candidate.className === position.className,
				);
		if (element) {
			element.scrollTop = position.top;
			element.scrollLeft = position.left;
		}
	}
	if (focused < 0 && activeBefore?.isConnected) activeBefore.focus({ preventScroll: true });
}
