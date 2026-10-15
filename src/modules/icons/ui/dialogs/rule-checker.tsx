import type { Category, FileItem } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { t } from '../../../../shared/i18n';
import { openIconicDialog } from './react-dialog';
import { PathList } from './PathList';
export default class RuleChecker {
	static open(plugin: IconicController, page: Category, matches: FileItem[]) {
		const key =
			page === 'folder'
				? matches.length === 1
					? 'folderMatch'
					: 'foldersMatch'
				: matches.length === 1
					? 'fileMatch'
					: 'filesMatch';
		openIconicDialog(plugin, t('iconic.ruleChecker.' + key, { '#': matches.length }), () => (
			<PathList plugin={plugin} initial={matches} page={page} />
		));
	}
}
