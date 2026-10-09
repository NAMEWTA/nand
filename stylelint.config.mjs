// CSS rules for NAND style sources (the design system). Colors belong to src/theme and the token
// layers; product CSS uses tokens. Pre-existing violations are tracked by scripts/lint-css.mjs.
export default {
	rules: {
		'declaration-no-important': true,
		'selector-pseudo-class-disallowed-list': ['has'],
		'color-no-hex': true,
		'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
		'declaration-property-value-allowed-list': { 'z-index': ['/^var\\(--nand-z-[a-z]+\\)$/', '0', '1', '-1', 'auto'] },
		'no-duplicate-selectors': true,
	},
	overrides: [
		{
			files: ['src/theme/**/*.css', 'src/ui/styles/000-foundation.css', 'src/modules/home/styles/004-root.css'],
			rules: { 'color-no-hex': null, 'function-disallowed-list': null },
		},
	],
};
