// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/theme-studio-modal.ts
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { RotateCcw } from 'lucide-react';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { Slider } from '../../../../ui/components/slider';
import { useT } from '../../../../ui/react/hooks';
import type { HomeHost } from '../../services/home-host';
import { dashboardSettingsStore } from '../../services/settings-store';
import { homeDecor } from '../../core/board/appearance-preset';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { P1Dialog } from '../dialogs/P1Dialog';
import { DashboardAppearanceProvider } from '../theme/ThemeBridge';
import { Choice } from '../board/controls';
import { p1Classes as cls } from '../theme/p1-classes';
import { DashboardImagePicker } from '../banner/DashboardImagePicker';
export function AppearanceStudio({ host, onClose }: { host: HomeHost; onClose: () => void }) {
	const [store] = useState(() => dashboardSettingsStore(host));
	useEffect(() => store.connect(), [store]);
	const settings = useStore(store.state, (s) => s.settings),
		t = useT();
	const [error, setError] = useState(''),
		[picking, setPicking] = useState(false),
		[reset, setReset] = useState(false);
	const update = (change: Parameters<typeof store.update>[0]) => {
		setError('');
		void store.update(change).catch((e) => setError(String(e)));
	};
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
					<p className={cls('dashboard-theme-studio-hint')}>{t('themeStudio.hint')}</p>
					<div className={cls('dashboard-modal-form')}>
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
					</div>
					{error && <p role="alert">{error}</p>}
				</div>
				<div className={cls('dashboard-modal-footer')}>
					<Button size="sm" onClick={onClose}>
						{t('common.close')}
					</Button>
				</div>
			</P1Dialog>
			{reset && (
				<DashboardDialog
					title={t('themeStudio.resetAll')}
					onClose={() => setReset(false)}
					onSave={() => {
						update((s) => {
							Object.assign(s, homeDecor({}));
						});
						setReset(false);
					}}
				>
					<p>{t('themeStudio.resetAllConfirm')}</p>
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
