// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { CommentsSettings } from '../settings';
import { useT } from '../../../ui/react/hooks';
import { SettingsRow, SettingsSwitchRow, ColorField } from '../../../ui/components/nand/SettingsFormControls';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { Choice } from '../../../ui/components/nand/Choice';
import { Input } from '../../../ui/components/input';
import { Slider } from '../../../ui/components/slider';

export function commentsSettingsPage(settings: SettingsHandle<CommentsSettings>) {
	return function CommentsSettingsPage() {
		const t = useT(),
			value = useSyncExternalStore(
				(listener) => settings.subscribe(listener),
				() => settings.get(),
			);
		const save = <K extends keyof CommentsSettings>(key: K, next: CommentsSettings[K]) => {
			void settings
				.update((draft) => {
					draft[key] = next;
				})
				.catch(() => toast.error(t('settings.writeFailed')));
		};
		return (
			<SettingsSection title={t('editor.comments.title')}>
				<SettingsRow
					label={t('editor.comments.author')}
					control={
						<Input
							aria-label={t('editor.comments.author')}
							value={value.author}
							onChange={(e) => save('author', e.target.value)}
						/>
					}
				/>
				{(
					[
						['highlightEnabled', 'settings.editorHighlight'],
						['popoverEnabled', 'settings.editorPopover'],
						['gutterEnabled', 'editor.comments.gutterEnabled'],
						['showCount', 'editor.comments.showCount'],
						['highlightLines', 'editor.comments.highlightLines'],
						['highlightResolved', 'editor.comments.highlightResolved'],
						['followAccent', 'editor.comments.followAccent'],
						['deleteWithNote', 'editor.comments.deleteWithNote'],
					] as const
				).map(([key, label]) => (
					<SettingsSwitchRow
						key={key}
						label={t(label)}
						checked={value[key]}
						onChange={() => save(key, !value[key])}
					/>
				))}
				{!value.followAccent && (
					<ColorField
						label={t('editor.comments.color')}
						description=""
						value={value.color}
						fallback="#7c3aed"
						onChange={(color) => save('color', color)}
					/>
				)}
				{(
					[
						['hoverDelay', 200, 1000, 50],
						['fuzzyThreshold', 0.1, 0.5, 0.05],
					] as const
				).map(([key, min, max, step]) => (
					<SettingsRow
						key={key}
						label={t(`editor.comments.${key}`)}
						control={
							<div className="flex w-48 items-center gap-3">
								<Slider
									aria-label={t(`editor.comments.${key}`)}
									min={min}
									max={max}
									step={step}
									value={[value[key]]}
									onValueChange={(v) => save(key, v[0] ?? min)}
								/>
								<output className="text-xs tabular-nums">{value[key]}</output>
							</div>
						}
					/>
				))}
				<SettingsRow
					label={t('editor.comments.panelSide')}
					control={
						<Choice
							label={t('editor.comments.panelSide')}
							value={value.panelSide}
							options={['left', 'right'].map((key) => [key, t(`editor.comments.${key}`)])}
							onChange={(v) => save('panelSide', v === 'left' ? 'left' : 'right')}
						/>
					}
				/>
				<SettingsRow
					label={t('editor.comments.sort')}
					control={
						<Choice
							label={t('editor.comments.sort')}
							value={value.sort}
							options={['position', 'created', 'activity'].map((key) => [
								key,
								t(`editor.comments.${key}`),
							])}
							onChange={(v) => save('sort', v === 'created' || v === 'activity' ? v : 'position')}
						/>
					}
				/>
			</SettingsSection>
		);
	};
}
