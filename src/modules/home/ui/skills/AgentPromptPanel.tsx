import { SuggestModal, type App } from 'obsidian';
import { contentFiles, type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { useState } from 'react';
import type { SkillShortcut } from '../../core/board/types/model';
import { skillError, skillPrompt, type SkillContext, type SkillDraft } from '../../services/skill-shortcuts';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/components/button';
import { TextField } from '../skills/PromptField';
import { openRecordOverlay } from '../dialogs/open-record-dialog';
import { P2Dialog } from '../dialogs/P2Dialog';
import { SkillTarget } from './SkillTarget';
import { ownAgentPreview } from './preview-lifetime';

function chooseFile(app: App, signal: AbortSignal, owner: unknown): Promise<string | null> {
	if (signal.aborted) return Promise.resolve(null);
	return new Promise((resolve) => {
		let result: string | null = null;
		let release = () => {};
		const modal = new (class extends SuggestModal<ContentFile> {
			getSuggestions(query: string) {
				return contentFiles(app)
					.getFiles()
					.filter((file) => file.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
					.slice(0, 100);
			}
			renderSuggestion(file: ContentFile, el: HTMLElement) {
				el.setText(file.path);
			}
			onChooseSuggestion(file: ContentFile) {
				result = file.path;
			}
			onClose() {
				super.onClose();
				release();
				queueMicrotask(() => resolve(signal.aborted ? null : result));
			}
		})(app);
		const close = () => modal.close();
		modal.setPlaceholder(t('home.skills.chooseFile'));
		modal.open();
		release = ownAgentPreview(
			app,
			() => {
				resolve(null);
				close();
			},
			owner,
			signal,
		);
	});
}

export function AgentPromptPanel({
	skill,
	context,
	initial,
	close,
	confirm,
	addFile,
}: {
	skill: SkillShortcut;
	context: SkillContext;
	initial: SkillDraft;
	close(this: void): void;
	confirm(this: void, value: SkillDraft): void;
	addFile?: () => Promise<string | null>;
}) {
	const [draft, setDraft] = useState(initial.finalPrompt);
	const [input, setInput] = useState(context.variables.input ?? '');
	const [files, setFiles] = useState(initial.files);
	const [candidates, setCandidates] = useState([...context.files]);
	const [destination, setDestination] = useState(initial.destination);
	const [valid, setValid] = useState(initial.destination.kind === 'fresh');
	const [edited, setEdited] = useState(false);
	const [error, setError] = useState('');
	const [choosing, setChoosing] = useState(false);
	const rebuild = (nextInput: string, nextFiles: string[]) => {
		try {
			setDraft(skillPrompt(skill, { ...context.variables, input: nextInput, paths: nextFiles.join('\n') }));
			setError('');
		} catch (error) {
			setError(skillError(error));
		}
	};
	const selectFiles = (next: string[]) => {
		setFiles(next);
		if (!edited) rebuild(input, next);
	};
	return (
		<div className="flex flex-col gap-3 nand-agent-prompt-preview nand-skills-preview">
			<p>{t('quickActions.skillTarget', { name: skill.agentId })}</p>
			<SkillTarget agentId={skill.agentId} value={destination} change={setDestination} validity={setValid} />
			<TextField
				label={t('home.skills.input')}
				value={input}
				placeholder={skill.inputPlaceholder}
				multiline
				rows={2}
				onInput={(value) => {
					setInput(value);
					if (!edited) rebuild(value, files);
				}}
			/>
			<fieldset>
				<legend>{t('home.skills.files')}</legend>
				{!candidates.length && <p>{t('home.skills.emptyScope')}</p>}
				{candidates.map((path) => (
					<label className="flex items-center gap-2" key={path}>
						<input
							type="checkbox"
							checked={files.includes(path)}
							onChange={(event) =>
								selectFiles(
									event.currentTarget.checked
										? [...files, path]
										: files.filter((file) => file !== path),
								)
							}
						/>
						<span>{path}</span>
					</label>
				))}
				{addFile && (
					<Button
						disabled={choosing}
						onClick={() => {
							setChoosing(true);
							void addFile()
								.then((path) => {
									if (!path) return;
									setCandidates((value) => (value.includes(path) ? value : [...value, path]));
									if (!files.includes(path)) selectFiles([...files, path]);
								})
								.finally(() => setChoosing(false));
						}}
					>
						{t('home.skills.addFile')}
					</Button>
				)}
			</fieldset>
			<TextField
				label={t('quickActions.skillFinalPrompt')}
				value={draft}
				multiline
				rows={8}
				onInput={(value) => {
					setDraft(value);
					setEdited(true);
				}}
			/>
			{edited && (
				<>
					<p className="text-xs text-muted-foreground">{t('home.skills.editedHint')}</p>
					<Button
						onClick={() => {
							rebuild(input, files);
							setEdited(false);
						}}
					>
						{t('home.skills.rebuild')}
					</Button>
				</>
			)}
			{error && <p role="alert">{error}</p>}
			<div className="flex justify-end gap-2">
				<Button onClick={close}>{t('common.cancel')}</Button>
				<Button
					variant="default"
					disabled={!draft.trim() || !valid || !!error || choosing}
					onClick={() => confirm({ finalPrompt: draft, files, destination })}
				>
					{destination.kind === 'existing' ? t('home.skills.paste') : t('quickActions.skillSend')}
				</Button>
			</div>
		</div>
	);
}

/** Scope candidates belong to this invocation. No remembered selection can enlarge an empty context. */
export function previewSkill(
	app: App,
	skill: SkillShortcut,
	context: SkillContext,
	initial: SkillDraft,
	signal: AbortSignal,
	owner: unknown,
	allowAddFiles = false,
): Promise<SkillDraft | null> {
	if (signal.aborted) return Promise.resolve(null);
	return new Promise((resolve) => {
		let result: SkillDraft | null = null;
		let release = () => {};
		const close = openRecordOverlay(
			app.workspace.getMostRecentLeaf()?.view.containerEl.ownerDocument ??
				app.workspace.containerEl.ownerDocument,
			(close) => (
				<P2Dialog
					title={skill.label || t('quickActions.skillPreview')}
					onClose={() => {
						release();
						resolve(result);
						close();
					}}
				>
					<AgentPromptPanel
						skill={skill}
						context={context}
						initial={initial}
						close={() => {
							release();
							resolve(null);
							close();
						}}
						confirm={(value) => {
							result = value;
							release();
							resolve(value);
							close();
						}}
						addFile={allowAddFiles ? () => chooseFile(app, signal, owner) : undefined}
					/>
				</P2Dialog>
			),
		);
		release = ownAgentPreview(
			app,
			() => {
				resolve(null);
				close();
			},
			owner,
			signal,
		);
	});
}
