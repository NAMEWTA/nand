import { bindLocalizedOptions } from '../../../ui/primitives/localized-dom';
import { bindLocalizedControl } from '../../../ui/primitives/localized-dom';
import { actionDescriptors } from '../core/actions/executor';
import { Notice, Platform, Setting, type App } from 'obsidian';
import type { AutomationEditRequest, AutomationsApi } from '../core/api';
import { systemTimeZone, validateSchedule } from '../core/schedule';
import { actionText, setActionText, switchAutomationAction } from '../core/switch-action';
import type { AutomationAction, AutomationDefinition } from '../../../shared/automation/types';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { repaintLocalizedForm } from '../../../ui/primitives/localized-form';
import { AutomationSessionPicker } from './session-picker';

export type TaskTarget = { path: string; cardId: string; title: string };
export type { AutomationEditRequest };

/** The automation form, rendered inline in the automations page; `done` returns to the list. */
export class AutomationEditorForm {
	private languageCleanup?: () => void;
	private draft: AutomationDefinition;
	private saving = false;
	private generation = 0;
	private originalSchedule: string;
	private runImmediately = false;
	private readonly editing: boolean;
	constructor(
		private readonly app: App,
		private readonly contentEl: HTMLElement,
		private service: AutomationsApi,
		private targets: () => Promise<TaskTarget[]>,
		private readonly cwd: string,
		request: AutomationEditRequest,
		private readonly done: (saved?: AutomationDefinition) => void,
		private pin?: (definition: AutomationDefinition) => Promise<void>,
	) {
		const { source, title = '', existing } = request;
		this.editing = !!existing;
		this.originalSchedule = JSON.stringify(existing?.schedule);
		this.draft = existing
			? structuredClone(existing)
			: {
					id: crypto.randomUUID(),
					name: title,
					enabled: true,
					deviceId: service.deviceId,
					revision: 1,
					schedule: { kind: 'manual' },
					action: source
						? { kind: 'notify', body: title }
						: {
								kind: 'agent',
								agentId: this.availableAgents()[0]?.id ?? '',
								prompt: '',
								cwd,
								sessionMode: 'fresh',
							},
					channels: ['in-app'],
					notifyOn: 'always',
					graceMinutes: 720,
					source,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};
	}
	private availableAgents() {
		return (this.service.agent()?.listAgents() ?? []).filter((agent) => agent.enabled && agent.installed !== false);
	}
	open(): void {
		this.draw();
		this.languageCleanup = onLanguageChanged(() => repaintLocalizedForm(this.contentEl, () => this.draw()));
	}
	close(): void {
		this.languageCleanup?.();
		this.languageCleanup = undefined;
		this.generation++;
		this.contentEl.empty();
	}
	private draw(): void {
		const generation = ++this.generation;
		const el = this.contentEl;
		el.empty();
		el.addClass('nand-automation-editor');
		bindLocalizedControl(new Setting(el).setName(t(this.editing ? 'automation.editTitle' : 'automation.new')), "name", this.editing ? 'automation.editTitle' : 'automation.new').setHeading();
		bindLocalizedControl(new Setting(el).setName(t('automation.name')), "name", 'automation.name').addText((input) =>
			input.setValue(this.draft.name).onChange((v) => {
				this.draft.name = v;
			}),
		);
		if (!this.draft.source)
			bindLocalizedControl(new Setting(el).setName(t('automation.action')), "name", 'automation.action').addDropdown((input) => {
				for (const descriptor of actionDescriptors) bindLocalizedOptions(input.addOption(descriptor.kind, t(descriptor.name)), {[descriptor.kind]: [descriptor.name]});
				input.setValue(this.draft.action.kind).onChange((v) => {
					this.draft.action = switchAutomationAction(this.draft.action, v as AutomationAction['kind'], {
						agentId: this.availableAgents()[0]?.id ?? '',
						cwd: this.cwd,
					});
					this.draw();
				});
			});
		const body = el.createDiv({ cls: 'nand-automation-editor-body' });
		const main = body.createDiv({ cls: 'nand-automation-editor-main' }),
			side = body.createDiv({ cls: 'nand-automation-editor-side' });
		const action = this.draft.action;
		bindLocalizedControl(new Setting(main).setName(t('automation.prompt')), "name", 'automation.prompt').addTextArea((input) => {
			input.inputEl.rows = 12;
			input.setDisabled(this.draft.source?.kind === 'widget');
			input
				.setValue(
					actionText(action),
				)
				.onChange((v) => {
					setActionText(action, v);
				});
		});
		if (action.kind === 'agent') this.agentFields(side, action);
		if (action.kind === 'script') {
			bindLocalizedControl(new Setting(side).setName(t('automation.cwd')), "name", 'automation.cwd').addText(input => input.setValue(action.cwd).onChange(value => { action.cwd = value; }));
			bindLocalizedControl(new Setting(side).setName(t('automation.shell')), "name", 'automation.shell').addDropdown(input => input.addOptions({ powershell: 'PowerShell', bash: 'Bash' }).setValue(action.shell).onChange(value => { action.shell = value as 'powershell' | 'bash'; }));
		}
		if (action.kind === 'create-task') {
			const row = bindLocalizedControl(new Setting(side).setName(t('automation.target')), "name", 'automation.target');
			void this.targets()
				.then((targets) => {
					if (generation !== this.generation) return;
					if (!targets.length) row.setDesc(t('automation.noTaskTargets'));
					row.addDropdown((input) => {
						bindLocalizedOptions(input.addOption('', t('automation.select')), {['']: ['automation.select']});
						for (const [i, target] of targets.entries()) input.addOption(String(i), target.title);
						const index = targets.findIndex((v) => v.path === action.path && v.cardId === action.cardId);
						if (index < 0) Object.assign(action, { path: '', cardId: '' });
						input.setValue(index < 0 ? '' : String(index)).onChange((v) => {
							const target = v === '' ? undefined : targets[Number(v)];
							Object.assign(action, { path: target?.path ?? '', cardId: target?.cardId ?? '' });
						});
					});
				})
				.catch((error) => {
					if (generation === this.generation) new Notice(String(error));
				});
		}
		if (this.draft.source?.kind !== 'widget') {
			if (actionDescriptors.find(d => d.kind === action.kind)?.scheduled) this.scheduleFields(side);
			else { this.draft.schedule = { kind: 'manual' }; bindLocalizedControl(new Setting(side).setDesc(t('automation.manualOnly')), "desc", 'automation.manualOnly'); }
		}
		bindLocalizedControl(new Setting(side).setName(t('automation.grace')), "name", 'automation.grace').addText((input) =>
			input.setValue(String(this.draft.graceMinutes)).onChange((v) => {
				this.draft.graceMinutes = Number(v);
			}),
		);
		bindLocalizedControl(new Setting(side).setName(t('automation.notifyOn')), "name", 'automation.notifyOn').addDropdown((input) => {
			for (const key of ['always', 'failure', 'never']) bindLocalizedOptions(input.addOption(key, t(`automation.${key}`)), {[key]: [`automation.${key}`]});
			input.setValue(this.draft.notifyOn).onChange((v) => {
				this.draft.notifyOn = v as AutomationDefinition['notifyOn'];
			});
		});
		bindLocalizedControl(new Setting(side).setName(t('automation.channels')), "name", 'automation.channels').setHeading();
		for (const channel of ['in-app', 'system'] as const)
			bindLocalizedControl(new Setting(side).setName(t(`automation.${channel}`)), "name", `automation.${channel}`).addToggle((input) =>
				input
					.setValue(this.draft.channels.includes(channel))
					.setDisabled(channel === 'system' && !Platform.isDesktopApp)
					.onChange((v) => {
						this.draft.channels = v
							? [...new Set([...this.draft.channels, channel])]
							: this.draft.channels.filter((c) => c !== channel);
					}),
			);
		bindLocalizedControl(new Setting(el)
			.setClass('nand-automation-editor-footer')
			.setDesc(t('automation.localOnly')), "desc", 'automation.localOnly')
			.addButton((button) =>
				bindLocalizedControl(button
					.setButtonText(t('automation.save')), "buttonText", 'automation.save')
					.setCta()
					.onClick(() => {
						void this.save();
					}),
			)
			.addButton((button) => bindLocalizedControl(button.setButtonText(t('automation.cancel')), "buttonText", 'automation.cancel').onClick(() => this.done()));
		if (this.pin) new Setting(el).addButton(button => bindLocalizedControl(button.setButtonText(t('automation.pin')), "buttonText", 'automation.pin').onClick(() => {
			void this.save(true);
		}));
	}
	private agentFields(el: HTMLElement, action: Extract<AutomationAction, { kind: 'agent' }>): void {
		const agents = this.availableAgents();
		const unavailable = !!action.agentId && !agents.some((agent) => agent.id === action.agentId);
		bindLocalizedControl(new Setting(el)
			.setName(t('automation.agent')), "name", 'automation.agent')
			.setDesc(
				unavailable
					? t('automation.agentSelectionUnavailable')
					: !agents.length
						? t('automation.noAvailableAgents')
						: '',
			)
			.addDropdown((input) => {
				bindLocalizedOptions(input.addOption('', t('automation.select')), {['']: ['automation.select']});
				if (unavailable) input.addOption(action.agentId, `${action.agentId} (${t('automation.unavailable')})`);
				for (const agent of agents) input.addOption(agent.id, agent.title);
				input.setValue(action.agentId).onChange((v) => {
					action.agentId = v;
					action.session = undefined;
					this.draw();
				});
			});
		bindLocalizedControl(new Setting(el).setName(t('automation.cwd')), "name", 'automation.cwd').addText((input) =>
			input.setValue(action.cwd).onChange((v) => {
				action.cwd = v;
				action.session = undefined;
			}),
		);
		bindLocalizedControl(new Setting(el).setName(t('automation.sessionMode')), "name", 'automation.sessionMode').addDropdown((input) => {
			bindLocalizedOptions(bindLocalizedOptions(input.addOption('fresh', t('automation.fresh')), {['fresh']: ['automation.fresh']}).addOption('reuse', t('automation.reuse')), {['reuse']: ['automation.reuse']});
			if (agents.some((a) => a.id === action.agentId))
				bindLocalizedOptions(input.addOption('specific', t('automation.specific')), {['specific']: ['automation.specific']});
			input.setValue(action.sessionMode).onChange((v) => {
				action.sessionMode = v as typeof action.sessionMode;
				this.draw();
			});
		});
		if (action.sessionMode === 'specific') {
			const row = bindLocalizedControl(new Setting(el).setName(t('automation.sessions')), "name", 'automation.sessions').setDesc(action.session?.title ?? '');
			row.addButton((button) =>
				bindLocalizedControl(button.setButtonText(t('automation.loadSessions')), "buttonText", 'automation.loadSessions').onClick(async () => {
					try {
						const sessions = ((await this.service.agent()?.listSessions(action.cwd)) ?? []).filter(
							(s) => s.agentId === action.agentId,
						);
						if (!sessions.length) {
							new Notice(t('automation.noSessions'));
							return;
						}
						new AutomationSessionPicker(this.app, sessions, (session) => {
							action.session = session;
							action.cwd = session.cwd;
							this.draw();
						}).open();
					} catch (error) {
						new Notice(String(error));
					}
				}),
			);
			bindLocalizedControl(bindLocalizedControl(new Setting(el)
				.setName(t('automation.sessionId')), "name", 'automation.sessionId')
				.setDesc(t('automation.sessionIdHelp')), "desc", 'automation.sessionIdHelp')
				.addText((input) =>
					input.setValue(action.session?.sessionId || '').onChange((value) => {
						action.session = {
							agentId: action.agentId,
							sessionId: value.trim(),
							cwd: action.cwd,
							title: value.trim(),
							accountKey: '',
							modifiedAtMs: Date.now(),
							transcriptPath: action.session?.transcriptPath,
						};
					}),
				);
			if (action.agentId === 'pi')
				bindLocalizedControl(new Setting(el).setName(t('automation.transcript')), "name", 'automation.transcript').addText((input) =>
					input.setValue(action.session?.transcriptPath || '').onChange((value) => {
						if (action.session) action.session.transcriptPath = value.trim();
					}),
				);
		}
	}
	private scheduleFields(el: HTMLElement): void {
		bindLocalizedControl(new Setting(el).setName(t('automation.schedule')), "name", 'automation.schedule').addDropdown((input) => {
			for (const kind of ['manual', 'now', 'once', 'recurring']) bindLocalizedOptions(input.addOption(kind, t(`automation.${kind}`)), {[kind]: [`automation.${kind}`]});
			input.setValue(this.runImmediately ? 'now' : this.draft.schedule.kind).onChange((v) => {
				this.runImmediately = v === 'now';
				this.draft.schedule =
					v === 'manual'
						? { kind: 'manual' }
						: v === 'recurring'
							? { kind: 'recurring', expression: '0 9 * * *', start: Date.now() }
							: { kind: 'once', at: Date.now() + (v === 'now' ? 0 : 3_600_000) };
				this.draw();
			});
		});
		const schedule = this.draft.schedule;
		if (schedule.kind === 'once' && !this.runImmediately)
			bindLocalizedControl(new Setting(el).setName(t('automation.time')), "name", 'automation.time').addText((input) => {
				input.inputEl.type = 'datetime-local';
				const local = new Date(schedule.at - new Date(schedule.at).getTimezoneOffset() * 60_000)
					.toISOString()
					.slice(0, 16);
				input.setValue(local).onChange((v) => {
					schedule.at = new Date(v).getTime();
				});
			});
		if (schedule.kind === 'recurring') {
			bindLocalizedControl(new Setting(el).setName(t('automation.preset')), "name", 'automation.preset').addDropdown((input) => {
				const presets: Record<string, string> = {
					hourly: '0 * * * *',
					daily: '0 9 * * *',
					weekdays: '0 9 * * 1-5',
					weekly: '0 9 * * 1',
				};
				bindLocalizedOptions(input.addOption('', t('automation.custom')), {['']: ['automation.custom']});
				for (const key of Object.keys(presets)) bindLocalizedOptions(input.addOption(key, t(`automation.${key}`)), {[key]: [`automation.${key}`]});
				input.onChange((v) => {
					if (presets[v]) {
						schedule.expression = presets[v];
						this.draw();
					}
				});
			});
			bindLocalizedControl(new Setting(el).setName(t('automation.expression')), "name", 'automation.expression').addText((input) =>
				input.setValue(schedule.expression).onChange((v) => {
					schedule.expression = v;
				}),
			);
		}
		if (schedule.kind === 'recurring') {
			schedule.timezone ??= systemTimeZone();
			bindLocalizedControl(new Setting(el).setName(t('automation.timezone')), "name", 'automation.timezone').addText(input => input.setValue(schedule.timezone!).onChange(zone => { schedule.timezone = zone; }));
		}
	}
	private async save(pin = false): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		try {
			if (this.runImmediately) this.draft.schedule = { kind: 'once', at: Date.now() };
			validateSchedule(this.draft.schedule);
			const a = this.draft.action;
			const invalid = (key: string) => {
				throw new Error(t(`automation.${key}`));
			};
			if (!this.draft.name.trim()) invalid('nameRequired');
			if (!Number.isFinite(this.draft.graceMinutes) || this.draft.graceMinutes < 0) invalid('graceInvalid');
			if (a.kind === 'agent' && (!a.agentId || !a.cwd.trim())) invalid('agentRequired');
			if (a.kind === 'agent' && !this.availableAgents().some((agent) => agent.id === a.agentId))
				invalid('agentSelectionUnavailable');
			if (a.kind === 'agent' && a.sessionMode === 'specific' && !a.session?.sessionId) invalid('sessionMissing');
			if (a.kind === 'create-task') {
				if (
					!a.path ||
					!a.cardId ||
					!(await this.targets()).some((target) => target.path === a.path && target.cardId === a.cardId)
				)
					invalid('targetRequired');
			}
			if (!actionText(a).trim())
				invalid('contentRequired');
			if (a.kind === 'notify' && !this.draft.channels.length) invalid('channelsRequired');
			if (
				!this.runImmediately &&
				this.draft.schedule.kind === 'once' &&
				this.draft.schedule.at <= Date.now() &&
				JSON.stringify(this.draft.schedule) !== this.originalSchedule
			)
				invalid('pastTime');
			await this.service.save(this.draft);
			if (pin) await this.pin?.(this.draft);
			this.done(this.draft);
			await this.service.tick();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		} finally {
			this.saving = false;
		}
	}
}
