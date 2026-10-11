import { websiteCopyControl } from './provider-copy';
// Selector reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import type { ProviderDom as DeepSeekDom, ProviderDomMessage as DeepSeekDomMessage } from './provider-dom';
export type { ProviderDom as DeepSeekDom } from './provider-dom';

/** Self-contained read-only program evaluated in the selected guest, never in the host document. */
function readDeepSeekDom(copyControl: typeof websiteCopyControl): DeepSeekDom {
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
   const parent: Element | null = node.parentElement;
   if (!parent) break;
   path.unshift(node.tagName.toLowerCase() + ':nth-child(' + ([...parent.children].indexOf(node) + 1) + ')');
   node = parent;
  }
  return 'html > ' + path.join(' > ');
 };
 const usable = (element: HTMLElement | undefined): element is HTMLElement => !!element && !element.hasAttribute('disabled')
  && element.getAttribute('aria-disabled') !== 'true' && !element.classList.contains('ds-button--disabled');
 const composer = unique(['textarea#chat-input', 'textarea.ds-scroll-area', 'textarea[class*="ds-"]', 'textarea[placeholder*="DeepSeek"]', 'div[contenteditable="true"][role="textbox"]']);
 const value = composer instanceof HTMLTextAreaElement ? composer.value : composer?.innerText ?? '';
 const submit = unique(['div[role="button"].ds-button--primary.ds-button--circle:not(.ds-button--disabled):not([aria-disabled="true"])',
  'button[aria-label*="发送"]:not(:disabled)', 'button[aria-label*="Send"]:not(:disabled)', 'button[type="submit"]:not(:disabled)']);
 const knownStop = [...document.querySelectorAll('button[aria-label*="停止"],button[aria-label*="Stop"],[data-testid="stop-button"],[aria-busy="true"]')].some(visible);
 const shared = !!submit?.matches('div[role="button"].ds-button--primary.ds-button--circle');
 const namedNewChat = [...document.querySelectorAll<HTMLElement>('button,[role="button"]')].filter(element => visible(element) && /^(开启新对话|新对话|New chat)$/i.test(element.innerText.trim()));
 const newChat = unique(['button[aria-label*="新对话"]', '[role="button"][aria-label*="新对话"]', 'button[aria-label="New chat"]'])
  ?? (namedNewChat.length === 1 ? namedNewChat[0] : undefined);
 const url = new URL(location.href);
 const rawId = url.pathname.match(/\/(?:a\/)?chat\/(?:s\/)?([^/?#]+)/)?.[1] ?? url.searchParams.get('chat_session_id');
 const conversationId = rawId && /^[\w-]{1,100}$/.test(rawId) ? rawId : undefined;
 const roots = [...document.querySelectorAll<HTMLElement>('[data-virtual-list-item-key],[data-message-id]')]
  .filter(root => !root.parentElement?.closest('[data-virtual-list-item-key],[data-message-id]'));
 const messages: DeepSeekDomMessage[] = [];
 for (const root of roots.slice(-200)) {
  const id = root.getAttribute('data-message-id') ?? root.getAttribute('data-virtual-list-item-key');
  if (!id || !/^[\w-]{1,100}$/.test(id)) continue;
  const user = root.matches('[data-role="user"],.ds-user-message') || !!root.querySelector('[data-role="user"],.ds-user-message');
  const assistant = root.matches('[data-role="assistant"],.ds-assistant-message') || !!root.querySelector('[data-role="assistant"],.ds-assistant-message,.ds-assistant-message-main-content');
  if (user === assistant) continue;
  const role = user ? 'user' : 'assistant';
  const content = user ? root.querySelector<HTMLElement>('[data-role="user"],.ds-user-message') ?? root
   : root.querySelector<HTMLElement>('.ds-assistant-message-main-content,[data-role="assistant"],.ds-assistant-message') ?? root;
  const copy = content.cloneNode(true) as HTMLElement;
  for (const element of copy.querySelectorAll('.ds-think-content,[class*="think-content"],[class*="reasoning"],[class*="search-plan"],[class*="search-process"],[class*="tool-call"],[role="status"],button,[role="button"],script,style')) element.remove();
  // Preserve TeX source when converting the scoped answer HTML to Markdown later.
  for (const math of copy.querySelectorAll('.katex-display,.katex')) {
   if (!copy.contains(math)) continue;
   const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
   if (source) math.replaceWith(document.createTextNode((math.classList.contains('katex-display') ? '$$\n' : '$') + source + (math.classList.contains('katex-display') ? '\n$$' : '$')));
  }
  const parent = root.getAttribute('data-parent-id') ?? root.getAttribute('data-parent-message-id');
  messages.push({ id, copy: role === 'assistant' ? copyControl(root, selectorFor) : undefined, selector: selectorFor(root), parentId: parent && /^[\w-]{1,100}$/.test(parent) ? parent : undefined,
   parentKnown: parent !== null && (parent === '' || /^[\w-]{1,100}$/.test(parent)), role,
   text: copy.textContent ?? '', html: copy.innerHTML,
   partial: roots.length > 200 || root.getAttribute('data-truncated') === 'true' || root.getAttribute('aria-busy') === 'true' });
 }
 const interrupted = [...document.querySelectorAll<HTMLElement>('[role="status"]')].some(element => visible(element) && /^(已停止|Stopped)$/i.test(element.innerText.trim()));
 return {
  url: url.href, conversationId,
  composer: composer ? { selector: selectorFor(composer), value } : undefined,
  submit: usable(submit) ? { selector: selectorFor(submit), shared, signature: (submit.querySelector('svg')?.innerHTML ?? submit.innerHTML).slice(0, 4096) } : undefined,
  newConversation: usable(newChat) ? selectorFor(newChat) : undefined,
  generating: knownStop || (shared && usable(submit) && value.trim() === ''),
  loginRequired: [...document.querySelectorAll('input[type="tel"],input[type="password"],a[href*="login"]')].some(visible),
  challenge: [...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="challenge"],[data-testid="captcha"]')].some(visible),
  messages, messageRootCount: roots.length,
  messageIdentitiesComplete: messages.length === roots.length && new Set(messages.map(message => message.id)).size === messages.length,
  interrupted,
 };
}

export const DEEPSEEK_DOM_READ = '(' + readDeepSeekDom.toString() + ')(' + websiteCopyControl.toString() + ')';
