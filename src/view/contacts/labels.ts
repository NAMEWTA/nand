import { t } from '../../shared/i18n';
import { relationKind } from '../../core/contacts/index-store';
import type { PersonRelation, ArchiveRecord } from '../../core/contacts/model';
export const ct = (key: string, params?: Record<string, string | number>): string => t('contacts.' + key, params);
export function relationLabel(kind: string): string {
	return ['leader', 'report', 'colleague', 'friend'].includes(kind) ? ct('relation.' + kind) : kind;
}
export function relationDescription(relation: PersonRelation, inverse: boolean, owner: ArchiveRecord): string {
	if (!inverse || ['leader', 'report', 'colleague', 'friend'].includes(relation.kind))
		return relationLabel(relationKind(relation.kind, inverse));
	return ct('inverse', { name: owner.fields.name, kind: relation.kind });
}
