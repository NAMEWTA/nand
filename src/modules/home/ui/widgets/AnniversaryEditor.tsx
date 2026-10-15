// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/anniversary-settings-modal.ts
import { useState } from 'react';
import type { AnniversaryConfig } from '../../core/board/types';
import { formatElapsed, parseAnniversaryDate } from '../../core/anniversaries/calendar';
import { replaceCivilDate } from '../../core/anniversaries/civil-date';
import type { LunarLookup } from '../../core/anniversaries/lunar-map';
import { useLunarLookup } from './use-record-lunar';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { Switch } from '../../../../ui/components/switch';
import { Button } from '../../../../ui/components/button';
import { Choice } from '../board/controls';
import { useT } from '../../../../ui/react/hooks';
function LunarInput({
	lookup,
	start,
	onChange,
}: {
	lookup: LunarLookup;
	start: string;
	onChange(this: void, start: string, valid: boolean): void;
}) {
	const t = useT(),
		[parts, setParts] = useState(() => {
			try {
				return lookup.toLunar(start.split('T')[0]!);
			} catch {
				return { year: new Date().getFullYear(), month: 1, day: 1, leap: false };
			}
		}),
		[invalid, setInvalid] = useState(false);
	const change = (patch: Partial<typeof parts>) => {
		const next = { ...parts, ...patch };
		setParts(next);
		try {
			const solar = lookup.toSolar(next.year, next.month, next.leap, next.day);
			onChange(replaceCivilDate(start, solar), true);
			setInvalid(false);
		} catch {
			onChange(start, false);
			setInvalid(true);
		}
	};
	return (
		<>
			<div className="grid grid-cols-3 gap-2">
				{(['year', 'month', 'day'] as const).map((key) => (
					<Label className="grid gap-2" key={key}>
						{t(`anniversary.lunar${key[0]!.toUpperCase() + key.slice(1)}`)}
						<Input
							type="number"
							value={parts[key] || ''}
							onChange={(e) => change({ [key]: Number(e.target.value) })}
						/>
					</Label>
				))}
			</div>
			<Label>
				<Switch checked={parts.leap} onCheckedChange={(leap) => change({ leap })} />
				{t('anniversary.leapMonth')}
			</Label>
			<p className="text-xs text-muted-foreground">{t('anniversary.lunarPolicy')}</p>
			<p role="status" className={invalid ? 'text-destructive' : 'text-xs'}>
				{invalid
					? t('anniversary.invalidLunarDate')
					: t('anniversary.solarEquivalent', { date: start.split('T')[0]! })}
			</p>
		</>
	);
}
export function AnniversaryEditor({
	initial,
	onSave,
	onDelete,
	onClose,
}: {
	initial: AnniversaryConfig;
	onSave(this: void, value: AnniversaryConfig): void;
	onDelete?(this: void): void;
	onClose(this: void): void;
}) {
	const [draft, setDraft] = useState(initial),
		[valid, setValid] = useState(!!parseAnniversaryDate(initial.startDate)),
		t = useT(),
		lunar = draft.calendar === 'lunar',
		{ lookup, failed } = useLunarLookup(lunar);
	return (
		<DashboardDialog
			title={t('anniversary.editTitle')}
			onClose={onClose}
			busy={!valid || (lunar && !lookup)}
			onSave={() => onSave(draft)}
		>
			<Label className="grid gap-2">
				{t('anniversary.label')}
				<Input
					value={draft.label}
					onChange={(e) => setDraft({ ...draft, label: e.target.value, defaultLabel: false })}
				/>
			</Label>
			<Choice
				label={t('anniversary.calendar')}
				value={draft.calendar ?? 'solar'}
				options={['solar', 'lunar'].map((value) => ({ value, label: t(`anniversary.${value}`) }))}
				onChange={(value) => {
					setValid(!!parseAnniversaryDate(draft.startDate));
					setDraft({ ...draft, calendar: value as 'solar' | 'lunar' });
				}}
			/>
			{lunar ? (
				lookup ? (
					<LunarInput
						lookup={lookup}
						start={draft.startDate}
						onChange={(startDate, valid) => {
							setValid(valid);
							setDraft({ ...draft, startDate });
						}}
					/>
				) : (
					<p role="status">{t(failed ? 'anniversary.conversionError' : 'anniversary.loading')}</p>
				)
			) : (
				<Label className="grid gap-2">
					{t('anniversary.startDate')}
					<Input
						type="date"
						value={draft.startDate.split('T')[0] ?? ''}
						onChange={(e) => {
							const startDate = replaceCivilDate(draft.startDate, e.target.value);
							setDraft({ ...draft, startDate });
							setValid(!!parseAnniversaryDate(startDate));
						}}
					/>
				</Label>
			)}
			<Choice
				label={t('anniversary.precision')}
				value={draft.precision}
				options={[
					{ value: 'ymd', label: t('anniversary.precisionYmd') },
					{ value: 'days', label: t('anniversary.precisionDays') },
					{ value: 'hours', label: t('anniversary.precisionHours') },
				]}
				onChange={(value) => setDraft({ ...draft, precision: value as AnniversaryConfig['precision'] })}
			/>
			<Label>
				<Switch
					checked={draft.annualReminder}
					onCheckedChange={(annualReminder) => setDraft({ ...draft, annualReminder })}
				/>
				{t('anniversary.annualReminder')}
			</Label>
			<Label className="grid gap-2">
				{t('wbg.set')}
				<Input
					value={draft.background?.image ?? ''}
					onChange={(e) =>
						setDraft({
							...draft,
							background: e.target.value
								? { opacity: 100, dim: 30, blur: 0, ...draft.background, image: e.target.value }
								: undefined,
						})
					}
				/>
			</Label>
			{draft.background && (
				<div className="grid grid-cols-2 gap-2">
					<Label>
						{t('wbg.opacity')}
						<Input
							type="number"
							min={0}
							max={100}
							value={draft.background.opacity ?? 100}
							onChange={(e) =>
								setDraft({
									...draft,
									background: {
										...draft.background!,
										opacity: Math.max(0, Math.min(100, Number(e.target.value))),
									},
								})
							}
						/>
					</Label>
					<Label>
						{t('wbg.dim')}
						<Input
							type="number"
							min={0}
							max={100}
							value={draft.background.dim ?? 30}
							onChange={(e) =>
								setDraft({
									...draft,
									background: {
										...draft.background!,
										dim: Math.max(0, Math.min(100, Number(e.target.value))),
									},
								})
							}
						/>
					</Label>
					<Label>
						{t('wbg.blur')}
						<Input
							type="number"
							min={0}
							max={20}
							value={draft.background.blur ?? 0}
							onChange={(e) =>
								setDraft({
									...draft,
									background: {
										...draft.background!,
										blur: Math.max(0, Math.min(20, Number(e.target.value))),
									},
								})
							}
						/>
					</Label>
					<Choice
						label={t('wbg.foreground')}
						value={draft.background.foreground?.startsWith('#') ? 'custom' : draft.background.foreground ?? 'theme'}
						options={[
							{ value: 'theme', label: t('wbg.fgTheme') },
							{ value: 'light', label: t('wbg.fgLight') },
							{ value: 'dark', label: t('wbg.fgDark') },
							{ value: 'custom', label: t('wbg.fgCustom') },
						]}
						onChange={(foreground) =>
							setDraft({
								...draft,
								background: {
									...draft.background!,
									foreground: foreground === 'theme' ? undefined : foreground === 'custom' ? (draft.background?.foreground?.startsWith('#') ? draft.background.foreground : '#ffffff') : foreground,
								},
							})
						}
					/>
					<Label>
						{t('wbg.fgCustom')}
						<Input type="color" aria-label={t('wbg.fgCustom')}
							disabled={!draft.background.foreground?.startsWith('#')}
							value={draft.background.foreground?.startsWith('#') ? draft.background.foreground : '#ffffff'}
							onChange={e => setDraft({ ...draft, background: { ...draft.background!, foreground: e.target.value } })} />
					</Label>
				</div>
			)}
			<p>
				{t('anniversary.preview')}:{' '}
				{valid ? formatElapsed(parseAnniversaryDate(draft.startDate)!, new Date(), draft.precision) : '--'}
			</p>
			{onDelete && (
				<Button variant="destructive" onClick={onDelete}>
					{t('common.delete')}
				</Button>
			)}
		</DashboardDialog>
	);
}
