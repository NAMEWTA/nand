import { bindLocalizedElement } from '../../primitives/localized-dom';
import { localizedAttributes, localizedText } from '../../primitives/localized-dom';
import { App, Modal, setIcon } from 'obsidian';
import { h } from 'preact';
import type { BannerData, BannerStatsConfig, QuoteItem } from '../../../core/dashboard/types/index';
import { getDailyNotesConfig } from '../../../platform/obsidian/calendar/daily-notes';
import { getHabitService } from '../../../platform/obsidian/habit/habit-service';
import { t } from '../../../shared/i18n/index';
import { MultiFolderSelectModal } from '../../primitives/folder-select-modal';
import { applyModalTheme } from '../appearance/modal-theme';
import { mountDashboardPanel } from '../renderer/render-context';
import { renderBannerStats } from './banner-stats';
import { BannerQuotePanel } from './BannerQuotePanel';
import { CENTER_STAT_OPTIONS, LEFT_STAT_OPTIONS, resolveStatsConfig, RIGHT_STAT_OPTIONS } from './stats-data';

export function getActiveQuote(banner: BannerData): QuoteItem {
	if (banner.quotes && banner.quotes.length > 0) {
		return banner.quotes[0]!;
	}
	return { quote: banner.quote, author: banner.author };
}

export function getActiveImage(banner: BannerData): string {
	if (banner.images && banner.images.length > 0) {
		return banner.images[0]!;
	}
	return banner.image;
}

/** Curated quote-font choices. `value` is a full CSS font-family stack so one
 * setting renders on macOS / Windows / iPad without per-OS editing; labels are
 * proper nouns and intentionally not localized. */
export interface QuoteFontOption {
	label: string;
	value: string;
}

export interface QuoteFontGroup {
	labelKey: string;
	fonts: readonly QuoteFontOption[];
}

export const QUOTE_FONT_GROUPS: readonly QuoteFontGroup[] = [
	{
		labelKey: 'banner.quoteFontGroupZh',
		fonts: [
			{ label: '楷体', value: '"Kaiti SC","STKaiti","KaiTi","楷体",serif' },
			{ label: '宋体', value: '"Songti SC","STSong","SimSun","宋体",serif' },
			{ label: '仿宋', value: '"STFangsong","FangSong","仿宋",serif' },
			{ label: '隶书', value: '"LiSu","隶书","STLiti","华文隶书",serif' },
			{ label: '行楷', value: '"STXingkai","华文行楷","Xingkai SC","行楷",cursive' },
			{ label: '圆体', value: '"Yuanti SC","YouYuan","幼圆",sans-serif' },
			{ label: '黑体', value: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif' },
			{ label: '霞鹜文楷', value: '"LXGW WenKai","LXGW WenKai Lite","霞鹜文楷","Kaiti SC","KaiTi",serif' },
		],
	},
	{
		labelKey: 'banner.quoteFontGroupEn',
		fonts: [
			{ label: 'Georgia', value: 'Georgia,serif' },
			{ label: 'Times New Roman', value: '"Times New Roman",Times,serif' },
			{ label: 'Palatino', value: '"Palatino Linotype",Palatino,"Book Antiqua",serif' },
			{ label: 'Baskerville', value: 'Baskerville,"Libre Baskerville",Georgia,serif' },
			{ label: 'Garamond', value: 'Garamond,"EB Garamond",Georgia,serif' },
			{ label: 'Didot', value: 'Didot,"Bodoni MT",Georgia,serif' },
			{ label: 'Helvetica', value: '"Helvetica Neue",Helvetica,Arial,sans-serif' },
			{ label: 'Courier', value: '"Courier New",Courier,monospace' },
		],
	},
];

/** First human-readable family in a CSS font-family stack — labels a legacy
 * hand-typed value that is not one of the curated options. */
export function firstFontName(stack: string): string {
	const quoted = /^"([^"]+)"/.exec(stack.trim());
	if (quoted?.[1]) return quoted[1];
	const bare = /^([^,]+)/.exec(stack.trim());
	return (bare?.[1] ?? stack).trim();
}

