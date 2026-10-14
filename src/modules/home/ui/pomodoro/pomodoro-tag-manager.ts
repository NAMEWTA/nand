// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/pomodoro-tag-manager.ts
import { createElement } from 'react';
import { t } from '../../../../shared/i18n';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { PomodoroTagsPanel } from './PomodoroTagsPanel';
export function openPomodoroTagManager(doc: Document, service: PomodoroService, onChange: () => void): void {
	openRecordDialog(doc, t('pomodoro.tagTitle'), 'dashboard-pomodoro-stats-modal', (close) =>
		createElement(PomodoroTagsPanel, { service, close, onChange }),
	);
}
