// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/section-type-modal.ts
export const SECTION_TYPES = [
	'sticky',
	'folder',
	'library',
	'projects',
	'dataview',
	'pm',
	'pipeline',
	'skills',
	'calendar',
	'rss',
	'images',
	'videos',
	'web',
	'weread',
	'ticktick',
] as const;
export const P0_SECTIONS: readonly string[] = ['sticky', 'folder', 'library', 'projects'];

export const P1_SECTIONS: readonly string[] = [
	'dataview',
	'pm',
	'pipeline',
	'skills',
	'calendar',
	'images',
	'videos',
	'web',
];
