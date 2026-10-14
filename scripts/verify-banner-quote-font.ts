import { strict as assert } from 'node:assert';
import { parse, serialize } from '../src/modules/home/core/board/parser/index';
import { QUOTE_FONT_GROUPS, firstFontName } from '../src/modules/home/ui/banner/quote-fonts';

// Format/font catalog checks; React rendering assertions live in Banner.dom.test.tsx.

const md = [
	'---',
	'banner:',
	'  quote: "Stay hungry, stay foolish."',
	'  author: "Steve Jobs"',
	'---',
	'',
	'## 板块',
].join('\n');

function main(): void {
	// 1. serialize -> parse round-trip keeps quoteFont.
	{
		const data = parse(md);
		data.banner.quoteFont = '楷体';
		const out = parse(serialize(data));
		assert.equal(out.banner.quoteFont, '楷体', '1: font survives round-trip');
	}

	// 2. Font name containing a double quote is escaped, not corrupted.
	{
		const data = parse(md);
		data.banner.quoteFont = 'My "Hand" Font';
		const out = parse(serialize(data));
		assert.equal(out.banner.quoteFont, 'My "Hand" Font', '2: quoted font name round-trips');
	}

	// 3. Absent key parses as undefined (theme default), serialize omits it.
	{
		const data = parse(md);
		assert.equal(data.banner.quoteFont, undefined, '3: parses as undefined');
		const out = serialize(data);
		assert.ok(!out.includes('quoteFont'), '3: key omitted when unset');
	}

	// 4. Dropdown catalog: both locales' groups present, values are unique
	//    non-empty CSS stacks ending in a generic family, labels non-empty.
	{
		const groups = QUOTE_FONT_GROUPS.map((g) => g.labelKey);
		assert.ok(groups.includes('banner.quoteFontGroupZh'), '6: Chinese font group exists');
		assert.ok(groups.includes('banner.quoteFontGroupEn'), '6: Western font group exists');
		const all = QUOTE_FONT_GROUPS.flatMap((g) => g.fonts);
		assert.ok(all.length >= 12, '6: catalog is not trivially small');
		const values = new Set<string>();
		const generic = /,(serif|sans-serif|cursive|monospace)$/;
		for (const font of all) {
			assert.ok(font.label.trim().length > 0, '6: label non-empty');
			assert.ok(generic.test(font.value), `6: stack ends in a generic family: ${font.label}`);
			assert.ok(!values.has(font.value), `6: duplicate stack value: ${font.label}`);
			values.add(font.value);
		}
		// Cross-platform guard: the kaiti pick covers macOS (Kaiti SC) and Windows (KaiTi).
		const kaiti = valuesHas(values, (v) => v.includes('"Kaiti SC"') && v.includes('"KaiTi"'));
		assert.ok(kaiti, '6: kaiti stack spans macOS and Windows names');
	}

	// 5. firstFontName labels hand-typed values for the dropdown.
	{
		assert.equal(firstFontName('"Kaiti SC","KaiTi",serif'), 'Kaiti SC', '7: leading quoted family wins');
		assert.equal(firstFontName('Georgia,serif'), 'Georgia', '7: bare family extracted');
		assert.equal(firstFontName('  楷体  '), '楷体', '7: single bare name trimmed');
	}

	console.log('verify-banner-quote-font: all 5 checks passed');
}

function valuesHas(values: Set<string>, pred: (v: string) => boolean): boolean {
	for (const v of values) if (pred(v)) return true;
	return false;
}

main();
