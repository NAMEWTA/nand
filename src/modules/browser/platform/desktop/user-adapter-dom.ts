import type { AdapterDefinition } from '../../core/providers/user-adapter';
import type { ProviderDom } from './provider-dom';

/** Fixed read-only code; user input is JSON data passed to querySelectorAll, never executable code. */
function applySelectors(dom: ProviderDom, rule: AdapterDefinition): ProviderDom {
	const url = new URL(location.href), pattern = rule.pathPattern, selectors = rule.selectors;
	if (url.origin !== rule.origin || url.username || url.password || !(pattern.endsWith('*') ? url.pathname.startsWith(pattern.slice(0, -1)) : url.pathname === pattern))
		throw new Error('browser_adapter_scope');
	const visible = (element: HTMLElement) => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
	const unique = (selector: string): HTMLElement | undefined => {
		const rows = [...document.querySelectorAll<HTMLElement>(selector)].filter(visible); return rows.length === 1 ? rows[0] : undefined;
	};
	const usable = (element?: HTMLElement) => !!element && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true';
	const composer = unique(selectors.composer), submit = unique(selectors.submit);
	const editable = composer instanceof HTMLTextAreaElement || composer?.isContentEditable;
	dom.composer = editable && usable(composer) ? { selector: selectors.composer, value: composer instanceof HTMLTextAreaElement ? composer.value : composer.innerText } : undefined;
	dom.submit = usable(submit) && submit?.matches('button,[role="button"],input[type="submit"]')
		? { selector: selectors.submit, shared: false, signature: submit.innerHTML.slice(0, 4096) } : undefined;
	const answers = [...document.querySelectorAll<HTMLElement>(selectors.answer)].filter(visible);
	for (const message of dom.messages) {
		if (message.role !== 'assistant') continue;
		const root = message.selector ? unique(message.selector) : undefined;
		const rows = root ? answers.filter(answer => root === answer || root.contains(answer)) : [];
		message.copy = undefined; message.partial = true;
		if (rows.length !== 1) { message.html = ''; message.text = ''; continue; }
		const copy = rows[0]!.cloneNode(true) as HTMLElement;
		for (const node of copy.querySelectorAll('script,style,button,[role="button"],input,textarea,[role="status"]')) node.remove();
		message.html = copy.innerHTML; message.text = copy.textContent ?? '';
	}
	return dom;
}
export const userAdapterDom = (base: string, rule: AdapterDefinition): string => '(' + applySelectors.toString() + ')(' + base + ',' + JSON.stringify(rule) + ')';