export function renderBanner(container: HTMLElement, banner: BannerData, onEdit: () => void, app: App): HTMLElement {
	const el = container.createDiv({ cls: 'dashboard-banner' });

	// Stats mode: three-column data panel over the (blurred, darkened) poster image.
	if (banner.mode === 'stats') {
		el.addClass('dashboard-banner--stats');
		const activeImage = getActiveImage(banner);
		if (activeImage) {
			const resolved = resolveVaultImage(app, activeImage);
			if (resolved) el.style.backgroundImage = `url("${resolved}")`;
		}
		renderBannerStats(el, banner.statsConfig, app);
		createBannerEditButton(el, onEdit);
		return el;
	}

	const activeImage = getActiveImage(banner);
	if (activeImage) {
		const resolved = resolveVaultImage(app, activeImage);
		if (resolved) {
			el.style.backgroundImage = `url("${resolved}")`;
		}
	}

	const overlay = el.createDiv({ cls: 'dashboard-banner-overlay' });
	const content = overlay.createDiv({ cls: 'dashboard-banner-content' });

	mountDashboardPanel(content, h(BannerQuotePanel, { banner, win: content.ownerDocument.defaultView! }));

	createBannerEditButton(overlay, onEdit);

	return el;
}

/** The wand button that opens the banner editor. Shared by both banner modes;
 *  positioned absolutely so it works whether it hangs off the banner or its overlay. */
function createBannerEditButton(parent: HTMLElement, onEdit: () => void): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: 'dashboard-banner-edit-btn',
		attr: { ...localizedAttributes('banner.editLabel', undefined, 'aria-label') },
	});
	setIcon(btn, 'wand');
	btn.addEventListener('click', (e) => {
		e.stopPropagation();
		onEdit();
	});
	return btn;
}

export function resolveVaultImage(app: App, relativePath: string): string | null {
	if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
		return relativePath;
	}

	const file = app.vault.getFileByPath(relativePath);
	if (!file) return null;

	const adapter = app.vault.adapter;
	if (
		'getResourcePath' in adapter &&
		typeof (adapter as { getResourcePath: (path: string) => string }).getResourcePath === 'function'
	) {
		return (adapter as { getResourcePath: (path: string) => string }).getResourcePath(relativePath);
	}

	const parts = relativePath.split('/');
	const encoded = parts.map((p) => encodeURIComponent(p)).join('/');
	return `app://local/${encoded}`;
}

export class BannerEditModal extends Modal {
	private banner: BannerData;
	private onSave: (updates: Partial<BannerData>) => void;
	private quotes: QuoteItem[];
	private images: string[];
	private mode: 'quote' | 'stats';
	private statsDraft: BannerStatsConfig;
	private quoteColorDraft: string;
	private quoteFontDraft: string;
	private form!: HTMLDivElement;

	constructor(app: App, banner: BannerData, onSave: (updates: Partial<BannerData>) => void) {
		super(app);
		this.banner = banner;
		this.onSave = onSave;
		this.mode = banner.mode === 'stats' ? 'stats' : 'quote';
		this.statsDraft = resolveStatsConfig(banner.statsConfig);
		this.quoteColorDraft = banner.quoteColor || '#ffffff';
		this.quoteFontDraft = banner.quoteFont || '';
		this.quotes =
			banner.quotes && banner.quotes.length > 0
				? banner.quotes.map((q) => ({ ...q }))
				: [{ quote: banner.quote, author: banner.author }];
		this.images =
			banner.images && banner.images.length > 0 ? [...banner.images] : banner.image ? [banner.image] : [];
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		containerEl.addClass('modal--dashboard');
		containerEl.parentElement?.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		header.createDiv({ cls: 'dashboard-modal-title', ...localizedText('banner.editTitle') });

		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		this.renderModeHeader(body);
		this.renderModeToggle(body);
		this.form = body.createDiv({ cls: 'dashboard-modal-form' });
		this.renderBody();
		this.renderActions(container);
	}

