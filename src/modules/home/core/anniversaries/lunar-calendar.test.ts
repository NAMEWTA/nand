import assert from 'node:assert/strict';
import { test } from 'vitest';
import { anniversaryDateThisYear, anniversaryOccurrence, parseAnniversaryDate } from './calendar';
import { civilDate, replaceCivilDate } from './civil-date';
import { lunarLookup } from './lunar-calendar';
import { lunarAnniversaryThisYear } from './lunar-map';

// Independent reference: Hong Kong Observatory Gregorian-Lunar conversion tables:
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2020e.txt (May 23/24: second fourth month)
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2021e.txt (May 12/13: fourth month)
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2023e.txt (March 21: second month day 30)
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2025e.txt (March 28: second month day 29)
test('real lunar dates round trip and missing leap months use the ordinary month', () => {
	assert.deepEqual(lunarLookup.toLunar('2020-05-24'), { year: 2020, month: 4, leap: true, day: 2 });
	assert.equal(lunarLookup.toSolar(2020, 4, true, 2), '2020-05-24');
	assert.equal(lunarLookup.monthDays(2021, 4, true), undefined);
	assert.deepEqual(lunarAnniversaryThisYear('2020-05-24', 2021, lunarLookup), { solar: '2021-05-13', rule: 'plain-month', leapCollapsed: true });
	assert.deepEqual(lunarAnniversaryThisYear('2020-05-24', 2020, lunarLookup), { solar: '2020-05-24', rule: 'exact', leapCollapsed: false });
});

test('an absent day maps to month end only for annual recurrence, never for typed input', () => {
	assert.deepEqual(lunarLookup.toLunar('2023-03-21'), { year: 2023, month: 2, leap: false, day: 30 });
	assert.deepEqual(lunarAnniversaryThisYear('2023-03-21', 2025, lunarLookup), { solar: '2025-03-28', rule: 'month-end', leapCollapsed: false });
	assert.throws(() => lunarLookup.toSolar(2025, 2, false, 30));
	assert.throws(() => lunarLookup.toSolar(2021, 4, true, 2));
	assert.throws(() => lunarLookup.toSolar(2025, 13, false, 1));
	assert.throws(() => lunarLookup.toSolar(2025, 2, false, 1.5));
});

test('Lunar New Year boundary keeps the preceding lunar year and reminder age', () => {
	const start = parseAnniversaryDate('2020-01-01T12:34:56')!; // lunar 2019/12/7
	const mark = anniversaryOccurrence(start, new Date(2021, 0, 1), 'lunar', lunarLookup);
	assert.equal(civilDate(mark.date), '2021-01-19'); // lunar 2020/12/7
	assert.equal(mark.years, 1);
	assert.equal(mark.date.getHours(), 0);
	assert.equal(civilDate(anniversaryDateThisYear(start, new Date(2021, 1, 12), 'lunar', lunarLookup)), '2022-01-09');
});

test('invalid stored values and unavailable conversions cannot silently become solar anniversaries', () => {
	for (const raw of ['', '2025-02-29', '2025-02-30T12:30', '2025-13-01', '0000-01-01', '2025-01-01T24:00', '2025-01-01T12:60', 'not a date']) assert.equal(parseAnniversaryDate(raw), null, raw);
	assert.ok(parseAnniversaryDate('2024-02-29T12:30:45.123+08:00'));
	assert.throws(() => lunarLookup.toLunar('2025-02-30'));
	const start = new Date(2020, 4, 24), now = new Date(2021, 5, 1);
	assert.throws(() => anniversaryDateThisYear(start, now, 'lunar'));
	assert.throws(() => anniversaryDateThisYear(start, now, 'lunar', { ...lunarLookup, monthDays: () => undefined }));
	assert.throws(() => anniversaryDateThisYear(start, now, 'lunar', { ...lunarLookup, toSolar: () => '2021-02-30' }));
});

test('calendar input preserves original time and solar anniversary behavior', () => {
	const original = '2020-05-24T12:34:56.123+08:00';
	const lunar = lunarLookup.toLunar(original.split('T')[0]!);
	assert.equal(replaceCivilDate(original, lunarLookup.toSolar(lunar.year, lunar.month, lunar.leap, lunar.day)), original);
	assert.equal(replaceCivilDate(original, '2021-05-13'), '2021-05-13T12:34:56.123+08:00');
	assert.equal(civilDate(anniversaryDateThisYear(new Date(2020, 1, 29), new Date(2021, 0, 1))), '2021-03-01');
});
