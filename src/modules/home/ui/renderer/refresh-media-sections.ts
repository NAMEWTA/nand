import { DEFAULT_HIGHLIGHT_IMPORT_PATH } from '../../core/board/default-paths';
import { setLocalizedAttribute, localizedAttributes, localizedText } from '../../../../ui/primitives/localized-dom';
import type { HoverParent } from 'obsidian';
import { App, Platform, setIcon } from 'obsidian';
import { partnerIndexOf } from '../../core/board/column-pairs';
import type { DashboardColumn, DashboardData, DashboardSettings } from '../../core/board/types/index';
import { MEDIA_SECTION_TYPES } from '../../core/media/section-types';
import { renderCalendarSection } from '../calendar/calendar-section';
import { renderDataviewSection } from '../dataview/render-dataview-section';
import { renderLibrarySection } from '../library/render-library-section';
import { destroyMediaSection, renderMediaSection } from '../media/media-section';
import type { RenderCallbacks } from '../render-contract';
import { startGuardedDrag } from '../ui/drag-guard';
import { captureScrollStates, restoreScrollStates } from '../ui/scroll-preserve';
import { renderWebSection } from '../web/web-section';
import { renderWereadSection } from '../weread/render-weread-section';
import { renderCard } from './render-card';
import { bindRenderContext, getRenderContext, type DashboardRenderContext } from './render-context';
import { getSectionType } from './render-text-with-links';
import { homeServices } from '../../services/instances';

