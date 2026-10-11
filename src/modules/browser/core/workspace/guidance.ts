import { BrowserError } from '../model';
import { officialWorkspaceOrigin } from '../providers/official-url';
import type { SelectionSource, WorkspaceProvider } from './model';

/** Public location and geometric bounds only; no HTML, scripts, screenshot data or credentials. */
export function validateSelection(source: SelectionSource, provider: WorkspaceProvider, profileId?: string): void {
	const id = (value: unknown): boolean => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
	const fail = (): never => { throw new BrowserError('browser_workspace_selection_invalid'); };
	if (!source || !source.page || ![source.page.pageId, source.page.profileId, source.page.generation].every(id)
		|| (profileId !== undefined && source.page.profileId !== profileId)
		|| typeof source.url !== 'string' || !officialWorkspaceOrigin(provider, source.url)
		|| typeof source.title !== 'string' || typeof source.selector !== 'string' || !source.selector || source.selector.length > 4000
		|| !source.rect || !source.viewport || ![source.rect.x, source.rect.y, source.rect.width, source.rect.height, source.viewport.width, source.viewport.height].every(value => Number.isFinite(value))
		|| source.rect.width <= 0 || source.rect.height <= 0 || source.viewport.width <= 0 || source.viewport.height <= 0
		|| (source.conversationId !== undefined && !id(source.conversationId)) || (source.messageId !== undefined && !id(source.messageId))) fail();
}
