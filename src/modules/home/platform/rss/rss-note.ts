// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-note.ts
import type { App } from 'obsidian';
import { stringify } from 'yaml';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { contentPath } from '../../../../shared/storage/content-paths';
import { t } from '../../../../shared/i18n';
import type { RssItem } from '../../core/rss/rss-xml';
import { stripHtmlText } from '../../core/rss/html-md';
export interface SaveRssArticleOptions {
	folder: string;
	feedTitle: string;
	item: RssItem;
	markdown: string;
}
const date = (time: number) => {
	const d = new Date(time);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function rssNoteName(item: RssItem, now = Date.now()): string {
	return `${date(item.pubDate ?? now)} ${item.title
		.replace(/[\\/:*?"<>|]/g, '')
		.replace(/\s+/g, ' ')
		.slice(0, 80)
		.trim()}`.trim();
}
export function buildRssNoteContent(opts: SaveRssArticleOptions, now = Date.now()): string {
	const { item, feedTitle, markdown } = opts,
		year = date(item.pubDate ?? now).slice(0, 4),
		summary = stripHtmlText(item.summaryHtml ?? item.contentHtml ?? '') || item.title;
	const props = {
		cssclasses: 'sb-second-brain',
		摘要: summary.length > 120 ? summary.slice(0, 120) + '…' : summary,
		类型: '收集',
		PARA分类: '收集箱',
		年份: year,
		年度页: `[[${year}]]`,
		状态: '待整理',
		Wiki摄入状态: '未摄入',
		领域: '',
		关联项目: [],
		Wiki关联: [],
		主题: [],
		来源: feedTitle,
		相关笔记: [],
		创建时间: date(now),
		更新时间: date(now),
	};
	return `---\n${stringify(props)}---\n\n${item.link ? `[${t('rss.openInBrowser')}](${item.link})\n\n` : ''}${markdown.trim()}\n`;
}
export async function saveRssArticle(app: App, opts: SaveRssArticleOptions) {
	const files = contentFiles(app),
		base = contentPath(`${opts.folder.trim().replace(/^\/+|\/+$/g, '') || 'NAND/RSS'}/${rssNoteName(opts.item)}`);
	for (let i = 1; i < 1000; i++) {
		const path = `${base}${i === 1 ? '' : `-${i}`}.md`;
		if (await app.vault.adapter.exists(path)) continue;
		try {
			return await files.create(path, buildRssNoteContent(opts));
		} catch (error) {
			if (!(await app.vault.adapter.exists(path))) throw error;
		}
	}
	throw new Error(t('rss.saveFailed'));
}
export async function exportRssOpml(app: App, text: string): Promise<string> {
	const files = contentFiles(app);
	for (let i = 0; i < 1000; i++) {
		const path = contentPath(`NAND/RSS/subscriptions${i ? `-${i}` : ''}.opml`);
		if (!(await app.vault.adapter.exists(path))) {
			await files.create(path, text);
			return path;
		}
	}
	throw new Error(t('rss.saveFailed'));
}