	/** One-line heading above the mode toggle explaining it switches the view. */
	private renderModeHeader(host: HTMLElement): void {
		const header = host.createDiv({ cls: 'dashboard-modal-mode-header' });
		header.createDiv({ cls: 'dashboard-modal-mode-title', ...localizedText('banner.mode.header') });
		header.createDiv({ cls: 'dashboard-modal-mode-hint', ...localizedText('banner.mode.hint') });
	}

	/** Segmented Poster/Quotes ↔ Statistics control at the top of the modal. */
	private renderModeToggle(host: HTMLElement): void {
		const bar = host.createDiv({ cls: 'dashboard-modal-mode-toggle' });
		const make = (key: 'quote' | 'stats', icon: string, labelKey: string): void => {
			const btn = bar.createEl('button', {
				cls: 'dashboard-modal-mode-btn' + (this.mode === key ? ' active' : ''),
				attr: { type: 'button' },
			});
			setIcon(btn, icon);
			btn.createSpan(localizedText(labelKey));
			btn.addEventListener('click', () => {
				if (this.mode === key) return;
				this.mode = key;
				bar.querySelectorAll('.dashboard-modal-mode-btn').forEach((b) => b.removeClass('active'));
				btn.addClass('active');
				this.renderBody();
			});
		};
		make('quote', 'image', 'banner.mode.quote');
		make('stats', 'bar-chart-3', 'banner.mode.stats');
	}

	private renderBody(): void {
		this.form.empty();
		if (this.mode === 'stats') {
			this.renderStatsBody();
		} else {
			this.renderQuoteBody();
		}
	}