export function refreshMediaSections(
	kanban: HTMLElement,
	data: DashboardData,
	callbacks: RenderCallbacks,
	app: App,
	settings: DashboardSettings | undefined,
	hoverParent: HoverParent | null,
	shouldRefresh?: (column: DashboardColumn) => boolean,
): number {
	getRenderContext(kanban).hoverParent = hoverParent;
	let refreshed = 0;
	for (const column of data.columns) {
		if (!MEDIA_SECTION_TYPES.has(getSectionType(column))) continue;
		if (shouldRefresh && !shouldRefresh(column)) continue;
		const matched = kanban.querySelector(`:scope > [data-column="${CSS.escape(column.name)}"]`);
		if (!(matched instanceof HTMLElement)) continue;
		const scrollStates = captureScrollStates(matched);
		destroyMediaSection(matched);
		const newEl = renderSection(column, callbacks, app, data, settings, getRenderContext(kanban));
		matched.replaceWith(newEl);
		restoreScrollStates(newEl, scrollStates);
		refreshed++;
	}
	return refreshed;
}
const COLLAPSED_KEY = 'nand.dashboard.media-collapsed';
function getCollapsedSections(app: App): Set<string> {
	try {
		const raw = app.loadLocalStorage(COLLAPSED_KEY) as string | null;
		if (!raw) return new Set();
		return new Set(JSON.parse(raw) as string[]);
	} catch {
		return new Set();
	}
}
function saveCollapsedSections(app: App, collapsed: Set<string>): void {
	app.saveLocalStorage(COLLAPSED_KEY, JSON.stringify([...collapsed]));
}
function attachSectionResizeHandle(el: HTMLElement, column: DashboardColumn, callbacks: RenderCallbacks): void {
	if (Platform.isMobile) return;
	// Memo and web sections are driven by a fixed CSS height, so the drag must
	// write inline height as well; other types are content-sized rows where
	// max-height can only clamp (shrink), never grow.
	const isFixedHeight = getSectionType(column) === 'memo' || getSectionType(column) === 'web';
	const handle = el.createDiv({ cls: 'dashboard-section-resize-handle' });
	handle.addEventListener('pointerdown', (e) => {
		if (!el.parentElement) return;
		const startY = e.clientY;
		const startHeight = el.offsetHeight;
		el.addClass('dashboard-section-row--resizing');
		// Guarded drag (pointer capture + viewport shield, see drag-guard):
		// keeps the move/up stream whole across embedded frames and Windows
		// webview surface overflow. frames-muted stays for hover calm.
		const shieldHost = el.closest('.nand-dashboard-root') ?? el.parentElement;
		shieldHost?.addClass('dashboard-frames-muted');

		startGuardedDrag(e, {
			cursor: 'ns-resize',
			onMove: (ev) => {
				// The row can be torn down mid-drag by a re-render; resizing a
				// detached element is stale work, so stop touching it.
				if (!el.isConnected) {
					el.removeClass('dashboard-section-row--resizing');
					shieldHost?.removeClass('dashboard-frames-muted');
					return;
				}
				const delta = ev.clientY - startY;
				const newHeight = Math.max(160, Math.min(2000, startHeight + delta));
				el.style.maxHeight = `${newHeight}px`;
				if (isFixedHeight) el.style.height = `${newHeight}px`;
			},
			onUp: (ev) => {
				el.removeClass('dashboard-section-row--resizing');
				shieldHost?.removeClass('dashboard-frames-muted');
				const finalHeight = Math.max(160, Math.min(2000, startHeight + (ev.clientY - startY)));
				if (finalHeight !== column.height) {
					callbacks.onColumnHeightChange(column.name, finalHeight);
				}
			},
		});
	});
}
function clampPairWidth(width: unknown): number {
	return typeof width === 'number' && Number.isFinite(width) ? Math.max(20, Math.min(80, Math.round(width))) : 50;
}
export function applyPairWidth(
	el: HTMLElement,
	column: DashboardColumn,
	data: DashboardData | undefined,
	callbacks: RenderCallbacks,
): void {
	if (!data) return;
	const idx = data.columns.indexOf(column);
	if (idx < 0) return;
	const partner = partnerIndexOf(data.columns, idx);
	if (partner === idx + 1) {
		el.addClass('dashboard-section-row--pair-left');
		el.style.setProperty('--db-pair-basis', `${clampPairWidth(column.width)}%`);
		attachPairWidthHandle(el, column, callbacks);
	} else if (partner === idx - 1) {
		const left = data.columns[partner]!;
		el.style.setProperty('--db-pair-basis', `${100 - clampPairWidth(left.width)}%`);
	}
}
function attachPairWidthHandle(el: HTMLElement, column: DashboardColumn, callbacks: RenderCallbacks): void {
	const handle = el.createDiv({ cls: 'dashboard-pair-width-handle' });
	setLocalizedAttribute(handle, 'aria-label', 'renderer.pairWidthHint');
	setLocalizedAttribute(handle, 'aria-label', 'renderer.pairWidthHint');
	handle.addEventListener('pointerdown', (e) => {
		const board = el.parentElement;
		const partnerEl = el.nextElementSibling;
		if (!board || !(partnerEl instanceof HTMLElement) || !partnerEl.hasClass('dashboard-section-row--half')) return;
		// Split math runs against the draggable span (line minus the one
		// gutter between the halves), reading the gutter from the board's own
		// --db-kanban-gap so a future CSS retune keeps the drag calibrated.
		const gutter = parseFloat(getComputedStyle(board).getPropertyValue('--db-kanban-gap')) || 10;
		const usable = board.clientWidth - gutter;
		if (usable <= 0) return;
		const startX = e.clientX;
		const startPct = clampPairWidth(column.width);
		let lastPct = startPct;
		el.addClass('dashboard-section-row--resizing');
		// Guarded drag (pointer capture + viewport shield, see drag-guard):
		// the pair divider shares a gutter-adjacent strip with everything the
		// board hosts, and on Windows a webview surface can overflow onto the
		// strip mid-drag — capture keeps the stream on this document.
		const shieldHost = el.closest('.nand-dashboard-root') ?? board;
		shieldHost.addClass('dashboard-frames-muted');
		startGuardedDrag(e, {
			cursor: 'col-resize',
			onMove: (ev) => {
				// The row can be torn down mid-drag by a re-render; stop rather
				// than resize a detached element.
				if (!el.isConnected) {
					el.removeClass('dashboard-section-row--resizing');
					shieldHost.removeClass('dashboard-frames-muted');
					return;
				}
				lastPct = Math.max(20, Math.min(80, startPct + ((ev.clientX - startX) / usable) * 100));
				el.style.setProperty('--db-pair-basis', `${lastPct}%`);
				partnerEl.style.setProperty('--db-pair-basis', `${100 - lastPct}%`);
			},
			onUp: () => {
				el.removeClass('dashboard-section-row--resizing');
				shieldHost.removeClass('dashboard-frames-muted');
				const rounded = Math.round(lastPct);
				// Snap BOTH inline bases to the rounded value: the live drag wrote
				// un-rounded percentages, and any update path that refreshes only
				// one half in place would otherwise leave a stale mate whose basis
				// sums past 100% and wraps the pair.
				el.style.setProperty('--db-pair-basis', `${rounded}%`);
				partnerEl.style.setProperty('--db-pair-basis', `${100 - rounded}%`);
				if (rounded !== Math.round(startPct)) {
					callbacks.onColumnWidthChange(column.name, rounded);
				}
			},
		});
	});
}
export function renderSection(
	column: DashboardColumn,
	callbacks: RenderCallbacks,
	app: App,
	data?: DashboardData,
	settings?: DashboardSettings,
	context?: DashboardRenderContext,
): HTMLElement {
	const el = createDiv();
	if (context) bindRenderContext(el, context);
	el.addClass('dashboard-section-row');
	el.dataset.column = column.name;
	const sectionType = getSectionType(column);
	el.dataset.sectionType = sectionType;

	const collapsed = getCollapsedSections(app);
	if (collapsed.has(column.name)) {
		el.addClass('dashboard-section-row--collapsed');
	}

	// Apply user-dragged height (desktop). Overrides the per-type max-height.
	// Desktop-only: the resize handle that sets it never runs on mobile, and a px
	// value tuned on a big screen would clamp phone rows far below the mobile
	// CSS sizing (50vh-family), shrinking card bodies to a sliver.
	if (!Platform.isMobile && typeof column.height === 'number' && column.height > 0) {
		el.style.maxHeight = `${column.height}px`;
		// Memo (aligned with Quick Links) and web (the frame fills the row)
		// sections have a fixed CSS height, so max-height alone can only shrink
		// them. Write the inline height too so the drag-resized value can also
		// grow the section past the default.
		if (sectionType === 'memo' || sectionType === 'web') {
			el.style.height = `${column.height}px`;
		}
	}

	// Side-by-side pairing (desktop only): mobile keeps full-width stacking —
	// the class never renders there, so the mobile CSS sizing is untouched.
	if (!Platform.isMobile && column.half) {
		el.addClass('dashboard-section-row--half');
		applyPairWidth(el, column, data, callbacks);
	}

	attachSectionResizeHandle(el, column, callbacks);

	const header = el.createDiv({ cls: 'dashboard-section-header' });

	// Drag handle to reorder sections (desktop only).
	const titleWrap = header.createDiv({ cls: 'dashboard-section-title-wrap' });

	// Drag handle sits at the far left, grouped with the title so the header's
	// space-between layout keeps the title left-aligned (not centered).
	if (!Platform.isMobile) {
		const grip = titleWrap.createDiv({ cls: 'dashboard-section-grip' });
		grip.setAttribute('draggable', 'true');
		setLocalizedAttribute(grip, 'aria-label', 'renderer.dragSection');
		setIcon(grip, 'grip-vertical');
	}

	const titleEl = titleWrap.createEl('h3', { text: column.name, cls: 'dashboard-section-title' });

	titleEl.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		const currentName = titleEl.getText();
		titleEl.empty();
		const input = titleEl.createEl('input', {
			cls: 'dashboard-section-rename-input',
			attr: { type: 'text', value: currentName },
		});
		input.focus();
		input.select();

		const finish = (save: boolean) => {
			const newName = input.value.trim();
			if (save && newName && newName !== currentName) {
				callbacks.onColumnRename(currentName, newName, data ? data.columns.indexOf(column) : -1);
			} else {
				titleEl.empty();
				titleEl.setText(currentName);
			}
		};

		input.addEventListener('keydown', (ke: KeyboardEvent) => {
			if (ke.key === 'Enter') {
				ke.preventDefault();
				finish(true);
			} else if (ke.key === 'Escape') {
				ke.preventDefault();
				finish(false);
			}
		});

		input.addEventListener('blur', () => {
			finish(true);
		});
	});
	titleEl.setCssProps({ cursor: 'pointer' });

	// Collapse toggle sits right after the title (keeps it out of the header
	// actions group, whose button count varies per section type).
	const toggle = titleWrap.createDiv({ cls: 'dashboard-section-toggle' });
	toggle.setAttribute('role', 'button');
	setLocalizedAttribute(toggle, 'aria-label', 'renderer.toggleSection');
	toggle.addEventListener('click', (e) => {
		e.stopPropagation();
		const isNowCollapsed = el.hasClass('dashboard-section-row--collapsed');
		if (isNowCollapsed) {
			el.removeClass('dashboard-section-row--collapsed');
			collapsed.delete(column.name);
		} else {
			el.addClass('dashboard-section-row--collapsed');
			collapsed.add(column.name);
		}
		saveCollapsedSections(app, collapsed);
	});

	const headerActions = header.createDiv({ cls: 'dashboard-section-header-actions' });

	// Sticky ("便利贴") sections mix memo and todo cards: they get the one-click
	// archive button like todo sections, but NOT the task-template button — cards
	// are always created through the type chooser (onCardAdd -> StickyCardTypeModal).
	if (sectionType === 'todo' || sectionType === 'sticky') {
		const archiveBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('renderer.archiveTasks', undefined, 'aria-label') },
		});
		setIcon(archiveBtn, 'archive');
		archiveBtn.addEventListener('click', () => callbacks.onArchiveTasks(column.name));
	}

	if (sectionType === 'todo') {
		const templateBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('template.addFromTemplate', undefined, 'aria-label') },
		});
		setIcon(templateBtn, 'layout-template');
		templateBtn.addEventListener('click', () => callbacks.onAddFromTemplate(column.name));
	}

	// Library section: render differently
	if (sectionType === 'library' || sectionType === 'folder') {
		// A folder section with no folder set would otherwise list the entire vault
		// (queryVaultFiles skips the folder filter when it is empty). In that state
		// renderLibrarySection never runs, so the toolbar (which hosts the always-
		// visible config button) does not exist yet — keep a header config button
		// as the only entry point. For a configured folder or any library section,
		// renderLibrarySection renders that toolbar config button, so we skip this
		// header one to avoid a duplicate next to the delete button.
		const folderUnconfigured =
			sectionType === 'folder' &&
			!(column.libraryConfig?.folders && column.libraryConfig.folders.some((f) => f.trim()));

		if (folderUnconfigured) {
			const configBtn = headerActions.createEl('button', {
				cls: 'dashboard-section-add-btn',
				attr: { ...localizedAttributes('folder.configure', undefined, 'aria-label') },
			});
			setIcon(configBtn, 'settings');
			configBtn.addEventListener('click', () => {
				const event = new CustomEvent('dashboard-library-config', {
					detail: { columnName: column.name },
					bubbles: true,
				});
				el.dispatchEvent(event);
			});
		}

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
		});

		if (folderUnconfigured) {
			el.createDiv({ cls: 'dashboard-library-empty dashboard-folder-empty', ...localizedText('folder.empty') });
			return el;
		}

		renderLibrarySection(
			el,
			column,
			app,
			(config) => {
				callbacks.onLibraryConfigChange(column.name, config);
			},
			getRenderContext(el).hoverParent,
			getRenderContext(el).noteOpener,
		);
		return el;
	}

	// Images / videos sections: full-vault media thumbnail wall; the config
	// modal (gear) currently manages the excluded-folder set.
	if (sectionType === 'images' || sectionType === 'videos') {
		const configBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('media.configure', undefined, 'aria-label') },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', {
				detail: { columnName: column.name },
				bubbles: true,
			});
			el.dispatchEvent(event);
		});

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
		});

		renderMediaSection(
			el,
			column,
			app,
			getRenderContext(el).hoverParent,
			callbacks.onOpenNoteInPopover,
			(homeServices.mediaTags ?? null) ?? undefined,
		);
		return el;
	}

	// Calendar section: the sidebar calendar's enlarged view (full month grid
	// with multi-day bars / week time grid) embedded in the board. Shares the
	// sidebar widget's scan (calendarExcludeFolders) and refreshes in place on
	// vault task changes (see refreshCalendarSections).
	if (sectionType === 'calendar') {
		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
		});

		if (settings) {
			renderCalendarSection(el, app, settings, callbacks.onOpenNoteAtLine, callbacks.settingsAccess);
		} else {
			el.createDiv({ cls: 'dashboard-library-empty', ...localizedText('calendar.noEvents') });
		}
		return el;
	}

	// Weread section: reading data from the official API.
	if (sectionType === 'weread') {
		const configBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('weread.configure', undefined, 'aria-label') },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', {
				detail: { columnName: column.name },
				bubbles: true,
			});
			el.dispatchEvent(event);
		});

		// Refresh button — same icon-button style as the other header actions,
		// positioned just left of delete.
		const refreshBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('weread.refresh', undefined, 'aria-label') },
		});
		setIcon(refreshBtn, 'refresh-cw');
		let reload: (() => void) | null = null;
		refreshBtn.addEventListener('click', () => reload?.());

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
		});

		const apiKey = (settings?.wereadApiKey ?? '').trim();
		const importPath = settings?.wereadImportPath ?? DEFAULT_HIGHLIGHT_IMPORT_PATH;
		renderWereadSection(el, column, app, apiKey, importPath, (fn) => {
			reload = fn;
		});
		return el;
	}

	// Dataview section: DQL query results (TABLE/LIST/TASK/CALENDAR).
	if (sectionType === 'dataview') {
		// Manual refresh (deliberately NOT wired to the vault-change debounce).
		const refreshBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('dataview.refresh', undefined, 'aria-label') },
		});
		setIcon(refreshBtn, 'refresh-cw');
		let reload: (() => void) | null = null;
		refreshBtn.addEventListener('click', () => reload?.());

		const configBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('dataview.configure', undefined, 'aria-label') },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', {
				detail: { columnName: column.name },
				bubbles: true,
			});
			el.dispatchEvent(event);
		});

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
		});

		renderDataviewSection(
			el,
			column,
			app,
			getRenderContext(el).hoverParent,
			callbacks.onOpenNoteInPopover ?? null,
			(fn) => {
				reload = fn;
			},
			(cfg) => callbacks.onDataviewConfigChange(column.name, cfg),
		);
		return el;
	}

	// Web section: an embedded page. Frameable sites load as an iframe; sites
	// whose headers refuse framing load in a desktop webview (see web-section).
	if (sectionType === 'web') {
		for (const target of ['modal', 'tab'] as const) {
			const button = headerActions.createEl('button', {
				cls: 'dashboard-section-add-btn',
				attr: { ...localizedAttributes(`browser.${target}`, undefined, 'aria-label') },
			});
			setIcon(button, target === 'tab' ? 'panel-top' : 'app-window');
			button.addEventListener('click', () => {
				if (column.webConfig?.url) callbacks.onOpenWeb?.(column.webConfig.url, target);
			});
		}
		const refreshBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('web.refresh', undefined, 'aria-label') },
		});
		setIcon(refreshBtn, 'refresh-cw');
		let reload: (() => void) | null = null;
		refreshBtn.addEventListener('click', () => reload?.());

		const configBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('web.configure', undefined, 'aria-label') },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', {
				detail: { columnName: column.name },
				bubbles: true,
			});
			el.dispatchEvent(event);
		});

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
		});

		renderWebSection(el, column, (fn) => {
			reload = fn;
		});
		return el;
	}

	const addCardBtn = headerActions.createEl('button', {
		cls: 'dashboard-section-add-btn',
		attr: { ...localizedAttributes('renderer.addCardTo', { column: column.name }, 'aria-label') },
	});
	setIcon(addCardBtn, 'plus');
	addCardBtn.addEventListener('click', () => callbacks.onCardAdd(column.name));

	// Notes (cover / no-cover) sections: gear opens the per-section new-note
	// settings (template + save folder). Same dispatch the library sections'
	// config button uses; view.ts routes it by sectionType.
	if (sectionType === 'notes' || sectionType === 'projects') {
		const notesCfgBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { ...localizedAttributes('notesCfg.title', undefined, 'aria-label') },
		});
		setIcon(notesCfgBtn, 'settings');
		notesCfgBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', {
				detail: { columnName: column.name },
				bubbles: true,
			});
			el.dispatchEvent(event);
		});
	}

	const deleteSectionBtn = headerActions.createEl('button', {
		cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
		attr: { ...localizedAttributes('renderer.deleteSection', { column: column.name }, 'aria-label') },
	});
	setIcon(deleteSectionBtn, 'trash-2');
	deleteSectionBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		callbacks.onColumnDelete(column.name, data ? data.columns.indexOf(column) : -1);
	});

	const cardsContainer = el.createDiv({ cls: 'dashboard-section-cards' });

	for (const card of column.cards) {
		try {
			const cardEl = renderCard(
				card,
				column.name,
				sectionType,
				callbacks,
				app,
				data,
				settings,
				getRenderContext(el),
			);
			cardsContainer.appendChild(cardEl);
		} catch (err) {
			console.error('[Dashboard] renderCard error:', card.id, card.type, err);
		}
	}

	return el;
}
