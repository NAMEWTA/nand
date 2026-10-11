// Selector/content reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import { websiteCopyControl } from './provider-copy';
import type { ProviderDom, ProviderDomMessage } from './provider-dom';

/** Static public DOM observation. Test IDs name roles, never message identities. */
function readClaudeDom(copyControl: typeof websiteCopyControl): ProviderDom {
	const visible = (element: Element): boolean => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
	const unique = (selectors: readonly string[]): HTMLElement | undefined => {
		for (const selector of selectors) {
			const matches = [...document.querySelectorAll<HTMLElement>(selector)].filter(visible);
			if (matches.length > 1) return undefined;
			if (matches.length === 1) return matches[0];
		}
		return undefined;
	};
	const selectorFor = (element: HTMLElement): string => {
		if (element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1) return '#' + CSS.escape(element.id);
		const path: string[] = []; let node: Element | null = element;
		while (node && node !== document.documentElement) {
			const parent: Element | null = node.parentElement; if (!parent) break;
			path.unshift(node.tagName.toLowerCase() + ':nth-child(' + ([...parent.children].indexOf(node) + 1) + ')'); node = parent;
		}
		return 'html > ' + path.join(' > ');
	};
	const usable = (element: HTMLElement | undefined): element is HTMLElement => !!element && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true';
	const composer = unique(['div.ProseMirror[contenteditable="true"]', 'div[contenteditable="true"][data-placeholder]', 'fieldset div[contenteditable="true"]']);
	const submit = unique(['button[aria-label="Send Message"]', 'button[aria-label="Send message"]', 'button[aria-label="发送消息"]', 'form button[type="submit"]']);
	const newChat = unique(['a[href="/new"]', 'button[aria-label="New chat"]', 'button[aria-label="新对话"]']);
	const url = new URL(location.href), conversationId = url.pathname.match(/^\/chat\/([\w-]{1,100})\/?$/)?.[1];
	const publicSelector = '[data-testid="user-message"],[data-testid="assistant-message"],.assistant-response,.font-claude-response';
	const privateSelector = '[data-testid*="thinking"],[data-testid*="reasoning"],.thinking,.reasoning,[data-content-type="thinking"],[data-content-type="tool_use"]';
	const candidates = [...document.querySelectorAll<HTMLElement>(publicSelector)].filter(node => visible(node) && !node.closest(privateSelector));
	const roots = [...new Set(candidates.map(node => node.closest<HTMLElement>('[data-message-id]') ?? node))];
	const messages: ProviderDomMessage[] = [];
	for (const root of roots.slice(-200)) {
		const nodes = candidates.filter(node => (node === root || root.contains(node)) && !candidates.some(parent => parent !== node && root.contains(parent) && parent.contains(node)));
		if (nodes.length !== 1) continue;
		const message = nodes[0]!, id = root.getAttribute('data-message-id');
		if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
		const role = message.getAttribute('data-testid') === 'user-message' ? 'user' : 'assistant';
		const content = role === 'assistant' ? message.querySelector<HTMLElement>('.standard-markdown,.prose') ?? message : message;
		const copy = content.cloneNode(true) as HTMLElement;
		for (const element of copy.querySelectorAll(privateSelector + ',[data-testid*="action"],[class*="message-actions"],[data-testid*="feedback"],[data-content-type="tool_result"],[class*="tool-call"],[role="status"],button,[role="button"],script,style')) element.remove();
		for (const math of copy.querySelectorAll('.katex-display,.katex')) {
			if (!copy.contains(math)) continue;
			const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
			if (source) math.replaceWith(document.createTextNode((math.classList.contains('katex-display') ? '$$\n' : '$') + source + (math.classList.contains('katex-display') ? '\n$$' : '$')));
		}
		const parent = root.getAttribute('data-parent-message-uuid') ?? root.getAttribute('data-parent-id');
		const parentKnown = parent !== null && (parent === '' || /^[\w-]{1,100}$/.test(parent));
		messages.push({ id, selector: selectorFor(root), copy: role === 'assistant' ? copyControl(root, selectorFor) : undefined,
			parentId: parentKnown && parent && parent !== '00000000-0000-0000-0000-000000000000' ? parent : undefined, parentKnown, role,
			text: role === 'user' ? content.innerText : copy.textContent ?? '', html: copy.innerHTML,
			partial: roots.length > 200 || root.getAttribute('data-truncated') === 'true' || root.getAttribute('data-is-streaming') === 'true' });
	}
	return { url: url.href, conversationId,
		composer: usable(composer) ? { selector: selectorFor(composer), value: composer.innerText } : undefined,
		submit: usable(submit) ? { selector: selectorFor(submit), shared: false, signature: '' } : undefined,
		newConversation: usable(newChat) ? selectorFor(newChat) : undefined,
		generating: [...document.querySelectorAll('[data-is-streaming="true"],button[data-testid="stop-button"],button[aria-label*="Stop"],button[aria-label*="停止"]')].some(visible),
		loginRequired: [...document.querySelectorAll('a[href*="login"],button[data-testid="login-button"],input[type="password"],input[type="tel"]')].some(visible),
		challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="challenge"],[data-testid="captcha"],#challenge-running')].some(visible),
		messages, messageRootCount: roots.length,
		messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
		interrupted: [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim())),
	};
}
export const CLAUDE_DOM_READ = '(' + readClaudeDom.toString() + ')(' + websiteCopyControl.toString() + ')';
