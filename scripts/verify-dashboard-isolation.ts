// React dashboard regression entry.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks([
	'services/board-backups.test.ts',
	'platform/dql/managed-pages.test.ts',
	'platform/calendar/managed-tasks.test.ts',
	'ui/widgets/media.dom.test.tsx',
	'ui/expense/records.dom.test.tsx',
	'platform/desktop/session-lifetime.test.ts',
]);
