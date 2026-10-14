// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/habit-stats-modal.ts
import { createElement } from 'react';
import { t } from '../../../../shared/i18n';
import type { HabitService } from '../../platform/habit/habit-service';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { HabitStatsPanel } from './HabitStatsPanel';
export function showHabitStats(doc: Document, service: HabitService): void {
	openRecordDialog(doc, t('habit.statsTitle'), 'dashboard-habit-stats-modal', (close) =>
		createElement(HabitStatsPanel, { service, close }),
	);
}
