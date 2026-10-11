import type { HomeWidgetKind } from '../../api';
import type { BoardWidgetMember } from '../../core/board/types/model';
import { t } from '../../../../shared/i18n';

export function widgetMemberLabel(member: BoardWidgetMember, kind?: HomeWidgetKind): string {
	if (member.label) return member.label;
	try {
		const label = kind?.instances().find(instance => instance.id === member.instanceId)?.label;
		if (label) return label;
	} catch { /* The widget host displays the provider's error separately. */ }
	return kind ? t(kind.titleKey) : member.kind;
}
