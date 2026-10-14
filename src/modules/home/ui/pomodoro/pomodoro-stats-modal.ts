// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/pomodoro-stats-modal.ts
import { createElement } from 'react';
import { t } from '../../../../shared/i18n';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { PomodoroStatsPanel } from './PomodoroStatsPanel';
export function showPomodoroStats(doc: Document, service: PomodoroService): void {
	openRecordDialog(
		doc,
		t('pomodoro.statsTitle'),
		'dashboard-pomodoro-stats-modal dashboard-pomodoro-stats-modal--wide',
		(close) => createElement(PomodoroStatsPanel, { service, close }),
	);
}
