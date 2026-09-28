import assert from 'node:assert/strict';
import fs from 'node:fs';
const evidence=JSON.parse(fs.readFileSync(new URL('./command-red.json',import.meta.url),'utf8'));
assert.equal(evidence.unchanged,0,'All nine affected native commands must change language without restarting');
