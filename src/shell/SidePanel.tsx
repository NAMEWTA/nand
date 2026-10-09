import { useId, useMemo, useState } from 'preact/hooks';
import type { Ref, TargetedKeyboardEvent } from 'preact';
import type { PanelItem, PanelModel, WorkbenchTarget } from '../app/contracts/workbench';
import { t } from '../shared/i18n';
import { Button } from '../ui/primitives/Button';
import { IconButton } from '../ui/primitives/IconButton';
import { ListItem } from '../ui/primitives/ListItem';
import { SearchField } from '../ui/primitives/SearchField';
import { Badge } from '../ui/primitives/Badge';
import { showMenu } from '../ui/primitives/menu';
import { targetKey } from './navigation-state';

export interface SidePanelProps {
	title: string;
	model?: PanelModel;
	current: WorkbenchTarget;
	/** Module-owned content rendered by the page (e.g. the agent session list). */
	customRef: Ref<HTMLDivElement>;
	onNavigate: (target: WorkbenchTarget) => void;
	onClose?: () => void;
	report: (error: unknown) => void;
}

const matches = (item: PanelItem, query: string) => item.label.toLocaleLowerCase().includes(query);

/** Column 2: the module's objects and sections. Up/Down move between rows; Enter opens one. */
export function SidePanel({ title, model, current, customRef, onNavigate, onClose, report }: SidePanelProps) {
	// Containers are labelled by their visible headings: Obsidian shows a hover tooltip for every `aria-label`.
	const titleId = useId();
	const [query, setQuery] = useState('');
	const needle = query.trim().toLocaleLowerCase();
	const sections = useMemo(
		() => (model?.sections ?? []).map((section) => ({ ...section, items: needle ? section.items.filter((item) => matches(item, needle)) : section.items })).filter((section) => !needle || section.items.length),
		[model, needle],
	);
	const currentKey = targetKey(current);
	const open = (item: PanelItem) => {
		void Promise.resolve(item.select?.())
			.then(() => {
				if (item.target) onNavigate(item.target);
			})
			.catch(report);
	};
	const rowKeys = (event: TargetedKeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const rows = [...(event.currentTarget.closest('.nand-panel')?.querySelectorAll<HTMLElement>('.nand-list-item') ?? [])];
		const index = rows.indexOf(event.currentTarget);
		rows[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
	};
	return (
		<aside class="nand-panel" aria-labelledby={titleId}>
			<header class="nand-panel-header">
				<h2 class="nand-panel-title" id={titleId}>{title}</h2>
				{onClose && <IconButton icon="x" size="sm" label={t('workbench.closeNavigation')} onClick={onClose} />}
			</header>
			{model?.primary && (
				<div class="nand-panel-primary">
					<Button icon={model.primary.icon} className="nand-panel-primary-button" onClick={() => { void Promise.resolve(model.primary?.run()).catch(report); }}>
						{model.primary.label}
					</Button>
				</div>
			)}
			{model?.searchable && (
				<div class="nand-panel-search">
					<SearchField value={query} placeholder={t('workbench.searchPanel')} onInput={setQuery} />
				</div>
			)}
			<div class="nand-panel-body nand-ui-scroll">
				{sections.map((section) => (
					<section class="nand-panel-section" key={section.id} aria-labelledby={section.title ? `${titleId}-${section.id}` : undefined}>
						{section.title && <div class="nand-list-section-title" id={`${titleId}-${section.id}`}>{section.title}</div>}
						<div class="nand-list" role="listbox" aria-labelledby={section.title ? `${titleId}-${section.id}` : titleId}>
							{section.items.map((item) => {
								const active = item.active ?? (item.target ? targetKey(item.target) === currentKey : false);
								const menu = item.menu?.();
								return (
									<ListItem
										key={item.id}
										label={item.label}
										icon={item.icon}
										meta={item.meta}
										active={active}
										badge={item.badge ? <Badge tone="accent">{item.badge}</Badge> : undefined}
										onSelect={() => open(item)}
										onKeyDown={rowKeys}
										onContextMenu={menu?.length ? (event) => showMenu(event, menu, report) : undefined}
										actions={menu?.length ? <IconButton icon="more-horizontal" size="sm" label={t('workbench.more')} onClick={(event) => showMenu(event.currentTarget, menu, report)} /> : undefined}
									/>
								);
							})}
							{!section.items.length && section.emptyText && <div class="nand-panel-empty">{section.emptyText}</div>}
						</div>
					</section>
				))}
				{needle && !sections.length && <div class="nand-panel-empty">{t('workbench.noResults')}</div>}
				<div class="nand-panel-custom" ref={customRef} />
			</div>
		</aside>
	);
}
