import { Notice, type App } from 'obsidian';
import { contentFiles } from './content-files';
import { isContentPath } from '../../../shared/storage/content-paths';
import { t } from '../../../shared/i18n';

const fragment = (link: string) => link.includes('#') ? link.slice(link.indexOf('#')).split('|')[0]! : '';

/** Repairs NAND references in native reading views as well as NAND's own preview. */
export async function renderContentLinks(app: App, element: HTMLElement, source: string): Promise<void> {
	const files = contentFiles(app);
	for (const link of element.querySelectorAll<HTMLElement>('a.internal-link')) {
		const raw = link.dataset.href ?? link.getAttribute('href') ?? '';
		const target = files.resolveLink(raw, source);
		if (target && (isContentPath(target.path) || isContentPath(source))) link.dataset.href = target.path + fragment(raw);
	}
	for (const embed of element.querySelectorAll<HTMLElement>('.internal-embed')) {
		const raw = embed.getAttribute('src') ?? embed.dataset.src ?? '';
		const target = files.resolveLink(raw, source);
		if (!target || !isContentPath(target.path) && !isContentPath(source)) continue;
		embed.empty();
		if (/^(png|jpg|jpeg|gif|webp|svg|avif)$/i.test(target.extension)) embed.createEl('img', { attr: { src: await files.resourceUrl(target.path), alt: target.basename } });
		else embed.createEl('a', { cls: 'internal-link', text: target.name, attr: { 'data-href': target.path, href: '#' } });
	}
}

export function handleContentLink(app: App, event: MouseEvent, source = ''): boolean {
	const node = event.target as Node | null;
	const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
	const link = element?.closest<HTMLElement>('a.internal-link, a[data-href]');
	if (!link) return false;
	const raw = link.dataset.href ?? link.getAttribute('href') ?? '';
	const files = contentFiles(app), target = files.resolveLink(raw, source);
	if (!target || !isContentPath(target.path) && !isContentPath(source)) return false;
	event.preventDefault(); event.stopImmediatePropagation();
	void files.open(target.path + fragment(raw), link.ownerDocument.defaultView ?? undefined).catch(error => { console.error('[NAND content link]', error); new Notice(t('content.saveFailed', { error: String(error) })); });
	return true;
}
