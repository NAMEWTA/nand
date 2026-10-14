import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { SettingsSubsectionHeader } from './SettingsFormControls';
export function SettingsSection({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
}) {
	const id = useId();
	return (
		<section aria-labelledby={id} className={cn('space-y-3', className)}>
			<div id={id}>
				<SettingsSubsectionHeader title={title} description={description} />
			</div>
			<div className="space-y-3">{children}</div>
		</section>
	);
}
