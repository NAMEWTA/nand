/** Reserved browser capabilities are not inherited by ordinary terminals or native services. */
export function withoutBrowserEnvironment<T extends string | undefined>(environment: Record<string, T>): Record<string, T> {
	return Object.fromEntries(Object.entries(environment).filter(([key]) => !key.toUpperCase().startsWith('NAND_BROWSER_')));
}
