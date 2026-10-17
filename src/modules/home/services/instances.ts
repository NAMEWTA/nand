import type { AgentDispatch, AgentDirectoryEntry, AgentSessionsPort, AgentQuickCommands, AgentSkills, AgentUsage } from '../../agent/api';
import type { NavigatorLists } from '../../navigator/api';
import type { IndexedWidgets } from '../core/board/widget-registry';
import type { ExpenseService } from '../platform/expense/expense-service';
import type { HabitService } from '../platform/habit/habit-service';
import type { MediaTagService } from '../platform/media/media-tags';
import type { MusicService } from '../platform/music/music-service';
import type { PomodoroService } from '../platform/pomodoro/pomodoro-service';
import type { ReadingService } from '../platform/reading/reading-service';

/**
 * Widget services, one each per home module activation (set in `activate()`, cleared in `dispose()`).
 * Every open board uses these shared instances, so two boards never run two timers or play two sounds.
 * The music player exists only off phones.
 */
export const homeServices: {
	habit?: HabitService;
	expense?: ExpenseService;
	mediaTags?: MediaTagService;
	music?: MusicService;
	pomodoro?: PomodoroService;
	reading?: ReadingService;
	widgets?: IndexedWidgets;
	widgetRevision?: number;
	watchWidgets?: (listener: () => void) => () => void;
	acquireDispatch?: () => Promise<AgentDispatch | undefined>;
	agents?: () => readonly AgentDirectoryEntry[];
	sessions?: () => AgentSessionsPort | undefined;
	skills?: () => AgentSkills | undefined;
	watchAgents?: (listener: () => void) => () => void;
	/** The agent module's provider quotas while it is active. */
	quickCommands?: () => AgentQuickCommands | undefined;
	usage?: () => AgentUsage | undefined;
	watchUsage?: (listener: () => void) => () => void;
	/** The navigator's recent notes and shortcuts while that module is active. */
	navigatorLists?: () => NavigatorLists | undefined;
	watchNavigatorLists?: (listener: () => void) => () => void;
} = {};
