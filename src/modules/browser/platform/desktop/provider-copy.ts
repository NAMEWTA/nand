/** Static guest program. Only a synchronous call from the selected copy control can supply a payload. */
export interface CopyRequest { root: string; button: string }
export interface WebsiteCopy { text: string; mime: 'text/markdown' | 'text/plain' | 'text/html' }

/** Shared static observation, called only within a provider's verified public message root. */
export function websiteCopyControl(root: HTMLElement, selectorFor: (element: HTMLElement) => string): CopyRequest | undefined {
	const excluded = 'pre,code,[class*="code-block"],[class*="think"],[class*="reasoning"],[class*="tool-call"],[data-channel]:not([data-channel="final"]),[data-message-channel]:not([data-message-channel="final"])';
	const buttons = [...root.querySelectorAll<HTMLElement>('button,[role="button"]')].filter(button => {
		const label = (button.getAttribute('aria-label') ?? button.getAttribute('title') ?? button.innerText).trim();
		return /^(copy|copy answer|copy response|复制|复制回答|复制回复)$/i.test(label) && !button.closest(excluded)
			&& !!button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden'
			&& !button.matches(':disabled,[aria-disabled="true"]');
	});
	return buttons.length === 1 ? { root: selectorFor(root), button: selectorFor(buttons[0]!) } : undefined;
}

async function captureWebsiteCopy(request: CopyRequest, guard: () => boolean): Promise<WebsiteCopy | undefined> {
	if (!guard() || navigator.userActivation.isActive) return undefined;
	const roots = document.querySelectorAll<HTMLElement>(request.root), buttons = document.querySelectorAll<HTMLElement>(request.button);
	if (roots.length !== 1 || buttons.length !== 1 || !roots[0]!.contains(buttons[0]!) || !buttons[0]!.getClientRects().length
		|| buttons[0]!.matches(':disabled,[aria-disabled="true"]')) return undefined;
	const clipboard = navigator.clipboard;
	if (!clipboard || typeof clipboard.writeText !== 'function') return undefined;
	const restorers: Array<() => void> = [], candidates: Array<Promise<WebsiteCopy | undefined>> = [];
	let dispatching = false, invalid = false, timer: number | undefined;
	const replace = (target: object, key: string, value: unknown): void => {
		const before = Object.getOwnPropertyDescriptor(target, key);
		Object.defineProperty(target, key, { configurable: true, writable: true, value });
		restorers.push(() => { if (Object.getOwnPropertyDescriptor(target, key)?.value === value) {
			if (before) Object.defineProperty(target, key, before); else Reflect.deleteProperty(target, key);
		} });
	};
	try {
		replace(clipboard, 'writeText', (text: string): Promise<void> => {
			if (dispatching) {
				if (typeof text === 'string' && text.length <= 2_000_000 && candidates.length < 4) candidates.push(Promise.resolve({ text, mime: 'text/plain' }));
				else invalid = true;
			}
			return Promise.resolve();
		});
		if (typeof clipboard.write === 'function') replace(clipboard, 'write', (items: ClipboardItem[]): Promise<void> => {
			if (dispatching && candidates.length < 4 && Array.isArray(items) && items.length === 1) {
				const item = items[0]!, mime = (['text/markdown', 'text/plain', 'text/html'] as const).find(type => item.types.includes(type));
				if (mime) candidates.push(item.getType(mime).then(async blob => blob.size <= 2_000_000 ? { text: await blob.text(), mime } : undefined));
				else invalid = true;
			} else if (dispatching) invalid = true;
			return Promise.resolve();
		});
		// Legacy selection-based copying has no verified content contract here and never reaches the OS.
		const exec = document.execCommand.bind(document);
		replace(document, 'execCommand', (command: string, ui?: boolean, value?: string): boolean => ['copy', 'cut'].includes(command.toLowerCase()) ? false : exec(command, ui, value));
		if (!guard()) return undefined;
		dispatching = true; buttons[0]!.click(); dispatching = false;
		if (!candidates.length) return undefined;
		const result = await Promise.race([Promise.all(candidates), new Promise<undefined>(resolve => { timer = window.setTimeout(() => resolve(undefined), 1000); })]);
		if (invalid || !guard() || !result || result.some(value => !value)) return undefined;
		const values = result.filter((value): value is WebsiteCopy => !!value);
		// Multiple differing writes are ambiguous; do not choose the longest payload.
		return values.length && values.every(value => value.text === values[0]!.text && value.mime === values[0]!.mime) ? values[0] : undefined;
	} catch { return undefined; }
	finally { dispatching = false; if (timer !== undefined) window.clearTimeout(timer); for (const restore of restorers.toReversed()) restore(); }
}

export function websiteCopyProgram(request: CopyRequest, guard: string): string {
	return '(' + captureWebsiteCopy.toString() + ')(' + JSON.stringify(request) + ',()=>(' + guard + '))';
}
