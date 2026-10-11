import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../../../../shared/i18n';
import type { GridTile } from '../../core/board/immersive-grid';
import type { BoardTileSource } from '../../core/board/board-tiles';
import { attachGridController } from './layout-controller';
import { showMenu } from '../../../../ui/primitives/menu';
import { Icon } from '../../../../ui/primitives/Icon';

export interface ImmersiveBoardProps {
	sources: readonly BoardTileSource[];
	tiles: readonly GridTile[];
	needsRepair?: boolean;
	label(this: void, source: BoardTileSource): string;
	mount(this: void, host: HTMLElement, source: BoardTileSource): () => void;
	save(this: void, tiles: readonly GridTile[]): void;
	remove?(this: void, memberId: string): void;
}
function ImmersiveTile({ source, label, mount, remove }: { source: BoardTileSource; label: string; mount: ImmersiveBoardProps['mount']; remove: ImmersiveBoardProps['remove'] }) {
	const content = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => mount(content.current!, source), [mount, source]);
	return <article class="nand-immersive-tile" data-tile={source.id} aria-label={label} onContextMenu={event => {
		if (source.type !== 'widget' || !remove || (event.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;
		event.preventDefault(); event.stopPropagation();
		showMenu(event.currentTarget.querySelector<HTMLElement>('.nand-immersive-grip')!, [{ title: t('home.widget.remove'), icon: 'x', run: () => remove(source.member.memberId) }]);
	}}>
		<div class="nand-immersive-surface">
			<div class="nand-immersive-toolbar">
				<button type="button" class="nand-immersive-grip" data-grid-action="move" aria-label={t('renderer.moveTile', { name: label })}>{label}</button>
				<button type="button" data-grid-action="fit" aria-label={t('renderer.fitTile')} title={t('renderer.fitTile')}><Icon name="minimize-2" /></button>
				{source.type === 'widget' && remove && <button type="button" class="nand-immersive-remove" aria-label={t('home.widget.removeNamed', { name: label })} onClick={() => remove(source.member.memberId)}>×</button>}
				<button type="button" class="nand-immersive-resize" data-grid-action="resize" aria-label={t('renderer.resizeTile')}>{t('renderer.resizeTile')}</button>
			</div>
			<div class="nand-immersive-body"><div ref={content} class="nand-immersive-content" /></div>
		</div>
	</article>;
}
export function ImmersiveBoard(props: ImmersiveBoardProps) {
	const root = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => attachGridController(root.current!, props.tiles, props.save), [props.tiles, props.save]);
	return <div class="nand-immersive-board">
		{props.needsRepair && <p role="status" class="nand-immersive-diagnostic">{t('renderer.layoutNeedsRepair')}</p>}
		<p class="nand-immersive-projection" hidden>{t('renderer.projectedLayout')}</p>
		<div ref={root} class="nand-immersive-grid">
		<div class="nand-immersive-live nand-visually-hidden" role="status" aria-live="polite" />
		{props.sources.map(source => <ImmersiveTile key={source.id} source={source} label={props.label(source)} mount={props.mount} remove={props.remove} />)}
		<div class="nand-immersive-ghost" aria-hidden="true" hidden />
		</div>
	</div>;
}
