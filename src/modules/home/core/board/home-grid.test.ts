import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'vitest';
import { lunarAnniversaryThisYear } from '../anniversaries/lunar-map';
import {
	displayFocal,
	focalForWrite,
	nextWindow,
	reconcileColumns,
	renderWindow,
	selectTemplate,
	templateChoices,
} from './board-experience';
import { orderedHostIcons } from './icon-catalog';
import {
	beginGesture,
	cancelGesture,
	CANONICAL_COLUMNS,
	commitGesture,
	dropAtPointer,
	dropTile,
	edgeScrollStep,
	effectiveColumns,
	migrateImmersive,
	placeTiles,
	projectLayout,
	resizeTile,
	SNAP_PX,
	tilesOverlap,
} from './immersive-grid';
import { parse, serialize } from './parser/parse';
import { planDashboardUpdate } from './render-update';
import { advanceStage } from './pipeline';
import { fillTemplate, planSkillDispatch } from './skill-prompt';
import { indexWidgetProviders, memberMount, normalizeMembers, removeBoardMember, widgetProviderKey } from './widget-registry';

describe('home grid and board rules', () => {
	test('choosing the immersive layout rebuilds the whole board', () => {
		const plain = ['---', 'dashboard: true', '---', '', '## Memo', '', '### Hello', 'id: card-1', 'type: generic', 'A note.', ''].join('\n');
		const entered = plain.replace('dashboard: true\n', 'dashboard: true\nlayout: immersive\ngridPacked: true\n');
		assert.equal(planDashboardUpdate(parse(plain), parse(entered), 'local').kind, 'full');
		const moved = entered.replace('type: generic\n', 'type: generic\ncols: 5\n');
		assert.equal(planDashboardUpdate(parse(entered), parse(moved), 'local').kind, 'full');
	});

	test('parse and serialize leave an untouched board byte-stable', () => {
		const source = [
			'---',
			'dashboard: true',
			'kept: yes',
			'banner:',
			'  quote: "Hello"',
			'  author: "Ada"',
			'---',
			'',
			'<!-- stay -->',
			'',
			'## Memo',
			'',
			'### Hello',
			'id: card-1',
			'type: generic',
			'A note that stays.',
			'',
		].join('\n');
		assert.equal(serialize(parse(source)), source);
	});

	test('immersive placement is one non-overlapping 12-column grid and cancel writes nothing', () => {
		assert.equal(effectiveColumns(960), 12);
		assert.equal(effectiveColumns(600), 6);
		assert.equal(effectiveColumns(288), 3);
		assert.equal(CANONICAL_COLUMNS, 12);
		assert.equal(SNAP_PX, 8);
		const canonical = [
			{ id: 'a', x: 1, y: 1, w: 8, h: 4, explicit: true },
			{ id: 'b', x: 1, y: 1, w: 8, h: 4 },
			{ id: 'c', x: 2, y: 2, w: 4, h: 3, explicit: true },
		];
		const placed = placeTiles(canonical);
		assert.equal(tilesOverlap(placed), false);
		assert.ok(placed.every((tile) => tile.x >= 0 && tile.x + tile.w <= 12 && tile.h >= 3));
		const narrow = projectLayout(placed, 288);
		assert.equal(narrow.writes, 0);
		assert.equal(narrow.columns, 3);
		assert.deepEqual(
			placed.map((tile) => [tile.x, tile.y]),
			placed.map((tile) => [tile.x, tile.y]),
		);
		assert.equal(tilesOverlap(narrow.display), false);
		const migrated = migrateImmersive(canonical, false);
		assert.equal(migrated.write, true);
		assert.equal(migrateImmersive(migrated.tiles, true).write, false);
		const gesture = beginGesture(placed);
		const preview = dropAtPointer(placed, 'b', 80, 40, 0, 0);
		const moved = commitGesture({ ...gesture, preview });
		assert.equal(moved.writes, 1);
		assert.equal(cancelGesture(gesture).writes, 0);
		assert.deepEqual(
			cancelGesture(gesture).tiles.map((tile) => tile.x),
			placed.map((tile) => tile.x),
		);
		const swapped = dropTile(
			placed,
			'a',
			placed.find((tile) => tile.id === 'c')!.x,
			placed.find((tile) => tile.id === 'c')!.y,
		);
		assert.equal(tilesOverlap(swapped), false);
		assert.equal(tilesOverlap(resizeTile(placed, 'a', 3, 2)), false);

	});

	test('skill prompts substitute once and do not submit', () => {
		assert.equal(
			fillTemplate('{{name}} {{missing}} {{name}}', { name: 'Ada {{raw}}' }),
			'Ada {{raw}} {{missing}} Ada {{raw}}',
		);
		const fresh = planSkillDispatch({
			agent: 'claude-code',
			skill: 'review',
			template: 'Look at {{path}}',
			vars: { path: 'a.md' },
		});
		assert.equal(fresh.mode, 'new-session');
		assert.equal(fresh.prompt, '/review\nLook at a.md');
		assert.equal(fresh.submit, false);
		assert.equal(fresh.reportedSuccess, false);
		const pasted = planSkillDispatch({
			agent: 'codex',
			skill: 'review',
			template: 'Look at {{path}}',
			vars: { path: 'a.md' },
			sessionId: 's1',
		});
		assert.deepEqual(pasted, {
			mode: 'paste',
			sessionId: 's1',
			prompt: '$review\nLook at a.md',
			submit: false,
			reportedSuccess: false,
		});
	});

	test('a workflow refuses a name clash before any write', () => {
		let writes = 0;
		const result = advanceStage({
			path: 'Board/note.md',
			config: {
				rootFolder: 'Board',
				statusField: 'status',
				stages: [{ id: 'next', value: 'Next', label: 'Next', folder: 'next' }],
			},
			targetStageId: 'next',
			siblingNames: ['note.md'],
			writeStatus: () => {
				writes += 1;
				return 'ok';
			},
		});
		assert.equal(result.status, 'refused');
		assert.equal(result.error, 'name-clash');
		assert.equal(writes, 0);
		const escaped = advanceStage({
			path: 'Board/note.md',
			config: {
				rootFolder: 'Board',
				statusField: 'status',
				stages: [{ id: 'out', value: 'Out', label: 'Out', folder: '../secret' }],
			},
			targetStageId: 'out',
			siblingNames: [],
			writeStatus: () => 'ok',
		});
		assert.equal(escaped.error, 'path-escape');
		const partial = advanceStage({
			path: 'Board/note.md',
			config: {
				rootFolder: 'Board',
				statusField: 'status',
				stages: [{ id: 'next', value: 'Next', label: 'Next', folder: 'next' }],
			},
			targetStageId: 'next',
			siblingNames: [],
			writeStatus: () => 'ok',
			rename: () => 'failed',
		});
		assert.equal(partial.status, 'partial');
		assert.deepEqual(partial.completed, ['status']);
	});

	test('lunar dates, columns, windows, focal points and templates follow the board rules', () => {
		const lookup = {
			toLunar: () => ({ year: 2024, month: 2, leap: true, day: 30 }),
			monthDays: (_year: number, _month: number, leap: boolean) => (leap ? undefined : 29),
			toSolar: (year: number, month: number, leap: boolean, day: number) =>
				`${year}-${month}-${leap ? 'leap' : 'plain'}-${day}`,
		};
		const lunar = lunarAnniversaryThisYear('2024-03-01', 2026, lookup);
		assert.equal(lunar.leapCollapsed, true);
		assert.equal(lunar.rule, 'month-end');
		assert.equal(lunar.solar, '2026-2-plain-29');
		const columns = reconcileColumns(['title', 'gone'], ['gone'], ['title', 'status']);
		assert.deepEqual(columns.hidden, ['gone']);
		assert.deepEqual(columns.order, ['title', 'gone', 'status']);
		assert.deepEqual(renderWindow(800, 0), { count: 50, total: 800, truncated: true });
		assert.equal(nextWindow(500, 800), 500);
		assert.equal(renderWindow(800, 500).count, 500);
		assert.deepEqual(displayFocal(undefined), { x: 50, y: 50 });
		assert.equal(focalForWrite(undefined), undefined);
		assert.deepEqual(focalForWrite({ x: 140, y: -3 }), { x: 100, y: 0 });
		assert.deepEqual(templateChoices('old.md'), ['old.md']);
		assert.deepEqual(templateChoices('old.md', []), []);
		assert.deepEqual(templateChoices('old.md', [' b.md ', 'a.md', 'b.md', '']), ['b.md', 'a.md']);
		assert.equal(selectTemplate(['a.md', 'b.md'], null), null);
	});

	test('the icon authority keeps the full host list, promotes preferred names and invents none', () => {
		const hosts = [...Array.from({ length: 900 }, (_, index) => `icon-${String(index).padStart(3, '0')}`), 'star', 'star'];
		const rows = orderedHostIcons(hosts);
		assert.equal(rows.length, 901);
		assert.equal(rows[0], 'star');
		assert.ok(rows.includes('icon-899'));
		assert.deepEqual(orderedHostIcons([]), []);
		assert.deepEqual(orderedHostIcons(['lucide-telescope', 'lucide-star']), ['lucide-star', 'lucide-telescope']);
	});

	test('widgets share one registry and a removed member keeps the instance', () => {
		const index = indexWidgetProviders([
			{
				module: 'home',
				bundle: {
					kinds: [
						{
							key: 'calendar',
							titleKey: 'home.widget.calendar',
							icon: 'calendar',
							defaultSize: { w: 4, h: 4 },
							minSize: { w: 2, h: 2 },
							instances: () => [{ id: 'default' }],
							render: () => undefined,
						},
					],
				},
			},
			{
				module: 'news',
				bundle: {
					kinds: [
						{
							key: 'calendar',
							titleKey: 'news.widget.raw',
							icon: 'newspaper',
							defaultSize: { w: 4, h: 4 },
							minSize: { w: 2, h: 2 },
							instances: () => [{ id: 'default' }],
							render: () => undefined,
						},
					],
				},
			},
		]);
		assert.equal(index.byKey.get(widgetProviderKey('home', 'calendar'))?.module, 'home');
		assert.equal(index.errors.length, 0);
		assert.equal(index.byKey.get(widgetProviderKey('news', 'calendar'))?.module, 'news');
		const members = normalizeMembers(
			[
				{ memberId: 'm1', kind: 'calendar', provider: 'news' },
				{ memberId: 'm1', kind: 'calendar', provider: 'news' },
			],
		);
		assert.equal(members.length, 1);
		assert.equal(memberMount({ kind: 'calendar', provider: 'home' }, index, new Set()), 'disabled');
		const removed = removeBoardMember(members, { shared: { title: 'keep' } }, 'm1');
		assert.deepEqual(removed.members, []);
		assert.deepEqual(removed.instances, { shared: { title: 'keep' } });
	});

	test('the narrow desktop home stylesheet keeps the quick note at content height', () => {
		const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
		const quick = readFileSync(
			path.join(root, 'src/modules/home/styles/087-quick-notes-region-single-line-accent-navbar-mas.css'),
			'utf8',
		);
		assert.match(quick, /\.dashboard-main > \.dashboard-quicknote \{[^}]*flex:\s*0 0 auto/s);
		// Banner clearance is measured in the real host by home-quicknote.mjs;
		// a fixed padding assertion missed both wrapping and the <=640 override.
		const icons = readFileSync(
			path.join(root, 'src/ui/styles/111-nand-surface-polish-host-theme-outside-the-board.css'),
			'utf8',
		);
		assert.match(icons, /\.nand-settings-page \.nand-home-module-icon/);
		const immersive = readFileSync(path.join(root, 'src/modules/home/styles/071b-immersive-grid.css'), 'utf8');
		assert.doesNotMatch(immersive, /transition|animation/);
		// home-integration.mjs checks computed reduced-motion styles in Obsidian.
		// A literal CSS assertion passed while more-specific widget rules still animated.
	});

	test('a pointer on the scrollport edge steps, and the middle or a blocked side does not', () => {
		assert.equal(edgeScrollStep(10, 0, 200, 40, 400), -16);
		assert.equal(edgeScrollStep(190, 0, 200, 40, 400), 16);
		assert.equal(edgeScrollStep(100, 0, 200, 40, 400), 0);
		assert.equal(edgeScrollStep(10, 0, 200, 0, 400), 0);
		assert.equal(edgeScrollStep(190, 0, 200, 400, 400), 0);
	});
});
