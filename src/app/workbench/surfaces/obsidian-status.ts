import { Menu, Platform, setIcon, type Plugin } from 'obsidian';
import type { AgentUsage, StatusBarPreferences, StatusSegment, UsageStatusHandle, WorkbenchTarget } from '../../contracts/workbench';
import { onLanguageChanged, t } from '../../../shared/i18n';
import { STATUS_ITEMS, itemShown, visibleSegments, withItemShown } from '../status-segments';

export interface ObsidianStatusHost {
	/** Current segments of every contribution (also while the workbench is closed). */
	segments: () => readonly StatusSegment[];
	preferences: () => StatusBarPreferences;
	setPreferences: (next: StatusBarPreferences) => Promise<void>;
	usage: () => AgentUsage | undefined;
	open: (target: WorkbenchTarget, ownerWindow: Window) => Promise<void>;
	report: (error: unknown) => void;
}

interface SegmentItem {
	el: HTMLElement;
	button: HTMLButtonElement;
	icon: HTMLElement;
	text: HTMLElement;
	segment: StatusSegment;
	iconName?: string;
	/** Detaches the listeners added in `createSegment`. */
	release: () => void;
}

/**
 * NAND's status entries live in Obsidian's own status bar: usage first, then one entry per visible
 * segment. Obsidian shows that bar only in the main window, so entries are registered once and are
 * never repeated in pop-out windows. Nothing here needs the workbench leaf to exist.
 */
