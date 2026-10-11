// Selector/content reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import { websiteCopyControl } from './provider-copy';
import type { ProviderDom, ProviderDomMessage } from './provider-dom';

function readDoubaoDom(copyControl: typeof websiteCopyControl): ProviderDom {
	const visible = (element: Element): boolean => {
		const bounds = element.getBoundingClientRect();
		return bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[hidden],[aria-hidden="true"]');
	};
	const usable = (element: HTMLElement): boolean => visible(element) && !element.hasAttribute('disabled') && !element.hasAttribute('readonly')
		&& element.getAttribute('aria-disabled') !== 'true' && element.getAttribute('data-disabled') !== 'true';
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
	const composer = unique(['div.tiptap.ProseMirror[contenteditable="true"][role="textbox"]', 'div.ProseMirror[contenteditable="true"][role="textbox"]',
		'[contenteditable="true"][role="textbox"]'], element => usable(element) && !element.closest('[role="search"],aside,[role="dialog"],#captcha_container'));
	const submit = unique(['button#flow-end-msg-send', 'button[data-testid="chat_input_send_button"]', 'button[aria-label="发送"]', 'button[aria-label="Send"]']);
	const namedNewChat = [...document.querySelectorAll<HTMLElement>('button,a,[role="button"]')].filter(element => usable(element) && /^(新对话|New chat)$/i.test(element.innerText.trim()));
	const newChat = unique(['button[aria-label="新对话"]', 'a[aria-label="新对话"]', '[role="button"][aria-label="新对话"]', '[data-testid="new_chat"]'])
		?? (namedNewChat.length === 1 ? namedNewChat[0] : undefined);
	const url = new URL(location.href), conversationId = url.pathname.match(/^\/chat\/([\w-]{1,100})\/?$/)?.[1];
	const rootSelector = '.list_items > .v_list_row,[data-message-id],[data-local-message-id],[data-msg-id],[data-role="user"],[data-role="assistant"],[data-testid="receive_message"],[data-testid="union_message"],[data-testid="message-block-container"]';
	const roots = [...document.querySelectorAll<HTMLElement>(rootSelector)].filter(root => visible(root) && !root.parentElement?.closest(rootSelector));
	const messages: ProviderDomMessage[] = [];
	for (const root of roots.slice(-200)) {
		const identity = root.matches('[data-message-id],[data-local-message-id],[data-msg-id]') ? root : root.querySelector('[data-message-id],[data-local-message-id],[data-msg-id]');
		const id = identity?.getAttribute('data-message-id') ?? identity?.getAttribute('data-local-message-id') ?? identity?.getAttribute('data-msg-id');
		if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
		const userSelector = '[data-role="user"],[class*="send-msg-bubble"]', answerSelector = '.flow-markdown-body,.md-box-root,[data-testid="message_text_content"]';
		const user = root.matches(userSelector) || !!root.querySelector(userSelector);
		const assistant = root.matches('[data-role="assistant"],[data-testid="receive_message"]') || !!root.querySelector(answerSelector);
		if (user === assistant) continue;
		const content = user ? root.querySelector<HTMLElement>(userSelector) ?? root : root.querySelector<HTMLElement>(answerSelector) ?? root;
		const copy = content.cloneNode(true) as HTMLElement;
		for (const element of copy.querySelectorAll('[class*="thinking"],[class*="reasoning"],[class*="search-process"],[class*="suggest"],[class*="message-action"],[class*="tool-call"],[data-testid*="action"],[role="status"],button,[role="button"],script,style')) element.remove();
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
	return { url: url.href, conversationId,
		composer: composer ? { selector: selectorFor(composer), value: composer.innerText } : undefined,
		submit: submit ? { selector: selectorFor(submit), shared: false, signature: '' } : undefined,
		newConversation: newChat ? selectorFor(newChat) : undefined,
		generating: [...document.querySelectorAll('button[data-testid="chat_input_local_break_button"],button[class*="break-btn"],button[aria-label*="停止"],button[aria-label*="Stop"],[data-state="loading"][class*="message"]')].some(visible),
		loginRequired: [...document.querySelectorAll('button[class*="login"],a[href*="login"],input[type="password"],input[type="tel"]')].some(visible),
		challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="verify"],[data-testid="captcha"],#captcha_container [role="slider"],[class*="captcha_verify"]')].some(visible),
		messages, messageRootCount: roots.length,
		messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
		interrupted: [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim())),
	};
}
export const DOUBAO_DOM_READ = '(' + readDoubaoDom.toString() + ')(' + websiteCopyControl.toString() + ')';
