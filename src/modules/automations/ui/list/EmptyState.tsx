// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationListEmptyView.tsx, AutomationTemplateEmptyState.tsx
import { Timer, Plus } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { AUTOMATION_TEMPLATES, type AutomationTemplate } from '../../core/templates';
export function EmptyState({
	onCreate,
	disabled,
}: {
	onCreate: (template?: AutomationTemplate) => void;
	disabled: boolean;
}) {
	const t = useT();
	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-muted-foreground">
				<Timer className="size-8" />
				<p className="text-sm text-foreground">{t('automation.emptyHero')}</p>
				<Button size="sm" onClick={() => onCreate()} disabled={disabled}>
					<Plus className="size-4" />
					{t('automation.new')}
				</Button>
			</div>
			<div className="mx-auto grid max-w-2xl gap-2 p-4">
				<div className="px-1 pb-1 text-sm font-medium">{t('automation.fromTemplate')}</div>
				{AUTOMATION_TEMPLATES.map((template) => (
					<button
						type="button"
						key={template.id}
						disabled={disabled}
						onClick={() => onCreate(template)}
						className="rounded-md border border-border/70 bg-background px-3 py-2 text-left shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<div className="text-[11px] font-medium uppercase text-muted-foreground">
							{t(`automation.${template.kind}`)}
						</div>
						<div className="mt-1 text-sm font-medium">{t(`automation.template.${template.id}.name`)}</div>
						<div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
							{t(`automation.template.${template.id}.description`)}
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
