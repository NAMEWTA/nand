import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DashboardSettings } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { Icon } from '../../primitives/Icon';
import type { RenderCallbacks } from '../render-contract';
function Chip({
	icon,
	label,
	variant = '',
	activate,
}: {
	icon: string;
	label: string;
	variant?: string;
	activate: () => void;
}) {
	return (
		<button class={`dashboard-quicknote-chip ${variant}`} onClick={activate}>
			<span class="dashboard-quicknote-icon">
				<Icon name={icon} />
			</span>
			{label}
		</button>
	);
}
export function QuickNotesPanel({
	settings,
	callbacks,
	root,
}: {
	root: HTMLElement;
	settings: DashboardSettings;
	callbacks: RenderCallbacks;
}) {
	const presets = settings.quickNotePresets ?? [],
		pinned = settings.pinnedNotes ?? [],
		commands = settings.quickCommands ?? [];
	const hasChips = presets.length || pinned.length || commands.length || settings.quickDailyEnabled;
	const [height, setHeight] = useState(26);
	const input = useRef<HTMLTextAreaElement>(null);
	useLayoutEffect(() => {
		root.classList.toggle('dashboard-quicknote--capture-expanded', height > 30);
	}, [root, height]);
	const resize = (element: HTMLTextAreaElement) => {
		element.setCssProps({ height: 'auto' });
		const next = Math.max(26, Math.min(element.scrollHeight, 160));
		element.style.height = `${next}px`;
		setHeight(next);
	};
	return (
		<>
			<div class="dashboard-quicknote-nav">
				{!hasChips && !settings.quickCaptureEnabled ? (
					<div class="dashboard-quicknote-empty">
						<span class="dashboard-quicknote-empty-text">{t('quickNote.empty')}</span>
						<button class="dashboard-quicknote-empty-btn" onClick={() => callbacks.onQuickNoteConfig()}>
							{t('quickNote.configure')}
						</button>
					</div>
				) : (
					<>
						{settings.quickDailyEnabled && (
							<Chip
								variant="dashboard-quicknote-today"
								icon="sun"
								label={t('quickNote.today')}
								activate={() => callbacks.onQuickNoteDaily()}
							/>
						)}
						{presets.map((preset, index) => (
							<Chip
								key={`preset-${index}`}
								icon={preset.icon || 'file-plus'}
								label={preset.label}
								activate={() => callbacks.onQuickNoteCreate(preset)}
							/>
						))}
						{pinned.map((note, index) => (
							<Chip
								key={`pin-${index}`}
								variant="dashboard-quicknote-pin"
								icon={note.icon || 'pin'}
								label={note.label}
								activate={() => callbacks.onOpenPinnedNote(note)}
							/>
						))}
						{commands.map((command, index) => (
							<Chip
								key={`command-${index}`}
								icon={command.icon || 'terminal'}
								label={command.label}
								activate={() => callbacks.onQuickCommand(command)}
							/>
						))}
					</>
				)}
			</div>
			<div class="dashboard-quicknote-actions">
				{settings.quickCaptureEnabled && (
					<div
						class={`dashboard-quicknote-capture${height > 30 ? ' dashboard-quicknote-capture--expanded' : ''}`}
					>
						<span class="dashboard-quicknote-capture-icon">
							<Icon name="pencil" />
						</span>
						<textarea
							ref={input}
							class="dashboard-quicknote-capture-input"
							rows={1}
							spellcheck={false}
							placeholder={t('quickNote.capturePlaceholder')}
							aria-label={t('quickNote.capture')}
							onInput={(event) => resize(event.currentTarget)}
							onKeyDown={(event) => {
								if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
								event.preventDefault();
								const element = event.currentTarget;
								const text = element.value.trim();
								if (text) {
									callbacks.onQuickNoteCapture(text);
									element.value = '';
								}
								resize(element);
							}}
						/>
					</div>
				)}
				<button
					class="dashboard-quicknote-cog"
					aria-label={t('quickNote.config')}
					onClick={() => callbacks.onQuickNoteConfig()}
				>
					<Icon name="settings-2" />
				</button>
			</div>
		</>
	);
}
