import { websiteCopyControl } from './provider-copy';
// Selector/content reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import type { ProviderDom, ProviderDomMessage } from './provider-dom';

/** Static guest observation; numbered turn containers never supply message identity. */
function readChatGptDom(copyControl: typeof websiteCopyControl): ProviderDom {
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
 const composer = unique(['#prompt-textarea[contenteditable="true"]', 'textarea#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'textarea']);
 const submit = unique(['button[data-testid="send-button"]', 'button[data-testid="composer-submit-button"]', 'button#composer-submit-button',
  'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]', 'button[aria-label*="发送"]', 'form button[type="submit"]']);
 const namedNewChat = [...document.querySelectorAll<HTMLElement>('a,button,[role="button"]')]
  .filter(element => visible(element) && /^(New chat|新聊天|新对话)$/i.test(element.innerText.trim()));
 const newChat = unique(['a[data-testid="create-new-chat-button"]', 'button[aria-label="New chat"]', 'a[aria-label="New chat"]'])
  ?? (namedNewChat.length === 1 ? namedNewChat[0] : undefined);
 const url = new URL(location.href), rawId = url.pathname.match(/^\/c\/([\w-]{1,100})\/?$/)?.[1];
 const rootSelector = '[data-testid^="conversation-turn-"],[data-message-author-role="user"],[data-message-author-role="assistant"]';
 const roots = [...document.querySelectorAll<HTMLElement>(rootSelector)].filter(root => visible(root) && !root.parentElement?.closest(rootSelector));
 const messages: ProviderDomMessage[] = [];
 for (const root of roots.slice(-200)) {
  const publicMessage = (element: HTMLElement): boolean => {
   const channelNode = element.closest('[data-channel],[data-message-channel]');
   const channel = channelNode?.getAttribute('data-channel') ?? channelNode?.getAttribute('data-message-channel');
   return visible(element) && (!channel || channel === 'final') && !element.closest('[data-testid*="reasoning"],.reasoning,.thinking');
  };
  const candidates = (root.matches('[data-message-author-role]') ? [root] : [...root.querySelectorAll<HTMLElement>('[data-message-author-role]')]).filter(publicMessage);
  if (candidates.length !== 1) continue;
  const message = candidates[0]!, id = message.getAttribute('data-message-id') ?? root.getAttribute('data-message-id');
  if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
  const role = message.getAttribute('data-message-author-role'); if (role !== 'user' && role !== 'assistant') continue;
  const content = message.querySelector<HTMLElement>(role === 'user' ? '.whitespace-pre-wrap' : '.markdown') ?? message;
  const copy = content.cloneNode(true) as HTMLElement;
  for (const element of copy.querySelectorAll('[data-testid*="action"],[class*="message-actions"],[class*="reasoning"],[class*="thinking"],[data-channel]:not([data-channel="final"]),[data-message-channel]:not([data-message-channel="final"]),[class*="tool-call"],[role="status"],button,[role="button"],script,style')) element.remove();
  for (const math of copy.querySelectorAll('.katex-display,.katex')) {
   if (!copy.contains(math)) continue;
   const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
   if (source) math.replaceWith(document.createTextNode((math.classList.contains('katex-display') ? '$$\n' : '$') + source + (math.classList.contains('katex-display') ? '\n$$' : '$')));
  }
  const parent = message.getAttribute('data-parent-id') ?? message.getAttribute('data-parent-message-id') ?? root.getAttribute('data-parent-id');
  const parentKnown = parent !== null && (parent === '' || /^[\w-]{1,100}$/.test(parent));
  messages.push({ id, copy: role === 'assistant' ? copyControl(root, selectorFor) : undefined, selector: selectorFor(message), parentId: parentKnown && parent ? parent : undefined, parentKnown, role,
   text: role === 'user' ? content.innerText : copy.textContent ?? '', html: copy.innerHTML,
   partial: roots.length > 200 || root.getAttribute('data-truncated') === 'true' || message.getAttribute('aria-busy') === 'true' });
 }
 return { url: url.href, conversationId: rawId,
  composer: usable(composer) ? { selector: selectorFor(composer), value: composer.tagName === 'TEXTAREA' ? (composer as HTMLTextAreaElement).value : composer.innerText } : undefined,
  submit: usable(submit) ? { selector: selectorFor(submit), shared: false, signature: '' } : undefined,
  newConversation: usable(newChat) ? selectorFor(newChat) : undefined,
  generating: [...document.querySelectorAll('button[data-testid="stop-button"],button[aria-label*="Stop generating"],button[aria-label*="停止"],[data-message-author-role="assistant"][aria-busy="true"]')].some(visible),
  loginRequired: [...document.querySelectorAll('button[data-testid="login-button"],a[href*="auth/login"],input[type="password"],input[type="tel"]')].some(visible),
  challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="challenge"],[data-testid="captcha"],#challenge-running')].some(visible),
  messages, messageRootCount: roots.length,
  messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
  interrupted: [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim())),
 };
}
export const CHATGPT_DOM_READ = '(' + readChatGptDom.toString() + ')(' + websiteCopyControl.toString() + ')';
