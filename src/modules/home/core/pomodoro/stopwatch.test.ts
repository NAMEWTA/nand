// Behavior adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), scripts/verify-pomodoro-stopwatch.ts
import { afterEach,expect,test,vi } from 'vitest';
import { PomodoroApplication } from './application';
import { DEFAULT_DASHBOARD_SETTINGS } from '../board/types/model';
import type { ActivityHost } from '../activity/ports';
afterEach(()=>vi.useRealTimers());
test('count-up reminders exclude pauses, and stop persists actual focused minutes once',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2030-01-02T10:00:00Z'));
 const settings={...DEFAULT_DASHBOARD_SETTINGS,pomodoroMode:'stopwatch' as const,pomodoroRemindInterval:1},notify=vi.fn();let tick=()=>{};const writes:string[]=[];
 const host:ActivityHost={settings,saveSettings:async()=>{},notify,chime:()=>{},setInterval:fn=>{tick=fn;return 1},clearInterval:()=>{}};
 const disk = new Map<string,string>();
 const timer=new PomodoroApplication(host,{exists:async(path)=>disk.has(path),read:async(path)=>disk.get(path)??'',write:async(path,text)=>{disk.set(path,text);writes.push(text)},mkdir:async()=>{}},'timer.json');await timer.loadSessions();
 timer.start();vi.setSystemTime(new Date('2030-01-02T10:01:00Z'));tick();expect(timer.getState().elapsedSeconds).toBe(60);expect(notify).toHaveBeenCalledOnce();
 timer.pause();vi.setSystemTime(new Date('2030-01-02T10:10:00Z'));expect(timer.getState().elapsedSeconds).toBe(60);timer.start();vi.setSystemTime(new Date('2030-01-02T10:11:00Z'));tick();expect(timer.getState().elapsedSeconds).toBe(120);
 timer.skip();await timer.flush();expect(timer.getTodayCount()).toBe(1);expect(writes.at(-1)).toContain('"duration":2');expect(timer.getState().status).toBe('idle');await timer.shutdown();
});
