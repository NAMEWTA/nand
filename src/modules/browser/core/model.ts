import type { SearchEngine } from '../../../shared/web-url';
import { DEFAULT_WORKSPACE_FOLDER, workspaceFolder } from './workspace/location';

export type { SearchEngine };
export const BROWSER_PAGE_TYPE = 'nand-browser-view';
export type BrowserTarget = 'tab' | 'modal';
export interface BrowserSettings {
	searchEngine: SearchEngine;
	/** Let agent sessions started from NAND control the browser through the local bridge (off by default). */
	agentAccess: boolean;
	workspaceFolder?: string;
}
export interface BrowserOpenRequest {
	profileId?: string;
	url?: string;
	target?: BrowserTarget;
	reuse?: boolean;
	zoom?: number;
	title?: string;
	scroll?: { x: number; y: number };
}
export interface BrowserPageState {
	id: string;
	profileId?: string;
	url: string;
	title: string;
	zoom: number;
	loading: boolean;
	canGoBack: boolean;
	canGoForward: boolean;
	error: string | null;
	favicon: string;
	scroll?: { x: number; y: number };
}
export interface BrowserHistoryEntry {
	url: string;
	title: string;
	visitedAt: number;
}
export interface BrowserDownload {
	id: string;
	name: string;
	received: number;
	total: number;
	state: string;
	path: string;
}
export interface BrowserSnapshotRef {
	ref: string;
	role: string;
	name: string;
	/** Display ordinal suffixes do not make a repeated role/name a stable workflow locator. */
	ambiguous?: boolean;
}
export interface BrowserRect {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface BrowserGrab {
	url: string;
	title: string;
	selector: string;
	text: string;
	html: string;
	styles: Record<string, string>;
	source: string | null;
	rect: BrowserRect;
	screenshot: string | null;
	viewport: { width: number; height: number };
	/** Only public identities explicitly declared by the selected element's ancestors. */
	messageId?: string;
	conversationId?: string;
}
export interface BrowserAgent {
	id: string;
	title: string;
}
export interface BrowserAgentDeliveryPort {
	list(): Promise<BrowserAgent[]>;
	attach(agentId: string, text: string, files: string[]): Promise<void>;
}
export interface BrowserAutomationPort {
	execute(method: string, params: Record<string, unknown>, admission?: () => void): Promise<unknown>;
}
export class BrowserError extends Error {
	constructor(
		public readonly code: string,
		message = code,
	) {
		super(message);
		this.name = 'BrowserError';
	}
}
export function newPageState(id: string, value: Partial<BrowserPageState> = {}): BrowserPageState {
	return {
		id,
		profileId: typeof value.profileId === 'string' ? value.profileId : 'default',
		url: typeof value.url === 'string' ? value.url : 'about:blank',
		title: typeof value.title === 'string' ? value.title : '',
		zoom: clampZoom(value.zoom),
		loading: false,
		canGoBack: false,
		canGoForward: false,
		error: null,
		favicon: '',
		...(value.scroll && Number.isFinite(value.scroll.x) && Number.isFinite(value.scroll.y)
			? { scroll: { x: Math.max(0, value.scroll.x), y: Math.max(0, value.scroll.y) } }
			: {}),
	};
}
export function clampZoom(value?: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.min(2, Math.max(0.5, value)) : 1;
}
export function normalizeBrowserSettings(raw: unknown): BrowserSettings {
	const value = raw as Partial<BrowserSettings> | null;
	const engine = value?.searchEngine;
	return { searchEngine: engine === 'bing' || engine === 'duckduckgo' ? engine : 'google', agentAccess: value?.agentAccess === true,
		workspaceFolder: workspaceFolder(value?.workspaceFolder) ?? DEFAULT_WORKSPACE_FOLDER };
}
