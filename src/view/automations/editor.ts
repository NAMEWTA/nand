import { Modal, Notice, Platform, Setting, type App } from 'obsidian';
import type { AutomationsApi } from '../../core/automations/api';
import { validateSchedule } from '../../core/automations/schedule';
import { switchAutomationAction } from '../../core/automations/switch-action';
import type { AutomationAction, AutomationDefinition, SourceRef } from '../../shared/automation/types';
import { t } from '../../shared/i18n/index';
import { AutomationSessionPicker } from './session-picker';

export type TaskTarget = { path: string; cardId: string; title: string };
export class AutomationEditor extends Modal {
	private draft: AutomationDefinition;
	private saving = false;
	private generation = 0;
	private originalSchedule: string;
	private runImmediately = false;
	private readonly editing: boolean;
	constructor(
		app: App,
		private service: AutomationsApi,
		private targets: () => Promise<TaskTarget[]>,
		private readonly cwd: string,
		source?: SourceRef,
		title = '',
		existing?: AutomationDefinition,
	) {
		super(app);
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
	onOpen(): void {
		this.draw();
	}
	onClose(): void {
		this.generation++;
		this.contentEl.empty();
	}
	private draw(): void {
		const generation = ++this.generation;
		const el = this.contentEl;
		el.empty();
		el.addClass('nand-automation-editor');
		new Setting(el).setName(t(this.editing ? 'automation.editTitle' : 'automation.new')).setHeading();
		new Setting(el).setName(t('automation.name')).addText((input) =>
			input.setValue(this.draft.name).onChange((v) => {
				this.draft.name = v;
			}),
		);
		if (!this.draft.source)
			new Setting(el).setName(t('automation.action')).addDropdown((input) => {
				for (const kind of ['agent', 'notify', 'create-task']) input.addOption(kind, t(`automation.${kind}`));
				input.setValue(this.draft.action.kind).onChange((v) => {
					this.draft.action = switchAutomationAction(
						this.draft.action,
						v as AutomationAction['kind'],
						{ agentId: this.availableAgents()[0]?.id ?? '', cwd: this.cwd },
					);
					this.draw();
				});
			});
		const body = el.createDiv({ cls: 'nand-automation-editor-body' });
		const main = body.createDiv(),
			side = body.createDiv();
		const action = this.draft.action;
		new Setting(main).setName(t('automation.prompt')).addTextArea((input) => {
			input.inputEl.rows = 12;
			input.setDisabled(this.draft.source?.kind === 'widget');
			input
				.setValue(
					action.kind === 'agent' ? action.prompt : action.kind === 'notify' ? action.body : action.text,
				)
				.onChange((v) => {
					if (action.kind === 'agent') action.prompt = v;
					else if (action.kind === 'notify') action.body = v;
					else action.text = v;
				});
		});
		if (action.kind === 'agent') this.agentFields(side, action);
		if (action.kind === 'create-task') {
			const row = new Setting(side).setName(t('automation.target'));
			void this.targets()
				.then((targets) => {
					if (generation !== this.generation) return;
					row.addDropdown((input) => {
						input.addOption('', t('automation.select'));
						for (const [i, target] of targets.entries()) input.addOption(String(i), target.title);
						const index = targets.findIndex((v) => v.path === action.path && v.cardId === action.cardId);
						input.setValue(index < 0 ? '' : String(index)).onChange((v) => {
							const target = targets[Number(v)];
							if (v && target) Object.assign(action, { path: target.path, cardId: target.cardId });
						});
					});
				})
				.catch((error) => {
					if (generation === this.generation) new Notice(String(error));
				});
		}
		if (this.draft.source?.kind !== 'widget') this.scheduleFields(side);
		new Setting(side).setName(t('automation.grace')).addText((input) =>
			input.setValue(String(this.draft.graceMinutes)).onChange((v) => {
				this.draft.graceMinutes = Number(v);
			}),
		);
		new Setting(side).setName(t('automation.notifyOn')).addDropdown((input) => {
			for (const key of ['always', 'failure', 'never']) input.addOption(key, t(`automation.${key}`));
			input.setValue(this.draft.notifyOn).onChange((v) => {
				this.draft.notifyOn = v as AutomationDefinition['notifyOn'];
			});
		});
		new Setting(side).setName(t('automation.channels')).setHeading();
		for (const channel of ['in-app', 'system', 'email', 'sms'] as const)
			new Setting(side).setName(t(`automation.${channel}`)).addToggle((input) =>
				input
					.setValue(this.draft.channels.includes(channel))
					.setDisabled(
						channel === 'email' || channel === 'sms' || (channel === 'system' && !Platform.isDesktopApp),
					)
					.onChange((v) => {
						this.draft.channels = v
							? [...new Set([...this.draft.channels, channel])]
							: this.draft.channels.filter((c) => c !== channel);
					}),
			);
		new Setting(el)
			.setDesc(t('automation.localOnly'))
			.addButton((button) =>
				button
					.setButtonText(t('automation.save'))
					.setCta()
					.onClick(() => {
						void this.save();
					}),
			)
			.addButton((button) => button.setButtonText(t('automation.cancel')).onClick(() => this.close()));
	}
	private agentFields(el: HTMLElement, action: Extract<AutomationAction, { kind: 'agent' }>): void {
		const agents = this.availableAgents();
		const unavailable = !!action.agentId && !agents.some((agent) => agent.id === action.agentId);
		new Setting(el)
			.setName(t('automation.agent'))
			.setDesc(
				unavailable
					? t('automation.agentSelectionUnavailable')
					: !agents.length
						? t('automation.noAvailableAgents')
						: '',
			)
			.addDropdown((input) => {
				input.addOption('', t('automation.select'));
				if (unavailable) input.addOption(action.agentId, `${action.agentId} (${t('automation.unavailable')})`);
				for (const agent of agents) input.addOption(agent.id, agent.title);
				input.setValue(action.agentId).onChange((v) => {
					action.agentId = v;
					action.session = undefined;
					this.draw();
				});
			});
		new Setting(el).setName(t('automation.cwd')).addText((input) =>
			input.setValue(action.cwd).onChange((v) => {
				action.cwd = v;
				action.session = undefined;
			}),
		);
		new Setting(el).setName(t('automation.sessionMode')).addDropdown((input) => {
			input.addOption('fresh', t('automation.fresh')).addOption('reuse', t('automation.reuse'));
			if (agents.find((a) => a.id === action.agentId)?.resumable)
				input.addOption('specific', t('automation.specific'));
			input.setValue(action.sessionMode).onChange((v) => {
				action.sessionMode = v as typeof action.sessionMode;
				this.draw();
			});
		});
		if (action.sessionMode === 'specific') {
			const row = new Setting(el).setName(t('automation.sessions')).setDesc(action.session?.title ?? '');
			row.addButton((button) =>
				button.setButtonText(t('automation.loadSessions')).onClick(async () => {
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
			new Setting(el)
				.setName(t('automation.sessionId'))
				.setDesc(t('automation.sessionIdHelp'))
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
			if (['pi', 'omp', 'prime-agent'].includes(action.agentId))
				new Setting(el).setName(t('automation.transcript')).addText((input) =>
					input.setValue(action.session?.transcriptPath || '').onChange((value) => {
						if (action.session) action.session.transcriptPath = value.trim();
					}),
				);
		}
	}
	private scheduleFields(el: HTMLElement): void {
		new Setting(el).setName(t('automation.schedule')).addDropdown((input) => {
			for (const kind of ['manual', 'now', 'once', 'recurring']) input.addOption(kind, t(`automation.${kind}`));
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
			new Setting(el).setName(t('automation.time')).addText((input) => {
				input.inputEl.type = 'datetime-local';
				const local = new Date(schedule.at - new Date(schedule.at).getTimezoneOffset() * 60_000)
					.toISOString()
					.slice(0, 16);
				input.setValue(local).onChange((v) => {
					schedule.at = new Date(v).getTime();
				});
			});
		if (schedule.kind === 'recurring') {
			new Setting(el).setName(t('automation.preset')).addDropdown((input) => {
				const presets: Record<string, string> = {
					hourly: '0 * * * *',
					daily: '0 9 * * *',
					weekdays: '0 9 * * 1-5',
					weekly: '0 9 * * 1',
				};
				input.addOption('', t('automation.custom'));
				for (const key of Object.keys(presets)) input.addOption(key, t(`automation.${key}`));
				input.onChange((v) => {
					if (presets[v]) {
						schedule.expression = presets[v];
						this.draw();
					}
				});
			});
			new Setting(el).setName(t('automation.expression')).addText((input) =>
				input.setValue(schedule.expression).onChange((v) => {
					schedule.expression = v;
				}),
			);
		}
		new Setting(el).setName(t('automation.timezone')).setDesc(Intl.DateTimeFormat().resolvedOptions().timeZone);
	}
	private async save(): Promise<void> {
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
			if (a.kind === 'create-task' && (!a.path || !a.cardId)) invalid('targetRequired');
			if (!(a.kind === 'agent' ? a.prompt : a.kind === 'notify' ? a.body : a.text).trim())
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
			this.close();
			await this.service.tick();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		} finally {
			this.saving = false;
		}
	}
}
