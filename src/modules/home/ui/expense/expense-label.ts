import { categoriesFor } from '../../core/expense/model';
import { t } from '../../../../shared/i18n';
const PRESET_KEYS = new Set<string>([...categoriesFor('expense'), ...categoriesFor('income')]);
export function categoryLabel(key: string): string {
	return PRESET_KEYS.has(key) ? t(`expense.cat.${key}`) : key;
}
