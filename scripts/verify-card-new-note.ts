// React dashboard regression entry; the replaced Preact renderer is no longer shipped.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks(['services/board-repairs.dom.test.tsx', 'ui/sections/library.dom.test.tsx']);
