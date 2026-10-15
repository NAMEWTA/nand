// scripts/verify-ui-styles.mjs
// 用法：node scripts/verify-ui-styles.mjs [--obsidian /opt/Obsidian] [--chrome google-chrome]
// 找不到 Chrome 或 Obsidian 时打印“跳过”并以 0 退出。
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith('--') ? [...acc, [cur.slice(2), all[i + 1]]] : acc), []));
const chrome = args.chrome ?? ['google-chrome', 'google-chrome-stable', 'chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(exists);
const obsidianDir = args.obsidian ?? ['/opt/Obsidian', '/Applications/Obsidian.app/Contents', path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Obsidian')].find((d) => fs.existsSync(path.join(d, 'resources', 'obsidian.asar')));
if (!chrome || !obsidianDir) { console.log('verify-ui-styles: 跳过（未找到 Chrome 或 Obsidian）'); process.exit(0); }

function exists(cmd) { try { execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }); return true; } catch { return fs.existsSync(cmd); } }

// 1) 从 asar 取出 app.css（asar = 8 字节 pickle 头 + JSON 文件表 + 数据）
function readAsarFile(asar, name) {
	const fd = fs.openSync(asar, 'r');
	const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0);
	const headerSize = head.readUInt32LE(12);
	const json = Buffer.alloc(headerSize); fs.readSync(fd, json, 0, headerSize, 16);
	const header = JSON.parse(json.toString());
	const entry = name.split('/').reduce((node, part) => node.files[part], header);
	const out = Buffer.alloc(entry.size);
	fs.readSync(fd, out, 0, entry.size, 8 + head.readUInt32LE(4) + Number(entry.offset));
	fs.closeSync(fd);
	return out.toString('utf8');
}
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nand-ui-styles-'));
fs.writeFileSync(path.join(work, 'obsidian-app.css'), readAsarFile(path.join(obsidianDir, 'resources', 'obsidian.asar'), 'app.css'));

// 2) 测试专用 Tailwind 构建（hover 不包媒体查询），再拼上令牌/基础/中和层
execFileSync(process.execPath, ['scripts/build-tailwind.mjs', '--test-hover', '--out', path.join(work, 'nand.css')], { stdio: 'inherit' });

// 3) 样例页面（类名取自 src/ui/components 的真实组件；可以用 react-dom/server 渲染组件生成）
//    关闭过渡：强制伪类后读到的是过渡起点的值，不关闭的话悬停检查会误判
const samples = fs.readFileSync('scripts/ui-style-samples.html', 'utf8');
for (const theme of ['theme-light', 'theme-dark']) {
	fs.writeFileSync(path.join(work, `${theme}.html`), `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="obsidian-app.css"><link rel="stylesheet" href="nand.css">
<style>* { transition: none !important; }</style></head>
<body class="${theme}">${samples}</body></html>`);
}

// 4) 启动 Chrome 并通过 DevTools 协议读取计算样式
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const waiting = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
for (let i = 0; i < 50 && !ws; i++) {
	try { const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); if (page) ws = new WebSocket(page.webSocketDebuggerUrl); } catch {}
	if (!ws) await sleep(200);
}
if (!ws) { proc.kill(); throw new Error('Chrome did not expose its debugging endpoint'); }
await new Promise((resolve, reject) => { if (ws.readyState === WebSocket.OPEN) resolve(); else { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); } });
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); } });
await send('Page.enable'); await send('DOM.enable'); await send('CSS.enable');

const expectations = JSON.parse(fs.readFileSync('scripts/ui-style-expectations.json', 'utf8'));
let failed = 0;
for (const theme of ['theme-light', 'theme-dark']) {
	await send('Page.navigate', { url: pathToFileURL(path.join(work, `${theme}.html`)).href }); await sleep(800);
	const { root } = await send('DOM.getDocument', { depth: -1 });
	for (const exp of expectations) {
		if (exp.themes && !exp.themes.includes(theme)) continue;
		const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: exp.selector });
		if (!nodeId) { failed++; console.error(`✗ ${theme} ${exp.name}: 样例里没有 ${exp.selector}`); continue; }
		await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: exp.state ?? [] });
		const { computedStyle } = await send('CSS.getComputedStyleForNode', { nodeId });
		const get = (name) => computedStyle.find((p) => p.name === name)?.value;
		for (const [prop, rule] of Object.entries(exp.expect)) {
			const value = get(prop);
			const ok = rule.equals !== undefined ? value === rule.equals : rule.not !== undefined ? value !== rule.not : true;
			if (!ok) { failed++; console.error(`✗ ${theme} ${exp.name} ${prop}: ${value}（期望 ${JSON.stringify(rule)}）`); }
		}
		await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
	}
}
ws.close();
// 等 Chrome 真正退出再删临时目录：kill() 立即返回，Chrome 退出时还会重新写入 profile/
const exited = new Promise((resolve) => proc.once('exit', resolve));
proc.kill();
await Promise.race([exited, sleep(5000)]);
fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 });
if (failed) { console.error(`verify-ui-styles: ${failed} 项不符合`); process.exit(1); }
console.log('verify-ui-styles: 全部通过');
