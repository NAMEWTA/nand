import esbuild from "esbuild";
import process from "process";
import { pluginBuildOptions } from './scripts/esbuild-options.mjs';

const prod = (process.argv[2] === "production");

const context = await esbuild.context(pluginBuildOptions({ production: prod }));

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
