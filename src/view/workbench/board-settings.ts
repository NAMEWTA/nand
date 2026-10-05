/** The workbench home always uses the stacked strip. That choice is not written back over the stored layout. */
export function workbenchBoardSettings<T extends { dashboardFile: string; layoutMode: string }>(settings: T, boardPath: string): T {
	return { ...settings, dashboardFile: boardPath, layoutMode: 'stacked' };
}

export function workbenchBoardSettingsPatch<T extends object>(value: T): Omit<T, 'dashboardFile' | 'modules' | 'layoutMode'> {
	const source = value as T & { dashboardFile?: unknown; modules?: unknown; layoutMode?: unknown };
	const { dashboardFile, modules, layoutMode, ...rest } = source;
	void dashboardFile;
	void modules;
	void layoutMode;
	return rest;
}
