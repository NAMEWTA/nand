// Current React behavior assertions; see the p8d repair assertion mapping.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks([
	'ui/sections/library.dom.test.tsx',
	'ui/library/managed-library.test.ts',
	'services/board-store.test.ts',
]);
