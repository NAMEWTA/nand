import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'vitest';
import { lunarAnniversaryThisYear } from '../anniversaries/lunar-map';
import { appearancePreset, commitAppearancePreset } from './appearance-preset';
import { cardTiles, moveCardGrid, packBoardOnce, resizeCardGrid } from './board-grid';
import {
	displayFocal,
	focalForWrite,
	nextWindow,
	reconcileColumns,
	renderWindow,
	selectTemplate,
	templateChoices,
} from './board-experience';
import { iconPickerRows } from './icon-catalog';
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
import { indexWidgetProviders, memberMount, normalizeMembers, removeBoardMember } from './widget-registry';

describe('home grid and board rules', () => {
	test('choosing the immersive layout rebuilds the whole board', () => {
		const plain = ['---', 'dashboard: true', '---', '', '## Memo', '', '### Hello', 'id: card-1', 'type: generic', 'A note.', ''].join('\n');
		const entered = plain.replace('dashboard: true\n', 'dashboard: true\nlayout: immersive\ngridPacked: true\n');
		assert.equal(planDashboardUpdate(parse(plain), parse(entered), 'local').kind, 'full');
		const moved = entered.replace('type: generic\n', 'type: generic\ncols: 5\n');
		assert.equal(planDashboardUpdate(parse(entered), parse(moved), 'local').kind, 'sections');
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
		assert.ok(placed.every((tile) => tile.x >= 1 && tile.x + tile.w - 1 <= 12 && tile.h >= 1));
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
		const unpacked = [
			{ id: 'a', gridCol: 0, gridRow: 0, gridCols: 0, gridRows: 0 },
			{ id: 'b', gridCol: 0, gridRow: 0, gridCols: 0, gridRows: 0 },
		];
		const packed = packBoardOnce(unpacked, false);
		assert.equal(packed.write, true);
		assert.equal(tilesOverlap(cardTiles(packed.cards)), false);
		assert.equal(packBoardOnce(packed.cards, true).write, false);
		const onto = packed.cards.find((card) => card.id === 'b')!;
		const swappedCards = moveCardGrid(packed.cards, 'a', onto.gridCol, onto.gridRow);
		assert.equal(tilesOverlap(cardTiles(swappedCards)), false);
		assert.equal(swappedCards.find((card) => card.id === 'a')!.gridCol, onto.gridCol);
		assert.equal(tilesOverlap(cardTiles(resizeCardGrid(packed.cards, 'a', 2, 2))), false);
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
		assert.deepEqual(templateChoices('old.md', []), ['old.md']);
		assert.equal(selectTemplate(['a.md', 'b.md'], null), null);
	});

	test('appearance save failure is not success, and the icon list stays within 400 host names', () => {
		const preset = appearancePreset(
			'day',
			'Day',
			{
				preset: 'system',
				headings: 'sans',
				emphasis: 'bold',
				accentLight: '#fff',
				accentDark: '#000',
				lineHeight: 1.5,
			},
			{
				bgImage: '',
				bgDim: 0,
				bgBlur: 0,
				bgSize: 'cover',
				surfaceOpacity: null,
				glassBlur: null,
				radiusScale: null,
				fontScale: 'medium',
			},
		);
		const failed = commitAppearancePreset(
			preset,
			() => undefined,
			() => {
				throw new Error('disk full');
			},
		);
		assert.deepEqual(failed, { saved: false, error: 'disk full' });
		const hosts = Array.from({ length: 900 }, (_, index) => `icon-${String(index).padStart(3, '0')}`);
		const rows = iconPickerRows(hosts, '');
		assert.equal(rows.length, 400);
		assert.ok(iconPickerRows(hosts, 'icon-899').includes('icon-899'));
		assert.ok(iconPickerRows([], 'star').includes('star'));
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
						},
					],
				},
			},
		]);
		assert.equal(index.byKey.get('calendar')?.module, 'home');
		assert.equal(index.errors.length, 1);
		const members = normalizeMembers(
			[
				{ id: 'm1', kind: 'calendar', provider: 'news' },
				{ id: 'm1', kind: 'calendar', provider: 'news' },
			],
			index,
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
		const banner = readFileSync(path.join(root, 'src/modules/home/styles/011-banner.css'), 'utf8');
		assert.match(banner, /padding:\s*22px 48px 16px/);
		const icons = readFileSync(
			path.join(root, 'src/ui/styles/111-nand-surface-polish-host-theme-outside-the-board.css'),
			'utf8',
		);
		assert.match(icons, /\.nand-settings-page \.nand-home-module-icon/);
		const immersive = readFileSync(path.join(root, 'src/modules/home/styles/071b-immersive-grid.css'), 'utf8');
		assert.doesNotMatch(immersive, /transition|animation/);
		const motion = readFileSync(path.join(root, 'src/shell/styles/workbench-pages.css'), 'utf8');
		assert.match(
			motion,
			/@media \(prefers-reduced-motion: reduce\) \{ \.nand-shell \* \{ scroll-behavior: auto; transition-duration: 0s; animation-duration: 0s; \} \}/,
		);
	});

	test('a pointer on the scrollport edge steps, and the middle or a blocked side does not', () => {
		assert.equal(edgeScrollStep(10, 0, 200, 40, 400), -16);
		assert.equal(edgeScrollStep(190, 0, 200, 40, 400), 16);
		assert.equal(edgeScrollStep(100, 0, 200, 40, 400), 0);
		assert.equal(edgeScrollStep(10, 0, 200, 0, 400), 0);
		assert.equal(edgeScrollStep(190, 0, 200, 400, 400), 0);
	});
});
