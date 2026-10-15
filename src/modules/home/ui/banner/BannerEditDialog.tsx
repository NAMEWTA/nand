import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/banner.ts, src/focal-point-picker.ts
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BannerStatsEditor } from './BannerStatsEditor';
import type { BannerData } from '../../core/board/types/model';
import { displayedFocalPoint, editImageFocal, focalPosition } from '../../core/board/focal-point';
import type { BoardStore } from '../../services/board-store';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { Button } from '../../../../ui/components/button';
import { Textarea } from '../../../../ui/components/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/components/tabs';
import { useT } from '../../../../ui/react/hooks';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { IconButton, Choice } from '../board/controls';
import { DraftList } from '../quickbar/DraftList';
import { QUOTE_FONT_GROUPS, firstFontName } from './quote-fonts';
import { Popover, PopoverTrigger, PopoverContent } from '../../../../ui/components/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '../../../../ui/components/command';
import { useDashboardLayout, useDashboardTheme } from '../theme/ThemeBridge';
import { useImage } from '../board/hooks';
function ImagePicker({ store, onChange }: { store: BoardStore; onChange(this: void, path: string): void }) {
	const t = useT(),
		theme = useDashboardTheme(),
		layout = useDashboardLayout(),
		[open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline">{t('ui.choosePath')}</Button>
			</PopoverTrigger>
			<PopoverContent
				className="nand-dashboard-root w-80 p-0"
				data-theme={theme}
				data-dashboard-layout={layout}
				data-dashboard-theme={theme}
			>
				<Command>
					<CommandInput aria-label={t('home.dashboard.image')} placeholder={t('ui.search')} />
					<CommandList>
						<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
						{store.imageFiles().map((file) => (
							<CommandItem
								key={file.path}
								value={file.path}
								onSelect={() => {
									onChange(file.path);
									setOpen(false);
								}}
							>
								{file.path}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
export function ImagePosition({
	store,
	path,
	raw,
	onChange,
}: {
	store: BoardStore;
	path: string;
	raw: unknown;
	onChange(this: void, x: number, y: number): void;
}) {
	const url = useImage(store, path),
		point = displayedFocalPoint(raw),
		t = useT();
	return (
		<div className="grid gap-2">
			<Button
				variant="outline"
				aria-label={t('home.dashboard.focal')}
				className="h-28 w-full touch-none bg-cover bg-center"
				style={{
					backgroundImage: url ? `url(${JSON.stringify(url)})` : undefined,
					backgroundPosition: focalPosition(raw),
				}}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={(e) => {
					if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
					const r = e.currentTarget.getBoundingClientRect();
					onChange(
						Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
						Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
					);
				}}
				onKeyDown={(e) => {
					const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0,
						dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
					if (dx || dy) {
						e.preventDefault();
						onChange(point.x + dx, point.y + dy);
					}
				}}
			/>
			<div className="flex gap-2">
				{(['x', 'y'] as const).map((axis) => (
					<Label key={axis}>
						{axis.toUpperCase()}
						<Input
							type="number"
							min={0}
							max={100}
							value={Math.round(point[axis])}
							onChange={(e) =>
								onChange(
									axis === 'x' ? +e.target.value : point.x,
									axis === 'y' ? +e.target.value : point.y,
								)
							}
						/>
					</Label>
				))}
				<Button variant="outline" onClick={() => onChange(50, 50)}>
					{t('home.dashboard.centerImage')}
				</Button>
			</div>
		</div>
	);
}
export function BannerEditDialog({
	store,
	banner,
	onClose,
}: {
	store: BoardStore;
	banner: BannerData;
	onClose(this: void): void;
}) {
	const t = useT(),
		[draft, setDraft] = useState(() => structuredClone(banner));
	const quotes = draft.quotes?.length ? draft.quotes : [{ quote: draft.quote, author: draft.author }],
		images = draft.images?.length ? draft.images : draft.image ? [draft.image] : [];
	return (
		<DashboardDialog
			title={t('banner.editTitle')}
			onClose={onClose}
			onSave={() => {
				void observeBoardAction(store.sync.updateBanner(draft).then(onClose));
			}}
		>
			<Tabs
				defaultValue={draft.mode === 'stats' ? 'stats' : 'poster'}
				onValueChange={(value) => setDraft({ ...draft, mode: value === 'stats' ? 'stats' : 'quote' })}
			>
				<TabsList>
					<TabsTrigger value="poster">{t('home.dashboard.poster')}</TabsTrigger>
					<TabsTrigger value="stats">{t('banner.tabStats')}</TabsTrigger>
				</TabsList>
				<TabsContent value="poster" className="grid gap-4">
					<Label>
						{t('banner.quoteFont')}
						<Choice
							label={t('banner.quoteFont')}
							value={draft.quoteFont || 'default'}
							onChange={(value) => setDraft({ ...draft, quoteFont: value === 'default' ? '' : value })}
							options={[
								{ value: 'default', label: t('banner.quoteFontDefault') },
								...QUOTE_FONT_GROUPS.flatMap((group) =>
									group.fonts.map((font) => ({
										value: font.value,
										label: `${t(group.labelKey)} · ${font.label}`,
									})),
								),
								...(draft.quoteFont &&
								!QUOTE_FONT_GROUPS.some((group) =>
									group.fonts.some((font) => font.value === draft.quoteFont),
								)
									? [{ value: draft.quoteFont, label: firstFontName(draft.quoteFont) }]
									: []),
							]}
						/>
					</Label>
					<Label>
						{t('banner.quoteColor')}
						<Input
							value={draft.quoteColor ?? ''}
							onChange={(e) => setDraft({ ...draft, quoteColor: e.target.value })}
						/>
					</Label>
					<DraftList
						items={quotes.map((quote, i) => ({ id: String(i), quote }))}
						onChange={(items) => setDraft({ ...draft, quotes: items.map((item) => item.quote) })}
					>
						{({ quote: q }, i) => (
							<div key={i} className="grid gap-2">
								<Label>
									{t('banner.quote')}
									<Textarea
										value={q.quote}
										onChange={(e) =>
											setDraft({
												...draft,
												quote: i === 0 ? e.target.value : draft.quote,
												quotes: quotes.map((v, n) =>
													n === i ? { ...v, quote: e.target.value } : v,
												),
											})
										}
									/>
								</Label>
								<div className="flex gap-2">
									<Input
										aria-label={t('home.dashboard.author')}
										value={q.author}
										onChange={(e) =>
											setDraft({
												...draft,
												author: i === 0 ? e.target.value : draft.author,
												quotes: quotes.map((v, n) =>
													n === i ? { ...v, author: e.target.value } : v,
												),
											})
										}
									/>
									<IconButton
										label={t('common.delete')}
										onClick={() =>
											setDraft({
												...draft,
												quotes: quotes.filter((_, n) => n !== i),
												quote: '',
												author: '',
											})
										}
									>
										<Trash2 />
									</IconButton>
								</div>
							</div>
						)}
					</DraftList>
					<Button
						variant="outline"
						onClick={() => setDraft({ ...draft, quotes: [...quotes, { quote: '', author: '' }] })}
					>
						<Plus />
						{t('banner.quote')}
					</Button>
					<DraftList
						items={images.map((path, i) => ({ id: String(i), path }))}
						onChange={(items) => setDraft({ ...draft, images: items.map((item) => item.path) })}
					>
						{({ path }, i) => (
							<div key={i} className="grid gap-2">
								<div className="flex gap-2">
									<Input
										aria-label={t('home.dashboard.image')}
										value={path}
										onChange={(e) =>
											setDraft({
												...draft,
												image: i === 0 ? e.target.value : draft.image,
												images: images.map((v, n) => (n === i ? e.target.value : v)),
											})
										}
									/>
									<IconButton
										label={t('common.delete')}
										onClick={() =>
											setDraft({ ...draft, images: images.filter((_, n) => n !== i), image: '' })
										}
									>
										<Trash2 />
									</IconButton>
								</div>
								<ImagePicker
									store={store}
									onChange={(value) =>
										setDraft({
											...draft,
											image: i === 0 ? value : draft.image,
											images: images.map((v, n) => (n === i ? value : v)),
										})
									}
								/>
								<ImagePosition
									store={store}
									path={path}
									raw={draft.imagePos?.[path]}
									onChange={(x, y) =>
										setDraft({ ...draft, imagePos: editImageFocal(draft.imagePos, path, { x, y }) })
									}
								/>
							</div>
						)}
					</DraftList>
					<Button variant="outline" onClick={() => setDraft({ ...draft, images: [...images, ''] })}>
						<Plus />
						{t('home.dashboard.image')}
					</Button>
				</TabsContent>
				<TabsContent value="stats">
					<BannerStatsEditor
						value={draft.statsConfig ?? {}}
						onChange={(statsConfig) => setDraft({ ...draft, statsConfig })}
					/>
				</TabsContent>
			</Tabs>
		</DashboardDialog>
	);
}
