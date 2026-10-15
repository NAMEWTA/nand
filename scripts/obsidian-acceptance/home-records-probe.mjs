// Shared by the workbench acceptance and focused Home native regression runs.
import assert from 'node:assert/strict';
export async function probeHomeRecords({ call, until, shot, escape }) {
	const dialogs = {};
	for (const [name, labels, css] of [
		['habit', ['Habit Stats', '打卡统计'], '.dashboard-habit-stats-modal'],
		['expense', ['Expense Statistics', '记账统计'], '.dashboard-expense-stats-modal'],
		['pomodoro', ['Focus Statistics', '专注统计'], '.dashboard-pomodoro-stats-modal'],
		['reading', ['Reading Statistics', '阅读统计'], '.dashboard-pomodoro-stats-modal'],
	]) {
		const trigger = `([...document.querySelectorAll('button[aria-label]')].find(el=>${JSON.stringify(labels)}.includes(el.getAttribute('aria-label'))&&el.getClientRects().length))`;
		await until(`!!${trigger}`, name + ' statistics trigger');
		await call(`(()=>{window.nandStatsTrigger=${trigger};nandStatsTrigger.scrollIntoView({block:'center'});nandStatsTrigger.focus();nandStatsTrigger.click()})()`);
		const state = await until(`(()=>{const el=document.querySelector(${JSON.stringify(css + '[role="dialog"]')});return el&&el.contains(document.activeElement)&&{portal:!!el.closest('.nand-portal-root'),focus:el.contains(document.activeElement),document:el.ownerDocument===document,recordsPage:!!document.querySelector('.nand-records-page-body')}})()`, name + ' statistics dialog');
		assert.deepEqual(state, { portal: true, focus: true, document: true, recordsPage: false });
		await shot('home-statistics-' + name);
		// Focus the dialog itself so Escape exercises this layer, not a focused icon's tooltip.
		await call(`document.querySelector(${JSON.stringify(css + '[role="dialog"]')}).focus()`);
		await until(`!document.querySelector('[role="tooltip"]')`, name + ' tooltip dismissed before testing the dialog layer');
		await escape();
		await until(`!document.querySelector(${JSON.stringify(css + '[role="dialog"]')})`, name + ' Escape dismisses');
		await until(`document.activeElement===window.nandStatsTrigger`, name + ' focus restored');
		// Reopen, then exercise the explicit close control as well.
		await call('window.nandStatsTrigger.click()');
		await until(`!!document.querySelector(${JSON.stringify(css + '[role="dialog"]')})`, name + ' reopens');
		await call(`(()=>{const el=document.querySelector(${JSON.stringify(css + '[role="dialog"]')});const close=[...el.querySelectorAll('button')].find(button=>['Close','关闭'].includes(button.getAttribute('aria-label')));if(!close)throw Error('Missing close button');close.click()})()`);
		await until(`!document.querySelector(${JSON.stringify(css + '[role="dialog"]')})`, name + ' close dismisses');
		dialogs[name] = { ...state, escape: true, restoredFocus: true, close: true };
	}
	const records = await call(`({route:app.workspace.getLeavesOfType('nand-workbench-view').some(leaf=>leaf.view.getState().target?.feature==='records'),entry:!!document.querySelector('[data-feature="records"],.nand-records-page-body')})`);
	assert.deepEqual(records, { route: false, entry: false });
	return { dialogs, records };
}
