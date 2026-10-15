import type { FileItem } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { t } from '../../../../shared/i18n';
import { openIconicDialog } from './react-dialog';
import { PathList } from './PathList';
export default class UsageChecker {
	static open(plugin: IconicController, unused: FileItem[]) {
		openIconicDialog(plugin, t('iconic.usageChecker.unusedIcons'), () => (
			<PathList plugin={plugin} initial={unused} unused />
		));
	}
}
