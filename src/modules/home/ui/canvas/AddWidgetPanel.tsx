import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import type { HomeWidgetKind } from '../../api';
import {
	HOME_WIDGET_CATEGORIES,
	HOME_WIDGET_TIERS,
	type HomeWidgetCategory,
	type HomeWidgetTier,
} from '../../core/board/widget-tiers';
import {
	catalogCategories,
	filterCatalog,
	supportedTiers,
	tierSize,
	type CatalogEntry,
} from '../../core/board/widget-catalog';
import { DashboardDialog } from '../dialogs/DashboardDialog';

export interface AddRequest {
	module: string;
	kind: HomeWidgetKind;
	tier: HomeWidgetTier;
	/** Existing instance to place; undefined creates a new instance (or the single default one). */
	instanceId?: string;
	create?: boolean;
}

export interface PanelEntry extends CatalogEntry {
	/** Instances that exist but are not on this board yet. */
	available: readonly { id: string; label: string }[];
	/** A singleton already on the board cannot be added twice. */
	placed: boolean;
}

const ROWS_SHOWN = 60;

const CATEGORY_ICONS: Record<HomeWidgetCategory, string> = {
	overview: 'layout-dashboard',
	time: 'clock',
	productivity: 'check-circle',
	record: 'notebook-pen',
	agent: 'bot',
	content: 'file-text',
	media: 'music',
	tools: 'wrench',
};

/** Proportional footprint of a size tier inside the 12-column board (60 rows shown). */
function Footprint({ kind, tier }: { kind: HomeWidgetKind; tier: HomeWidgetTier }) {
	const size = tierSize(kind, tier);
	return (
		<span
			aria-hidden
			className="relative block h-[44px] w-[88px] shrink-0 overflow-hidden rounded-[3px] border border-[var(--db-border-card)] bg-[var(--db-bg-hover)]"
		>
			<span
				data-testid="footprint"
				className="absolute top-0 left-0 block rounded-[2px] bg-[var(--db-accent)] opacity-70"
				style={{ width: `${(size.w / 12) * 100}%`, height: `${Math.min(100, (size.h / ROWS_SHOWN) * 100)}%` }}
			/>
		</span>
	);
}

/** Add-widget panel: categories, search and a size preview per widget. Adding is one request; the canvas writes once. */
export function AddWidgetPanel({
	entries,
	onAdd,
	onClose,
}: {
	entries: readonly PanelEntry[];
	onAdd(this: void, request: AddRequest): void;
	onClose(this: void): void;
}) {
	const t = useT(),
		[query, setQuery] = useState(''),
		[category, setCategory] = useState<HomeWidgetCategory | undefined>(),
		[tiers, setTiers] = useState<Record<string, HomeWidgetTier>>({});
	const searched = filterCatalog(entries, query) as PanelEntry[],
		shown = filterCatalog(searched, '', category) as PanelEntry[],
		categories = catalogCategories(searched, HOME_WIDGET_CATEGORIES);
	return (
		<DashboardDialog title={t('canvas.addWidget')} wide onClose={onClose} cancelLabel={t('common.close')}>
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-[var(--db-text-muted)]" />
				<Input
					autoFocus
					className="pl-8"
					aria-label={t('canvas.search')}
					placeholder={t('canvas.search')}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>
			<div className="flex flex-wrap gap-1" role="group" aria-label={t('canvas.categories')}>
				<Button
					size="xs"
					variant={category ? 'ghost' : 'secondary'}
					aria-pressed={!category}
					onClick={() => setCategory(undefined)}
				>
					{t('canvas.category.all')}
				</Button>
				{categories.map((value) => (
					<Button
						key={value}
						size="xs"
						variant={category === value ? 'secondary' : 'ghost'}
						aria-pressed={category === value}
						onClick={() => setCategory(value)}
					>
						<ObsidianIcon name={CATEGORY_ICONS[value]} className="size-3" />
						{t(`canvas.category.${value}`)}
					</Button>
				))}
			</div>
			<ul className="m-0 grid max-h-[55vh] list-none grid-cols-1 gap-2 overflow-y-auto p-0 sm:grid-cols-2">
				{shown.map((entry) => {
					const { kind } = entry,
						id = `${entry.module}:${kind.key}`,
						tier = tiers[id] ?? kind.defaultTier,
						title = t(entry.kind.titleKey);
					const request = (extra: Partial<AddRequest>): AddRequest => ({
						module: entry.module,
						kind,
						tier,
						...extra,
					});
					return (
						<li
							key={id}
							data-widget-entry={kind.key}
							className="flex flex-col gap-2 rounded-[var(--db-radius-md)] border border-[var(--db-border-card)] bg-[var(--db-bg-card)] p-3"
						>
							<div className="flex items-center gap-2">
								<ObsidianIcon name={kind.icon} className="size-4 shrink-0" />
								<span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
								<Footprint kind={kind} tier={tier} />
							</div>
							<div
								className="flex flex-wrap gap-1"
								role="group"
								aria-label={t('canvas.sizeOf', { name: title })}
							>
								{HOME_WIDGET_TIERS.filter((value) => supportedTiers(kind).includes(value)).map(
									(value) => (
										<Button
											key={value}
											size="xs"
											variant={tier === value ? 'secondary' : 'outline'}
											aria-pressed={tier === value}
											title={t(`canvas.size.${value}`)}
											onClick={() => setTiers({ ...tiers, [id]: value })}
										>
											{value}
										</Button>
									),
								)}
							</div>
							<div className="flex flex-wrap gap-1">
								{entry.available.length === 0 && !kind.create && (
									<Button
										size="xs"
										disabled={entry.placed}
										aria-label={t('home.widget.addNamed', { name: title })}
										onClick={() =>
											onAdd(request({ instanceId: kind.section ? undefined : 'default' }))
										}
									>
										{entry.placed ? t('canvas.added') : t('common.add')}
									</Button>
								)}
								{entry.available.map((instance) => (
									<Button
										key={instance.id}
										size="xs"
										variant="outline"
										aria-label={t('home.widget.addNamed', { name: instance.label || title })}
										onClick={() => onAdd(request({ instanceId: instance.id }))}
									>
										{t('common.add')} · {instance.label || title}
									</Button>
								))}
								{kind.create && (
									<Button
										size="xs"
										variant="outline"
										aria-label={t('home.widget.createNamed', { name: title })}
										onClick={() => onAdd(request({ create: true }))}
									>
										{t('canvas.create')}
									</Button>
								)}
							</div>
						</li>
					);
				})}
				{shown.length === 0 && (
					<li className="col-span-full p-4 text-center text-sm text-[var(--db-text-muted)]">
						{t('canvas.empty')}
					</li>
				)}
			</ul>
		</DashboardDialog>
	);
}
