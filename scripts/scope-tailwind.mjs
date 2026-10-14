// scripts/scope-tailwind.mjs —— PostCSS 插件
// 1) 展开 @layer（分层规则会输给 Obsidian 未分层的 app.css）
// 2) 顶层选择器加作用域并提升特异性：`.x` -> `.x:is(.nand-ui, .nand-ui *):not(#\#)`，特异性 (1,2,0)
// 3) `:root, :host` -> `.nand-ui`
import postcss from 'postcss';

const ROOT = '.nand-ui';
const SCOPE = `:is(${ROOT}, ${ROOT} *):not(#\\#)`;

function scopeSelector(selector) {
	const s = selector.trim();
	if (s === ':root' || s === ':host') return ROOT;
	if (s === '*') return SCOPE;
	if (s.startsWith('::')) return `${SCOPE}${s}`;          // ::before / ::backdrop
	// Tailwind's optimizer emits legacy :before/:after as well as ::before.
	// Escaped colons inside class names are not pseudo-elements.
	const pe = s.search(/(?<!\\)(?:::[\w-]+|:(?:before|after|first-letter|first-line)\b)/);                               // 伪元素必须在最后
	if (pe >= 0) return `${s.slice(0, pe)}${SCOPE}${s.slice(pe)}`;
	return `${s}${SCOPE}`;
}

function hasRuleAncestor(node) {
	for (let p = node.parent; p; p = p.parent) if (p.type === 'rule') return true;
	return false;
}

export const scopeTailwind = () => ({
	postcssPlugin: 'nand-scope-tailwind',
	Once(root) {
		let found = true;
		while (found) {
			found = false;
			root.walkAtRules('layer', (at) => {
				found = true;
				if (at.nodes?.length) at.replaceWith(at.nodes); else at.remove();
			});
		}
		root.walkRules((rule) => {
			if (hasRuleAncestor(rule)) return;                          // 嵌套规则随父级
			if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
			rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
		});
	},
});
scopeTailwind.postcss = true;
