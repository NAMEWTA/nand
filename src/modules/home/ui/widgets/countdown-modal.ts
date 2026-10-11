import { bindLocalizedOptions } from '../../../../ui/primitives/localized-dom';
import { bindLocalizedElement, bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { App, Modal, Setting, setIcon } from 'obsidian';
import { resolveWidgetLabel, usesDefaultWidgetLabel } from '../../core/board/default-widget-label';
import type { CountdownConfig } from '../../core/board/types/index';
import { getLanguage, t } from '../../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';
import { WidgetBackgroundModal } from './widget-background';

export class CountdownSettingsModal extends Modal {
	private config: CountdownConfig;
	private onSave: (config: CountdownConfig) => void;
	private calendarPopup: HTMLElement | null = null;
	private releaseCalendar: (() => void) | null = null;
	private selectedDate: string;
	private selectedHour: number;
	private selectedMinute: number;

	constructor(app: App, config: CountdownConfig, onSave: (config: CountdownConfig) => void) {
		super(app);
		this.config = {
			...config,
			label: resolveWidgetLabel(config, 'countdown'),
			defaultLabel: usesDefaultWidgetLabel(config, 'countdown'),
		};
		this.onSave = onSave;

		// Parse existing value: "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD"
		const raw = config.targetDate;
		if (raw.includes('T')) {
			const parts = raw.split('T');
			this.selectedDate = parts[0] ?? '';
			const [h, m] = (parts[1] ?? '0:0').split(':').map(Number);
			this.selectedHour = h ?? 0;
			this.selectedMinute = m ?? 0;
		} else if (raw) {
			this.selectedDate = raw;
			this.selectedHour = 0;
			this.selectedMinute = 0;
		} else {
			const now = new Date();
			this.selectedDate = '';
			this.selectedHour = now.getHours();
			this.selectedMinute = now.getMinutes();
		}
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		this.modalEl.addClass('modal--dashboard');
		containerEl.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('countdown.settingsTitle') }), 'countdown.settingsTitle');

		const body = container.createDiv({ cls: 'dashboard-modal-body' });
		const form = body.createDiv({ cls: 'dashboard-modal-form' });

		const dateRow = bindLocalizedControl(new Setting(form).setName(t('countdown.targetDate')), "name", 'countdown.targetDate');
		const dateTrigger = dateRow.controlEl.createEl('button', { cls: 'dashboard-countdown-date-trigger', attr: { type: 'button' } });
		const dateText = dateTrigger.createSpan({ text: this.selectedDate || t('countdown.setTarget') });
		setIcon(dateTrigger.createSpan(), 'calendar');
		dateTrigger.addEventListener('click', () => this.showCalendarPopup(dateTrigger, dateText));
		bindLocalizedControl(new Setting(form).setName(t('countdown.displayMode')), "name", 'countdown.displayMode').addDropdown(input => {
			for (const mode of ['days', 'hours', 'minutes']) bindLocalizedOptions(input.addOption(mode, t('countdown.' + mode)), {[mode]: ['countdown.' + mode]});
			input.setValue(this.config.displayMode).onChange(value => { this.config.displayMode = value as 'days' | 'hours' | 'minutes'; });
		});
		bindLocalizedControl(bindLocalizedControl(new Setting(form).setName(t('countdown.reminderDays')), "name", 'countdown.reminderDays').setDesc(t('countdown.reminderDaysDesc')), "desc", 'countdown.reminderDaysDesc').addText(input => {
			input.inputEl.type = 'number'; input.inputEl.min = '0'; input.inputEl.max = '365';
			input.setValue(String(this.config.reminderDays)).onChange(value => { this.config.reminderDays = parseInt(value, 10) || 0; });
		});
		bindLocalizedControl(new Setting(form).setName(t('countdown.label')), "name", 'countdown.label').addText(input => {
			bindLocalizedControl(input.setValue(this.config.label).setPlaceholder(t('countdown.labelPlaceholder')), "placeholder", 'countdown.labelPlaceholder').onChange(value => {
				this.config.label = value.trim(); this.config.defaultLabel = false;
			});
		});
		bindLocalizedControl(new Setting(form).setName(t('wbg.set')), "name", 'wbg.set').addButton(button => bindLocalizedControl(button
			.setButtonText(this.config.background ? t('common.edit') : t('wbg.set')), "buttonText", this.config.background ? ('common.edit') : ('wbg.set'), (this.config.background) ? (undefined) : (undefined)).onClick(() => {
				new WidgetBackgroundModal(this.app, this.config.background, background => { this.config.background = background; }).open();
			}));

		// Actions
		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
		const saveBtn = bindLocalizedElement(footer.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			text: t('common.save'),
		}), 'common.save');
		saveBtn.addEventListener('click', () => {
			// Time lives on the instance (picked inside the calendar popup).
			const dateTime = this.selectedDate
				? `${this.selectedDate}T${String(this.selectedHour).padStart(2, '0')}:${String(this.selectedMinute).padStart(2, '0')}`
				: '';
			this.onSave({
				...this.config,
				targetDate: dateTime,
			});
			this.close();
		});
	}

	onClose(): void {
		this.closeCalendarPopup();
		const { contentEl } = this;
		contentEl.empty();
	}

	private closeCalendarPopup(): void {
		this.releaseCalendar?.();
		this.releaseCalendar = null;
		if (this.calendarPopup) {
			this.calendarPopup.remove();
			this.calendarPopup = null;
		}
	}

	private showCalendarPopup(anchor: HTMLElement, dateText: HTMLElement): void {
		this.closeCalendarPopup();

		const doc = anchor.ownerDocument;
		const win = doc.defaultView!;
		const popup = doc.body.createDiv({
			cls: 'dashboard-task-reminder-popup dashboard-countdown-calendar-popup',
		});
		applyModalTheme(popup);

		const rect = anchor.getBoundingClientRect();
		popup.setCssProps({
			position: 'fixed',
			top: `${rect.bottom + 4}px`,
		});
		const popupWidth = 240;
		if (rect.left + popupWidth > win.innerWidth) {
			popup.style.right = `${win.innerWidth - rect.right}px`;
		} else {
			popup.style.left = `${rect.left}px`;
		}

		const now = new Date();
		let selectedYear: number;
		let selectedMonth: number;
		let selectedDay: number;

		if (this.selectedDate) {
			const dp = this.selectedDate.split('-').map(Number);
			selectedYear = dp[0] ?? now.getFullYear();
			selectedMonth = (dp[1] ?? now.getMonth() + 1) - 1;
			selectedDay = dp[2] ?? now.getDate();
		} else {
			selectedYear = now.getFullYear();
			selectedMonth = now.getMonth();
			selectedDay = now.getDate();
		}

		const viewYear = { value: selectedYear };
		const viewMonth = { value: selectedMonth };
		const lang = getLanguage();
		const dayNames =
			lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
		const monthNames =
			lang === 'zh'
				? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
				: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

		// Two-level header: < > navigate months (or years in the year-month
		// panel); the label button toggles between the day grid and the
		// year-month panel for fast jumps across years.
		const calNav = popup.createDiv({ cls: 'dashboard-task-reminder-calendar-nav' });
		const prevBtn = calNav.createEl('button', { text: '<' });
		const monthLabel = calNav.createEl('button', { cls: 'dashboard-countdown-cal-label' });
		const nextBtn = calNav.createEl('button', { text: '>' });

		// The panel swaps between the day grid and the year-month picker;
		// the time row and action buttons stay put below it.
		const calBody = popup.createDiv();
		const timeRow = popup.createDiv({ cls: 'dashboard-countdown-popup-time' });
		const btnRow = popup.createDiv({ cls: 'dashboard-task-reminder-popup-btns' });
		bindLocalizedElement(btnRow.createEl('button', { cls: 'dashboard-modal-btn dashboard-modal-btn--confirm', text: t('common.save') }), 'common.save');
		bindLocalizedElement(btnRow.createEl('button', { cls: 'dashboard-modal-btn dashboard-modal-btn--cancel', text: t('common.cancel') }), 'common.cancel');

		const ymMode = { value: false };

		const renderCalendar = () => {
			calBody.empty();
			if (ymMode.value) {
				renderYearMonthPanel();
				return;
			}
			const grid = calBody.createDiv({ cls: 'dashboard-task-reminder-calendar' });
			const y = viewYear.value;
			const m = viewMonth.value;
			monthLabel.setText(`${y}-${String(m + 1).padStart(2, '0')}`);

			for (const d of dayNames) {
				grid.createDiv({ cls: 'dashboard-task-reminder-calendar-header', text: d });
			}

			const firstDay = new Date(y, m, 1).getDay();
			const daysInMonth = new Date(y, m + 1, 0).getDate();
			const daysInPrev = new Date(y, m, 0).getDate();
			const today = new Date();
			const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;

			for (let i = firstDay - 1; i >= 0; i--) {
				const d = daysInPrev - i;
				grid.createEl('button', {
					cls: 'dashboard-task-reminder-calendar-day dashboard-task-reminder-calendar-day--other-month',
					text: String(d),
				});
			}

			for (let d = 1; d <= daysInMonth; d++) {
				const cls = ['dashboard-task-reminder-calendar-day'];
				if (isCurrentMonth && d === today.getDate()) cls.push('dashboard-task-reminder-calendar-day--today');
				if (y === selectedYear && m === selectedMonth && d === selectedDay)
					cls.push('dashboard-task-reminder-calendar-day--selected');
				const dayBtn = grid.createEl('button', { cls: cls.join(' '), text: String(d) });
				dayBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					selectedYear = y;
					selectedMonth = m;
					selectedDay = d;
					renderCalendar();
				});
			}

			const totalCells = firstDay + daysInMonth;
			const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
			for (let d = 1; d <= remaining; d++) {
				grid.createEl('button', {
					cls: 'dashboard-task-reminder-calendar-day dashboard-task-reminder-calendar-day--other-month',
					text: String(d),
				});
			}
		};

		/** Year-month picker: the top nav already shows the year and steps by
		 *  years, so this panel is just the 12 month cells. */
		const renderYearMonthPanel = () => {
			const panel = calBody.createDiv({ cls: 'dashboard-countdown-ym-panel' });
			monthLabel.setText(String(viewYear.value));

			const monthGrid = panel.createDiv({ cls: 'dashboard-countdown-ym-grid' });
			for (let m = 0; m < 12; m++) {
				const cls = ['dashboard-countdown-ym-cell'];
				if (viewYear.value === selectedYear && m === selectedMonth)
					cls.push('dashboard-task-reminder-calendar-day--selected');
				const monthBtn = monthGrid.createEl('button', { cls: cls.join(' '), text: monthNames[m] });
				monthBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					viewMonth.value = m;
					ymMode.value = false;
					renderCalendar();
				});
			}
		};

		// Header navigation: months in the day grid, years in the year-month
		// panel; the label button toggles between the two views.
		const step = (dir: number): void => {
			if (ymMode.value) {
				viewYear.value += dir;
			} else {
				viewMonth.value += dir;
				if (viewMonth.value < 0) {
					viewMonth.value = 11;
					viewYear.value--;
				}
				if (viewMonth.value > 11) {
					viewMonth.value = 0;
					viewYear.value++;
				}
			}
			renderCalendar();
		};

		prevBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			step(-1);
		});

		nextBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			step(1);
		});

		monthLabel.addEventListener('click', (e) => {
			e.stopPropagation();
			ymMode.value = !ymMode.value;
			renderCalendar();
		});

		// Time row: hour and minute pick inside the popup, so one Save commit
		// carries both the date and the time.
		bindLocalizedElement(timeRow.createSpan({ cls: 'dashboard-countdown-popup-time-label', text: t('countdown.targetTime') }), 'countdown.targetTime');
		const hourSelect = timeRow.createEl('select', { cls: 'dashboard-countdown-time-select' });
		for (let h = 0; h < 24; h++) {
			const opt = hourSelect.createEl('option', { text: String(h).padStart(2, '0'), attr: { value: String(h) } });
			if (h === this.selectedHour) opt.selected = true;
		}
		timeRow.createSpan({ cls: 'dashboard-countdown-time-sep', text: ':' });
		const minuteSelect = timeRow.createEl('select', { cls: 'dashboard-countdown-time-select' });
		for (let m = 0; m < 60; m += 5) {
			const opt = minuteSelect.createEl('option', {
				text: String(m).padStart(2, '0'),
				attr: { value: String(m) },
			});
			if (m === this.selectedMinute) opt.selected = true;
		}
		// Also offer the exact stored minute when it is not a multiple of 5.
		if (this.selectedMinute % 5 !== 0) {
			const opt = minuteSelect.createEl('option', {
				text: String(this.selectedMinute).padStart(2, '0'),
				attr: { value: String(this.selectedMinute) },
			});
			opt.selected = true;
		}
		hourSelect.addEventListener('change', () => {
			this.selectedHour = parseInt(hourSelect.value, 10) || 0;
		});
		minuteSelect.addEventListener('change', () => {
			this.selectedMinute = parseInt(minuteSelect.value, 10) || 0;
		});

		btnRow.querySelector('.dashboard-modal-btn--confirm')!.addEventListener('click', (e) => {
			e.stopPropagation();
			this.selectedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
			dateText.setText(this.selectedDate);
			this.closeCalendarPopup();
		});

		btnRow.querySelectorAll('button')[1]!.addEventListener('click', (e) => {
			e.stopPropagation();
			this.closeCalendarPopup();
		});

		renderCalendar();
		this.calendarPopup = popup;

		// Swallow mousedowns inside the popup so the document-level outside
		// click handler never sees them — clicking the native time <select>
		// (whose dropdown lives outside the DOM tree) used to read as an
		// outside click and close the popup instantly.
		popup.addEventListener('mousedown', (e) => e.stopPropagation());

		const outsideClick = (ev: MouseEvent) => {
			const target = ev.target as Element | null;
			// Native select dropdown layers can report detached or option
			// targets; never treat them as outside.
			if (target && typeof target.matches === 'function' && target.matches('select, option')) return;
			if (!popup.contains(target) && !anchor.contains(target)) {
				this.closeCalendarPopup();
			}
		};
		const timer = win.setTimeout(() => doc.addEventListener('mousedown', outsideClick), 0);
		this.releaseCalendar = () => { win.clearTimeout(timer); doc.removeEventListener('mousedown', outsideClick); };
	}
}
