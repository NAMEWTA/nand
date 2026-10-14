// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationsPageTopBar.tsx, AutomationsPageBreadcrumb.tsx
import { ArrowLeft, ChevronRight, Menu, MoreHorizontal } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { useT } from '../../../ui/react/hooks';
import { IconButton } from './parts';
export function TopBar({
	name,
	detail,
	onBack,
	onList,
	onMenu,
	onNavigation,
}: {
	name?: string;
	detail?: string;
	onBack: () => void;
	onList: () => void;
	onMenu: (event: MouseEvent) => void;
	onNavigation: () => void;
}) {
	const t = useT();
	return (
		<header className="flex shrink-0 items-center gap-2 px-6 pb-3">
			<IconButton label={t('workbench.navigation')} onClick={onNavigation}>
				<Menu className="size-4" />
			</IconButton>
			{name ? (
				<>
					<IconButton label={t('automation.back')} onClick={onBack}>
						<ArrowLeft className="size-4" />
					</IconButton>
					<Button variant="ghost" size="sm" onClick={onList}>
						{t('automation.title')}
					</Button>
					<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
					<h1 className="min-w-0 truncate text-lg font-semibold leading-8">{name}</h1>
					{detail && (
						<>
							<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
							<span className="min-w-0 truncate text-sm text-muted-foreground">{detail}</span>
						</>
					)}
				</>
			) : (
				<h1 className="truncate text-lg font-semibold leading-8">{t('automation.title')}</h1>
			)}
			<div className="ml-auto">
				<IconButton label={t('automation.pageMenu')} onClick={(event) => onMenu(event.nativeEvent)}>
					<MoreHorizontal className="size-4" />
				</IconButton>
			</div>
		</header>
	);
}
