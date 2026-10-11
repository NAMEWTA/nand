import { BrowserError } from '../model';
import { snapshotJson } from '../workspace/snapshot';
import type { BrowserWorkflowSpec, WorkflowCondition, WorkflowLocator, WorkflowScope, WorkflowValue, WorkflowVariable } from './model';

const fail = (detail?: string): never => { throw new BrowserError('browser_workflow_invalid', detail); };
const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const text = (value: unknown, max = 16_000): value is string => typeof value === 'string' && value.length <= max;
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const keys = (value: object, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
export const workflowMaterial = (spec: BrowserWorkflowSpec): string => snapshotJson({ title: spec.title, description: spec.description,
	variables: spec.variables, targetScope: spec.targetScope, steps: spec.steps, consequenceClass: spec.consequenceClass })!;
const namesIn = (value: string): string[] => [...value.matchAll(/\{\{([A-Za-z_][\w-]{0,63})\}\}/g)].map(match => match[1]!);
function template(value: unknown, variables: ReadonlySet<string>): value is string {
	return text(value) && namesIn(value).every(name => variables.has(name))
		&& !/\{\{|\}\}/.test(value.replace(/\{\{([A-Za-z_][\w-]{0,63})\}\}/g, ''));
}
function locator(value: WorkflowLocator, variables: ReadonlySet<string>): void {
	if (!value || !keys(value, ['role', 'name']) || !text(value.role, 100) || !/^[a-z][a-z\d -]*$/.test(value.role) || value.role.trim() !== value.role
		|| !template(value.name, variables) || !value.name.trim()) fail('element');
}
function condition(value: WorkflowCondition, variables: ReadonlySet<string>): void {
	if (!value || !['url', 'exists', 'value', 'text'].includes(value.kind)) fail('condition');
	if (value.kind === 'url') { if (!keys(value, ['kind', 'equals']) || !template(value.equals, variables)) fail('condition'); }
	else {
		if (!keys(value, value.kind === 'exists' ? ['kind', 'element'] : ['kind', 'element', 'equals'])) fail('condition');
		locator(value.element, variables);
		if (value.kind !== 'exists' && !template(value.equals, variables)) fail('condition');
	}
}
export function workflowScopeMatches(scope: WorkflowScope, profileId: string, value: string): boolean {
	try { const url = new URL(value); return !url.username && !url.password && url.origin === scope.origin && scope.profileId === profileId && url.pathname.startsWith(scope.pathPrefix); }
	catch { return false; }
}
export function validateWorkflow(value: unknown): BrowserWorkflowSpec {
	const spec = value as BrowserWorkflowSpec;
	if (!spec || !keys(spec, ['id', 'version', 'title', 'description', 'variables', 'targetScope', 'steps', 'consequenceClass', 'createdAt', 'updatedAt', 'verification'])
		|| !id(spec.id) || !Number.isSafeInteger(spec.version) || spec.version < 1 || !text(spec.title, 200) || !spec.title.trim() || !text(spec.description)
		|| !time(spec.createdAt) || !time(spec.updatedAt) || !Array.isArray(spec.variables) || spec.variables.length > 16
		|| !Array.isArray(spec.targetScope) || !spec.targetScope.length || spec.targetScope.length > 8
		|| !Array.isArray(spec.steps) || !spec.steps.length || spec.steps.length > 30
		|| !['read-only', 'page-input', 'submission'].includes(spec.consequenceClass)) fail();
	for (const variable of spec.variables) {
		if (!variable || !keys(variable, ['name', 'type', 'required', 'default']) || typeof variable.name !== 'string' || !/^[A-Za-z_][\w-]{0,63}$/.test(variable.name)
			|| ['__proto__', 'constructor', 'prototype'].includes(variable.name)
			|| !['text', 'number', 'boolean', 'secret'].includes(variable.type) || typeof variable.required !== 'boolean'
			|| (variable.default !== undefined && (variable.type === 'secret' || !validValue(variable, variable.default)))) fail('variable');
	}
	const variables = new Set(spec.variables.map(variable => variable.name));
	if (variables.size !== spec.variables.length) fail('variable');
	for (const scope of spec.targetScope) {
		if (!scope || !keys(scope, ['id', 'profileId', 'origin', 'pathPrefix']) || !id(scope.id) || !id(scope.profileId)
			|| !text(scope.origin, 500) || !text(scope.pathPrefix, 500) || !/^\/[^?#\\\s]*$/.test(scope.pathPrefix)) fail('scope');
		try { const url = new URL(scope.origin), path = new URL(scope.pathPrefix, url);
			if (!['http:', 'https:'].includes(url.protocol) || url.origin !== scope.origin || path.origin !== url.origin || path.pathname !== scope.pathPrefix) fail('scope');
		} catch { fail('scope'); }
	}
	if (!unique(spec.targetScope.map(scope => scope.id)) || !unique(spec.steps.map(step => step?.id))) fail();
	for (const step of spec.steps) {
		if (!step || !keys(step, ['id', 'target', 'operation', 'args', 'precondition', 'postcondition']) || !id(step.id)
			|| !spec.targetScope.some(scope => scope.id === step.target) || !step.args || typeof step.args !== 'object'
			|| !Array.isArray(step.precondition) || !step.precondition.length || step.precondition.length > 8
			|| !Array.isArray(step.postcondition) || !step.postcondition.length || step.postcondition.length > 8) fail(step?.id);
		for (const test of [...step.precondition, ...step.postcondition]) condition(test, variables);
		switch (step.operation) {
			case 'observe': if (Object.keys(step.args).length) fail(step.id); break;
			case 'navigate': if (!keys(step.args, ['url']) || !template(step.args.url, variables)) fail(step.id); break;
			case 'read': case 'click': if (!keys(step.args, ['element'])) fail(step.id); locator(step.args.element, variables); break;
			case 'keypress': if (!keys(step.args, ['element', 'key']) || !text(step.args.key, 100) || !step.args.key.trim()) fail(step.id); locator(step.args.element, variables); break;
			case 'fill': {
				if (!keys(step.args, ['element', 'value']) || !template(step.args.value, variables)) fail(step.id);
				locator(step.args.element, variables);
				const same = (test: WorkflowCondition) => test.kind === 'value' && snapshotJson(test.element) === snapshotJson(step.args.element);
				if (step.precondition.filter(same).length !== 1 || !step.postcondition.some(test => same(test) && 'equals' in test && test.equals === step.args.value)) fail(step.id);
				break;
			}
			default: fail('operation');
		}
	}
	const consequence = spec.steps.some(step => step.operation === 'click' || step.operation === 'keypress') ? 'submission'
		: spec.steps.some(step => step.operation === 'fill' || step.operation === 'navigate') ? 'page-input' : 'read-only';
	if (spec.consequenceClass !== consequence) fail('consequence');
	const proof = spec.verification;
	if (proof && (!keys(proof, ['runId', 'version', 'at', 'material']) || !id(proof.runId) || proof.version !== spec.version || !time(proof.at) || proof.material !== workflowMaterial(spec))) fail('verification');
	return spec;
}
function validValue(variable: WorkflowVariable, value: unknown): value is WorkflowValue {
	return variable.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : variable.type === 'boolean' ? typeof value === 'boolean' : text(value);
}
export function validateWorkflowPublicInputs(spec: BrowserWorkflowSpec, supplied: unknown): asserts supplied is Record<string, WorkflowValue> {
	if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return fail('variable');
	for (const [name, value] of Object.entries(supplied)) {
		const variable = spec.variables.find(row => row.name === name);
		if (!variable || variable.type === 'secret' || !validValue(variable, value)) fail('variable');
	}
}
export function workflowInputs(spec: BrowserWorkflowSpec, supplied: Record<string, unknown>): { values: Record<string, WorkflowValue>; publicInputs: Record<string, WorkflowValue>; secretNames: string[] } {
	validateWorkflow(spec);
	if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).some(name => !spec.variables.some(variable => variable.name === name))) fail('variable');
	const values: Record<string, WorkflowValue> = {}, publicInputs: Record<string, WorkflowValue> = {}, secretNames = spec.variables.filter(variable => variable.type === 'secret').map(variable => variable.name);
	for (const variable of spec.variables) {
		const value = Object.hasOwn(supplied, variable.name) ? supplied[variable.name] : variable.default;
		if (value === undefined || value === '') { if (variable.required) fail(variable.name); }
		if (value === undefined) continue;
		if (!validValue(variable, value)) return fail(variable.name);
		values[variable.name] = value;
		if (variable.type !== 'secret') publicInputs[variable.name] = value;
	}
	return { values, publicInputs, secretNames };
}
/** One pass only. Braces supplied as a value stay literal and cannot expand another variable. */
export function interpolateWorkflow(value: string, inputs: Readonly<Record<string, WorkflowValue>>): string {
	return value.replace(/\{\{([A-Za-z_][\w-]{0,63})\}\}/g, (_match, name: string) => {
		if (!Object.hasOwn(inputs, name)) fail(name); return String(inputs[name]);
	});
}
