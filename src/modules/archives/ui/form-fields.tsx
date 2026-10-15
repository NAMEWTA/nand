import { useState } from 'react';
import { normalizeValues } from '../core/resources';
import { ct } from './labels';
import { Input } from '../../../ui/components/input';
import { Button } from '../../../ui/components/button';
import { Badge } from '../../../ui/components/badge';
import { SettingsRow } from '../../../ui/components/nand/SettingsRow';
export function MultiValueField({
	label,
	value,
	onChange,
	chips,
}: {
	label: string;
	value: string[];
	onChange: (values: string[]) => void;
	chips: boolean;
}) {
	const [values, setValues] = useState(value.length ? value : chips ? [] : ['']),
		[entry, setEntry] = useState('');
	const update = (next: string[], pending = entry) => {
		setValues(next);
		onChange(normalizeValues(chips ? [...next, pending] : next));
	};
	const commit = () => {
		update(normalizeValues([...values, entry]), '');
		setEntry('');
	};
	return (
		<SettingsRow
			label={label}
			className="flex-wrap [&>div:last-child]:w-full sm:[&>div:last-child]:w-2/3"
			alignTop
			control={
				<div className="space-y-2">
					{chips ? (
						<>
							<div className="flex flex-wrap gap-1">
								{values.filter(Boolean).map((item, index) => (
									<Badge key={index} variant="secondary">
										{item}
										<Button
											type="button"
											size="sm"
											variant="ghost"
											aria-label={ct('removeItem') + ': ' + item}
											onClick={() => update(values.filter((_, i) => i !== index))}
										>
											×
										</Button>
									</Badge>
								))}
							</div>
							<div className="flex gap-2">
								<Input
									aria-label={label}
									value={entry}
									onChange={(e) => {
										setEntry(e.target.value);
										onChange(normalizeValues([...values, e.target.value]));
									}}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											commit();
										}
									}}
									onPaste={(e) => {
										const text = e.clipboardData.getData('text');
										if (text.includes('\n')) {
											e.preventDefault();
											update(normalizeValues([...values, entry, text]), '');
											setEntry('');
										}
									}}
								/>
								<Button type="button" variant="outline" onClick={commit}>
									{ct('addItem')}
								</Button>
							</div>
						</>
					) : (
						<>
							{(values.length ? values : ['']).map((item, index) => (
								<div className="flex gap-2" key={index}>
									<Input
										aria-label={label + ' ' + (index + 1)}
										value={item}
										onChange={(e) =>
											update(
												(values.length ? values : ['']).map((v, i) =>
													i === index ? e.target.value : v,
												),
											)
										}
										onPaste={(e) => {
											const text = e.clipboardData.getData('text');
											if (text.includes('\n')) {
												e.preventDefault();
												const next = [...values];
												next.splice(index, 1, ...normalizeValues([text]));
												update(next);
											}
										}}
									/>
									<Button
										type="button"
										variant="ghost"
										aria-label={ct('removeItem') + ': ' + label + ' ' + (index + 1)}
										onClick={() => update(values.filter((_, i) => i !== index))}
									>
										×
									</Button>
								</div>
							))}
							<Button type="button" variant="outline" onClick={() => setValues([...values, ''])}>
								{ct('addItem')}
							</Button>
						</>
					)}
				</div>
			}
		/>
	);
}
