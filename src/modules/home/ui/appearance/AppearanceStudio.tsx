// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/theme-studio-modal.ts
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { RotateCcw } from 'lucide-react';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { Slider } from '../../../../ui/components/slider';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import type { HomeHost } from '../../services/home-host';
import { dashboardSettingsStore } from '../../services/settings-store';
import {
	CUSTOM_COLOR_TOKENS,
	captureAppearanceSnapshot,
	customThemeSettingsSlice,
	type CustomColors,
} from '../../core/board/custom-theme';
import { homeDecor } from '../../core/board/appearance-preset';
import { resolveCustomColorValue } from './appearance';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { P1Dialog } from '../dialogs/P1Dialog';
import { DashboardAppearanceProvider } from '../theme/ThemeBridge';
import { Choice } from '../board/controls';
import { p1Classes as cls } from '../theme/p1-classes';
import { DashboardImagePicker } from '../banner/DashboardImagePicker';
const swatches = [
	'#e76f51',
	'#e9c46a',
	'#2a9d8f',
	'#577590',
	'#6d597a',
	'#b56576',
	'#3b82f6',
	'#8b5cf6',
	'#ec4899',
	'#10b981',
];
function rgb(color: string | undefined): { hex: string; alpha: number } {
	const parts = color?.match(/[\d.]+/g);
	return {
		hex: color?.startsWith('#')
			? color
			: parts && parts.length >= 3
				? '#' +
					parts
						.slice(0, 3)
						.map((n) => Number(n).toString(16).padStart(2, '0'))
						.join('')
				: '#808080',
		alpha: color?.startsWith('rgba') && parts?.[3] ? Number(parts[3]) * 100 : 100,
	};
}
const compose = (hex: string, alpha: number) =>
	alpha >= 100 ? hex : `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${alpha / 100})`;
