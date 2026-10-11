import { t } from '../../../shared/i18n';
import { boardLayout } from '../core/board/layout';
import type { BoardLayout } from '../core/board/types/model';

export function LayoutPicker({ value, choose }: { value: BoardLayout; choose: (layout: BoardLayout) => void }) {
	return <label class="nand-board-layout">
		<span>{t('renderer.boardLayout')}</span>
		<select class="nand-input" value={value} data-board-layout-choice onChange={event => {
			const next = boardLayout(event.currentTarget.value);
			if (next) choose(next);
		}}>
			<option value="side">{t('renderer.layoutSide')}</option>
			<option value="stacked">{t('renderer.layoutStacked')}</option>
			<option value="immersive">{t('renderer.layoutImmersive')}</option>
		</select>
	</label>;
}
