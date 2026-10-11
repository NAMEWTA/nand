// Selector/content reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import { websiteCopyControl } from './provider-copy';
import type { ProviderDom, ProviderDomMessage } from './provider-dom';

function readQwenDom(copyControl: typeof websiteCopyControl): ProviderDom {
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
	const composer = unique(['[data-chat-input-shell="true"] textarea', 'textarea.message-input-textarea', 'textarea#chat-input',
		'[data-slate-editor="true"][contenteditable="true"]', '.chat-composer textarea', '.chat-composer [role="textbox"][contenteditable="true"]'], element =>
		usable(element) && !element.closest('[role="search"],aside,[role="dialog"],.nc-container,.baxia-dialog') &&
		!/搜索会话|搜索聊天|search conversations?|search chats?/i.test((element.getAttribute('placeholder') ?? '') + ' ' + (element.getAttribute('aria-label') ?? '')));
	const submit = unique(['[data-chat-input-shell="true"] button.send-button', 'button.send-button', 'button[aria-label="发送"]', 'button[aria-label="Send"]']);
	const namedNewChat = [...document.querySelectorAll<HTMLElement>('button,a,[role="button"]')].filter(element => usable(element) && /^(新建对话|新对话|New chat)$/i.test(element.innerText.trim()));
	const newChat = unique(['button[aria-label="新建对话"]', '[role="button"][aria-label="新建对话"]']) ?? (namedNewChat.length === 1 ? namedNewChat[0] : undefined);
	let draft = '';
	if (composer) {
		if (composer.tagName === 'TEXTAREA') draft = (composer as HTMLTextAreaElement).value;
		else if (composer.matches('[data-slate-editor="true"]')) {
			const copy = composer.cloneNode(true) as HTMLElement;
			for (const node of copy.querySelectorAll('[data-slate-placeholder="true"],[data-slate-zero-width]')) node.remove();
			draft = copy.textContent === '' ? '' : composer.innerText;
		} else draft = composer.innerText;
	}
	const url = new URL(location.href), conversationId = url.pathname.match(/^\/(?:conversation|chat|c)\/([\w-]{1,100})\/?$/)?.[1];
	const rootSelector = '[data-role="user"],[data-role="assistant"],[data-message-id],.chat-answers-card-wrap[data-chat-answers-wrap]';
	const roots = [...document.querySelectorAll<HTMLElement>(rootSelector)].filter(root => visible(root) && !root.parentElement?.closest(rootSelector));
	const messages: ProviderDomMessage[] = [];
	for (const root of roots.slice(-200)) {
		const id = root.getAttribute('data-message-id') ?? root.getAttribute('data-chat-answers-wrap');
		if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
		const user = root.matches('[data-role="user"]') || !!root.querySelector('[data-role="user"]');
		const assistant = root.matches('[data-role="assistant"],.chat-answers-card-wrap') || !!root.querySelector('[data-role="assistant"],.answer-text.md-text-card');
		if (user === assistant) continue;
		const content = user ? root : root.querySelector<HTMLElement>('.qk-markdown,.response-message-content.phase-answer,.markdown-body') ?? root;
		const copy = content.cloneNode(true) as HTMLElement;
		for (const element of copy.querySelectorAll('.answer-meta,[data-answer-feedback-toolbar],.answer-receiving-card,.chat-message-mask,[class*="thinking"],[class*="reasoning"],.phase-think,[class*="tool-call"],[role="status"],button,[role="button"],script,style')) element.remove();
		for (const math of copy.querySelectorAll('.katex-display,.katex')) {
			if (!copy.contains(math)) continue;
			const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
			if (source) math.replaceWith(document.createTextNode((math.classList.contains('katex-display') ? '$$\n' : '$') + source + (math.classList.contains('katex-display') ? '\n$$' : '$')));
		}
		const parent = root.getAttribute('data-parent-id') ?? root.getAttribute('data-parent-message-id'), parentKnown = parent !== null && (parent === '' || /^[\w-]{1,100}$/.test(parent));
		messages.push({ id, selector: selectorFor(root), copy: assistant ? copyControl(root, selectorFor) : undefined,
			parentId: parentKnown && parent ? parent : undefined, parentKnown, role: user ? 'user' : 'assistant', text: user ? content.innerText : copy.textContent ?? '', html: copy.innerHTML,
			partial: roots.length > 200 || root.getAttribute('data-truncated') === 'true' || root.getAttribute('aria-busy') === 'true' });
	}
	return { url: url.href, conversationId,
		composer: composer ? { selector: selectorFor(composer), value: draft } : undefined,
		submit: submit ? { selector: selectorFor(submit), shared: false, signature: '' } : undefined,
		newConversation: newChat ? selectorFor(newChat) : undefined,
		generating: [...document.querySelectorAll('.answer-receiving-card,button.stop-button,button[aria-label*="停止"],button[aria-label*="Stop"]')].some(visible),
		loginRequired: [...document.querySelectorAll('a[href*="login"],button[class*="login"],input[type="password"],input[type="tel"]')].some(visible),
		challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="verify"],iframe[src*="challenge"],[data-testid="captcha"],.nc-container [role="slider"],.nc_scale,.baxia-dialog [role="slider"]')].some(visible),
		messages, messageRootCount: roots.length,
		messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
		interrupted: [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim())),
	};
}
export const QWEN_DOM_READ = '(' + readQwenDom.toString() + ')(' + websiteCopyControl.toString() + ')';
