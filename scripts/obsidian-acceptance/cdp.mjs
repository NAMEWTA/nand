import { once } from 'node:events';

export async function connect(url = 'app://obsidian.md/index.html') {
	const targets = await (await fetch((process.env.NAND_CDP_URL || 'http://127.0.0.1:9237') + '/json')).json();
	const target = targets.find((t) => t.type === 'page' && t.url === url);
	if (!target) throw Error('No Obsidian page');
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await once(ws, 'open');
	let serial = 0;
	const pending = new Map();
	ws.addEventListener('message', (event) => {
		const m = JSON.parse(event.data);
		if (m.id) {
			const p = pending.get(m.id);
			if (p) {
				pending.delete(m.id);
				m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
			}
		}
	});
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++serial;
			pending.set(id, { resolve, reject });
			ws.send(JSON.stringify({ id, method, params }));
		});
	const evaluate = async (expression) => {
		const r = await send('Runtime.evaluate', {
			expression,
			awaitPromise: true,
			returnByValue: true,
			userGesture: true,
		});
		if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
		return r.result.value;
	};
	return { send, evaluate, close: () => ws.close() };
}
