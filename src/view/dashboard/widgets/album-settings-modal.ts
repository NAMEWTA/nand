import { bindLocalizedOptions } from '../../primitives/localized-dom';
import { bindLocalizedElement, bindLocalizedControl } from '../../primitives/localized-dom';
import { App, Modal, Setting, type TextComponent } from 'obsidian';
import type { AlbumConfig, WidgetHeightRatio } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';
import { PathPickerModal } from '../ui/path-picker-modal';
import { normalizeTransition } from './album-model';

/** Create/edit one album widget entry. Folder via text or the vault folder
 *  picker; interval/ratio/transition mirror the legacy single-album fields;
 *  heightRatio picks the stacked-layout card size. Edits stay local until
 *  Save commits them through onSave. */
export class AlbumSettingsModal extends Modal {
	private readonly cfg: AlbumConfig;
	private readonly onSave: (cfg: AlbumConfig) => void;

	constructor(app: App, cfg: AlbumConfig, onSave: (cfg: AlbumConfig) => void) {
		super(app);
		this.cfg = { ...cfg };
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		containerEl.addClass('modal--dashboard');
		containerEl.parentElement?.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const title = bindLocalizedElement(container.createDiv({ cls: 'dashboard-modal-title', text: t('album.editTitle') }), 'album.editTitle');
		title.setCssProps({ fontSize: '1em' });
		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		let folderInput: TextComponent | undefined;
		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('settings.widgetAlbumFolder')), "name", 'settings.widgetAlbumFolder')
			.setDesc(t('settings.widgetAlbumFolderDesc')), "desc", 'settings.widgetAlbumFolderDesc')
			.addText((text) => {
				folderInput = text;
				bindLocalizedControl(text.setPlaceholder(t('settings.widgetAlbumFolderPlaceholder')), "placeholder", 'settings.widgetAlbumFolderPlaceholder')
					.setValue(this.cfg.folder)
					.onChange((v) => {
						this.cfg.folder = v.trim().replace(/^\/+|\/+$/g, '');
					});
			})
			.addExtraButton((btn) =>
				bindLocalizedControl(btn
					.setIcon('folder-search')
					.setTooltip(t('pathPicker.pickFolder')), "tooltip", 'pathPicker.pickFolder')
					.onClick(() => {
						new PathPickerModal(this.app, 'folder', (path) => {
							this.cfg.folder = path;
							folderInput?.setValue(path);
						}).open();
					}),
			);

		const INTERVAL_PRESETS = [3, 5, 8, 10, 15, 30, 60];
		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('settings.widgetAlbumInterval')), "name", 'settings.widgetAlbumInterval')
			.setDesc(t('settings.widgetAlbumIntervalDesc')), "desc", 'settings.widgetAlbumIntervalDesc')
			.addDropdown((dropdown) => {
				if (!INTERVAL_PRESETS.includes(this.cfg.intervalSec)) {
					dropdown.addOption(String(this.cfg.intervalSec), `${this.cfg.intervalSec}s`);
				}
				for (const sec of INTERVAL_PRESETS) dropdown.addOption(String(sec), `${sec}s`);
				dropdown.setValue(String(this.cfg.intervalSec)).onChange((v) => {
					this.cfg.intervalSec = Number(v);
				});
			});

		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('settings.widgetAlbumRecursive')), "name", 'settings.widgetAlbumRecursive')
			.setDesc(t('settings.widgetAlbumRecursiveDesc')), "desc", 'settings.widgetAlbumRecursiveDesc')
			.addToggle((toggle) =>
				toggle.setValue(this.cfg.recursive).onChange((v) => {
					this.cfg.recursive = v;
				}),
			);

		// The legacy frame aspect-ratio option (1:1 / 3:4) is gone: the card
		// size selector below supersedes it — the frame now fills whatever
		// height the card gets and crops via object-fit. cfg.ratio stays in
		// the data model for the side layout's natural sizing.

		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('settings.widgetAlbumTransition')), "name", 'settings.widgetAlbumTransition')
			.setDesc(t('settings.widgetAlbumTransitionDesc')), "desc", 'settings.widgetAlbumTransitionDesc')
			.addDropdown((dropdown) =>
				bindLocalizedOptions(bindLocalizedOptions(bindLocalizedOptions(bindLocalizedOptions(dropdown
					.addOption('fade', t('settings.widgetAlbumTransitionFade')), {['fade']: ['settings.widgetAlbumTransitionFade']})
					.addOption('slide-left', t('settings.widgetAlbumTransitionSlideLeft')), {['slide-left']: ['settings.widgetAlbumTransitionSlideLeft']})
					.addOption('slide-right', t('settings.widgetAlbumTransitionSlideRight')), {['slide-right']: ['settings.widgetAlbumTransitionSlideRight']})
					.addOption('zoom', t('settings.widgetAlbumTransitionZoom')), {['zoom']: ['settings.widgetAlbumTransitionZoom']})
					.setValue(normalizeTransition(this.cfg.transition))
					.onChange((v) => {
						this.cfg.transition = normalizeTransition(v);
					}),
			);

		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('album.heightRatio')), "name", 'album.heightRatio')
			.setDesc(t('album.heightRatioDesc')), "desc", 'album.heightRatioDesc')
			.addDropdown((dropdown) =>
				bindLocalizedOptions(bindLocalizedOptions(bindLocalizedOptions(bindLocalizedOptions(dropdown
					.addOption('full', t('album.size.full')), {['full']: ['album.size.full']})
					.addOption('twoThirds', t('album.size.twoThirds')), {['twoThirds']: ['album.size.twoThirds']})
					.addOption('half', t('album.size.half')), {['half']: ['album.size.half']})
					.addOption('third', t('album.size.third')), {['third']: ['album.size.third']})
					.setValue(this.cfg.heightRatio)
					.onChange((v) => {
						this.cfg.heightRatio = v as WidgetHeightRatio;
					}),
			);

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				text: t('common.cancel'),
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
		bindLocalizedElement(footer
			.createEl('button', {
				text: t('common.save'),
				cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			}), 'common.save')
			.addEventListener('click', () => {
				this.close();
				this.onSave(this.cfg);
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
