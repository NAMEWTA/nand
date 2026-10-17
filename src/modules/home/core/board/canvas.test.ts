import { expect, test } from 'vitest';
import { convertToCanvas, defaultCanvasMembers, needsCanvasConversion } from './canvas';
import { parse, serialize } from './parser/parse';
import { generateDefaultMarkdown } from './parser/default-document';
import { boardTileSources, boardTiles } from './board-tiles';
import { tilesOverlap } from './immersive-grid';
import { setLanguage } from '../../../../shared/i18n';
import { widgetPresentationKey } from './widget-members';
import { bannerOf, mapBanners, withBanner } from './banner';

const legacy =
	'---\ndashboard: true\nlayout: stacked\nbanner:\n  quote: "Q"\n  author: "A"\n---\n## Todo\n\n### Tasks\n- [ ] One\n\n### Memo\nKept body\n';

test('an old board converts once: cards and banner stay, the banner becomes the top widget, tiles do not overlap', () => {
	const data = parse(legacy);
	expect(needsCanvasConversion(data)).toBe(true);
	const members = [{ memberId: 'home:calendar:default', provider: 'home', kind: 'calendar', instanceId: 'default' }];
	const converted = convertToCanvas(data, members);
	expect(converted.layout).toBe('immersive');
	expect(converted.legacyLayout).toBeUndefined();
	expect(converted.widgets?.map((m) => m.kind)).toEqual(['banner', 'calendar']);
	expect(converted.columns).toEqual(data.columns);
	expect(converted.banner.quote).toBe('Q');
	const tiles = boardTiles(converted, boardTileSources(converted, converted.widgets!));
	expect(
		tilesOverlap(
			tiles.map((tile) => ({
				...tile,
				x: converted.immersive!.find((t) => t.id === tile.id)!.x ?? 0,
				y: converted.immersive!.find((t) => t.id === tile.id)!.y ?? 0,
			})),
		),
	).toBe(false);
	const banner = converted.immersive!.find((tile) => tile.id === 'widget:banner')!;
	expect(banner).toMatchObject({ w: 12, x: 0, y: 0 });
	expect(needsCanvasConversion(converted)).toBe(false);
	// the converted file round-trips and no longer needs conversion
	const reread = parse(serialize(converted));
	expect(needsCanvasConversion(reread)).toBe(false);
	expect(reread.columns[0]?.cards.map((card) => card.title)).toEqual(
		data.columns[0]?.cards.map((card) => card.title),
	);
});

test('without remembered widgets an old board gets the default set and an existing banner member is not doubled', () => {
	const converted = convertToCanvas(parse(legacy), undefined);
	expect(converted.widgets?.filter((m) => m.kind === 'banner')).toHaveLength(1);
	expect(converted.widgets?.map((m) => m.kind)).toEqual(defaultCanvasMembers().map((m) => m.kind));
	const again = convertToCanvas(converted, undefined);
	expect(again.widgets).toEqual(converted.widgets);
	expect(again.immersive).toEqual(converted.immersive);
});

test('conversion keeps the saved positions of an old immersive board', () => {
	const data = parse(legacy);
	data.layout = 'immersive';
	data.widgets = [{ memberId: 'home:lunar:default', provider: 'home', kind: 'lunar', instanceId: 'default' }];
	data.immersive = [{ id: 'widget:lunar', w: 5, cap: 22, x: 6, y: 9 }];
	const converted = convertToCanvas(data, undefined);
	expect(converted.immersive?.find((tile) => tile.id === 'widget:lunar')).toMatchObject({
		w: 5,
		cap: 22,
		x: 6,
		y: 9,
	});
});

test('a new board is a canvas from the start: banner on top, sections placed, no overlap', () => {
	setLanguage('en');
	const data = parse(generateDefaultMarkdown());
	expect(needsCanvasConversion(data)).toBe(false);
	expect(data.widgets?.map(widgetPresentationKey)).toEqual(['banner', 'calendar', 'quickActions', 'pomodoro']);
	expect(data.widgets?.[0]?.kind).toBe('banner');
	const saved = data.immersive!;
	expect(saved.length).toBe(data.widgets!.length + data.columns.length);
	expect(tilesOverlap(saved.map((tile) => ({ ...tile, x: tile.x ?? 0, y: tile.y ?? 0, h: tile.cap })))).toBe(false);
});

const oldImmersive =
	'---\nlayout: immersive\nwidgets: [{"memberId":"home:pomodoro:default","provider":"home","kind":"pomodoro","instanceId":"default"}]\nimmersive: [{"id":"widget:pomodoro","w":3,"cap":24,"x":0,"y":0}]\nbanner:\n  quote: "Preserve old banner"\n  author: "A"\n---\n\n## Notes\n\n### One\nid: one\ntype: generic\nBody\n';

test('an old immersive board (no canvas mark) is converted once: the banner joins as a widget and stays removable', () => {
	const old = parse(oldImmersive);
	expect(old.layout).toBe('immersive');
	expect(needsCanvasConversion(old)).toBe(true);
	const converted = convertToCanvas(old, undefined);
	expect(converted.widgets?.map((m) => m.kind)).toEqual(['banner', 'pomodoro']);
	expect(converted.banner.quote).toBe('Preserve old banner');
	// existing positions stay; the new banner takes a free spot instead of pushing anything
	expect(converted.immersive?.find((tile) => tile.id === 'widget:pomodoro')).toMatchObject({
		x: 0,
		y: 0,
		w: 3,
		cap: 24,
	});
	expect(converted.canvas).toBe(1);
	// written and read back: no second conversion
	const reread = parse(serialize(converted));
	expect(reread.canvas).toBe(1);
	expect(needsCanvasConversion(reread)).toBe(false);
	// the user removes the banner: nothing brings it back
	const removed = { ...reread, widgets: reread.widgets!.filter((m) => m.kind !== 'banner') };
	expect(needsCanvasConversion(parse(serialize(removed)))).toBe(false);
	expect(parse(serialize(removed)).widgets?.map((m) => m.kind)).toEqual(['pomodoro']);
});

test('extra banner instances keep their own data through a write and a read', () => {
	const data = parse(oldImmersive);
	const next = withBanner(convertToCanvas(data, undefined), 'banner-2', { quote: 'Second', mode: 'quote' });
	expect(bannerOf(next, 'default').quote).toBe('Preserve old banner');
	expect(bannerOf(next, 'banner-2').quote).toBe('Second');
	const reread = parse(serialize(next));
	expect(reread.banners?.['banner-2']?.quote).toBe('Second');
	expect(bannerOf(reread, 'banner-2').quote).toBe('Second');
	expect(bannerOf(reread, 'default').quote).toBe('Preserve old banner');
	// an unknown instance starts from the default poster rather than failing
	expect(bannerOf(reread, 'never-saved').author).toBe('NAND');
	expect(mapBanners(reread, (banner) => ({ ...banner, image: 'x.png' })).banners?.['banner-2']?.image).toBe('x.png');
});
