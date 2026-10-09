import type { Ref } from 'preact';
import type { BrowserAgent, BrowserGrab, BrowserHistoryEntry } from '../core/model';
import { grabText } from '../core/text';
import { t } from '../../../shared/i18n';
import { Icon } from '../../../ui/primitives/Icon';

/** Icon-only toolbar button labelled by a `browser.*` key. */
export function ToolbarButton({ label, icon, onClick, disabled = false }: { label: string; icon: string; onClick: (event: MouseEvent) => void; disabled?: boolean }) {
	return (
		<button type="button" class="nand-ui-icon-btn" aria-label={t(`browser.${label}`)} title={t(`browser.${label}`)} disabled={disabled} onClick={onClick}>
			<Icon name={icon} />
		</button>
	);
}

export interface AddressBarProps {
	inputRef: Ref<HTMLInputElement>;
	value: string;
	/** Suggestions are open (the field has focus and the user is typing or browsing them). */
	open: boolean;
	suggestions: readonly BrowserHistoryEntry[];
	activeIndex: number;
	onFocus: (input: HTMLInputElement) => void;
	onBlur: () => void;
	onInput: (value: string) => void;
	onKeyDown: (event: KeyboardEvent) => void;
	onSubmit: () => void;
	onPick: (url: string) => void;
}

/** Address field with history suggestions. */
export function AddressBar({ inputRef, value, open, suggestions, activeIndex, onFocus, onBlur, onInput, onKeyDown, onSubmit, onPick }: AddressBarProps) {
	return (
		<div class="nand-browser-address-wrap">
			<form
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}
			>
				<Icon name="globe" />
				<input
					ref={inputRef}
					class="nand-browser-address"
					aria-label={t('browser.address')}
					placeholder={t('browser.address')}
					value={value}
					spellcheck={false}
					onFocus={(event) => onFocus(event.currentTarget)}
					onBlur={onBlur}
					onInput={(event) => onInput(event.currentTarget.value)}
					onKeyDown={onKeyDown}
				/>
			</form>
			{open && (
				<div class="nand-browser-suggestions">
					{suggestions.map((entry, index) => (
						<button class={`nand-ui-list-item${index === activeIndex ? ' is-active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(entry.url)}>
							<span>{entry.title || entry.url}</span>
							<small>{entry.url}</small>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

/** Find-in-page bar. */
export function FindBar({ inputRef, value, active, matches, onInput, onNext, onPrevious, onClose }: {
	inputRef: Ref<HTMLInputElement>;
	value: string;
	active: number;
	matches: number;
	onInput: (value: string) => void;
	onNext: (forward: boolean) => void;
	onPrevious: () => void;
	onClose: () => void;
}) {
	return (
		<div class="nand-ui-toolbar nand-browser-find">
			<input
				ref={inputRef}
				aria-label={t('browser.find')}
				value={value}
				onInput={(event) => onInput(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.isComposing) onNext(!event.shiftKey);
				}}
			/>
			<span>{active}/{matches}</span>
			<ToolbarButton label="back" icon="chevron-up" onClick={onPrevious} />
			<ToolbarButton label="forward" icon="chevron-down" onClick={() => onNext(true)} />
			<ToolbarButton label="close" icon="x" onClick={onClose} />
		</div>
	);
}

export interface DownloadRow {
	id: string;
	name: string;
	received: number;
	total: number;
	state: string;
}

/** Downloads of the page, with cancel / open / show / dismiss. */
export function DownloadsBar({ downloads, action }: { downloads: readonly DownloadRow[]; action: (id: string, action: 'cancel' | 'open' | 'show' | 'dismiss') => void }) {
	return (
		<div class="nand-browser-downloads" aria-label={t('browser.downloads')}>
			{downloads.map((download) => (
				<div class="nand-ui-toolbar">
					<span>{download.name}</span>
					<progress value={download.received} max={download.total || 1} />
					{download.state === 'progressing' ? (
						<ToolbarButton label="cancel" icon="x" onClick={() => action(download.id, 'cancel')} />
					) : (
						<>
							<ToolbarButton label="openFile" icon="file" onClick={() => action(download.id, 'open')} disabled={download.state !== 'completed'} />
							<ToolbarButton label="showFile" icon="folder" onClick={() => action(download.id, 'show')} disabled={download.state !== 'completed'} />
							<ToolbarButton label="dismiss" icon="x" onClick={() => action(download.id, 'dismiss')} />
						</>
					)}
				</div>
			))}
		</div>
	);
}

/** Empty page or load failure (with retry and "open in system browser"). */
export function PageMessage({ message, failed, onRetry, onExternal }: { message: string; failed: boolean; onRetry: () => void; onExternal: () => void }) {
	return (
		<div class="nand-browser-empty">
			<Icon name={failed ? 'triangle-alert' : 'globe'} />
			<p>{message}</p>
			{failed && (
				<div class="nand-ui-toolbar">
					<button class="nand-ui-btn" onClick={onRetry}>{t('browser.retry')}</button>
					<button class="nand-ui-btn-ghost" onClick={onExternal}>{t('browser.external')}</button>
				</div>
			)}
		</div>
	);
}

/** A design-mode selection: copy it, mark it up, or paste it into an agent session. */
export function SelectionPanel({ grab, agents, agent, onAgent, onClose, onMarkup, onCopyText, onCopyImage, onAttach }: {
	grab: BrowserGrab;
	agents: readonly BrowserAgent[];
	agent: string;
	onAgent: (id: string) => void;
	onClose: () => void;
	onMarkup: () => void;
	onCopyText: () => void;
	onCopyImage: () => void;
	onAttach: () => void;
}) {
	return (
		<div class="nand-browser-overlay nand-browser-grab">
			<div class="nand-ui-toolbar">
				<strong>{t('browser.selection')}</strong>
				<div class="nand-ui-spacer" />
				<ToolbarButton label="close" icon="x" onClick={onClose} />
			</div>
			{grab.screenshot && <img src={grab.screenshot} alt={t('browser.selection')} />}
			<pre>{grabText(grab)}</pre>
			{grab.screenshot && <button class="nand-ui-btn-ghost" onClick={onMarkup}>{t('browser.markup')}</button>}
			<div class="nand-ui-toolbar">
				<button class="nand-ui-btn-ghost" onClick={onCopyText}>{t('browser.copy')}</button>
				{grab.screenshot && <button class="nand-ui-btn-ghost" onClick={onCopyImage}>{t('browser.copyImage')}</button>}
				{agents.length ? (
					<>
						<select aria-label={t('browser.chooseAgent')} value={agent} onChange={(event) => onAgent(event.currentTarget.value)}>
							{agents.map((item) => <option value={item.id}>{item.title}</option>)}
						</select>
						<button class="nand-ui-btn mod-cta" onClick={onAttach}>{t('browser.attach')}</button>
					</>
				) : (
					<small>{t('browser.noAgents')}</small>
				)}
			</div>
		</div>
	);
}
