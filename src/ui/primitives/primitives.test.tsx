import assert from 'node:assert/strict';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { test } from 'vitest';
import { flush, installDom, key } from '../../../test/dom';
import { ListItem } from './ListItem';
import { SearchField } from './SearchField';
import { Tabs } from './Tabs';

const { document } = installDom();

test('tabs move selection and focus with the arrow keys and wrap around', async () => {
	const root = document.createElement('div');
	document.body.append(root);
	const selected: string[] = [];
	function Harness() {
		const [id, setId] = useState('a');
		return <Tabs label="Kinds" items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} selected={id} onSelect={(next) => { selected.push(next); setId(next); }} />;
	}
	render(<Harness />, root);
	const tabs = () => [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
	assert.deepEqual(tabs().map((tab) => tab.getAttribute('aria-selected')), ['true', 'false', 'false']);
	key(tabs()[0]!, 'ArrowLeft');
	await flush();
	assert.deepEqual(selected, ['c']);
	assert.equal(tabs()[2]!.getAttribute('aria-selected'), 'true');
	key(tabs()[2]!, 'Home');
	await flush();
	assert.deepEqual(selected, ['c', 'a']);
	render(null, root);
});

test('list items select with Enter and Space but not from nested actions', () => {
	const root = document.createElement('div');
	document.body.append(root);
	let selected = 0;
	render(<ListItem label="Session" active onSelect={() => selected++} actions={<button type="button" class="inner">x</button>} />, root);
	const row = root.querySelector('.nand-list-item')!;
	assert.equal(row.getAttribute('aria-selected'), 'true');
	key(row, 'Enter');
	key(row, ' ');
	key(root.querySelector('.inner')!, 'Enter');
	assert.equal(selected, 2);
	render(null, root);
});

test('search fields clear on Escape before passing other keys on', () => {
	const root = document.createElement('div');
	document.body.append(root);
	const values: string[] = [];
	const keys: string[] = [];
	render(<SearchField value="abc" placeholder="Find" onInput={(value) => values.push(value)} onKeyDown={(event) => keys.push(event.key)} />, root);
	const input = root.querySelector('input')!;
	key(input, 'Escape');
	key(input, 'ArrowDown');
	assert.deepEqual(values, ['']);
	assert.deepEqual(keys, ['ArrowDown']);
	render(null, root);
});
