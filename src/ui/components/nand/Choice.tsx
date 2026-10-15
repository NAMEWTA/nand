import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

/** A labelled single selection, including an optional empty value. */
export function Choice({
	label,
	value,
	options,
	onChange,
	disabled,
	className,
	open,
	onOpenChange,
}: {
	label: string;
	value: string;
	options: readonly (readonly [string, string])[];
	onChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	return (
		<Select
			open={open}
			onOpenChange={onOpenChange}
			value={value || '__empty__'}
			onValueChange={(next) => onChange(next === '__empty__' ? '' : next)}
			disabled={disabled}
		>
			<SelectTrigger aria-label={label} className={className}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map(([key, text]) => (
					<SelectItem key={key} value={key || '__empty__'}>
						{text}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
