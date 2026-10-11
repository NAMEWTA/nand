import { bindLocalizedElement, bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { App, FuzzySuggestModal, Modal, Notice, setIcon } from 'obsidian';
import { focalForWrite } from '../../core/board/board-experience';
import { homeDecor } from '../../core/board/appearance-preset';
import { h, render } from 'preact';
import { formatFocalPoint } from '../../core/board/focal-point';
import { mountFocalEditor } from '../images/focal-editor';
import { closeOwnedDashboardDialogs, openOwnedDashboardModal } from '../ui/dialog-scope';
import type { BgSize, DashboardSettings } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import type { DashboardHost } from '../host';
import { resolveVaultImage } from '../banner/banner';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { refreshAppearanceLive } from './appearance';
import { applyModalTheme } from './modal-theme';

/** Image extensions offered by the background-image browser. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);

/** Defaults shown for advanced sliders while their setting is null (theme default). */
interface AdvancedDefaults {
	blur: number;
	radius: number;
}

/**
 * Board appearance — a background image and advanced surface controls. Colors come from the global
 * theme (Settings → Appearance). Changes apply live to every open dashboard
 * (via refreshAppearanceLive, no full re-render) and persist on a short debounce.
 */
export class ThemeStudioModal extends Modal {
	private plugin: DashboardHost;
	private bgImage: string;
	private bgDim: number;
	private bgBlur: number;
	private bgSize: BgSize;
	private surfaceOpacity: number | null;
	private glassBlur: number | null;
	private radiusScale: number | null;
	private fontScale: DashboardSettings['fontScale'];
	private bgFocal: { x: number; y: number } | undefined;
	private readonly advancedDefaults: AdvancedDefaults;
	private saveTimer: number | null = null;
	private disposePresets?: () => void;
	private decorRoot?: HTMLElement;
	private focalEditor?: ReturnType<typeof mountFocalEditor>;
	private themeObserver?: MutationObserver;

	constructor(app: App, plugin: DashboardHost) {
		super(app);
		this.plugin = plugin;
		const s = plugin.settings;
		this.bgImage = s.bgImage;
		this.bgDim = s.bgDim;
		this.bgBlur = s.bgBlur;
		this.bgSize = s.bgSize;
		this.surfaceOpacity = s.surfaceOpacity;
		this.glassBlur = s.glassBlur;
		this.radiusScale = s.radiusScale;
		this.fontScale = s.fontScale ?? 'medium';
		this.bgFocal = focalForWrite(s.bgFocal);
		this.advancedDefaults = readAdvancedDefaults(this.contentEl.doc);
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal', 'nand-appearance-modal');
		this.modalEl.addClass('modal--dashboard');
		containerEl.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);
		const ownerWindow = containerEl.win as Window & { MutationObserver: typeof MutationObserver };
		const observer = new ownerWindow.MutationObserver(() => this.refreshTheme());
		observer.observe(containerEl.doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
		this.themeObserver = observer;
		this.renderBody();
	}

	onClose(): void {
		this.themeObserver?.disconnect();
		this.themeObserver = undefined;
		if (this.saveTimer !== null) {
			this.contentEl.win.clearTimeout(this.saveTimer);
			void this.plugin.saveSettings().catch(() => new Notice(t('appearancePresets.unsaved')));
		}
		this.saveTimer = null;
		closeOwnedDashboardDialogs(this.app, this);
		closeOwnedDashboardDialogs(this.app, this.contentEl);
		this.disposePresets?.();
		this.focalEditor?.dispose();
		this.contentEl.empty();
	}

	/** Build (or rebuild) the modal body. Safe to call on discrete clicks only —
	 *  never on continuous `input` events, or an open color picker would lose focus. */
	private renderBody(): void {
		this.disposePresets?.();
		const { contentEl } = this;
		contentEl.empty();
		const container = contentEl.createDiv({
			cls: 'dashboard-modal dashboard-modal--compact dashboard-theme-studio',
		});
		const header = container.createDiv({ cls: 'dashboard-modal-header dashboard-theme-studio-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('themeStudio.modalTitle') }), 'themeStudio.modalTitle');

		// Global one-click restore, on the title row (right-aligned) so it's easy to find.
		const resetAllBtn = bindLocalizedElement(bindLocalizedElement(header.createEl('button', {
			cls: 'dashboard-theme-studio-resetall',
			attr: { 'aria-label': t('themeStudio.resetAll'), title: t('themeStudio.resetAll') },
		}), 'themeStudio.resetAll', undefined, "aria-label"), 'themeStudio.resetAll', undefined, "title");
		setIcon(resetAllBtn.createSpan({ cls: 'dashboard-theme-studio-resetall-icon' }), 'rotate-ccw');
		resetAllBtn.appendText(t('themeStudio.resetAll'));
		resetAllBtn.addEventListener('click', () => {
			void this.confirmResetAll();
		});

		const body = container.createDiv({ cls: 'dashboard-modal-body' });
		bindLocalizedElement(body.createEl('p', { cls: 'dashboard-theme-studio-hint', text: t('themeStudio.hint') }), 'themeStudio.hint');

		const presets = body.createDiv();
		let closed = false;
		this.disposePresets = () => { closed = true; render(null, presets); };
		void import('./AppearancePresetsPanel').then(({ AppearancePresetsPanel }) => {
			if (!closed) render(h(AppearancePresetsPanel, { service: this.plugin.appearance, applied: () => {
				Object.assign(this, homeDecor(this.plugin.settings));
				this.refreshTheme();
				this.renderDecor();
			} }), presets);
		}, () => { if (!closed) presets.createEl('p', { text: t('appearancePresets.loadError'), attr: { role: 'alert' } }); });
		this.decorRoot = body.createDiv({ cls: 'dashboard-modal-form' });
		this.renderDecor();
		this.renderActions(container);
	}

	private renderDecor(): void {
		if (!this.decorRoot) return;
		this.focalEditor?.dispose();
		this.decorRoot.empty();
		this.renderBackgroundSection(this.decorRoot);
		this.renderAdvancedSection(this.decorRoot);
	}

	private renderBackgroundSection(form: HTMLElement): void {
		const section = form.createDiv({ cls: 'dashboard-theme-studio-section' });
		bindLocalizedElement(section.createEl('h3', { text: t('themeStudio.bg.title') }), 'themeStudio.bg.title');
		bindLocalizedElement(section.createEl('p', { cls: 'dashboard-theme-studio-desc', text: t('themeStudio.bg.desc') }), 'themeStudio.bg.desc');

		// Image path + browse + clear
		const imageRow = section.createDiv({ cls: 'dashboard-theme-studio-image-row' });
		const input = imageRow.createEl('input', {
			cls: 'dashboard-modal-input dashboard-theme-studio-image-input',
			attr: { type: 'text', placeholder: 'attachments/bg.jpg', 'aria-label': t('themeStudio.bg.title') },
		});
		input.value = this.bgImage;
		input.addEventListener('input', () => {
			this.bgImage = input.value;
			this.focalEditor?.update(resolveVaultImage(this.app, this.bgImage), (this.bgFocal ? formatFocalPoint(this.bgFocal) : undefined));
			this.scheduleApply();
		});

		const browseBtn = bindLocalizedElement(imageRow.createEl('button', {
			cls: 'dashboard-theme-studio-browse',
			text: t('themeStudio.bg.browse'),
		}), 'themeStudio.bg.browse');
		browseBtn.addEventListener('click', () => {
			openOwnedDashboardModal(this.app, new ImageFileSuggestModal(this.app, (path) => {
				this.bgImage = path;
				input.value = path;
				this.focalEditor?.update(resolveVaultImage(this.app, path), (this.bgFocal ? formatFocalPoint(this.bgFocal) : undefined));
				this.scheduleApply();
			}), this);
		});

		const clearImgBtn = bindLocalizedElement(imageRow.createEl('button', {
			cls: 'dashboard-theme-studio-image-clear',
			text: t('themeStudio.bg.clear'),
		}), 'themeStudio.bg.clear');
		clearImgBtn.addEventListener('click', () => {
			this.bgImage = '';
			input.value = '';
			this.focalEditor?.update(null, (this.bgFocal ? formatFocalPoint(this.bgFocal) : undefined));
			this.scheduleApply();
		});

		// Dim slider
		this.renderSlider(section, {
			label: t('themeStudio.bg.dim'),
			min: 0,
			max: 100,
			step: 1,
			value: this.bgDim,
			onChange: (v) => {
				this.bgDim = v;
				this.scheduleApply();
			},
		});

		// Blur slider
		this.renderSlider(section, {
			label: t('themeStudio.bg.blur'),
			min: 0,
			max: 30,
			step: 1,
			value: this.bgBlur,
			onChange: (v) => {
				this.bgBlur = v;
				this.scheduleApply();
			},
		});

		// Fill mode
		const sizeRow = section.createDiv({ cls: 'dashboard-theme-studio-size-row' });
		bindLocalizedElement(sizeRow.createSpan({ cls: 'dashboard-theme-studio-color-label', text: t('themeStudio.bg.size') }), 'themeStudio.bg.size');
		const sizeSelect = sizeRow.createEl('select', { cls: 'dashboard-modal-input dashboard-theme-studio-size', attr: { 'aria-label': t('themeStudio.bg.size') } });
		const coverOpt = bindLocalizedElement(sizeSelect.createEl('option', { value: 'cover', text: t('themeStudio.bg.sizeCover') }), 'themeStudio.bg.sizeCover');
		const containOpt = bindLocalizedElement(sizeSelect.createEl('option', { value: 'contain', text: t('themeStudio.bg.sizeContain') }), 'themeStudio.bg.sizeContain');
		if (this.bgSize === 'contain') containOpt.selected = true;
		else coverOpt.selected = true;
		sizeSelect.addEventListener('change', () => {
			this.bgSize = sizeSelect.value === 'contain' ? 'contain' : 'cover';
			this.scheduleApply();
		});
		this.focalEditor = mountFocalEditor(section.createDiv(), {
			source: resolveVaultImage(this.app, this.bgImage), value: (this.bgFocal ? formatFocalPoint(this.bgFocal) : undefined), ratio: 2,
			change: point => { this.bgFocal = point; this.scheduleApply(); },
		}, this.app);
	}

	// ── Advanced (glass blur, corner radius, surface opacity) ──────────────

	private renderAdvancedSection(form: HTMLElement): void {
		const section = form.createDiv({ cls: 'dashboard-theme-studio-section' });
		bindLocalizedElement(section.createEl('h3', { text: t('themeStudio.advanced.title') }), 'themeStudio.advanced.title');
		bindLocalizedElement(section.createEl('p', { cls: 'dashboard-theme-studio-desc', text: t('themeStudio.advanced.desc') }), 'themeStudio.advanced.desc');

		this.renderNullableSlider(section, {
			label: t('themeStudio.advanced.surfaceOpacity'),
			min: 0,
			max: 100,
			step: 1,
			get: () => this.surfaceOpacity,
			displayDefault: 100,
			onChange: (v) => {
				this.surfaceOpacity = v;
				this.scheduleApply();
			},
		});
		this.renderNullableSlider(section, {
			label: t('themeStudio.advanced.glassBlur'),
			min: 0,
			max: 20,
			step: 1,
			get: () => this.glassBlur,
			displayDefault: this.advancedDefaults.blur,
			onChange: (v) => {
				this.glassBlur = v;
				this.scheduleApply();
			},
		});
		this.renderNullableSlider(section, {
			label: t('themeStudio.advanced.radius'),
			min: 0,
			max: 22,
			step: 1,
			get: () => this.radiusScale,
			displayDefault: this.advancedDefaults.radius,
			onChange: (v) => {
				this.radiusScale = v;
				this.scheduleApply();
			},
		});
		this.renderFontScaleRow(section);
	}

	/** Segmented Small / Medium / Large text-size picker plus a one-click
	 *  reset back to the default ('medium' = inherited base size). */
	private renderFontScaleRow(section: HTMLElement): void {
		const row = section.createDiv({ cls: 'dashboard-theme-studio-fontscale-row' });
		bindLocalizedElement(row.createSpan({ cls: 'dashboard-theme-studio-color-label', text: t('themeStudio.fontSize') }), 'themeStudio.fontSize');

		const seg = row.createDiv({ cls: 'dashboard-theme-studio-fontscale' });
		const options: Array<{ value: DashboardSettings['fontScale']; labelKey: string }> = [
			{ value: 'small', labelKey: 'themeStudio.fontSizeSmall' },
			{ value: 'medium', labelKey: 'themeStudio.fontSizeMedium' },
			{ value: 'large', labelKey: 'themeStudio.fontSizeLarge' },
		];
		const renderSeg = (): void => {
			seg.empty();
			for (const opt of options) {
				const btn = bindLocalizedElement(seg.createEl('button', {
					cls: 'dashboard-theme-studio-fontscale-btn' + (this.fontScale === opt.value ? ' active' : ''),
					text: t(opt.labelKey),
				}), opt.labelKey);
				btn.addEventListener('click', () => {
					if (this.fontScale === opt.value) return;
					this.fontScale = opt.value;
					renderSeg();
					this.scheduleApply();
				});
			}
		};
		renderSeg();

		// One-click restore to the default size.
		const resetBtn = bindLocalizedElement(bindLocalizedElement(row.createEl('button', {
			cls: 'dashboard-theme-studio-color-clear',
			attr: {
				'aria-label': t('themeStudio.fontSizeReset'),
				title: t('themeStudio.fontSizeReset'),
			},
		}), 'themeStudio.fontSizeReset', undefined, "aria-label"), 'themeStudio.fontSizeReset', undefined, "title");
		setIcon(resetBtn, 'rotate-ccw');
		resetBtn.addEventListener('click', () => {
			if (this.fontScale === 'medium') return;
			this.fontScale = 'medium';
			renderSeg();
			this.scheduleApply();
		});
	}

	/** Slider for a nullable numeric override. null shows the theme-default
	 *  value + a hint and a × button to reset back to the theme default. */
	private renderNullableSlider(
		section: HTMLElement,
		opts: {
			label: string;
			min: number;
			max: number;
			step: number;
			get: () => number | null;
			displayDefault: number;
			onChange: (v: number | null) => void;
		},
	): void {
		const row = section.createDiv({ cls: 'dashboard-theme-studio-slider-row' });
		const current = opts.get();
		const label = row.createSpan({ cls: 'dashboard-theme-studio-color-label' });
		const hint = row.createSpan({ cls: 'dashboard-theme-studio-slider-hint' });

		const paint = () => {
			const v = opts.get();
			label.setText(`${opts.label}  ${v ?? opts.displayDefault}`);
			hint.textContent = v == null ? t('themeStudio.advanced.themeDefault') : '';
		};
		paint();

		const slider = row.createEl('input', {
			cls: 'dashboard-theme-studio-slider',
			attr: { type: 'range', min: String(opts.min), max: String(opts.max), step: String(opts.step), 'aria-label': opts.label },
		});
		slider.value = String(current ?? opts.displayDefault);
		slider.addEventListener('input', () => {
			opts.onChange(Number(slider.value));
			paint();
		});

		const resetBtn = bindLocalizedElement(bindLocalizedElement(row.createEl('button', {
			cls: 'dashboard-theme-studio-color-clear',
			attr: {
				'aria-label': t('themeStudio.advanced.resetToTheme'),
				title: t('themeStudio.advanced.resetToTheme'),
			},
		}), 'themeStudio.advanced.resetToTheme', undefined, "aria-label"), 'themeStudio.advanced.resetToTheme', undefined, "title");
		setIcon(resetBtn, 'rotate-ccw');
		resetBtn.addEventListener('click', () => {
			opts.onChange(null);
			slider.value = String(opts.displayDefault);
			paint();
		});
	}

	private renderSlider(
		section: HTMLElement,
		opts: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void },
	): void {
		const row = section.createDiv({ cls: 'dashboard-theme-studio-slider-row' });
		const label = row.createSpan({
			cls: 'dashboard-theme-studio-color-label',
			text: `${opts.label}  ${opts.value}`,
		});
		const slider = row.createEl('input', {
			cls: 'dashboard-theme-studio-slider',
			attr: { type: 'range', min: String(opts.min), max: String(opts.max), step: String(opts.step), 'aria-label': opts.label },
		});
		slider.value = String(opts.value);
		slider.addEventListener('input', () => {
			const v = Number(slider.value);
			label.setText(`${opts.label}  ${v}`);
			opts.onChange(v);
		});
	}

	// ── Actions ────────────────────────────────────────────────────────────

	private renderActions(container: HTMLElement): void {
		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
				text: t('common.done'),
			}), 'common.done')
			.addEventListener('click', () => this.close());
	}

	// ── Global one-click restore ───────────────────────────────────────────

	private async confirmResetAll(): Promise<void> {
		const ok = await showConfirmDialog(this.app, {
			title: t('themeStudio.resetAll'),
			message: t('themeStudio.resetAllConfirm'),
			confirmLabel: t('common.confirm'),
			destructive: false,
			owner: this.contentEl,
		});
		if (!ok) return;

		this.bgImage = '';
		this.bgFocal = undefined;
		this.bgDim = 40;
		this.bgBlur = 0;
		this.bgSize = 'cover';
		this.surfaceOpacity = null;
		this.glassBlur = null;
		this.radiusScale = null;
		this.fontScale = 'medium';
		this.scheduleApply();
		this.contentEl.empty();
		this.renderBody();
	}

	// ── Apply + persist ────────────────────────────────────────────────────

	/** Write current edits into settings, live-apply to open dashboards, debounce-save. */
	private scheduleApply(): void {
		this.plugin.settings = { ...this.plugin.settings, ...homeDecor(this) };
		this.refreshTheme();
		if (this.saveTimer !== null) this.contentEl.win.clearTimeout(this.saveTimer);
		this.saveTimer = this.contentEl.win.setTimeout(() => {
			void this.plugin.saveSettings().catch(() => new Notice(t('appearancePresets.unsaved')));
			this.saveTimer = null;
		}, 400);
	}
	private refreshTheme(): void {
		refreshAppearanceLive(this.app, this.plugin.settings);
		applyModalTheme(this.containerEl);
	}
}

