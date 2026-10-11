import { render } from 'preact';
import { onLanguageChanged, t } from '../../../../shared/i18n';
import { TextField } from '../../../../ui/primitives/TextField';
import { parseAnniversaryDate } from '../../core/anniversaries/calendar';
import { replaceCivilDate } from '../../core/anniversaries/civil-date';
import type { LunarLookup } from '../../core/anniversaries/lunar-map';
import type { AnniversaryConfig } from '../../core/board/types/model';
import { createLunarLookup } from '../../platform/calendar/lunar-lookup';

/** Calendar input is a draft; changing the input system never changes the stored instant. */
export class AnniversaryDateEditor {
	private calendar: 'solar' | 'lunar';
	private start: string;
	private lunar = { year: '', month: '1', day: '', leap: false };
	private lookup?: LunarLookup;
	private loading = false;
	private failed = false;
	private closed = false;
	private readonly languageCleanup: () => void;
	valid = false;
	constructor(private readonly root: HTMLElement, initial: AnniversaryConfig, private readonly change: (start: string, calendar: 'solar' | 'lunar', valid: boolean) => void) {
		this.start = initial.startDate;
		this.calendar = initial.calendar === 'lunar' ? 'lunar' : 'solar';
		this.valid = !!parseAnniversaryDate(this.start);
		this.draw();
		this.languageCleanup = onLanguageChanged(() => this.draw());
		if (this.calendar === 'lunar') this.load();
	}
	private load(): void {
		if (this.lookup) { this.readLunar(); return; }
		this.loading = true;
		this.publish();
		void createLunarLookup().then(lookup => {
			if (this.closed) return;
			this.lookup = lookup;
			this.loading = false;
			this.readLunar();
		}).catch(() => {
			if (this.closed) return;
			this.loading = false;
			this.failed = true;
			this.publish();
		});
	}
	private readLunar(): void {
		try {
			if (this.start && this.valid) {
				const parts = this.lookup!.toLunar(this.start.split('T')[0]!);
				this.lunar = { year: String(parts.year), month: String(parts.month), day: String(parts.day), leap: parts.leap };
			}
		} catch { this.failed = true; }
		this.publish();
	}
	private editLunar(update: Partial<typeof this.lunar>): void {
		this.lunar = { ...this.lunar, ...update };
		try {
			const { year, month, day, leap } = this.lunar;
			if (![year, month, day].every(value => /^\d+$/.test(value))) throw new RangeError('Incomplete date');
			this.start = replaceCivilDate(this.start, this.lookup!.toSolar(Number(year), Number(month), leap, Number(day)));
			this.valid = !!parseAnniversaryDate(this.start);
		} catch { this.valid = false; }
		this.publish();
	}
	private publish(): void {
		this.change(this.start, this.calendar, this.valid && !this.loading && !this.failed);
		this.draw();
	}
	private draw(): void {
		const lunar = this.calendar === 'lunar';
		const message = this.loading ? t('anniversary.loading') : this.failed ? t('anniversary.conversionError') : !this.valid ? t(lunar ? 'anniversary.invalidLunarDate' : 'anniversary.invalidDate') : '';
		render(<div class="nand-ui-stack nand-anniversary-date-editor">
			<label class="nand-field"><span class="nand-field-label">{t('anniversary.calendar')}</span>
				<select class="dropdown" value={this.calendar} disabled={this.loading} onChange={event => {
					// An invalid typed date must be corrected before it can be converted.
					if (!this.valid && (lunar ? this.lunar.year || this.lunar.day : this.start)) { event.currentTarget.value = this.calendar; return; }
					this.calendar = event.currentTarget.value === 'lunar' ? 'lunar' : 'solar';
					this.failed = false;
					if (this.calendar === 'lunar') this.load(); else this.publish();
				}}><option value="solar">{t('anniversary.solar')}</option><option value="lunar">{t('anniversary.lunar')}</option></select>
			</label>
			{!lunar ? <TextField label={t('anniversary.startDate')} hint={t('anniversary.startDateDesc')} type="date" value={this.start.split('T')[0] ?? ''} onInput={day => {
				this.start = replaceCivilDate(this.start, day);
				this.valid = !!parseAnniversaryDate(this.start);
				this.publish();
			}} /> : <>
				<TextField label={t('anniversary.lunarYear')} type="number" value={this.lunar.year} disabled={!this.lookup} onInput={year => this.editLunar({ year })} />
				<TextField label={t('anniversary.lunarMonth')} type="number" value={this.lunar.month} disabled={!this.lookup} onInput={month => this.editLunar({ month })} />
				<TextField label={t('anniversary.lunarDay')} type="number" value={this.lunar.day} disabled={!this.lookup} onInput={day => this.editLunar({ day })} />
				<label class="nand-ui-toolbar"><input type="checkbox" checked={this.lunar.leap} disabled={!this.lookup} onChange={event => this.editLunar({ leap: event.currentTarget.checked })} />{t('anniversary.leapMonth')}</label>
				<p class="nand-field-hint">{t('anniversary.lunarPolicy')}</p>
				{this.valid && !this.loading && !this.failed && <p>{t('anniversary.solarEquivalent', { date: this.start.split('T')[0]! })}</p>}
			</>}
			<div role="status" aria-live="polite">{message}</div>
		</div>, this.root);
	}
	dispose(): void { this.closed = true; this.languageCleanup(); render(null, this.root); }
}
