import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { HOOK_SCRIPT } from './automation-hooks';
import { MAX_ANSWER_BYTES, MAX_HOOK_INPUT_BYTES } from './event-payload';

async function invoke(input: unknown) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-answer-hook-'));
	try {
		const script = path.join(directory, 'hook.cjs');
		await fs.writeFile(script, HOOK_SCRIPT);
		const child = spawn(process.execPath, [script, 'Stop'], { windowsHide: true, env: { ...process.env, NAND_HOOK_DIR: directory, NAND_HOOK_TOKEN: 'test-token' } });
		let output = '';
		child.stdout.on('data', chunk => { output += String(chunk); });
		const exited = new Promise<void>((resolve, reject) => {
			child.once('error', reject);
			child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Hook exit ${code}`)));
		});
		child.stdin.end(JSON.stringify(input));
		await exited;
		assert.equal(output, '{}');
		const files = (await fs.readdir(directory)).filter(file => file.endsWith('.json'));
		assert.equal(files.length, 1, 'completion metadata survives oversized input');
		return JSON.parse(await fs.readFile(path.join(directory, files[0]!), 'utf8')) as { event: string; data: Record<string, string> };
	} finally { await fs.rm(directory, { recursive: true, force: true }); }
}

test('native hook returns the entire Chinese JSON answer without spooling the prompt or tool input', async () => {
	const answer = JSON.stringify(Array.from({ length: 2400 }, (_, id) => ({ id, reason: '完整结果，来源明确。' })));
	assert.ok(Buffer.byteLength(answer) > 100_000);
	const event = await invoke({ session_id: 'root', last_assistant_message: answer, prompt: 'private prompt', tool_input: { secret: 'never spool' } });
	assert.equal(event.event, 'Stop');
	assert.deepEqual(event.data, { session_id: 'root', last_assistant_message: answer });
});

test('oversize answers and hook input produce explicit errors instead of losing completion', async () => {
	const answer = await invoke({ session_id: 'root', last_assistant_message: '中'.repeat(Math.ceil(MAX_ANSWER_BYTES / 3) + 1) });
	assert.equal(answer.event, 'Stop');
	assert.equal(answer.data.nand_answer_error, 'answerTooLarge');
	assert.equal(answer.data.last_assistant_message, undefined);
	const input = await invoke({ prompt: 'x'.repeat(MAX_HOOK_INPUT_BYTES + 1) });
	assert.equal(input.event, 'HookError');
	assert.equal(input.data.nand_answer_error, 'hookInputTooLarge');
});
