import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { BrowserWorkflowSpec } from './model';
import { interpolateWorkflow, validateWorkflow, workflowInputs, workflowMaterial, workflowScopeMatches } from './validate';

const spec = (): BrowserWorkflowSpec => ({ id: 'flow', version: 1, title: 'Fill a reviewed form', description: '', createdAt: 1, updatedAt: 1,
	variables: [{ name: 'message', type: 'text', required: true }, { name: 'private', type: 'secret', required: false }],
	targetScope: [{ id: 'form', profileId: 'default', origin: 'https://example.test', pathPrefix: '/form/' }], consequenceClass: 'page-input',
	steps: [{ id: 'fill', target: 'form', operation: 'fill', args: { element: { role: 'textbox', name: 'Message' }, value: '{{message}}' },
		precondition: [{ kind: 'value', element: { role: 'textbox', name: 'Message' }, equals: '' }],
		postcondition: [{ kind: 'value', element: { role: 'textbox', name: 'Message' }, equals: '{{message}}' }] }] });
test('workflow variables interpolate once; secret inputs and absent optional values never enter persisted public inputs', () => {
	const flow = spec(); flow.variables.push({ name: 'count', type: 'number', required: false }); validateWorkflow(flow);
	const inputs = workflowInputs(flow, { message: '{{private}}', private: 'runtime-only' });
	assert.equal(interpolateWorkflow('{{message}}', inputs.values), '{{private}}');
	assert.deepEqual(inputs.publicInputs, { message: '{{private}}' }); assert.deepEqual(inputs.secretNames, ['private']); assert.equal('count' in inputs.values, false);
	assert.throws(() => workflowInputs(flow, {}), { code: 'browser_workflow_invalid' });
	assert.throws(() => workflowInputs(flow, { message: 'ok', count: '3' }), { code: 'browser_workflow_invalid' });
	assert.throws(() => workflowInputs(flow, { message: 'ok', unlisted: true }), { code: 'browser_workflow_invalid' });
	assert.throws(() => interpolateWorkflow('{{missing}}', inputs.values), { code: 'browser_workflow_invalid' });
});
test('workflow definitions reject script operations, missing draft safeguards, hidden consequences and secret defaults', () => {
	const cases: unknown[] = [
		{ ...spec(), variables: [{ name: 'private', type: 'secret', required: true, default: 'must-not-persist' }] },
		{ ...spec(), steps: [{ ...spec().steps[0], operation: 'eval', args: { script: 'alert(1)' } }] },
		{ ...spec(), steps: [{ ...spec().steps[0], precondition: [{ kind: 'url', equals: 'https://example.test/form/' }] }] },
		{ ...spec(), consequenceClass: 'read-only' },
		{ ...spec(), steps: [{ ...spec().steps[0], args: { element: { role: 'textbox', name: 'Message' }, value: '{{undeclared}}' } }] },
		{ ...spec(), variables: [{ name: '__proto__', type: 'text', required: false }] },
	];
	for (const value of cases) assert.throws(() => validateWorkflow(value), { code: 'browser_workflow_invalid' });
	const flow = spec(); flow.verification = { runId: 'run', version: 1, at: 2, material: workflowMaterial(flow) }; validateWorkflow(flow);
	flow.steps[0]!.target = 'another-page'; assert.throws(() => validateWorkflow(flow), { code: 'browser_workflow_invalid' });
});
test('workflow targets bind exact origin/account and explicit normalized path prefixes', () => {
	const scope = spec().targetScope[0]!;
	assert.equal(workflowScopeMatches(scope, 'default', 'https://example.test/form/order'), true);
	for (const url of ['https://example.test.evil/form/order', 'https://user:secret@example.test/form/order', 'https://example.test/admin/'])
		assert.equal(workflowScopeMatches(scope, 'default', url), false);
	assert.equal(workflowScopeMatches(scope, 'another-account', 'https://example.test/form/order'), false);
	for (const pathPrefix of ['//evil/', '/form/../', '/form/?token=', '/form/\\admin']) assert.throws(() => validateWorkflow({ ...spec(), targetScope: [{ ...scope, pathPrefix }] }), { code: 'browser_workflow_invalid' });
});