/** Fuzzy picker over vault image files for the background-image path. */
class ImageFileSuggestModal extends FuzzySuggestModal<TFileStub> {
	private readonly onChoosePath: (path: string) => void;

	constructor(app: App, onChoosePath: (path: string) => void) {
		super(app);
		this.onChoosePath = onChoosePath;
		this.setPlaceholder(t('themeStudio.bg.browsePlaceholder'));
		bindLocalizedControl(this, 'placeholder', 'themeStudio.bg.browsePlaceholder');
		this.emptyStateText = t('themeStudio.bg.noImages');
	}

	getItems(): TFileStub[] {
		return this.app.vault
			.getFiles()
			.filter((f) => IMAGE_EXTENSIONS.has(f.extension.toLowerCase()))
			.slice(0, 500)
			.map((f) => ({ path: f.path, basename: f.basename }));
	}

	getItemText(item: TFileStub): string {
		return `${item.basename} — ${item.path}`;
	}

	onChooseItem(item: TFileStub): void {
		if (item) this.onChoosePath(item.path);
	}
}

interface TFileStub {
	path: string;
	basename: string;
}

/** Read the active theme's blur + radius so advanced sliders start at the right spot. */
function readAdvancedDefaults(doc: Document): AdvancedDefaults {
	const root = doc.querySelector<HTMLElement>('.nand-dashboard-root');
	if (!root) return { blur: 0, radius: 14 };
	const cs = root.win.getComputedStyle(root);
	const blurRaw = cs.getPropertyValue('--db-backdrop-blur').trim();
	const blurMatch = blurRaw.match(/blur\(([\d.]+)px\)/i);
	const blur = blurMatch ? Math.round(parseFloat(blurMatch[1]!)) : 0;
	const radiusRaw = cs.getPropertyValue('--db-radius-md').trim();
	const radiusMatch = radiusRaw.match(/([\d.]+)px/);
	const radius = radiusMatch ? Math.round(parseFloat(radiusMatch[1]!)) : 14;
	return { blur, radius };
}
