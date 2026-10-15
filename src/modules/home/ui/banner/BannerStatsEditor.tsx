// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/banner-edit-modal.ts
import type { BannerStatsConfig } from '../../core/board/types';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
import { Switch } from '../../../../ui/components/switch';
import { useT } from '../../../../ui/react/hooks';
import { Choice } from '../board/controls';
import { LEFT_STAT_OPTIONS, CENTER_STAT_OPTIONS, RIGHT_STAT_OPTIONS } from './stats-data';
import { homeServices } from '../../services/instances';
export function BannerStatsEditor({
	value,
	onChange,
}: {
	value: BannerStatsConfig;
	onChange: (value: BannerStatsConfig) => void;
}) {
	const t = useT(),
		patch = (p: Partial<BannerStatsConfig>) => onChange({ ...value, ...p });
	return (
		<div className="grid gap-4">
			{(['showLeft', 'showCenter', 'showRight', 'showDetails'] as const).map((key) => (
				<Label key={key} className="flex gap-2">
					<Switch checked={value[key] !== false} onCheckedChange={(checked) => patch({ [key]: checked })} />
					{t(`banner.stats.${key}`)}
				</Label>
			))}
			<Choice
				label={t('banner.stats.leftStat')}
				value={value.leftStat ?? 'totalNotes'}
				options={LEFT_STAT_OPTIONS.map((key) => ({ value: key, label: t(`banner.stats.${key}`) }))}
				onChange={(leftStat) => patch({ leftStat: leftStat as BannerStatsConfig['leftStat'] })}
			/>
			<Choice
				label={t('banner.stats.centerStat')}
				value={value.centerStat ?? 'streak'}
				options={CENTER_STAT_OPTIONS.map((key) => ({ value: key, label: t(`banner.stats.${key}`) }))}
				onChange={(centerStat) => patch({ centerStat: centerStat as BannerStatsConfig['centerStat'] })}
			/>
			{RIGHT_STAT_OPTIONS.map((key) => (
				<Label key={key} className="flex gap-2">
					<Switch
						checked={(value.rightStats ?? ['taskCompletion', 'connectivity', 'avgLinksPerNote']).includes(
							key,
						)}
						onCheckedChange={(checked) =>
							patch({
								rightStats: checked
									? [
											...(value.rightStats ?? [
												'taskCompletion',
												'connectivity',
												'avgLinksPerNote',
											]),
											key,
										]
									: (
											value.rightStats ?? ['taskCompletion', 'connectivity', 'avgLinksPerNote']
										).filter((k) => k !== key),
							})
						}
					/>
					{t(`banner.stats.${key}`)}
				</Label>
			))}
			{(['blur', 'darkness'] as const).map((key) => (
				<Label key={key}>
					{t(`banner.stats.${key}`)}
					<Input
						type="range"
						min={0}
						max={key === 'blur' ? 16 : 100}
						value={value[key] ?? (key === 'blur' ? 2 : 20)}
						onChange={(e) => patch({ [key]: +e.target.value })}
					/>
				</Label>
			))}
			<Label>
				{t('banner.stats.accent')}
				<Input value={value.accent ?? ''} onChange={(e) => patch({ accent: e.target.value || undefined })} />
			</Label>
			<Label>
				{t('banner.stats.dailyFolder')}
				<Input value={value.dailyFolder ?? ''} onChange={(e) => patch({ dailyFolder: e.target.value })} />
			</Label>
			<Label>
				{t('exclude.folders')}
				<Textarea
					value={value.excludeFolders?.join('\n') ?? ''}
					onChange={(e) => patch({ excludeFolders: e.target.value.split('\n').filter(Boolean) })}
				/>
			</Label>
			<Choice
				label={t('banner.stats.heatmapSource')}
				value={value.heatmapSource ?? 'notes'}
				options={['notes', 'habit'].map((key) => ({ value: key, label: t(`banner.stats.source.${key}`) }))}
				onChange={(heatmapSource) => patch({ heatmapSource: heatmapSource as 'notes' | 'habit' })}
			/>
			{value.heatmapSource === 'habit' && (
				<Choice
					label={t('banner.stats.heatmapHabit')}
					value={value.heatmapHabitId ?? 'all'}
					options={[
						{ value: 'all', label: t('home.pipeline.all') },
						...(homeServices.habit?.getHabits() ?? []).map((h) => ({ value: h.id, label: h.name })),
					]}
					onChange={(heatmapHabitId) => patch({ heatmapHabitId })}
				/>
			)}
		</div>
	);
}