export function AppearanceStudio({ host, onClose }: { host: HomeHost; onClose: () => void }) {
	const [store] = useState(() => dashboardSettingsStore(host));
	useEffect(() => store.connect(), [store]);
	const settings = useStore(store.state, (s) => s.settings),
		t = useT(),
		doc = useOwnerDocument();
	const [name, setName] = useState<string | null>(null),
		[error, setError] = useState(''),
		[picking, setPicking] = useState(false),
		[reset, setReset] = useState(false),
		[removing, setRemoving] = useState<string | null>(null);
	const [defaults] = useState(() => {
		const root = [...doc.querySelectorAll<HTMLElement>('.nand-dashboard-root[data-theme]')].find(
			(root) => root.getBoundingClientRect().width > 0,
		);
		return Object.fromEntries(
			Object.entries(CUSTOM_COLOR_TOKENS).map(([key, token]) => [
				key,
				root ? doc.defaultView!.getComputedStyle(root).getPropertyValue(token).trim() : undefined,
			]),
		);
	});
	const update = (change: Parameters<typeof store.update>[0]) => {
		setError('');
		void store.update(change).catch((e) => setError(String(e)));
	};
	const color = (key: keyof CustomColors, value: string | undefined) =>
		update((s) => {
			s.customColors = { ...s.customColors, [key]: value };
			delete s.activeCustomThemeId;
		});
	const slider = (
		key: 'bgDim' | 'bgBlur' | 'surfaceOpacity' | 'glassBlur' | 'radiusScale',
		max: number,
		fallback: number,
	) => {
		const nullable = key !== 'bgDim' && key !== 'bgBlur';
		return (
			<div className={cls('dashboard-theme-studio-slider-row')} key={key}>
				<span className={cls('dashboard-theme-studio-color-label')}>
					{t(`home.p1.${key}`)} {settings[key] ?? fallback}
				</span>
				{nullable && (
					<span className={cls('dashboard-theme-studio-slider-hint')}>
						{settings[key] === null ? t('themeStudio.advanced.themeDefault') : ''}
					</span>
				)}
				<Slider
					data-hit-control
					className="dashboard-theme-studio-slider h-4 flex-[2]"
					thumbLabels={[t(`home.p1.${key}`)]}
					min={0}
					max={max}
					value={[settings[key] ?? fallback]}
					onValueChange={([value]) =>
						update((s) => {
							s[key] = value!;
							delete s.activeCustomThemeId;
						})
					}
				/>
				{nullable && (
					<Button
						size="icon-xs"
						variant="ghost"
						className={cls('dashboard-theme-studio-color-clear')}
						aria-label={t('themeStudio.advanced.resetToTheme')}
						onClick={() =>
							update((s) => {
								s[key] = null;
							})
						}
					>
						<RotateCcw />
					</Button>
				)}
			</div>
		);
	};
	return (
		<DashboardAppearanceProvider host={host} settings={settings}>
			<P1Dialog
				title={t('themeStudio.modalTitle')}
				classes="dashboard-modal dashboard-modal--compact dashboard-theme-studio"
				onClose={onClose}
				width={560}
			>
				<div className={cls('dashboard-modal-header dashboard-theme-studio-header')}>
					<div className={cls('dashboard-modal-title')}>{t('themeStudio.modalTitle')}</div>
					<Button
						size="xs"
						variant="ghost"
						data-hit-control
						className={`${cls('dashboard-theme-studio-resetall')} h-[30px]`}
						onClick={() => setReset(true)}
					>
						<RotateCcw className="size-[13px]" />
						{t('themeStudio.resetAll')}
					</Button>
				</div>
				<div className={cls('dashboard-modal-body')}>
					<p className={cls('dashboard-theme-studio-hint')}>
						{t('themeStudio.hint')}
					</p>
					<div className={cls('dashboard-modal-form')}>
						<section style={{ paddingBottom: 13 }} className={cls('dashboard-theme-studio-section')}>
							<h3>{t('themeStudio.color.title')}</h3>
							<p className={cls('dashboard-theme-studio-desc')}>{t('themeStudio.color.desc')}</p>
							<div className={cls('dashboard-theme-studio-swatches')}>
								{swatches.map((hex) => (
									<Button
										key={hex}
										size="icon-xs"
										variant="ghost"
										className={cls('dashboard-theme-studio-swatch')}
										aria-label={hex}
										style={{ background: hex }}
										onClick={() => color('accent', hex)}
									/>
								))}
							</div>
							<div className={cls('dashboard-theme-studio-color-list')}>
								{Object.keys(CUSTOM_COLOR_TOKENS).map((raw) => {
									const key = raw as keyof CustomColors,
										value = settings.customColors[key],
										mode = !value
											? 'theme'
											: value === 'light' || value === 'dark'
												? value
												: 'custom';
									const { hex, alpha } = rgb(resolveCustomColorValue(key, value) ?? defaults[key]);
									return (
										<div className={cls('dashboard-theme-studio-color-row')} key={key}>
											<span className={cls('dashboard-theme-studio-color-label')}>
												{t(`themeStudio.color.${key}`)}
											</span>
											<Choice
												compact
												className={`${cls('dashboard-theme-studio-color-mode')} data-[size=sm]:h-7`}
												label={t(`themeStudio.color.${key}`)}
												value={mode}
												options={['theme', 'light', 'dark', 'custom'].map((value) => ({
													value,
													label: t(`home.p1.color.${value}`),
												}))}
												onChange={(mode) =>
													color(
														key,
														mode === 'theme'
															? undefined
															: mode === 'custom'
																? compose(hex, alpha)
																: mode,
													)
												}
											/>
											<Input
												data-hit-control
												type="color"
												className={cls('dashboard-modal-color-input')}
												aria-label={t(`themeStudio.color.${key}`)}
												disabled={mode !== 'custom'}
												value={hex}
												onChange={(e) => color(key, compose(e.target.value, alpha))}
											/>
											<Slider
												data-hit-control
												className="dashboard-theme-studio-alpha-slider h-4 w-[90px] shrink-0 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:size-3"
												thumbLabels={[t('themeStudio.color.alpha')]}
												min={0}
												max={100}
												step={5}
												disabled={mode !== 'custom'}
												value={[alpha]}
												onValueChange={([value]) => color(key, compose(hex, value!))}
											/>
											<Button
												size="icon-xs"
												variant="ghost"
												className={cls('dashboard-theme-studio-color-clear')}
												aria-label={t('themeStudio.color.clear')}
												onClick={() => color(key, undefined)}
											>
												<RotateCcw />
											</Button>
										</div>
									);
								})}
							</div>
							<Button
								size="xs"
								variant="outline"
								data-hit-control
								className={`${cls('dashboard-theme-studio-reset')} h-[30px]`}
								onClick={() =>
									update((s) => {
										s.customColors = {};
										delete s.activeCustomThemeId;
									})
								}
							>
								{t('themeStudio.color.reset')}
							</Button>
						</section>
						<section className={cls('dashboard-theme-studio-section')}>
							<h3>{t('themeStudio.bg.title')}</h3>
							<p className={cls('dashboard-theme-studio-desc')}>{t('themeStudio.bg.desc')}</p>
							<div className={cls('dashboard-theme-studio-image-row')}>
								<Input
									className={cls('dashboard-modal-input dashboard-theme-studio-image-input')}
									aria-label={t('home.dashboard.image')}
									placeholder="attachments/bg.jpg"
									value={settings.bgImage}
									onChange={(e) =>
										update((s) => {
											s.bgImage = e.target.value;
											delete s.activeCustomThemeId;
										})
									}
								/>
								<Button
									size="sm"
									variant="outline"
									className={cls('dashboard-theme-studio-browse')}
									onClick={() => setPicking(true)}
								>
									{t('themeStudio.bg.browse')}
								</Button>
								<Button
									size="sm"
									variant="outline"
									className={cls('dashboard-theme-studio-image-clear')}
									onClick={() =>
										update((s) => {
											s.bgImage = '';
										})
									}
								>
									{t('themeStudio.bg.clear')}
								</Button>
							</div>
							{slider('bgDim', 100, 40)}
							{slider('bgBlur', 30, 0)}
							<div className={cls('dashboard-theme-studio-size-row')}>
								<span className={cls('dashboard-theme-studio-color-label')}>
									{t('themeStudio.bg.size')}
								</span>
								<Choice
									compact
									className={cls('dashboard-theme-studio-size')}
									label={t('themeStudio.bg.size')}
									value={settings.bgSize}
									options={['cover', 'contain'].map((value) => ({
										value,
										label: t(`themeStudio.bg.${value}`),
									}))}
									onChange={(value) =>
										update((s) => {
											s.bgSize = value as 'cover' | 'contain';
										})
									}
								/>
							</div>
						</section>
						<section className={cls('dashboard-theme-studio-section')}>
							<h3>{t('themeStudio.advanced.title')}</h3>
							<p className={cls('dashboard-theme-studio-desc')}>{t('themeStudio.advanced.desc')}</p>
							{slider('surfaceOpacity', 100, 100)}
							{slider('glassBlur', 20, 0)}
							{slider('radiusScale', 22, 14)}
							<div className={cls('dashboard-theme-studio-fontscale-row')}>
								<span className={cls('dashboard-theme-studio-color-label')}>
									{t('themeStudio.fontSize')}
								</span>
								<div className={cls('dashboard-theme-studio-fontscale')}>
									{(['small', 'medium', 'large'] as const).map((value) => (
										<Button
											size="xs"
											variant="ghost"
											key={value}
											className={cls(
												`dashboard-theme-studio-fontscale-btn${settings.fontScale === value ? ' active' : ''}`,
											)}
											onClick={() =>
												update((s) => {
													s.fontScale = value;
												})
											}
										>
											{t(`home.p1.${value}`)}
										</Button>
									))}
								</div>
								<Button
									size="icon-xs"
									variant="ghost"
									className={cls('dashboard-theme-studio-color-clear')}
									aria-label={t('themeStudio.fontSizeReset')}
									onClick={() =>
										update((s) => {
											s.fontScale = 'medium';
										})
									}
								>
									<RotateCcw />
								</Button>
							</div>
						</section>
						<section className={cls('dashboard-theme-studio-section dashboard-theme-studio-mythemes')}>
							<h3>{t('themeStudio.myThemes')}</h3>
							<p className={cls('dashboard-theme-studio-desc')}>
								{t(
									settings.customThemes.length
										? 'themeStudio.myThemesDesc'
										: 'themeStudio.myThemesEmpty',
								)}
							</p>
							<div className={cls('dashboard-theme-studio-mythemes-list')}>
								{settings.customThemes.map((theme) => (
									<div
										className={cls(
											`dashboard-theme-studio-mytheme-item${settings.activeCustomThemeId === theme.id ? ' is-active' : ''}`,
										)}
										key={theme.id}
									>
										<Input
											aria-label={t('home.dashboard.name')}
											className={cls('dashboard-theme-studio-mytheme-name')}
											defaultValue={theme.name}
											onBlur={(e) => {
												const name = e.target.value.trim();
												if (
													name &&
													!settings.customThemes.some(
														(p) => p.id !== theme.id && p.name === name,
													)
												)
													update((s) => {
														const p = s.customThemes.find((p) => p.id === theme.id);
														if (p) p.name = name;
													});
											}}
										/>
										<span className={cls('dashboard-theme-studio-mytheme-base')}>{theme.base}</span>
										<Button
											size="xs"
											variant="outline"
											onClick={() =>
												update((s) => Object.assign(s, customThemeSettingsSlice(theme)))
											}
										>
											{t('themeStudio.applyTheme')}
										</Button>
										<Button size="xs" variant="ghost" onClick={() => setRemoving(theme.id)}>
											{t('common.delete')}
										</Button>
									</div>
								))}
							</div>
						</section>
					</div>
					{error && <p role="alert">{error}</p>}
				</div>
				<div className={cls('dashboard-modal-footer')}>
					<Button size="sm" variant="outline" onClick={() => setName('')}>
						{t('themeStudio.saveAsTheme')}
					</Button>
					<Button size="sm" onClick={onClose}>
						{t('common.close')}
					</Button>
				</div>
			</P1Dialog>
			{name !== null && (
				<DashboardDialog
					title={t('home.p1.saveTheme')}
					onClose={() => setName(null)}
					onSave={() => {
						if (!name.trim()) {
							setError(t('appearancePresets.nameRequired'));
							return;
						}
						if (settings.customThemes.some((p) => p.name === name.trim())) {
							setError(t('appearancePresets.duplicate'));
							return;
						}
						update((s) => {
							const id = crypto.randomUUID();
							s.customThemes.push({ ...captureAppearanceSnapshot(s), id, name: name.trim() });
							s.activeCustomThemeId = id;
						});
						setName(null);
					}}
				>
					<Input
						aria-label={t('home.dashboard.name')}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
					{error && <p role="alert">{error}</p>}
				</DashboardDialog>
			)}
			{reset && (
				<DashboardDialog
					title={t('themeStudio.resetAll')}
					onClose={() => setReset(false)}
					onSave={() => {
						update((s) => {
							Object.assign(s, homeDecor({}));
							s.customColors = {};
							delete s.activeCustomThemeId;
						});
						setReset(false);
					}}
				>
					<p>{t('themeStudio.resetAllConfirm')}</p>
				</DashboardDialog>
			)}
			{removing && (
				<DashboardDialog
					title={t('common.delete')}
					confirmLabel={t('common.delete')}
					danger
					onClose={() => setRemoving(null)}
					onSave={() => {
						update((s) => {
							s.customThemes = s.customThemes.filter((p) => p.id !== removing);
							if (s.activeCustomThemeId === removing) delete s.activeCustomThemeId;
						});
						setRemoving(null);
					}}
				>
					<p>{settings.customThemes.find((theme) => theme.id === removing)?.name}</p>
				</DashboardDialog>
			)}
			{picking && (
				<DashboardImagePicker
					app={host.app}
					onPick={(path) => {
						update((s) => {
							s.bgImage = path;
						});
						setPicking(false);
					}}
					onClose={() => setPicking(false)}
				/>
			)}
		</DashboardAppearanceProvider>
	);
}