	private renderQuoteBody(): void {
		// === Quotes section ===
		const quotesSection = this.form.createDiv({ cls: 'dashboard-modal-quotes' });
		quotesSection.createEl('label', { ...localizedText('banner.quotesLabel'), cls: 'dashboard-modal-quotes-label' });
		const quotesList = quotesSection.createDiv({ cls: 'dashboard-modal-quotes-list' });

		const renderQuotes = () => {
			quotesList.empty();
			for (let i = 0; i < this.quotes.length; i++) {
				const item = this.quotes[i]!;
				const row = quotesList.createDiv({ cls: 'dashboard-modal-quote-item' });

				const fields = row.createDiv({ cls: 'dashboard-modal-quote-fields' });

				const qInput = fields.createEl('textarea', {
					cls: 'dashboard-modal-input dashboard-modal-quote-input',
					attr: { rows: '2', ...localizedAttributes('banner.quote', undefined, 'placeholder') },
				});
				qInput.value = item.quote;
				qInput.addEventListener('input', () => {
					this.quotes[i] = { ...this.quotes[i]!, quote: qInput.value };
				});

				const aInput = fields.createEl('input', {
					cls: 'dashboard-modal-input dashboard-modal-author-input',
					attr: { type: 'text', ...localizedAttributes('banner.author', undefined, 'placeholder') },
				});
				aInput.value = item.author;
				aInput.addEventListener('input', () => {
					this.quotes[i] = { ...this.quotes[i]!, author: aInput.value };
				});

				if (this.quotes.length > 1) {
					const delBtn = row.createEl('button', {
						cls: 'dashboard-modal-quote-delete',
						attr: { ...localizedAttributes('banner.deleteQuote', undefined, 'aria-label') },
					});
					setIcon(delBtn, 'x');
					delBtn.addEventListener('click', () => {
						this.quotes.splice(i, 1);
						renderQuotes();
					});
				}
			}
		};

		renderQuotes();

		const addQuoteBtn = quotesSection.createEl('button', {
			cls: 'dashboard-modal-quote-add',
			...localizedText('banner.addQuote'),
		});
		addQuoteBtn.addEventListener('click', () => {
			this.quotes.push({ quote: '', author: '' });
			renderQuotes();
			const last = quotesList.querySelector<HTMLTextAreaElement>(
				'.dashboard-modal-quote-item:last-child textarea',
			);
			if (last) last.focus();
		});

		// === Images section ===
		const imagesSection = this.form.createDiv({ cls: 'dashboard-modal-images' });
		imagesSection.createEl('label', { ...localizedText('banner.imagesLabel'), cls: 'dashboard-modal-images-label' });
		const imagesList = imagesSection.createDiv({ cls: 'dashboard-modal-images-list' });

		const renderImages = () => {
			imagesList.empty();
			for (let i = 0; i < this.images.length; i++) {
				const row = imagesList.createDiv({ cls: 'dashboard-modal-image-item' });

				const imgInput = row.createEl('input', {
					cls: 'dashboard-modal-input dashboard-modal-image-input',
					attr: { type: 'text', placeholder: 'attachments/banner.jpg' },
				});
				imgInput.value = this.images[i]!;
				imgInput.addEventListener('input', () => {
					this.images[i] = imgInput.value;
				});

				if (this.images.length > 1) {
					const delBtn = row.createEl('button', {
						cls: 'dashboard-modal-image-delete',
						attr: { ...localizedAttributes('banner.deleteImage', undefined, 'aria-label') },
					});
					setIcon(delBtn, 'x');
					delBtn.addEventListener('click', () => {
						this.images.splice(i, 1);
						renderImages();
					});
				}
			}
		};

		renderImages();

		const addImageBtn = imagesSection.createEl('button', {
			cls: 'dashboard-modal-image-add',
			...localizedText('banner.addImage'),
		});
		addImageBtn.addEventListener('click', () => {
			this.images.push('');
			renderImages();
			const last = imagesList.querySelector<HTMLInputElement>('.dashboard-modal-image-item:last-child input');
			if (last) last.focus();
		});

		// === Quote Color ===
		const colorSection = this.form.createDiv({ cls: 'dashboard-modal-quote-color' });
		colorSection.createEl('label', { ...localizedText('banner.quoteColor'), cls: 'dashboard-modal-quote-color-label' });
		const colorRow = colorSection.createDiv({ cls: 'dashboard-modal-quote-color-row' });

		const colorInput = colorRow.createEl('input', {
			cls: 'dashboard-modal-color-input',
			attr: { type: 'color' },
		});
		colorInput.value = this.quoteColorDraft;
		colorInput.addEventListener('input', () => {
			this.quoteColorDraft = colorInput.value;
		});

		const colorResetBtn = colorRow.createEl('button', {
			cls: 'dashboard-modal-color-reset',
			...localizedText('banner.resetColor'),
		});
		colorResetBtn.addEventListener('click', () => {
			colorInput.value = '#ffffff';
			this.quoteColorDraft = '#ffffff';
		});

		// === Quote Font: curated dropdown of cross-platform CSS stacks, applied
		// to quote + author. A hand-typed value from before the dropdown existed
		// stays as an extra option instead of silently vanishing. ===
		colorSection.createEl('label', { ...localizedText('banner.quoteFont'), cls: 'dashboard-modal-quote-color-label' });
		const fontRow = colorSection.createDiv({ cls: 'dashboard-modal-quote-color-row' });
		const fontSelect = fontRow.createEl('select', { cls: 'dropdown dashboard-modal-quote-font-select' });
		const defaultOption = fontSelect.createEl('option', { value: '', ...localizedText('banner.quoteFontDefault') });
		defaultOption.selected = !this.quoteFontDraft;
		const knownValues = new Set<string>(['']);
		for (const group of QUOTE_FONT_GROUPS) {
			const optgroup = fontSelect.createEl('optgroup', { attr: { label: t(group.labelKey) } });
			for (const font of group.fonts) {
				knownValues.add(font.value);
				const o = optgroup.createEl('option', { value: font.value, text: font.label });
				if (font.value === this.quoteFontDraft) o.selected = true;
			}
		}
		if (this.quoteFontDraft && !knownValues.has(this.quoteFontDraft)) {
			const o = fontSelect.createEl('option', {
				value: this.quoteFontDraft,
				...localizedText('banner.quoteFontCustom', { name: firstFontName(this.quoteFontDraft) }),
			});
			o.selected = true;
		}
		fontSelect.addEventListener('change', () => {
			this.quoteFontDraft = fontSelect.value;
		});

		const fontResetBtn = fontRow.createEl('button', {
			cls: 'dashboard-modal-color-reset',
			...localizedText('banner.resetFont'),
		});
		fontResetBtn.addEventListener('click', () => {
			fontSelect.value = '';
			this.quoteFontDraft = '';
		});
	}

