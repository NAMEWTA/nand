// Test helper for the notes navigator: registers the real Moment package (the one Obsidian ships).
// Tests only: registers the real Moment package (the one Obsidian ships) with the formatting module.
import { createRequire } from 'node:module';
import { registerMoment, type MomentApi } from '../src/modules/navigator/core/moment-format';

const require = createRequire(createRequire(import.meta.url).resolve('obsidian/package.json'));
const real = require('moment') as MomentApi & { locale(name: string): string };
real.locale('en');
registerMoment(real);
export const testMoment = real;
