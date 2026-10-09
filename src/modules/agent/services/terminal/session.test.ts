import assert from 'node:assert/strict';
import { test } from 'vitest';
import { oscColor, TerminalSession, type SessionEvent } from './session';
import { hookActivity } from './sessions';

const ESC = '\x1b';
const encoder = new TextEncoder();

function fixture(over: Partial<ConstructorParameters<typeof TerminalSession>[0]> = {}) {
	const sent: string[] = [];
	const acks: number[] = [];
	const session = new TerminalSession({
		id: 'terminal-test',
		sid: 7,
		kind: 'shell',
		title: 'Shell',
		cwd: '/vault',
		cols: 80,
		rows: 24,
		scrollback: 1000,
		platform: 'linux',
		colors: () => ({ foreground: '#d4d4d4', background: '#1e1e1e', cursor: '#ffffff' }),
		...over,
	});
	session.attach({
		input: (_sid, data) => sent.push(typeof data === 'string' ? data : new TextDecoder().decode(data)),
		resize: () => {},
		acknowledge: (_sid, bytes) => acks.push(bytes),
		end: () => {},
	}, 1234);
	/** Feed output and wait until the model parsed it. */
	const feed = (text: string) => new Promise<void>((resolve) => {
		session.receive(encoder.encode(text));
		session.subscribe(() => {})();
		setTimeout(resolve, 20);
	});
	return { session, sent, acks, feed };
}

test('the model answers device queries, color queries and size reports exactly once', async () => {
	const { sent, feed } = fixture();
	await feed(`${ESC}[c${ESC}[6n${ESC}]11;?\x07${ESC}[18t`);
	assert.ok(sent.includes(`${ESC}[?1;2c`), JSON.stringify(sent));
	assert.ok(sent.includes(`${ESC}[1;1R`));
	assert.ok(sent.includes(`${ESC}]11;rgb:1e1e/1e1e/1e1e${ESC}\\`));
	assert.ok(sent.includes(`${ESC}[8;24;80t`));
	assert.equal(sent.filter((reply) => reply === `${ESC}[1;1R`).length, 1);
});

test('kitty flags and win32-input-mode follow the application', async () => {
	const { session, sent, feed } = fixture();
	await feed(`${ESC}[>1u${ESC}[?u`);
	assert.equal(session.keyboard.kitty, 1);
	assert.ok(sent.includes(`${ESC}[?1u`));
	await feed(`${ESC}[?1049h`);
	assert.equal(session.keyboard.kitty, 0, 'the alternate screen has its own stack');
	await feed(`${ESC}[?1049l${ESC}[<u`);
	assert.equal(session.keyboard.kitty, 0);
	await feed(`${ESC}[?9001h`);
	assert.equal(session.keyboard.win32, true);
	await feed(`${ESC}[?9001l`);
	assert.equal(session.keyboard.win32, false);
});

test('bracketed paste decides input readiness; paste is sanitized', async () => {
	const { session, sent, feed } = fixture();
	assert.equal(session.inputReady(), false);
	await feed(`${ESC}[?2004h`);
	assert.equal(session.inputReady(), true);
	session.paste('a\x1b[31mb\r\n');
	assert.equal(sent.at(-1), `${ESC}[200~a[31mb\r${ESC}[201~`);
});

test('shell integration marks give prompts, failures and the working directory', async () => {
	const { session, feed } = fixture();
	await feed(`${ESC}]133;A\x07$ false\r\n${ESC}]133;D;1\x07${ESC}]7;file://host/tmp/a%20b\x07\r\n${ESC}]133;A\x07$ `);
	const prompts = session.prompts();
	assert.equal(prompts.lines.length, 2);
	assert.equal(prompts.lastFailed(), prompts.lines[0]);
	assert.equal(session.cwd, '/tmp/a b');
	await feed(`${ESC}]633;P;Cwd=/srv/x\x07`);
	assert.equal(session.cwd, '/srv/x');
});

test('subscribers get one snapshot then live output, with nothing lost or repeated', async () => {
	const { session, acks, feed } = fixture();
	await feed('before ');
	const seen: string[] = [];
	const off = session.subscribe((text) => seen.push(text));
	session.receive(encoder.encode('after'));
	await new Promise((resolve) => setTimeout(resolve, 20));
	off();
	assert.equal(seen.length, 2);
	assert.ok(seen[0]!.includes('before') && !seen[0]!.includes('after'), JSON.stringify(seen));
	assert.equal(seen[1], 'after');
	assert.ok(acks.reduce((sum, value) => sum + value, 0) >= 'before after'.length);
});

test('exit reaches observers after the output and the title follows OSC 2 unless renamed', async () => {
	const { session, feed } = fixture({ agentId: 'codex', kind: 'agent' });
	const events: SessionEvent[] = [];
	session.observe((event) => events.push(event));
	await feed(`${ESC}]2;Working title\x07done`);
	assert.equal(session.title, 'Working title');
	session.rename('Mine');
	await feed(`${ESC}]2;Other\x07`);
	assert.equal(session.title, 'Mine');
	session.exit(3, null);
	assert.equal(events.at(-1)?.kind, 'exit');
	assert.equal(session.connection, 'exited');
	assert.equal(session.exitCode, 3);
	assert.ok(events.some((event) => event.kind === 'data' && event.text.includes('done')));
});

test('helpers: OSC color format and native lifecycle activity', () => {
	assert.equal(oscColor('#abc'), 'rgb:aaaa/bbbb/cccc');
	assert.equal(oscColor('#102030'), 'rgb:1010/2020/3030');
	assert.equal(oscColor('blue'), undefined);
	assert.equal(hookActivity('UserPromptSubmit'), 'running');
	assert.equal(hookActivity('Notification'), 'waiting');
	assert.equal(hookActivity('Stop'), 'idle');
	assert.equal(hookActivity('Whatever'), undefined);
});
