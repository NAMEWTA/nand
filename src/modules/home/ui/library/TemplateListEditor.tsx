import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { App } from 'obsidian';
import { templateChoices } from '../../core/board/board-experience';
import { onLanguageChanged, t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { IconButton } from '../../../../ui/primitives/IconButton';
import { TextField } from '../../../../ui/primitives/TextField';
import { PathPickerModal } from '../ui/path-picker-modal';

function TemplateList({
	paths,
	change,
	browse,
}: {
	paths: readonly string[];
	change: (paths: string[]) => void;
	browse: () => void;
}) {
	const [input, setInput] = useState('');
	const move = (index: number, delta: number) => {
		const next = [...paths];
		[next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
		change(next);
	};
	const add = () => {
		if (input.trim()) {
			change([...paths, input]);
			setInput('');
		}
	};
	return (
		<div class="nand-ui-stack nand-template-list">
			<p>{t('home.templates.hint')}</p>
			{paths.map((path, index) => (
				<div class="nand-ui-stack" key={path} data-template-path={path}>
					<span>{path}</span>
					<div class="nand-ui-toolbar">
						<IconButton
							icon="arrow-up"
							label={t('home.templates.up', { path })}
							disabled={!index}
							onClick={() => move(index, -1)}
						/>
						<IconButton
							icon="arrow-down"
							label={t('home.templates.down', { path })}
							disabled={index === paths.length - 1}
							onClick={() => move(index, 1)}
						/>
						<IconButton
							icon="trash-2"
							label={t('home.templates.remove', { path })}
							onClick={() => change(paths.filter((_, at) => at !== index))}
						/>
					</div>
				</div>
			))}
			<TextField
				label={t('home.templates.path')}
				value={input}
				onInput={setInput}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						add();
					}
				}}
			/>
			<div class="nand-ui-toolbar">
				<Button disabled={!input.trim()} onClick={add}>
					{t('common.add')}
				</Button>
				<Button onClick={browse}>{t('folder.browse')}</Button>
			</div>
		</div>
	);
}

/** The parent form reads the ordered draft only on Save and disposes it on close. */
export class TemplateListEditor {
	private paths: string[];
	private picker?: PathPickerModal;
	private closed = false;
	private readonly languageCleanup: () => void;
	constructor(
		private readonly app: App,
		private readonly root: HTMLElement,
		initial: readonly string[],
	) {
		this.paths = templateChoices(undefined, initial);
		this.draw();
		this.languageCleanup = onLanguageChanged(() => this.draw());
	}
	get value(): string[] {
		return [...this.paths];
	}
	private draw(): void {
		render(
			<TemplateList
				paths={this.paths}
				change={(paths) => {
					this.paths = templateChoices(undefined, paths);
					this.draw();
				}}
				browse={() => {
					this.picker = new PathPickerModal(this.app, 'file', (path) => {
						if (!this.closed) {
							this.paths = templateChoices(undefined, [...this.paths, path]);
							this.draw();
						}
					});
					this.picker.open();
				}}
			/>,
			this.root,
		);
	}
	dispose(): void {
		this.closed = true;
		this.languageCleanup();
		this.picker?.close();
		render(null, this.root);
	}
}