	private renderStatsBody(): void {
		// === Columns: visibility + per-column stat ===
		const colsSection = this.form.createDiv({ cls: 'dashboard-modal-stats-cols' });
		colsSection.createEl('label', { ...localizedText('banner.stats.columns'), cls: 'dashboard-modal-stats-label' });

		const leftRow = colsSection.createDiv({ cls: 'dashboard-modal-stats-col-row' });
		this.addVisibilityCheckbox(leftRow, 'showLeft', 'banner.stats.colLeft');
		this.addStatDropdown(leftRow, 'leftStat', LEFT_STAT_OPTIONS);

		const centerRow = colsSection.createDiv({ cls: 'dashboard-modal-stats-col-row' });
		this.addVisibilityCheckbox(centerRow, 'showCenter', 'banner.stats.colCenter');
		this.addStatDropdown(centerRow, 'centerStat', CENTER_STAT_OPTIONS);

		const rightRow = colsSection.createDiv({
			cls: 'dashboard-modal-stats-col-row dashboard-modal-stats-col-row--top',
		});
		this.addVisibilityCheckbox(rightRow, 'showRight', 'banner.stats.colRight');
		const rightMetrics = rightRow.createDiv({ cls: 'dashboard-modal-stats-right-metrics' });
		rightMetrics.createDiv({ cls: 'dashboard-modal-stats-right-title', ...localizedText('banner.stats.rightMetrics') });
		for (const key of RIGHT_STAT_OPTIONS) {
			const lab = rightMetrics.createEl('label', { cls: 'dashboard-modal-stats-checkbox' });
			const cb = lab.createEl('input', { attr: { type: 'checkbox' } });
			cb.checked = (this.statsDraft.rightStats ?? []).includes(key);
			cb.addEventListener('change', () => {
				const set = new Set(this.statsDraft.rightStats ?? []);
				if (cb.checked) set.add(key);
				else set.delete(key);
				this.statsDraft.rightStats = RIGHT_STAT_OPTIONS.filter((k) => set.has(k));
			});
			lab.createSpan({ ...localizedText(`banner.stats.${key}`) });
		}

		// === Heatmap source: note activity or habit check-ins (center column) ===
		const heatSection = this.form.createDiv({ cls: 'dashboard-modal-stats-cols' });
		heatSection.createEl('label', { ...localizedText('banner.stats.heatSource'), cls: 'dashboard-modal-stats-label' });

		const heatRow = heatSection.createDiv({ cls: 'dashboard-modal-stats-col-row' });
		const sourceSelect = heatRow.createEl('select', { cls: 'dropdown dashboard-modal-stats-select' });
		const SOURCE_KEYS: Array<['notes' | 'habit', string]> = [
			['notes', 'banner.stats.heatSourceNotes'],
			['habit', 'banner.stats.heatSourceHabit'],
		];
		for (const [value, key] of SOURCE_KEYS) {
			const o = sourceSelect.createEl('option', { value, ...localizedText(key) });
			if ((this.statsDraft.heatmapSource ?? 'notes') === value) o.selected = true;
		}

		const habitSelect = heatRow.createEl('select', { cls: 'dropdown dashboard-modal-stats-select' });
		const heatHint = heatSection.createDiv({ cls: 'dashboard-modal-stats-hint' });

		const renderHabitOptions = (): void => {
			const habits = getHabitService(this.app)?.getHabits() ?? [];
			habitSelect.empty();
			habitSelect.createEl('option', { value: 'all', ...localizedText('banner.stats.heatHabitAll') });
			for (const h of habits) {
				habitSelect.createEl('option', { value: h.id, text: h.name });
			}
			// Dangling id (saved habit deleted since): fall back to the rollup.
			const current = this.statsDraft.heatmapHabitId ?? 'all';
			const valid = current === 'all' || habits.some((h) => h.id === current);
			if (!valid) this.statsDraft.heatmapHabitId = 'all';
			habitSelect.value = valid ? current : 'all';

			const isHabit = this.statsDraft.heatmapSource === 'habit';
			habitSelect.disabled = !isHabit || habits.length === 0;
			heatHint.setText(isHabit && habits.length === 0 ? t('banner.stats.heatHabitNone') : '');
		};

		sourceSelect.addEventListener('change', () => {
			this.statsDraft.heatmapSource = sourceSelect.value === 'habit' ? 'habit' : undefined;
			renderHabitOptions();
		});
		habitSelect.addEventListener('change', () => {
			this.statsDraft.heatmapHabitId = habitSelect.value;
		});
		renderHabitOptions();

		// === Appearance: blur / darkness / accent ===
		const appearSection = this.form.createDiv({ cls: 'dashboard-modal-stats-appear' });
		appearSection.createEl('label', { ...localizedText('banner.stats.appearance'), cls: 'dashboard-modal-stats-label' });
		this.addSlider(appearSection, 'banner.stats.blur', this.statsDraft.blur ?? 2, 0, 16, (v) => {
			this.statsDraft.blur = v;
		});
		this.addSlider(appearSection, 'banner.stats.darkness', this.statsDraft.darkness ?? 20, 0, 100, (v) => {
			this.statsDraft.darkness = v;
		});

		const accentRow = appearSection.createDiv({ cls: 'dashboard-modal-stats-accent-row' });
		accentRow.createDiv({ cls: 'dashboard-modal-stats-inline-label', ...localizedText('banner.stats.accent') });
		const accentInput = accentRow.createEl('input', {
			cls: 'dashboard-modal-color-input',
			attr: { type: 'color' },
		});
		accentInput.value = this.statsDraft.accent || '#bff038';
		accentInput.addEventListener('input', () => {
			this.statsDraft.accent = accentInput.value;
		});
		const accentReset = accentRow.createEl('button', {
			cls: 'dashboard-modal-color-reset',
			...localizedText('banner.resetColor'),
		});
		accentReset.addEventListener('click', () => {
			accentInput.value = '#bff038';
			this.statsDraft.accent = undefined;
		});

		// === Streak source ===
		const dailySection = this.form.createDiv({ cls: 'dashboard-modal-stats-daily' });
		dailySection.createEl('label', { ...localizedText('banner.stats.dailyFolder'), cls: 'dashboard-modal-stats-label' });
		const detected = getDailyNotesConfig(this.app);
		const folderInput = bindLocalizedElement(dailySection.createEl('input', {
			cls: 'dashboard-modal-input',
			attr: {
				type: 'text',
				placeholder: detected
					? t('banner.stats.autoDetected', { folder: detected.folder || '/' })
					: t('banner.stats.manualHint'),
			},
		}), detected ? ('banner.stats.autoDetected') : ('banner.stats.manualHint'), (detected) ? ({ folder: detected.folder || '/' }) : (undefined), "placeholder");
		folderInput.value = this.statsDraft.dailyFolder ?? '';
		folderInput.addEventListener('input', () => {
			this.statsDraft.dailyFolder = folderInput.value.trim() || undefined;
		});
		dailySection.createDiv({ cls: 'dashboard-modal-stats-hint', ...localizedText('banner.stats.dailyFolderHint') });

		const useDailyLabel = dailySection.createEl('label', { cls: 'dashboard-modal-stats-checkbox' });
		const useDailyCheck = useDailyLabel.createEl('input', { attr: { type: 'checkbox' } });
		useDailyCheck.checked = this.statsDraft.streakFromDaily !== false;
		useDailyCheck.addEventListener('change', () => {
			this.statsDraft.streakFromDaily = useDailyCheck.checked;
		});
		useDailyLabel.createSpan({ ...localizedText('banner.stats.streakFromDaily') });

		// === Excluded folders ===
		const excludeSection = this.form.createDiv({ cls: 'dashboard-modal-stats-daily' });
		excludeSection.createEl('label', {
			...localizedText('banner.stats.excludeFolders'),
			cls: 'dashboard-modal-stats-label',
		});
		excludeSection.createDiv({ cls: 'dashboard-modal-stats-hint', ...localizedText('banner.stats.excludeFoldersHint') });

		// Chips host is separate from the add row so re-rendering chips on
		// remove never wipes the manual input/browse controls.
		const chipsHost = excludeSection.createDiv({ cls: 'dashboard-settings-folder-chips' });
		const renderExcludeChips = (): void => {
			chipsHost.empty();
			for (const folder of this.statsDraft.excludeFolders ?? []) {
				const chip = chipsHost.createDiv({ cls: 'dashboard-settings-folder-chip' });
				chip.createSpan({ text: folder });
				const removeBtn = chip.createEl('button', {
					cls: 'dashboard-settings-folder-chip-remove',
					attr: { ...localizedAttributes('common.remove', { name: folder }, 'aria-label') },
				});
				setIcon(removeBtn, 'x');
				removeBtn.addEventListener('click', () => {
					this.statsDraft = {
						...this.statsDraft,
						excludeFolders: (this.statsDraft.excludeFolders ?? []).filter((f) => f !== folder),
					};
					renderExcludeChips();
				});
			}
		};
		renderExcludeChips();

		const addControl = excludeSection.createDiv({ cls: 'dashboard-settings-folder-add' });
		const excludeFolderInput = addControl.createEl('input', {
			cls: 'dashboard-settings-folder-input',
			attr: { type: 'text', ...localizedAttributes('folder.selectFolder', undefined, 'placeholder') },
		});
		const addExcludedFolder = (): void => {
			const folder = excludeFolderInput.value.trim();
			if (!folder) return;
			const folders = this.statsDraft.excludeFolders ?? [];
			if (!folders.includes(folder)) {
				this.statsDraft = { ...this.statsDraft, excludeFolders: [...folders, folder] };
			}
			excludeFolderInput.value = '';
			renderExcludeChips();
		};
		const browseBtn = addControl.createEl('button', { cls: 'dashboard-settings-folder-browse' });
		setIcon(browseBtn, 'folder');
		browseBtn.addEventListener('click', () => {
			// Multi-select picker: manage the whole excluded set in one place.
			// Manual typing above stays for paths outside the folder tree.
			new MultiFolderSelectModal(
				this.app,
				this.statsDraft.excludeFolders ?? [],
				(folders) => {
					this.statsDraft = { ...this.statsDraft, excludeFolders: folders };
					renderExcludeChips();
				},
				{ parentCoversChildren: true },
			).open();
		});
		const addBtn = addControl.createEl('button', {
			cls: 'dashboard-settings-folder-add-btn',
			...localizedText('common.add'),
		});
		addBtn.addEventListener('click', addExcludedFolder);
		excludeFolderInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				addExcludedFolder();
			}
		});

		// === Details ===
		const subSection = this.form.createDiv({ cls: 'dashboard-modal-stats-sub' });
		const subLabel = subSection.createEl('label', { cls: 'dashboard-modal-stats-checkbox' });
		const subCheck = subLabel.createEl('input', { attr: { type: 'checkbox' } });
		subCheck.checked = this.statsDraft.showDetails !== false;
		subCheck.addEventListener('change', () => {
			this.statsDraft.showDetails = subCheck.checked;
		});
		subLabel.createSpan({ ...localizedText('banner.stats.showDetails') });
	}

	private addVisibilityCheckbox(
		host: HTMLElement,
		key: 'showLeft' | 'showCenter' | 'showRight',
		labelKey: string,
	): void {
		const lab = host.createEl('label', { cls: 'dashboard-modal-stats-vis' });
		const cb = lab.createEl('input', { attr: { type: 'checkbox' } });
		cb.checked = this.statsDraft[key] !== false;
		cb.addEventListener('change', () => {
			this.statsDraft[key] = cb.checked;
		});
		lab.createSpan(localizedText(labelKey));
	}

	private addStatDropdown(host: HTMLElement, key: 'leftStat' | 'centerStat', options: readonly string[]): void {
		const select = host.createEl('select', { cls: 'dropdown dashboard-modal-stats-select' });
		const current = this.statsDraft[key] as string | undefined;
		for (const opt of options) {
			const o = select.createEl('option', { value: opt, ...localizedText(`banner.stats.${opt}`) });
			if (opt === current) o.selected = true;
		}
		select.addEventListener('change', () => {
			(this.statsDraft as unknown as Record<string, string>)[key] = select.value;
		});
	}

	private addSlider(
		host: HTMLElement,
		labelKey: string,
		value: number,
		min: number,
		max: number,
		onChange: (v: number) => void,
	): void {
		const row = host.createDiv({ cls: 'dashboard-modal-stats-slider' });
		row.createDiv({ cls: 'dashboard-modal-stats-inline-label', ...localizedText(labelKey) });
		const slider = row.createEl('input', {
			cls: 'dashboard-modal-stats-range',
			attr: { type: 'range', min: String(min), max: String(max), value: String(value) },
		});
		const valLabel = row.createDiv({ cls: 'dashboard-modal-stats-slider-val', text: String(value) });
		slider.addEventListener('input', () => {
			const v = Number(slider.value);
			valLabel.textContent = String(v);
			onChange(v);
		});
	}

	private renderActions(host: HTMLElement): void {
		const footer = host.createDiv({ cls: 'dashboard-modal-footer' });
		footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				...localizedText('common.cancel'),
			})
			.addEventListener('click', () => this.close());
		footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
				...localizedText('common.save'),
			})
			.addEventListener('click', () => this.save());
	}

	private save(): void {
		const updates: Partial<BannerData> = { mode: this.mode };
		if (this.mode === 'stats') {
			updates.statsConfig = {
				dailyFolder: this.statsDraft.dailyFolder,
				dailyFormat: this.statsDraft.dailyFormat,
				streakFromDaily: this.statsDraft.streakFromDaily,
				excludeFolders: this.statsDraft.excludeFolders,
				accent: this.statsDraft.accent,
				blur: this.statsDraft.blur,
				darkness: this.statsDraft.darkness,
				showDetails: this.statsDraft.showDetails,
				showLeft: this.statsDraft.showLeft,
				showCenter: this.statsDraft.showCenter,
				showRight: this.statsDraft.showRight,
				leftStat: this.statsDraft.leftStat,
				centerStat: this.statsDraft.centerStat,
				rightStats: this.statsDraft.rightStats ? [...this.statsDraft.rightStats] : undefined,
				// Notes (default) omits both keys so the frontmatter stays clean.
				heatmapSource: this.statsDraft.heatmapSource === 'habit' ? 'habit' : undefined,
				heatmapHabitId:
					this.statsDraft.heatmapSource === 'habit' ? (this.statsDraft.heatmapHabitId ?? 'all') : undefined,
			};
		} else {
			const validQuotes = this.quotes.filter((q) => q.quote.trim());
			const validImages = this.images.filter((s) => s.trim());
			if (validQuotes.length > 0) {
				updates.quote = validQuotes[0]!.quote;
				updates.author = validQuotes[0]!.author;
				updates.quotes = validQuotes.length > 1 ? validQuotes : undefined;
			} else {
				// Empty quotes allowed — Banner will show only the background image.
				updates.quote = '';
				updates.author = '';
				updates.quotes = undefined;
			}
			if (validImages.length > 0) {
				updates.image = validImages[0]!;
				updates.images = validImages.length > 1 ? validImages : undefined;
			} else {
				updates.image = '';
				updates.images = undefined;
			}
			updates.quoteColor = this.quoteColorDraft === '#ffffff' ? undefined : this.quoteColorDraft;
			updates.quoteFont = this.quoteFontDraft.trim() || undefined;
		}
		this.onSave(updates);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
