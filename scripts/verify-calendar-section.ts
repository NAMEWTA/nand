// React dashboard regression entry; the replaced Preact renderer is no longer shipped.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks([
	'platform/calendar/managed-tasks.test.ts',
	'ui/calendar/calendar-names.dom.test.tsx',
	'core/board/p1.test.ts',
]);
