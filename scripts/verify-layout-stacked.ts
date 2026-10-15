// React dashboard regression entry; the replaced Preact renderer is no longer shipped.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks([
	'ui/board/dnd.test.ts',
	'ui/widgets/widget-layout.dom.test.tsx',
	'core/board/layout.test.ts',
	'core/board/board-tiles.test.ts',
]);
