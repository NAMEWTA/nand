import { Button } from '../../ui/components/button';
import { t } from '../../shared/i18n';
import { ShellIcon } from '../icon';
export interface ResourceTabsProps {
	label?: string;
	tabs: readonly { id: string; title: string; icon?: string }[];
	active?: string;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
	onNew: () => void;
	newLabel: string;
}
export function ResourceTabs(props: ResourceTabsProps) {
	const refs = useRef(new Map<string, HTMLButtonElement>());
	const active = props.tabs.some((tab) => tab.id === props.active) ? props.active : props.tabs[0]?.id;
	const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		if (event.key === 'Delete') {
			event.preventDefault();
			const tab = props.tabs[index];
			if (tab) props.onClose(tab.id);
			return;
		}
		const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: props.tabs.length - 1 }[event.key];
		if (next === undefined || !props.tabs.length) return;
		event.preventDefault();
		const tab = props.tabs[(next + props.tabs.length) % props.tabs.length];
		if (tab) {
			props.onSelect(tab.id);
			refs.current.get(tab.id)?.focus();
		}
	};
	return (
		<div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-2">
			<div
				className="flex min-w-0 gap-0.5 overflow-x-auto scrollbar-none"
				role="tablist"
				aria-label={props.label ?? t('workbench.pages')}
			>
				{props.tabs.map((tab, index) => (
					<div
						key={tab.id}
						className="flex w-44 shrink-0 items-center rounded-md data-[current=true]:bg-background data-[current=true]:shadow-sm"
						data-current={active === tab.id}
						onAuxClick={(event) => {
							if (event.button === 1) {
								event.preventDefault();
								props.onClose(tab.id);
							}
						}}
					>
						<Button
							role="tab"
							ref={(element) => {
								if (element) refs.current.set(tab.id, element);
								else refs.current.delete(tab.id);
							}}
							aria-selected={active === tab.id}
							tabIndex={active === tab.id ? 0 : -1}
							title={tab.title}
							className="h-7 min-w-0 flex-1 justify-start text-muted-foreground aria-selected:text-foreground aria-selected:font-medium"
							variant="ghost"
							onClick={() => props.onSelect(tab.id)}
							onKeyDown={(event) => keys(event, index)}
						>
							{tab.icon && <ShellIcon name={tab.icon} />}
							<span className="truncate">{tab.title}</span>
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							tabIndex={-1}
							aria-label={t('workbench.closePage')}
							onClick={() => props.onClose(tab.id)}
						>
							<ShellIcon name="x" />
						</Button>
					</div>
				))}
			</div>
			<Button variant="ghost" size="icon-xs" aria-label={props.newLabel} onClick={props.onNew}>
				<ShellIcon name="plus" />
			</Button>
		</div>
	);
}
import { useRef, type KeyboardEvent } from 'react';
