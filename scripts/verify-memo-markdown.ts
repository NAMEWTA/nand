// React dashboard regression entry; the replaced Preact renderer is no longer shipped.
import { runHomeReactChecks } from './run-home-react-checks';
runHomeReactChecks(['core/board/card-links.test.ts', 'services/board-repairs.dom.test.tsx']);
