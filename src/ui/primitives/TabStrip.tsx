import type { TargetedKeyboardEvent } from 'preact';
import { useId } from 'preact/hooks';
import { t } from '../../shared/i18n';
import { IconButton } from './IconButton';
import { Icon } from './Icon';

export interface TabStripTab {
	id: string;
	title: string;
	icon?: string;
}

export interface TabStripProps {
	label: string;
	tabs: readonly TabStripTab[];
	active?: string;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
	onNew: () => void;
	newLabel: string;
	/** Drag a tab to a new position (omit to keep the order fixed). */
	onMove?: (from: number, to: number) => void;
}

/** Resource tabs (browser pages, terminal tabs): click selects, middle click or the × closes, arrows move, drag reorders. */
export function TabStrip({ label, tabs, active, onSelect, onClose, onNew, newLabel, onMove }: TabStripProps) {
	const labelId = useId();
	const keys = (event: TargetedKeyboardEvent<HTMLDivElement>, index: number) => {
		const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
		if (event.key === 'Delete') {
			event.preventDefault();
			const tab = tabs[index];
			if (tab) onClose(tab.id);
			return;
		}
		if (next === undefined) return;
		event.preventDefault();
		const tab = tabs[(next + tabs.length) % tabs.length];
		if (!tab) return;
		onSelect(tab.id);
		(event.currentTarget.parentElement?.children[(next + tabs.length) % tabs.length] as HTMLElement | undefined)?.focus();
	};
	return (
		<div class="nand-tabstrip">
			<span class="nand-visually-hidden" id={labelId}>{label}</span>
			<div class="nand-tabstrip-tabs" role="tablist" aria-labelledby={labelId}>
				{tabs.map((tab, index) => (
					<div
						key={tab.id}
						role="tab"
						class={`nand-tab${tab.id === active ? ' is-active' : ''}`}
						aria-selected={tab.id === active}
						tabIndex={tab.id === active ? 0 : -1}
						title={tab.title}
						onClick={() => onSelect(tab.id)}
						onAuxClick={(event) => {
							if (event.button === 1) onClose(tab.id);
						}}
						onKeyDown={(event) => keys(event, index)}
						draggable={!!onMove}
						onDragStart={(event) => {
							event.dataTransfer?.setData('application/x-nand-tab', String(index));
							if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
						}}
						onDragOver={(event) => {
							if (onMove && event.dataTransfer?.types.includes('application/x-nand-tab')) event.preventDefault();
						}}
						onDrop={(event) => {
							const from = Number(event.dataTransfer?.getData('application/x-nand-tab'));
							if (!onMove || !Number.isInteger(from)) return;
							event.preventDefault();
							onMove(from, index);
						}}
					>
						{tab.icon && <Icon name={tab.icon} className="nand-tab-icon" />}
						<span class="nand-tab-title">{tab.title}</span>
						<span class="nand-tab-close" onClick={(event) => event.stopPropagation()}>
							<IconButton icon="x" size="sm" label={t('workbench.closeTab')} tabIndex={-1} onClick={() => onClose(tab.id)} />
						</span>
					</div>
				))}
			</div>
			<IconButton icon="plus" size="sm" label={newLabel} onClick={onNew} />
		</div>
	);
}
