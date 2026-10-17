import { expect, test } from 'vitest';
import { homeSettings } from './settings';

test('home workspace registry is canonical, normalized and persists without flat adapters', () => {
	const value = homeSettings.normalize({
		workspaces: { files: ['One', 'Two.md'], names: ['First', 'Second'], active: 1 },
		workspaceFiles: ['obsolete'],
		dashboardFile: 'obsolete',
		sidebarPinned: true,
		bannerCollapsed: true,
		stylePreset: 'aurora',
		widgetCalendarEnabled: true,
		widgetLunarEnabled: false,
	});
	expect(value.workspaces).toEqual({
		files: ['.nand/content/One', '.nand/content/Two'],
		names: ['First', 'Second'],
		active: 1,
	});
	expect(value.dashboardFile).toBe('.nand/content/Two');
	const saved = homeSettings.pick(value, 'vault');
	expect(saved).not.toHaveProperty('dashboardFile');
	expect(saved).not.toHaveProperty('workspaceFiles');
	for (const retired of ['sidebarPinned', 'bannerCollapsed', 'stylePreset', 'widgetCalendarEnabled', 'layoutMode'])
		expect(saved).not.toHaveProperty(retired);
	expect(saved).toMatchObject({ workspaces: value.workspaces });
	// The old per-widget switches are captured once so old boards convert with the widgets they showed.
	expect(value.legacyWidgetMembers?.map((member) => member.kind)).toContain('calendar');
	expect(value.legacyWidgetMembers?.map((member) => member.kind)).not.toContain('lunar');
	expect(homeSettings.normalize(saved).legacyWidgetMembers).toEqual(value.legacyWidgetMembers);
	expect(homeSettings.normalize({}).legacyWidgetMembers).toBeUndefined();
	expect(homeSettings.normalize(saved).workspaces).toEqual(value.workspaces);
	expect(homeSettings.normalize({ workspaceFiles: ['Old'] }).workspaces.files).toEqual(['.nand/content/dashboard']);
});
