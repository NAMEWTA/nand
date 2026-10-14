// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: styles.css
// Static Tailwind recipes retain upstream selector names for visual comparison. No runtime CSS is generated.
import { cn } from '../../../../ui/lib/utils';
const layout: Record<string, string> = {
	'dashboard-docsearch': 'flex [flex-direction:column] gap-[12px] [margin-top:16px]',
	'dashboard-docsearch-input': '[font-size:1em] p-[10px_14px]',
	'dashboard-docsearch-results':
		'flex [flex-direction:column] gap-[2px] max-h-[300px] [overflow-y:auto] [border:1px_solid_var(--db-border)] rounded-[var(--db-radius-sm)] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:[background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)] [&::-webkit-scrollbar-thumb]:rounded-[4px]',
	'dashboard-docsearch-hint': 'p-[16px] [text-align:center] [color:var(--db-text-faint)] [font-size:0.9em]',
	'dashboard-docsearch-item':
		'flex [align-items:center] gap-[10px] p-[8px_12px] [cursor:pointer] motion-safe:[transition:background_0.1s_ease] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-docsearch-icon': '[font-size:1em] [flex-shrink:0]',
	'dashboard-docsearch-info': '[flex:1] [overflow:hidden]',
	'dashboard-docsearch-name': '[font-size:0.9em] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-docsearch-path':
		'[font-size:0.78em] [color:var(--db-text-faint)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-docsearch-cancel': '[margin-top:8px] [align-self:flex-end]',
	'dashboard-sidebar-skills':
		'flex [flex-direction:column] [justify-content:center] gap-[7px] min-h-[48px] h-[auto] p-[7px_8px] rounded-[999px] [overflow:hidden] [background:color-mix(in_srgb,_var(--db-text-muted,_var(--db-input-color-1))_9%,_transparent)] [border:1px_solid_color-mix(in_srgb,_var(--db-text-muted,_var(--db-input-color-1))_14%,_transparent)] [box-sizing:border-box]',
	'dashboard-sidebar-skills--multi': 'rounded-[var(--db-radius-lg,_18px)]',
	'dashboard-skills-row': 'flex [align-items:center] [justify-content:space-between] gap-[8px] min-h-[34px]',
	'dashboard-skills-orb':
		'[--orb:var(--db-input-color-2)] [flex:1_1_0] min-w-[20px] max-w-[34px] [aspect-ratio:1_/_1] h-[auto] p-[0] [border:none] rounded-[50%] [cursor:pointer] [color:var(--db-input-color-3)] inline-flex [align-items:center] [justify-content:center] [background:radial-gradient(120%_90%_at_30%_22%,_color-mix(in_srgb,_var(--orb)_55%,_var(--db-input-color-4)),_transparent_55%),_linear-gradient(180deg,_color-mix(in_srgb,_var(--orb)_88%,_var(--db-input-color-4))_8%,_var(--orb)_52%,_color-mix(in_srgb,_var(--orb)_86%,_var(--db-input-color-5)))] [box-shadow:inset_0_1px_0_var(--db-input-color-6),_inset_0_-2px_3px_var(--db-input-color-7),_0_2px_3px_var(--db-input-color-8)] motion-safe:[transition:transform_0.08s_ease,_box-shadow_0.08s_ease,_filter_0.12s_ease] [&_svg]:w-[46%] [&_svg]:h-[46%] [&_svg]:[filter:drop-shadow(0_1px_0_var(--db-input-color-9))] [&:hover]:[filter:brightness(1.06)] [&:active]:[transform:translateY(1px)] [&:active]:[box-shadow:inset_0_2px_4px_var(--db-input-color-10),_inset_0_-1px_0_var(--db-input-color-11),_0_1px_1px_var(--db-input-color-12)] [&.is-pressed]:[transform:translateY(1px)] [&.is-pressed]:[box-shadow:inset_0_2px_4px_var(--db-input-color-10),_inset_0_-1px_0_var(--db-input-color-11),_0_1px_1px_var(--db-input-color-12)]',
	'dashboard-skills-orb--cog': '[color:var(--db-input-color-13)]',
	'dashboard-sidebar-capturebar':
		'[background:transparent] [border:none] p-[0] rounded-[0] [box-shadow:none] [backdrop-filter:none] [-webkit-backdrop-filter:none]',
	'dashboard-capturebar':
		'flex [align-items:center] gap-[6px] [box-sizing:border-box] p-[5px_5px_5px_6px] rounded-[20px] [background:linear-gradient(var(--db-bg-card,_var(--db-input-color-14)),_var(--db-bg-card,_var(--db-input-color-14))),_var(--db-bg,_var(--db-input-color-15))] [border:1px_solid_var(--db-border-input,_var(--db-border-card,_var(--db-input-color-16)))] [box-shadow:0_1px_4px_var(--db-input-color-17)] motion-safe:[transition:border-color_0.15s_ease,_box-shadow_0.15s_ease] [&:focus-within]:[border-color:color-mix(in_srgb,_var(--db-accent)_55%,_var(--db-border-input,_var(--db-border-card)))] [&:focus-within]:[box-shadow:0_1px_6px_color-mix(in_srgb,_var(--db-accent)_18%,_var(--db-input-color-17))] [&_.dashboard-skills-orb]:[flex:0_0_28px] [&_.dashboard-skills-orb]:max-w-[28px]',
	'dashboard-capturebar-glyph':
		'[flex:0_0_auto] inline-flex [align-items:center] [justify-content:center] w-[24px] h-[24px] p-[0] [border:none] [background:transparent] [box-shadow:none] rounded-[50%] [color:var(--db-text)] [cursor:pointer] motion-safe:[transition:background_0.12s_ease] [&:hover]:[background:color-mix(in_srgb,_var(--db-text)_9%,_transparent)] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:[stroke-width:2.5]',
	'dashboard-capturebar-glyph--static': '[cursor:default] [color:var(--db-text-muted)]',
	'dashboard-capturebar-input':
		'[flex:1_1_auto] min-w-[0] h-[28px] [line-height:28px] p-[0_4px] [box-sizing:border-box] [border:none] rounded-[var(--db-radius-sm)] [background:transparent] [box-shadow:none] [color:var(--db-text)] [font-size:0.85em] [&::placeholder]:[color:var(--db-text-muted)] [&::placeholder]:[opacity:1]',
	'dashboard-filesearch-pop':
		'[position:fixed] [z-index:var(--layer-menu)] hidden [flex-direction:column] gap-[2px] w-[min(340px,_86vw)] max-h-[min(280px,_60vh)] [overflow-y:auto] p-[4px] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-md)] [background:linear-gradient(var(--db-bg-card,_var(--db-input-color-14)),_var(--db-bg-card,_var(--db-input-color-14))),_var(--db-bg-modal,_var(--db-bg,_var(--db-input-color-15)))] [box-shadow:0_10px_30px_var(--db-input-color-18)] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&.is-open]:flex [&_.dashboard-docsearch-item]:rounded-[var(--db-radius-sm)]',
	'dashboard-filesearch-meta':
		'[flex-shrink:0] [align-self:center] [font-size:0.72em] [color:var(--db-text-faint,_var(--db-text-muted))] whitespace-nowrap [padding-left:6px]',
};
export function inputWidgetClasses(names: string | undefined): string {
	return cn(...(names ?? '').split(/\s+/).flatMap((name) => [name, layout[name]]));
}
