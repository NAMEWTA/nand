import { t } from '../../../shared/i18n/index';
import type { AgentWorkbench } from '../api';
import { formatUsageChip } from '../core/launch/usage-format';
import type { AgentController } from './controller';

export function agentWorkbench(controller: AgentController): AgentWorkbench {
	return {
		panel: () => ({ sections: [] }),
		title: (target) => {
			if (target.section === 'history') return t('agent.history');
			if (target.section === 'usage') return t('agent.usage');
			const session = target.resourceId ? controller.sessions.get(target.resourceId) : undefined;
			return session ? `${t('workbench.agent')} · ${session.title}` : undefined;
		},
		status: () => controller.status().filter((row) => !row.automated),
		usage: () => ({
			source: controller.usage,
			pinned: controller.usagePinned(),
			chips: () =>
				controller.usage
					.getState()
					.snapshots.flatMap((snapshot) => {
						const chip = formatUsageChip(snapshot);
						return chip ? [snapshot.provider + ' ' + chip] : [];
					})
					.join(' · '),
		}),
		subscribe: (listener) => controller.subscribe(listener),
	};
}
