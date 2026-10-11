import { bindLocalizedOptions } from '../../../../ui/primitives/localized-dom';
import { bindLocalizedElement, bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { App, Modal, Setting } from 'obsidian';
import { formatElapsed, parseAnniversaryDate } from '../../core/anniversaries/calendar';
import { resolveWidgetLabel, usesDefaultWidgetLabel } from '../../core/board/default-widget-label';
import type { AnniversaryConfig } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';
import { WidgetBackgroundModal } from './widget-background';
import { AnniversaryDateEditor } from './AnniversaryDateEditor';

/** Create/edit one anniversary ("纪念日") entry: a historical date plus the
 *  elapsed display precision and the annual reminder switch. Edits stay local
 *  until Save commits them through onSave. */
export class AnniversarySettingsModal extends Modal {
	private readonly cfg: AnniversaryConfig;
	private readonly onSave: (cfg: AnniversaryConfig) => void;
	private preview: Setting | null = null;
	private dateEditor?: AnniversaryDateEditor;
	private dateValid = false;
	private saveButton?: HTMLButtonElement;
	private backgroundModal?: WidgetBackgroundModal;

	constructor(app: App, cfg: AnniversaryConfig, onSave: (cfg: AnniversaryConfig) => void) {
		super(app);
		this.cfg = {
			...cfg,
			label: resolveWidgetLabel(cfg, 'anniversary'),
			defaultLabel: usesDefaultWidgetLabel(cfg, 'anniversary'),
		};
		this.onSave = onSave;
		this.dateValid = !!parseAnniversaryDate(this.cfg.startDate);
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal', 'nand-anniversary-modal');
		this.modalEl.addClass('modal--dashboard');
		containerEl.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const title = bindLocalizedElement(container.createDiv({ cls: 'dashboard-modal-title', text: t('anniversary.editTitle') }), 'anniversary.editTitle');
		title.setCssProps({ fontSize: '1em' });
		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('anniversary.label')), "name", 'anniversary.label')
			.setDesc(t('anniversary.labelDesc')), "desc", 'anniversary.labelDesc')
			.addText((text) =>
				bindLocalizedControl(text
					.setPlaceholder(t('anniversary.labelPlaceholder')), "placeholder", 'anniversary.labelPlaceholder')
					.setValue(this.cfg.label)
					.onChange((v) => {
						this.cfg.label = v.trim();
						this.cfg.defaultLabel = false;
					}),
			);

		this.dateEditor = new AnniversaryDateEditor(body.createDiv(), this.cfg, (date, calendar, valid) => {
			this.cfg.startDate = date;
			this.cfg.calendar = calendar;
			this.dateValid = valid;
			if (this.saveButton) this.saveButton.disabled = !valid;
			this.updatePreview();
		});

		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('anniversary.precision')), "name", 'anniversary.precision')
			.setDesc(t('anniversary.precisionDesc')), "desc", 'anniversary.precisionDesc')
			.addDropdown((dropdown) =>
				bindLocalizedOptions(bindLocalizedOptions(bindLocalizedOptions(dropdown
					.addOption('ymd', t('anniversary.precisionYmd')), {['ymd']: ['anniversary.precisionYmd']})
					.addOption('days', t('anniversary.precisionDays')), {['days']: ['anniversary.precisionDays']})
					.addOption('hours', t('anniversary.precisionHours')), {['hours']: ['anniversary.precisionHours']})
					.setValue(this.cfg.precision)
					.onChange((v) => {
						this.cfg.precision = v as AnniversaryConfig['precision'];
						this.updatePreview();
					}),
			);

		bindLocalizedControl(bindLocalizedControl(new Setting(body)
			.setName(t('anniversary.annualReminder')), "name", 'anniversary.annualReminder')
			.setDesc(t('anniversary.annualReminderDesc')), "desc", 'anniversary.annualReminderDesc')
			.addToggle((toggle) =>
				toggle.setValue(this.cfg.annualReminder).onChange((v) => {
					this.cfg.annualReminder = v;
				}),
			);

		// Card background: the nested modal edits this.cfg.background in
		// place (cfg is a local copy); the parent Save commits it with the
		// rest of the entry.
		bindLocalizedControl(new Setting(body)
			.setName(t('wbg.set')), "name", 'wbg.set')
			.setDesc(this.cfg.background?.image ?? '')
			.addButton((btn) =>
				bindLocalizedControl(btn.setButtonText(this.cfg.background ? t('common.edit') : t('wbg.set')), "buttonText", this.cfg.background ? ('common.edit') : ('wbg.set'), (this.cfg.background) ? (undefined) : (undefined)).onClick(() => {
					this.backgroundModal = new WidgetBackgroundModal(this.app, this.cfg.background, (bg) => {
						this.cfg.background = bg;
					});
					this.backgroundModal.open();
				}),
			);

		// Live preview of the widget's value line for the current inputs.
		this.preview = bindLocalizedControl(new Setting(body).setName(t('anniversary.preview')), "name", 'anniversary.preview').setDesc('--');
		this.updatePreview();

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				text: t('common.cancel'),
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
		this.saveButton = bindLocalizedElement(footer
			.createEl('button', {
				text: t('common.save'),
				cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			}), 'common.save');
		this.saveButton.disabled = !this.dateValid;
		this.saveButton.addEventListener('click', () => {
				if (!this.dateValid) return;
				this.onSave(this.cfg);
				this.close();
			});
	}

	private updatePreview(): void {
		if (!this.preview) return;
		const start = parseAnniversaryDate(this.cfg.startDate);
		this.preview.setDesc(
			start && this.dateValid ? formatElapsed(start, new Date(), this.cfg.precision) : t('anniversary.invalidDate'),
		);
	}

	onClose(): void {
		this.dateEditor?.dispose();
		this.dateEditor = undefined;
		this.backgroundModal?.close();
		this.backgroundModal = undefined;
		this.contentEl.empty();
	}
}
