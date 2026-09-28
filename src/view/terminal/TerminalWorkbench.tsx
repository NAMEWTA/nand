import type { ComponentChildren, Ref } from 'preact';
import { t } from '../../shared/i18n/terminal-accessor';
import { Icon } from '../primitives/Icon';

/** Code-time slots: each panel is independently owned and can be composed elsewhere. */
export function TerminalWorkbench({
	sessions,
	history,
	usage,
	terminalRef,
	searchRef,
	inputRef,
	search,
	previous,
	next,
	closeSearch,
}: {
	sessions?: ComponentChildren;
	history?: ComponentChildren;
	usage?: ComponentChildren;
	terminalRef: Ref<HTMLDivElement>;
	searchRef: Ref<HTMLDivElement>;
	inputRef: Ref<HTMLInputElement>;
	search: () => void;
	previous: () => void;
	next: () => void;
	closeSearch: () => void;
}) {
	return (
		<>
			<div className="nand-agent-sidebar">{sessions}</div>
			<div className="nand-agent-center">
				<div className="terminal-search-container" ref={searchRef}>
					<input
						type="text"
						className="terminal-search-input"
						placeholder={t('terminal.search.placeholder')}
						aria-label={t('terminal.search.placeholder')}
						ref={inputRef}
						onInput={search}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								if (event.shiftKey) previous();
								else next();
							} else if (event.key === 'Escape') closeSearch();
						}}
					/>
					{(
						[
							['chevron-up', 'previous', previous],
							['chevron-down', 'next', next],
							['x', 'close', closeSearch],
						] as const
					).map(([icon, label, action]) => (
						<button
							key={label}
							type="button"
							className="terminal-search-btn clickable-icon"
							title={t(`terminal.search.${label}`)}
							aria-label={t(`terminal.search.${label}`)}
							onClick={action}
						>
							<Icon name={icon} />
						</button>
					))}
				</div>
				<div className="terminal-container" ref={terminalRef} />
			</div>
			<div className="nand-agent-history">{history}</div>
			<div className="nand-agent-usage">{usage}</div>
		</>
	);
}
