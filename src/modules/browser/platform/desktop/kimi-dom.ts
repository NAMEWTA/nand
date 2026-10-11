import { websiteCopyControl } from './provider-copy';
// Selector/content reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import type { ProviderDom, ProviderDomMessage } from './provider-dom';

/** Static, read-only guest program. Native input remains in the existing operation queue. */
function readKimiDom(copyControl: typeof websiteCopyControl): ProviderDom {
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
 const usable = (element: HTMLElement | undefined): element is HTMLElement => !!element && !element.hasAttribute('disabled')
  && element.getAttribute('aria-disabled') !== 'true' && !element.classList.contains('disabled');
 const composer = unique(['div.chat-input-editor[contenteditable="true"][data-lexical-editor="true"]',
  'div[contenteditable="true"][data-lexical-editor="true"]', 'div.chat-input-editor[contenteditable="true"]',
  'div.ProseMirror[contenteditable="true"]', 'textarea']);
 const submit = unique(['.send-button-container:not(.stop):not(.disabled):not([aria-disabled="true"])',
  'button[aria-label*="发送"]:not(:disabled)', 'button[aria-label*="Send"]:not(:disabled)', 'button[type="submit"]:not(:disabled)']);
 const namedNewChat = [...document.querySelectorAll<HTMLElement>('button,[role="button"]')]
  .filter(element => visible(element) && /^(新建会话|新建对话|New chat)$/i.test(element.innerText.trim()));
 const newChat = unique(['button[aria-label*="新建会话"]', 'button[aria-label*="新建对话"]', 'button[aria-label="New chat"]'])
  ?? (namedNewChat.length === 1 ? namedNewChat[0] : undefined);
 const url = new URL(location.href), rawId = url.pathname.match(/^\/chat\/([^/?#]+)\/?$/)?.[1] ?? url.searchParams.get('chat_id') ?? url.searchParams.get('chatId');
 const conversationId = rawId && /^[\w-]{1,100}$/.test(rawId) ? rawId : undefined;
 const rootSelector = '[data-message-id],.chat-content-item-user,.chat-content-item-assistant,[data-role="user"],[data-role="assistant"]';
 const roots = [...document.querySelectorAll<HTMLElement>(rootSelector)].filter(root => !root.parentElement?.closest(rootSelector));
 const messages: ProviderDomMessage[] = [];
 for (const root of roots.slice(-200)) {
  const id = root.getAttribute('data-message-id'); if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
  const user = root.matches('.chat-content-item-user,[data-role="user"]') || !!root.querySelector('.segment-user,[data-role="user"]');
  const assistant = root.matches('.chat-content-item-assistant,[data-role="assistant"]') || !!root.querySelector('.segment-assistant,[data-role="assistant"]');
  if (user === assistant) continue;
  const role = user ? 'user' : 'assistant';
  const content = root.querySelector<HTMLElement>(user ? '.segment-user,[data-role="user"]' : '.segment-assistant .segment-content,.segment-assistant,.segment-content,[data-role="assistant"]') ?? root;
  const copy = content.cloneNode(true) as HTMLElement;
  for (const element of copy.querySelectorAll('[class*="thinking"],[class*="reasoning"],[class*="search-process"],[class*="search-status"],[class*="tool-call"],[class*="loading"],[role="status"],button,[role="button"],script,style')) element.remove();
  for (const math of copy.querySelectorAll('.katex-display,.katex')) {
   if (!copy.contains(math)) continue;
   const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
   if (source) math.replaceWith(document.createTextNode((math.classList.contains('katex-display') ? '$$\n' : '$') + source + (math.classList.contains('katex-display') ? '\n$$' : '$')));
  }
  const parent = root.getAttribute('data-parent-id') ?? root.getAttribute('data-parent-message-id');
  const parentKnown = parent !== null && (parent === '' || /^[\w-]{1,100}$/.test(parent));
  messages.push({ id, copy: role === 'assistant' ? copyControl(root, selectorFor) : undefined, selector: selectorFor(root), parentId: parentKnown && parent ? parent : undefined, parentKnown, role,
   text: user ? content.innerText : copy.textContent ?? '', html: copy.innerHTML,
   partial: roots.length > 200 || root.getAttribute('data-truncated') === 'true' || root.getAttribute('aria-busy') === 'true' });
 }
 return { url: url.href, conversationId,
  composer: usable(composer) ? { selector: selectorFor(composer), value: composer.tagName === 'TEXTAREA' ? (composer as HTMLTextAreaElement).value : composer.innerText } : undefined,
  submit: usable(submit) ? { selector: selectorFor(submit), shared: false, signature: '' } : undefined,
  newConversation: usable(newChat) ? selectorFor(newChat) : undefined,
  generating: [...document.querySelectorAll('.send-button-container.stop,button[aria-label*="停止"],button[aria-label*="Stop"],[data-role="assistant"][aria-busy="true"],.segment-assistant[aria-busy="true"],.segment-loading')].some(visible),
  loginRequired: [...document.querySelectorAll('input[type="tel"],input[type="password"],a[href*="login"]')].some(visible),
  challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="challenge"],[data-testid="captcha"]')].some(visible),
  messages, messageRootCount: roots.length,
  messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
  interrupted: [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim())),
 };
}
export const KIMI_DOM_READ = '(' + readKimiDom.toString() + ')(' + websiteCopyControl.toString() + ')';
