import type { WereadConfig,WereadWidget } from "../dashboard/types/index";


export function normalizedWidgets(cfg?: WereadConfig): WereadWidget[] {
	if (cfg?.widgets?.length) return cfg.widgets;
	return [{ id: 'w1', view: 'shelf', groupBy: 'readingState' }];
}


// Local structural aliases to keep the render functions decoupled from the
// service's exported interfaces (which carry optional fields).
export type WereadBookLike = {
	bookId: string;
	title: string;
	author: string;
	cover?: string;
	progress: number;
	finished?: boolean;
	readingTime?: number;
	category?: string;
	readingState: 'notStarted' | 'reading' | 'finished';
	contentType: 'book' | 'audio' | 'article';
	lastReadTime?: number;
	noteCount?: number;
	bookmarkCount?: number;
	reviewCount?: number;
};

export type WereadNotebookLike = {
	bookId: string;
	title: string;
	author: string;
	noteCount: number;
	bookmarkCount: number;
	reviewCount: number;
};

export type WereadBookmarkLike = { bookId: string; chapterUid?: number; markText: string };