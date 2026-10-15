import { ObsidianIcon } from '../../../ui/components/nand/ObsidianIcon';
import { ICONS } from '../platform/resources';
const colors: Record<string, string> = {
	red: '--color-red',
	orange: '--color-orange',
	yellow: '--color-yellow',
	green: '--color-green',
	cyan: '--color-cyan',
	blue: '--color-blue',
	purple: '--color-purple',
	pink: '--color-pink',
	gray: '--color-base-70',
};
export function IconPreview({ icon, color }: { icon: string | null | undefined; color?: string | null }) {
	return (
		<span
			className="inline-flex size-5 shrink-0 items-center justify-center"
			style={{ color: color ? (colors[color] ? `var(${colors[color]})` : color) : undefined }}
		>
			{icon && (ICONS.has(icon) || icon.startsWith('lucide-') ? <ObsidianIcon name={icon} /> : icon)}
		</span>
	);
}
