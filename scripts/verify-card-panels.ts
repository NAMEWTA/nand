// React dashboard regression entry.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks([
	'ui/expense/records.dom.test.tsx',
	'ui/reading/reading-confirm.dom.test.tsx',
	'ui/widgets/input-widgets.dom.test.tsx',
	'ui/board/controls.dom.test.tsx',
	'services/board-repairs.dom.test.tsx',
	'ui/sections/library.dom.test.tsx',
]);
