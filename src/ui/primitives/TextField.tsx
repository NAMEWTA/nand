import type { TargetedKeyboardEvent } from 'preact';

export interface TextFieldProps {
	label?: string;
	hint?: string;
	value: string;
	placeholder?: string;
	multiline?: boolean;
	rows?: number;
	type?: 'text' | 'url' | 'number' | 'date' | 'time' | 'datetime-local' | 'email' | 'tel';
	disabled?: boolean;
	autoFocus?: boolean;
	onInput: (value: string) => void;
	onKeyDown?: (event: TargetedKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/** Labelled text input or textarea. */
export function TextField({ label, hint, value, placeholder, multiline, rows = 4, type = 'text', disabled, autoFocus, onInput, onKeyDown }: TextFieldProps) {
	const control = multiline ? (
		<textarea class="nand-input" value={value} rows={rows} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
			onInput={(event) => onInput(event.currentTarget.value)} onKeyDown={onKeyDown} />
	) : (
		<input class="nand-input" type={type} value={value} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
			onInput={(event) => onInput(event.currentTarget.value)} onKeyDown={onKeyDown} />
	);
	if (!label && !hint) return control;
	return (
		<label class="nand-field">
			{label && <span class="nand-field-label">{label}</span>}
			{control}
			{hint && <span class="nand-field-hint">{hint}</span>}
		</label>
	);
}
