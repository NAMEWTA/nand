/** Empty selects the default identity; invalid nonempty input must never select it implicitly. */
export function accountName(value: string): string {
	if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error('agent.accountInvalid');
	if (value === '') return '';
	const normalized = value.normalize('NFC').trim();
	if (!normalized || [...normalized].length > 128) throw new Error('agent.accountInvalid');
	return normalized;
}
