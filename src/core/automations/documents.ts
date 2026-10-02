import {
	collectionDocument as doc,
	documentName,
	type DocumentCollectionCodec,
} from '../../shared/storage/document-collection';
import { isDefinition } from '../../shared/automation/metadata';
import type { AutomationAction, AutomationDefinition } from '../../shared/automation/types';
import { actionDescriptors } from '../actions/executor';
import { actionText, setActionText, switchAutomationAction } from './switch-action';

export interface AutomationDefinitionsRepository {
	list(): Promise<AutomationDefinition[]>;
	save(definition: AutomationDefinition): Promise<void>;
	remove(definition: AutomationDefinition): Promise<void>;
}
export interface DefinitionCollection {
	definitions: AutomationDefinition[];
}
const root = 'NAND/自动化';
export const automationDocuments: DocumentCollectionCodec<DefinitionCollection> = {
	root,
	managedProperties: [
		'id',
		'name',
		'enabled',
		'deviceId',
		'revision',
		'graceMinutes',
		'channels',
		'notifyOn',
		'createdAt',
		'updatedAt',
		'action',
		'schedule',
		'agentId',
		'cwd',
		'shell',
		'sessionMode',
		'session',
		'cardId',
		'path',
		'command',
		'url',
		'at',
		'repeat',
		'start',
		'timezone',
	],
	empty: () => ({ definitions: [] }),
	encode: ({ definitions }) =>
		definitions.map((definition) => {
			const { action, schedule, source: _source, ...metadata } = definition;
			const { kind: _kind, ...parameters } = action;
			for (const key of ['prompt', 'body', 'text', 'script']) delete (parameters as Record<string, unknown>)[key];
			const document = doc(
				definition.id,
				`${root}/${documentName(definition.name)}-${definition.id.slice(-8)}/操作.md`,
				'automation',
				{
					...metadata,
					action: action.kind,
					...parameters,
					schedule: schedule.kind,
					...(schedule.kind === 'once' ? { at: new Date(schedule.at).toISOString() } : {}),
					...(schedule.kind === 'recurring'
						? {
								repeat: schedule.expression,
								start: new Date(schedule.start).toISOString(),
								timezone: schedule.timezone ?? 'America/New_York',
							}
						: {}),
				},
			);
			document.sections = { [action.kind === 'script' ? 'script' : 'prompt']: actionText(action) };
			return document;
		}),
	decode: (documents) => ({
		definitions: documents
			.filter((d) => d.properties['nand-type'] === 'automation')
			.map((document) => {
				const p = document.properties;
				const kind = p.action as AutomationAction['kind'];
				if (!actionDescriptors.some((descriptor) => descriptor.kind === kind))
					throw new Error(`Invalid action: ${document.path}`);
				const action = switchAutomationAction({ kind: 'notify', body: '' }, kind, {
					agentId: typeof p.agentId === 'string' ? p.agentId : '',
					cwd: typeof p.cwd === 'string' ? p.cwd : '.',
				});
				Object.assign(
					action,
					...['shell', 'sessionMode', 'session', 'cardId', 'path', 'command', 'url']
						.filter((key) => p[key] !== undefined)
						.map((key) => ({ [key]: p[key] })),
				);
				setActionText(action, document.sections?.[kind === 'script' ? 'script' : 'prompt'] ?? '');
				const definition = {
					name: p.name,
					enabled: p.enabled,
					deviceId: p.deviceId,
					revision: p.revision,
					graceMinutes: p.graceMinutes,
					channels: p.channels,
					notifyOn: p.notifyOn,
					createdAt: p.createdAt,
					updatedAt: p.updatedAt,
					id: document.id,
					action,
					schedule:
						p.schedule === 'manual'
							? { kind: 'manual' }
							: p.schedule === 'once'
								? { kind: 'once', at: Date.parse(String(p.at)) }
								: {
										kind: 'recurring',
										expression: p.repeat,
										start: Date.parse(String(p.start)),
										timezone: p.timezone,
									},
				};
				if (!isDefinition(definition)) throw new Error(`Invalid automation: ${document.path}`);
				return definition;
			}),
	}),
};
