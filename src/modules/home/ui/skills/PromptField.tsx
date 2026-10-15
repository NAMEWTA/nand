import type { HTMLInputTypeAttribute } from 'react';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
export function TextField({
	label,
	hint,
	value,
	onInput,
	multiline,
	rows,
	type,
	disabled,
	placeholder,
}: {
	label: string;
	hint?: string;
	value: string;
	onInput: (value: string) => void;
	multiline?: boolean;
	rows?: number;
	type?: HTMLInputTypeAttribute;
	disabled?: boolean;
	placeholder?: string;
}) {
	return (
		<Label className="flex flex-col gap-1">
			{label}
			{multiline ? (
				<Textarea
					value={value}
					rows={rows}
					disabled={disabled}
					placeholder={placeholder}
					onChange={(e) => onInput(e.target.value)}
				/>
			) : (
				<Input
					type={type}
					value={value}
					disabled={disabled}
					placeholder={placeholder}
					onChange={(e) => onInput(e.target.value)}
				/>
			)}{' '}
			{hint && <span className="text-xs text-muted-foreground">{hint}</span>}
		</Label>
	);
}
