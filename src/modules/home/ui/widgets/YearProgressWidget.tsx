// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/year-progress-widget.ts
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { YearProgressPanel } from './YearProgressPanel';
export function YearProgressWidget() {
	return <YearProgressPanel win={useOwnerDocument().defaultView!} />;
}
