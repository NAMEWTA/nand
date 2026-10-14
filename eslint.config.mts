import fs from 'node:fs';
import path from 'node:path';
import reactHooks from 'eslint-plugin-react-hooks';
import noObsidianThenable from './scripts/no-obsidian-thenable.mjs';
import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

// React Compiler diagnostics do not understand Preact hooks. Apply the full recommended
// rules to React files; legacy files opt out only while their explicit Preact pragma remains.
function legacyTsx(directory: string): string[] {
 return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? legacyTsx(file) : file.endsWith('.tsx') && fs.readFileSync(file, 'utf8').startsWith('/** @jsxImportSource preact */') ? [file.replaceAll(path.sep, '/')] : [];
 });
}
const preactFiles = legacyTsx('src');

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				activeDocument: 'readonly',
				activeWindow: 'readonly',
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{ files: ['src/**/*.tsx'], ignores: preactFiles, plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules } },
	{ plugins: { nand: { rules: { "no-obsidian-thenable": noObsidianThenable } } }, rules: { "nand/no-obsidian-thenable": "error" } },
	// keyCode 229 is the WebKit IME fallback after compositionend, before Enter keydown.
	{ files: ['src/ui/react/ime.ts'], rules: { '@typescript-eslint/no-deprecated': 'off' } },
	// TypeScript resolves identifiers itself; core `no-undef` misreads type-only globals such as `NodeJS`.
	{ files: ["**/*.ts", "**/*.tsx"], rules: { "no-undef": "off" } },
	// Desktop folders are the only place Node and Electron are allowed (architecture rule R5, enforced by
	// scripts/verify-architecture.mjs); they are reached only on desktop.
	{ files: ["src/**/desktop/**/*.ts"], languageOptions: { globals: globals.node }, rules: { "obsidianmd/no-nodejs-modules": "off" } },
	// This guest shim intercepts legacy copy/cut to block OS clipboard writes and restores the original method.
	// It does not use execCommand to acquire content; modern Clipboard methods supply the bounded payload.
	{ files: ["src/modules/browser/platform/desktop/provider-copy.ts"], rules: { "@typescript-eslint/no-deprecated": "off" } },
	{
		files: ["src/**/*.ts", "src/**/*.tsx"],
		ignores: ["src/**/desktop/**"],
		rules: {
			"no-restricted-globals": [
				"error",
				{ name: "app", message: "Avoid using the global app object. Instead use the reference provided by your plugin instance." },
				{ name: "fetch", message: "Use the built-in `requestUrl` function instead of `fetch` for network requests in Obsidian." },
				{ name: "localStorage", message: "Prefer `App#saveLocalStorage` / `App#loadLocalStorage` functions to write / read localStorage data that's unique to a vault." },
				...["process", "Buffer", "__dirname", "__filename", "global"].map((name) => ({ name, message: "Node globals belong in a desktop folder (architecture rule R5)." })),
			],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"build",
		"esbuild.config.mjs",
		"eslint.config.js",
		"eslint.config.mts",
		"vitest.config.ts",
		"stylelint.config.mjs",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"scripts/**",
		"**/*.test.ts",
		"**/*.test.tsx",
		"test/**",
		"speculo/**",
	]),
);
