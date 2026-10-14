// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/banner.ts
/** Curated quote-font choices. `value` is a full CSS font-family stack so one
 * setting renders on macOS / Windows / iPad without per-OS editing; labels are
 * proper nouns and intentionally not localized. */
export interface QuoteFontOption {
	label: string;
	value: string;
}

export interface QuoteFontGroup {
	labelKey: string;
	fonts: readonly QuoteFontOption[];
}

export const QUOTE_FONT_GROUPS: readonly QuoteFontGroup[] = [
	{
		labelKey: 'banner.quoteFontGroupZh',
		fonts: [
			{ label: '楷体', value: '"Kaiti SC","STKaiti","KaiTi","楷体",serif' },
			{ label: '宋体', value: '"Songti SC","STSong","SimSun","宋体",serif' },
			{ label: '仿宋', value: '"STFangsong","FangSong","仿宋",serif' },
			{ label: '隶书', value: '"LiSu","隶书","STLiti","华文隶书",serif' },
			{ label: '行楷', value: '"STXingkai","华文行楷","Xingkai SC","行楷",cursive' },
			{ label: '圆体', value: '"Yuanti SC","YouYuan","幼圆",sans-serif' },
			{ label: '黑体', value: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif' },
			{ label: '霞鹜文楷', value: '"LXGW WenKai","LXGW WenKai Lite","霞鹜文楷","Kaiti SC","KaiTi",serif' },
		],
	},
	{
		labelKey: 'banner.quoteFontGroupEn',
		fonts: [
			{ label: 'Georgia', value: 'Georgia,serif' },
			{ label: 'Times New Roman', value: '"Times New Roman",Times,serif' },
			{ label: 'Palatino', value: '"Palatino Linotype",Palatino,"Book Antiqua",serif' },
			{ label: 'Baskerville', value: 'Baskerville,"Libre Baskerville",Georgia,serif' },
			{ label: 'Garamond', value: 'Garamond,"EB Garamond",Georgia,serif' },
			{ label: 'Didot', value: 'Didot,"Bodoni MT",Georgia,serif' },
			{ label: 'Helvetica', value: '"Helvetica Neue",Helvetica,Arial,sans-serif' },
			{ label: 'Courier', value: '"Courier New",Courier,monospace' },
		],
	},
];

/** First human-readable family in a CSS font-family stack — labels a
 * hand-typed value that is not one of the curated options. */
export function firstFontName(stack: string): string {
	const quoted = /^"([^"]+)"/.exec(stack.trim());
	if (quoted?.[1]) return quoted[1];
	const bare = /^([^,]+)/.exec(stack.trim());
	return (bare?.[1] ?? stack).trim();
}
