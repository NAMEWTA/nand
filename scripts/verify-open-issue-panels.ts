// React dashboard regression entry.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks([
	'services/board-repairs.dom.test.tsx',
	'platform/record-storage.dom.test.tsx',
	'ui/expense/records.dom.test.tsx',
	'ui/reading/reading-confirm.dom.test.tsx',
]);
