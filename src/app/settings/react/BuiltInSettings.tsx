// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type DashboardPlugin from '../../main';
import type { FieldSpec, SettingsPageSpec } from '../../contracts/settings';
import { appearancePage } from '../appearance';
import { useOwnerWindow, useT } from '../../../ui/react/hooks';
import { SettingsRow } from '../../../ui/components/nand/SettingsRow';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { Choice } from '../../../ui/components/nand/Choice';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Slider } from '../../../ui/components/slider';
import { Switch } from '../../../ui/components/switch';
function Field({ field }: { field: FieldSpec }) {
	const t = useT(),
		[busy, setBusy] = useState(false);
	const handle = field.kind === 'button' ? undefined : field.handle;
	useSyncExternalStore(
		(listener) => handle?.subscribe(listener) ?? (() => {}),
		() => handle?.get(),
	);
	const run = (work: () => void | Promise<void>) => {
		setBusy(true);
		void Promise.resolve()
			.then(work)
			.catch(() => toast.error(t('settings.writeFailed')))
			.finally(() => setBusy(false));
	};
	if (field.visible?.() === false) return null;
	const label = t(field.nameKey);
	if (field.kind === 'button')
		return (
			<SettingsRow
				label={label}
				description={field.descriptionKey && t(field.descriptionKey)}
				control={
					<Button
						variant={field.cta ? 'default' : 'outline'}
						disabled={busy}
						onClick={() => run(() => field.run())}
					>
						{t(field.labelKey)}
					</Button>
				}
			/>
		);
	const value = (field.handle.get() as Record<string, unknown>)[field.key];
	const set = (next: unknown) => {
		void field.handle
			.update((draft) => {
				(draft as Record<string, unknown>)[field.key] = next;
			})
			.catch(() => toast.error(t('settings.writeFailed')));
	};
	return (
		<SettingsRow
			label={label}
			description={field.descriptionKey && t(field.descriptionKey)}
			control={
				field.kind === 'select' ? (
					<Choice
						label={label}
						value={String(value)}
						options={field.options.map((option) => [option.value, t(option.labelKey)])}
						onChange={set}
					/>
				) : field.kind === 'toggle' ? (
					<Switch aria-label={label} checked={!!value} onCheckedChange={set} />
				) : field.kind === 'slider' ? (
					<div className="flex w-48 items-center gap-3">
						<Slider
							aria-label={label}
							min={field.min}
							max={field.max}
							step={field.step}
							value={[Number(value)]}
							onValueChange={(v) => set(v[0])}
						/>
						<output className="text-xs tabular-nums">{String(value)}</output>
					</div>
				) : field.kind === 'color' ? (
					<div className="flex items-center gap-2">
						<input
							type="color"
							aria-label={label}
							value={/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : '#7c3aed'}
							onChange={(e) => set(e.target.value)}
							className="h-8 w-10 rounded-md border border-input bg-transparent p-1"
						/>
						<Input
							aria-label={label}
							className="w-32"
							value={String(value)}
							onChange={(e) => set(e.target.value)}
						/>
						<Button variant="outline" onClick={() => set('')}>
							{t(field.resetLabelKey)}
						</Button>
					</div>
				) : (
					<Input
						aria-label={label}
						value={String(value)}
						placeholder={field.placeholderKey && t(field.placeholderKey)}
						onChange={(e) => set(e.target.value)}
					/>
				)
			}
		/>
	);
}
function SettingsSpec({ spec }: { spec: SettingsPageSpec }) {
	const t = useT();
	return (
		<div className="space-y-8">
			{spec.descriptionKey && <p className="text-sm text-muted-foreground">{t(spec.descriptionKey)}</p>}
			{spec.sections.map((section, index) => (
				<SettingsSection
					key={index}
					title={section.titleKey ? t(section.titleKey) : ''}
					description={section.descriptionKey && t(section.descriptionKey)}
				>
					{section.fields.map((field) => (
						<Field key={field.nameKey} field={field} />
					))}
				</SettingsSection>
			))}
		</div>
	);
}
export function AppearanceSettings({ plugin }: { plugin: DashboardPlugin }) {
	const owner = useOwnerWindow();
	return <SettingsSpec spec={appearancePage(plugin.theme, owner.navigator.clipboard)} />;
}
export function AboutSettings() {
	const t = useT();
	return (
		<div className="space-y-6 text-sm">
			<div className="space-y-2">
				{['about.intro1', 'about.intro2', 'about.intro3'].map((key) => (
					<p key={key}>{t(key)}</p>
				))}
			</div>
			<SettingsSection title={t('about.building')}>
				{[
					['about.projNand', 'about.projNandDesc'],
					['about.projWta', 'about.projWtaDesc'],
				].map(([name, desc]) => (
					<p key={name}>
						<strong>{t(name!)}</strong>｜{t(desc!)}
					</p>
				))}
			</SettingsSection>
			<SettingsSection title={t('about.contact')}>
				<a className="text-primary underline underline-offset-4" href="https://github.com/NAMEWTA">
					{t('about.githubUser')}
				</a>
			</SettingsSection>
		</div>
	);
}
