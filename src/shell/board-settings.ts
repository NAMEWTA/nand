/** The workbench home keeps its own board pointer: `dashboardFile` is overridden for the page and not written back. */
export function workbenchBoardSettings<T extends { dashboardFile: string }>(settings: T, boardPath: string): T {
	return { ...settings, dashboardFile: boardPath };
}

export function workbenchBoardSettingsPatch<T extends object>(value: T): Omit<T, 'dashboardFile'> {
	const { dashboardFile, ...rest } = value as T & { dashboardFile?: unknown };
	void dashboardFile;
	return rest;
}