export function registerObsidianStatus(plugin: Plugin, host: ObsidianStatusHost) {
	// Obsidian ties every `addStatusBarItem()` to the plugin until it unloads, so items are never
	// created per appearance: a hidden item returns to the pool and is reused, which bounds the
	// number of host registrations by the peak number of simultaneously visible items.
	const segments = new Map<string, SegmentItem>();
	const pool: SegmentItem[] = [];
	const usage: {
		service?: AgentUsage;
		off?: () => void;
		/** The single usage item; created on first use, hidden (not removed) while unused. */
		el?: HTMLElement;
		release?: () => void;
		visible: boolean;
		handle?: UsageStatusHandle;
		releaseWindow?: () => void;
		token: number;
		rendered?: { service: AgentUsage; preferences: StatusBarPreferences; revision: number };
	} = { token: 0, visible: false };
	let revision = 0;
	let disposed = false;

	const save = (next: StatusBarPreferences) => {
		void host.setPreferences(next).catch(host.report);
	};
	const showMenu = (event: MouseEvent) => {
		event.preventDefault();
		const preferences = host.preferences();
		const menu = new Menu();
		for (const item of STATUS_ITEMS)
			menu.addItem((entry) =>
				entry
					.setTitle(t(item.labelKey))
					.setChecked(itemShown(preferences, item.id))
					.onClick(() => {
						const current = host.preferences();
						save(withItemShown(current, item.id, !itemShown(current, item.id)));
					}),
			);
		menu.addSeparator();
		const choices = [
			[t('shell.usageDisplay'), 'usageDisplay', [['used', t('shell.used')], ['remaining', t('shell.remaining')]]],
			[t('shell.usageMode'), 'usageMode', [['verbose', t('shell.verbose')], ['compact', t('shell.compact')]]],
		] as const;
		for (const [label, key, options] of choices)
			for (const [value, name] of options)
				menu.addItem((entry) =>
					entry
						.setTitle(`${label} · ${name}`)
						.setChecked(preferences[key] === value)
						.onClick(() => save({ ...host.preferences(), [key]: value })),
				);
		menu.showAtMouseEvent(event);
	};

	const createSegment = (segment: StatusSegment): SegmentItem => {
		const el = plugin.addStatusBarItem();
		el.addClass('nand-status-item');
		const button = el.createEl('button', { cls: 'clickable-icon nand-status-button', attr: { type: 'button' } });
		const icon = button.createSpan({ cls: 'status-bar-item-icon nand-status-icon' });
		const text = button.createSpan({ cls: 'nand-status-text' });
		const click = () => {
			const target = item.segment.target;
			if (target) void host.open(target, el.win).catch(host.report);
		};
		const item: SegmentItem = {
			el,
			button,
			icon,
			text,
			segment,
			release: () => {
				button.removeEventListener('click', click);
				el.removeEventListener('contextmenu', showMenu);
				el.remove();
			},
		};
		button.addEventListener('click', click);
		el.addEventListener('contextmenu', showMenu);
		return item;
	};
	const acquireSegment = (segment: StatusSegment): SegmentItem => {
		const item = pool.pop() ?? createSegment(segment);
		item.el.hidden = false;
		return item;
	};
	const releaseSegment = (item: SegmentItem) => {
		item.el.hidden = true;
		delete item.el.dataset.statusSegment;
		pool.push(item);
	};
	const updateSegment = (item: SegmentItem, segment: StatusSegment) => {
		item.segment = segment;
		if (item.iconName !== segment.icon) {
			item.iconName = segment.icon;
			setIcon(item.icon, segment.icon);
		}
		item.text.setText(String(segment.count ?? segment.label));
		item.el.dataset.statusSegment = segment.id;
		item.el.dataset.tone = segment.tone ?? 'neutral';
		item.button.setAttribute('aria-label', segment.label);
		item.button.toggleClass('is-static', !segment.target);
		if (segment.target) item.button.removeAttribute('aria-disabled');
		else item.button.setAttribute('aria-disabled', 'true');
	};

	const dropUsageView = () => {
		usage.token++;
		usage.handle?.dispose();
		usage.handle = undefined;
		usage.releaseWindow?.();
		usage.releaseWindow = undefined;
		if (usage.el) usage.el.hidden = true;
		usage.visible = false;
		usage.rendered = undefined;
	};
	const dropUsage = () => {
		dropUsageView();
		usage.off?.();
		usage.off = undefined;
		usage.service = undefined;
	};
	const syncUsage = () => {
		const next = host.usage();
		const preferences = host.preferences();
		const active = !!next && itemShown(preferences, 'usage');
		if (!active || usage.service !== next) dropUsage();
		if (!active) return;
		if (!usage.service) {
			usage.service = next;
			usage.off = next.subscribe(syncUsage);
		}
		if (!next.snapshot().providers.length) return dropUsageView();
		const props = () => ({
			usage: next,
			preferences: host.preferences(),
			revision,
			onPreferences: save,
			navigate: (target: WorkbenchTarget) => {
				if (usage.el && usage.visible) void host.open(target, usage.el.win).catch(host.report);
			},
			report: host.report,
		});
		if (!usage.visible) {
			let el = usage.el;
			if (!el) {
				el = usage.el = plugin.addStatusBarItem();
				el.addClass('nand-status-usage');
				el.addEventListener('contextmenu', showMenu);
				usage.release = () => el?.removeEventListener('contextmenu', showMenu);
			}
			el.hidden = false;
			usage.visible = true;
			usage.releaseWindow = next.observeWindow?.(el.win);
			const token = ++usage.token;
			// React is loaded only once there is usage to show.
			void import('../../../shell/status-bar/mount-usage')
				.then(({ mountUsageStatus }) => {
					if (disposed || token !== usage.token || !usage.el || !usage.visible) return;
					usage.handle = mountUsageStatus(usage.el, props());
					usage.rendered = { service: next, preferences: host.preferences(), revision };
				})
				.catch(host.report);
			return;
		}
		const last = usage.rendered;
		if (usage.handle && (!last || last.service !== next || last.preferences !== preferences || last.revision !== revision)) {
			usage.handle.update(props());
			usage.rendered = { service: next, preferences, revision };
		}
	};

	/** Keep usage first, then segments in contribution order, without moving unrelated plugins' items. */
	const arrange = (ordered: readonly HTMLElement[]) => {
		let previous: HTMLElement | undefined;
		for (const el of ordered) {
			if (previous && previous.nextElementSibling !== el) previous.after(el);
			previous = el;
		}
	};

	const clear = () => {
		dropUsage();
		usage.release?.();
		usage.el?.remove();
		usage.el = undefined;
		for (const item of [...segments.values(), ...pool]) item.release();
		segments.clear();
		pool.length = 0;
	};
	const refresh = () => {
		// Obsidian Mobile has no status bar; the workbench page header carries statuses there.
		if (disposed || !Platform.isDesktopApp) return;
		const wanted = visibleSegments(host.segments(), host.preferences());
		const keep = new Set(wanted.map((segment) => segment.id));
		for (const [id, item] of segments)
			if (!keep.has(id)) {
				releaseSegment(item);
				segments.delete(id);
			}
		for (const segment of wanted) {
			let item = segments.get(segment.id);
			if (!item) segments.set(segment.id, (item = acquireSegment(segment)));
			updateSegment(item, segment);
		}
		syncUsage();
		arrange([...(usage.el && usage.visible ? [usage.el] : []), ...wanted.flatMap((segment) => segments.get(segment.id)?.el ?? [])]);
	};

	const offLanguage = onLanguageChanged(() => {
		revision++;
		refresh();
	});
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		offLanguage();
		clear();
	};
	plugin.register(dispose);
	return { refresh, dispose };
}
