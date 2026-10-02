import { Menu } from 'obsidian';
import { normalizeBrowserUrl } from '../../../core/browser/url';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import type { CardBodyProps } from './TaskPanel';

export function WebShortcutPanel({ card, callbacks, context }: CardBodyProps) {
	const open = (target = card.openIn ?? 'modal') => callbacks.onOpenWeb?.(card.url, target);
	return (
		<div class="nand-browser-shortcut">
			<button class="nand-ui-btn-ghost nand-browser-shortcut-open" onClick={() => open()}>
				<Icon name="globe" />
				<span>{card.url}</span>
			</button>
			<button
				class="nand-ui-icon-btn"
				aria-label={t('browser.more')}
				onClick={(event) => {
					const menu = new Menu();
					for (const target of ['modal', 'tab'] as const)
						menu.addItem((item) =>
							item
								.setTitle(t(`browser.${target}`))
								.setIcon(target === 'tab' ? 'panel-top' : 'app-window')
								.onClick(() => open(target)),
						);
					menu.addItem((item) =>
						item
							.setTitle(t('browser.external'))
							.setIcon('external-link')
							.onClick(() => {
								const url = normalizeBrowserUrl(card.url);
								context.root.win.open(url, '_blank');
							}),
					);
					menu.addItem((item) =>
						item
							.setTitle(t('browser.configure'))
							.setIcon('settings')
							.onClick(() => callbacks.onCardEdit(card)),
					);
					menu.showAtMouseEvent(event);
				}}
			>
				<Icon name="ellipsis" />
			</button>
		</div>
	);
}
