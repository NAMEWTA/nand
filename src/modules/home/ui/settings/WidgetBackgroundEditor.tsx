// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/widget-background-modal.ts
import { useState } from 'react';
import type { App } from 'obsidian';
import { Button } from '../../../../ui/components/button';
import { DashboardImagePicker } from '../banner/DashboardImagePicker';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
import type { WidgetBackground } from '../../core/board/types';
import { Choice } from '../board/controls';
export function WidgetBackgroundEditor({
	value,
	onChange,
	app,
}: {
	app?: App;
	value: WidgetBackground | undefined;
	onChange: (value: WidgetBackground) => void;
}) {
	const t = useT(),
		[picking, setPicking] = useState(false),
		bg = { image: '', opacity: 100, dim: 30, blur: 0, ...value };
	return (
		<div className="grid gap-2">
			<Input
				aria-label={t('home.dashboard.image')}
				value={bg.image}
				onChange={(e) => onChange({ ...bg, image: e.target.value })}
			/>
			{app && (
				<Button variant="outline" onClick={() => setPicking(true)}>
					{t('pathPicker.pickFile')}
				</Button>
			)}
			{app && picking && (
				<DashboardImagePicker
					app={app}
					onClose={() => setPicking(false)}
					onPick={(image) => {
						onChange({ ...bg, image });
						setPicking(false);
					}}
				/>
			)}
			{(['opacity', 'dim', 'blur'] as const).map((key) => (
				<Label className="grid grid-cols-[1fr_2fr] items-center gap-2" key={key}>
					{t(
						key === 'opacity'
							? 'home.p1.opacity'
							: key === 'dim'
								? 'home.p1.imageDim'
								: 'home.p1.imageBlur',
					)}
					<Input
						type="range"
						min={0}
						max={key === 'blur' ? 20 : 100}
						value={bg[key]}
						onChange={(e) => onChange({ ...bg, [key]: +e.target.value })}
					/>
				</Label>
			))}
			<Choice
				label={t('home.p1.foreground')}
				value={
					bg.foreground === 'light' || bg.foreground === 'dark'
						? bg.foreground
						: bg.foreground
							? 'custom'
							: 'theme'
				}
				options={['theme', 'light', 'dark', 'custom'].map((value) => ({
					value,
					label: t(`home.p1.color.${value}`),
				}))}
				onChange={(value) =>
					onChange({
						...bg,
						foreground: value === 'theme' ? undefined : value === 'custom' ? '#ffffff' : value,
					})
				}
			/>
			{bg.foreground?.startsWith('#') && (
				<Input
					type="color"
					aria-label={t('home.p1.foreground')}
					value={bg.foreground}
					onChange={(e) => onChange({ ...bg, foreground: e.target.value })}
				/>
			)}
		</div>
	);
}
