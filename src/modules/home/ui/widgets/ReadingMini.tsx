// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useEffect } from 'react';
import type { BoardStore } from '../../services/board-store';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { createReadingMiniTimer } from '../reading/reading-mini-timer';
export function ReadingMini({ store }: { store: BoardStore }) {
	const doc = useOwnerDocument(),
		visible = useVisible(),
		service = store.widgets.reading;
	useEffect(() => {
		if (!visible || !service) return;
		const panel = createReadingMiniTimer(service, doc);
		return () => panel.destroy();
	}, [visible, service, doc]);
	return null;
}
