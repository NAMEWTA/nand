import { expect,test } from 'vitest';
import { homeSettings } from './settings';
test('home workspace registry is canonical, normalized and persists without flat adapters',()=>{
 const value=homeSettings.normalize({workspaces:{files:['One','Two.md'],names:['First','Second'],active:1},workspaceFiles:['obsolete'],dashboardFile:'obsolete',sidebarPinned:true,bannerCollapsed:true,stylePreset:'aurora'});
 expect(value.workspaces).toEqual({files:['.nand/content/One','.nand/content/Two'],names:['First','Second'],active:1});
 expect(value.dashboardFile).toBe('.nand/content/Two');
 const saved=homeSettings.pick(value,'vault');
 expect(saved).not.toHaveProperty('dashboardFile');expect(saved).not.toHaveProperty('workspaceFiles');
 expect(saved).toMatchObject({sidebarPinned:true,bannerCollapsed:true,stylePreset:'aurora',workspaces:value.workspaces});
 expect(homeSettings.normalize(saved).workspaces).toEqual(value.workspaces);
 expect(homeSettings.normalize({workspaceFiles:['Old']}).workspaces.files).toEqual(['.nand/content/dashboard']);
});
