import { useLayoutEffect, useRef, useState } from 'react';
import { Ellipsis, GripVertical, Maximize2, Settings2, X } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '../../../../ui/components/dropdown-menu';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import type { HomeWidgetTier } from '../../core/board/widget-tiers';

/** The toolbar sheds controls by width and by hit size (44px on touch): full row, then size/fit/settings in a menu, then only grip + menu. */
export const HIT_DESKTOP = 32;
export const HIT_TOUCH = 44;
/** Width needed by a full row (grip, icon, a short name, 4 sizes, fit, settings, delete) and by the compact row (grip, name, menu, delete). */
export const fullWidth = (hit: number): number => hit * 8 + 76;
export const compactWidth = (hit: number): number => hit * 3 + 64;

export interface TileToolbarProps {
	label: string;
	icon?: string;
	tiers: readonly HomeWidgetTier[];
	current?: HomeWidgetTier;
	/** Narrow panes show a projection: sizes cannot change there. */
	projected: boolean;
	fitting: boolean;
	canConfigure: boolean;
	onTier(this: void, tier: HomeWidgetTier): void;
	onFit(this: void): void;
	onConfigure(this: void): void;
	onRemove(this: void): void;
}

/**
 * The edit-mode bar of one tile. It never exceeds the tile: a tile of two columns keeps its grip, the
 * name, a menu and (while there is room) delete, so every action stays reachable.
 */
export function TileToolbar(props: TileToolbarProps) {
	const { label, icon, tiers, current, projected, fitting, canConfigure, onTier, onFit, onConfigure, onRemove } =
		props;
	const t = useT(),
		ref = useRef<HTMLDivElement>(null),
		[box, setBox] = useState({ width: fullWidth(HIT_DESKTOP), hit: HIT_DESKTOP });
	useLayoutEffect(() => {
		const el = ref.current,
			win = el?.ownerDocument.defaultView;
		if (!el || !win) return;
		const measure = () =>
			setBox({
				width: el.clientWidth,
				hit: win.matchMedia?.('(pointer: coarse)').matches ? HIT_TOUCH : HIT_DESKTOP,
			});
		const observer = new win.ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	const mode =
		box.width >= fullWidth(box.hit) ? 'full' : box.width >= compactWidth(box.hit) ? 'compact' : 'tiny';
	const sizeLabel = (tier: HomeWidgetTier) => t('canvas.setSize', { name: label, size: t(`canvas.size.${tier}`) });
	const remove = (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label={t('home.widget.removeNamed', { name: label })}
			onClick={onRemove}
		>
			<X />
		</Button>
	);
	return (
		<div
			ref={ref}
			data-toolbar-mode={mode}
			className="nand-immersive-toolbar flex min-h-9 min-w-0 shrink-0 items-center gap-0.5 overflow-hidden border-b border-[var(--db-border-card)] bg-[var(--db-bg-hover)] px-0.5"
		>
			<Button
				variant="ghost"
				size="icon-sm"
				data-grid-action="move"
				className="cursor-grab"
				aria-label={t('renderer.moveTile', { name: label })}
			>
				<GripVertical className="size-3" />
			</Button>
			{mode !== 'tiny' && icon && <ObsidianIcon name={icon} className="size-3.5 shrink-0" />}
			{mode !== 'tiny' ? (
				<span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
			) : (
				<span className="flex-1" />
			)}
			{mode === 'full' && (
				<>
					{tiers.length > 0 && (
						<span className="flex" role="group" aria-label={t('canvas.sizeOf', { name: label })}>
							{tiers.map((tier) => (
								<Button
									key={tier}
									variant={current === tier ? 'secondary' : 'ghost'}
									size="icon-sm"
									className="text-[10px]"
									aria-pressed={current === tier}
									aria-label={sizeLabel(tier)}
									disabled={projected}
									onClick={() => onTier(tier)}
								>
									{tier}
								</Button>
							))}
						</span>
					)}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-pressed={fitting}
						aria-label={t('renderer.fitTile')}
						onClick={onFit}
					>
						<Maximize2 className="size-3" />
					</Button>
					{canConfigure && (
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t('canvas.settings', { name: label })}
							onClick={onConfigure}
						>
							<Settings2 className="size-3" />
						</Button>
					)}
					{remove}
				</>
			)}
			{mode !== 'full' && (
				<>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t('canvas.moreActions', { name: label })}
							>
								<Ellipsis />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{tiers.map((tier) => (
								<DropdownMenuCheckboxItem
									key={tier}
									checked={current === tier}
									disabled={projected}
									aria-label={sizeLabel(tier)}
									onSelect={() => onTier(tier)}
								>
									{tier} · {t(`canvas.size.${tier}`)}
								</DropdownMenuCheckboxItem>
							))}
							{tiers.length > 0 && <DropdownMenuSeparator />}
							<DropdownMenuCheckboxItem checked={fitting} onSelect={onFit}>
								{t('renderer.fitTile')}
							</DropdownMenuCheckboxItem>
							{canConfigure && (
								<DropdownMenuItem onSelect={onConfigure}>
									{t('canvas.settings', { name: label })}
								</DropdownMenuItem>
							)}
							{mode === 'tiny' && (
								<DropdownMenuItem variant="destructive" onSelect={onRemove}>
									{t('home.widget.removeNamed', { name: label })}
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
					{mode === 'compact' && remove}
				</>
			)}
		</div>
	);
}
