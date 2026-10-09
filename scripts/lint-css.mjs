// Stylelint with a shrink-only baseline: files listed in scripts/stylelint-baseline.json may keep the
// listed rule violations until their module migrates. A new file/rule violation fails, and so does a
// baseline entry that no longer occurs (run with --update-baseline to remove it).
import fs from 'node:fs';
import path from 'node:path';
import stylelint from 'stylelint';

const root = path.resolve(import.meta.dirname, '..');
const baselinePath = path.join(root, 'scripts/stylelint-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const { results } = await stylelint.lint({ files: 'src/**/*.css', cwd: root, configFile: path.join(root, 'stylelint.config.mjs') });

const current = {};
const added = [];
for (const result of results) {
	const file = path.relative(root, result.source).replaceAll(path.sep, '/');
	const rules = [...new Set(result.warnings.map((warning) => warning.rule))].sort();
	if (rules.length) current[file] = rules;
	for (const warning of result.warnings) {
		if (!baseline[file]?.includes(warning.rule)) added.push(`${file}:${warning.line}:${warning.column} ${warning.text}`);
	}
}
const stale = Object.entries(baseline).flatMap(([file, rules]) => rules.filter((rule) => !current[file]?.includes(rule)).map((rule) => `${file} ${rule}`));

if (process.argv.includes('--update-baseline')) {
	if (added.length) {
		console.error(`Refusing to baseline ${added.length} new violations:\n${added.join('\n')}`);
		process.exit(1);
	}
	fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, '\t')}\n`);
	console.log(`stylelint baseline: ${Object.keys(current).length} files`);
} else if (added.length || stale.length) {
	if (added.length) console.error(`New CSS violations:\n${added.join('\n')}`);
	if (stale.length) console.error(`Fixed violations still in the baseline (run with --update-baseline):\n${stale.join('\n')}`);
	process.exitCode = 1;
} else {
	const count = Object.values(current).reduce((sum, rules) => sum + rules.length, 0);
	console.log(`stylelint: ${results.length} files; ${Object.keys(current).length} files keep ${count} baselined rule groups; no new violations.`);
}
