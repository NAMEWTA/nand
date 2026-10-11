// Scoped DOM/copy reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import { websiteCopyControl } from './provider-copy';
import type { ProviderDom, ProviderDomMessage } from './provider-dom';

function readScopedChatDom(copyControl: typeof websiteCopyControl, userClass: string, assistantClass: string): ProviderDom {
	const visible = (element: Element): boolean => {
		const bounds = element.getBoundingClientRect();
		return bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[hidden],[aria-hidden="true"]');
	};
	const usable = (element: HTMLElement): boolean => visible(element) && !element.hasAttribute('disabled') && !element.hasAttribute('readonly') && element.getAttribute('aria-disabled') !== 'true';
	const unique = (selectors: readonly string[], eligible = usable): HTMLElement | undefined => {
		for (const selector of selectors) {
			const matches = [...document.querySelectorAll<HTMLElement>(selector)].filter(eligible);
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
	const composer = unique(['textarea[placeholder]', 'div.ProseMirror[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'], element =>
		usable(element) && !element.closest('[role="search"],aside,[role="dialog"]'));
	const submit = unique(['button[aria-label="发送"]', 'button[aria-label="Send"]', '[role="button"][aria-label="发送"]']);
	const namedNewChat = [...document.querySelectorAll<HTMLElement>('button,a,[role="button"]')].filter(element => usable(element) && /^(新建对话|新对话|New chat)$/i.test(element.innerText.trim()));
	const newChat = unique(['button[aria-label="新建对话"]', '[role="button"][aria-label="新建对话"]']) ?? (namedNewChat.length === 1 ? namedNewChat[0] : undefined);
	// The reference establishes no URL route. Accept only a unique explicit public conversation identity.
	const conversationIds = [...new Set([...document.querySelectorAll('[data-conversation-id]')].filter(visible).map(element => element.getAttribute('data-conversation-id')))];
	const declared = conversationIds.length === 1 ? conversationIds[0] : undefined;
	const conversationId = declared && /^[\w-]{1,100}$/.test(declared) ? declared : undefined;
	const userSelector = '[data-role="user"],[data-testid*="user-message"],[class*="' + userClass + '"]';
	const assistantSelector = '[data-role="assistant"],[data-testid*="assistant-message"],[class*="' + assistantClass + '"],.assistant-response';
	const rootSelector = '[data-message-id],' + userSelector + ',' + assistantSelector;
	const roots = [...document.querySelectorAll<HTMLElement>(rootSelector)].filter(root => visible(root) && !root.parentElement?.closest(rootSelector));
	const messages: ProviderDomMessage[] = [];
	for (const root of roots.slice(-200)) {
		const identity = root.hasAttribute('data-message-id') ? root : root.querySelector('[data-message-id]'), id = identity?.getAttribute('data-message-id');
		if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
		const user = root.matches(userSelector) || !!root.querySelector(userSelector), assistant = root.matches(assistantSelector) || !!root.querySelector(assistantSelector);
		if (user === assistant) continue;
		const content = root.querySelector<HTMLElement>('[class*="markdown"],[class*="message-content"]') ?? root;
		const copy = content.cloneNode(true) as HTMLElement;
		for (const element of copy.querySelectorAll('[class*="thinking"],[class*="reasoning"],[class*="tool-call"],[class*="message-action"],[role="status"],button,[role="button"],script,style')) element.remove();
		for (const math of copy.querySelectorAll('.katex-display,.katex')) {
			if (!copy.contains(math)) continue;
			const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
			if (source) math.replaceWith(document.createTextNode((math.classList.contains('katex-display') ? '$$\n' : '$') + source + (math.classList.contains('katex-display') ? '\n$$' : '$')));
		}
		const parent = identity?.getAttribute('data-parent-id') ?? identity?.getAttribute('data-parent-message-id'), parentKnown = parent !== null && parent !== undefined && (parent === '' || /^[\w-]{1,100}$/.test(parent));
		messages.push({ id, selector: selectorFor(root), copy: assistant ? copyControl(root, selectorFor) : undefined,
			parentId: parentKnown && parent ? parent : undefined, parentKnown, role: user ? 'user' : 'assistant', text: user ? content.innerText : copy.textContent ?? '', html: copy.innerHTML,
			partial: roots.length > 200 || root.getAttribute('data-truncated') === 'true' || root.getAttribute('aria-busy') === 'true' });
	}
	return { url: location.href, conversationId,
		composer: composer ? { selector: selectorFor(composer), value: composer.tagName === 'TEXTAREA' ? (composer as HTMLTextAreaElement).value : composer.innerText } : undefined,
		submit: submit ? { selector: selectorFor(submit), shared: false, signature: '' } : undefined,
		newConversation: newChat ? selectorFor(newChat) : undefined,
		generating: [...document.querySelectorAll('button[aria-label*="停止"],button[aria-label*="Stop"],[data-state="streaming"],[aria-busy="true"]')].some(visible),
		loginRequired: [...document.querySelectorAll('button[class*="login"],a[href*="login"],input[type="password"],input[type="tel"]')].some(visible),
		challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="verify"],[data-testid="captcha"],[role="dialog"] [role="slider"]')].some(visible),
		messages, messageRootCount: roots.length,
		messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
		interrupted: [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim())),
	};
}
export function scopedChatDom(userClass: string, assistantClass: string): string {
	return '(' + readScopedChatDom.toString() + ')(' + websiteCopyControl.toString() + ',' + JSON.stringify(userClass) + ',' + JSON.stringify(assistantClass) + ')';
}
