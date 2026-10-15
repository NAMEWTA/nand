// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pipeline-model.ts
import type { PmConfig } from '../../core/board/types';
export function projectStageColor(config: PmConfig | undefined, label: string): string {
	const explicit = config?.stages.find((stage) => stage.label === label)?.color;
	if (explicit) return explicit;
	let hash = 0;
	for (const char of label || '?') hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return `var(--db-project-chip-${hash % 8})`;
}
