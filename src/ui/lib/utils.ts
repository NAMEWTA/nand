// src/ui/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// 不登记的话，tailwind-merge 会把自定义字号 text-2xs / text-3xs 当成颜色类，
// 与 text-muted-foreground 合并时把字号删掉（Orca 的 lib/utils.ts 同样这么做）。
const twMerge = extendTailwindMerge({ extend: { theme: { text: ['2xs', '3xs'] } } });

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
