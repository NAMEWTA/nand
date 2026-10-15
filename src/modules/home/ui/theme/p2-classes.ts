// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: styles.css
// Static Tailwind recipes retain upstream selector names for visual comparison. No runtime CSS is generated.
import { cn } from '../../../../ui/lib/utils';
const layout: Record<string, string> = {
	'dashboard-toolbar-dropdown': 'inline-flex [align-items:center] gap-[2px] min-h-[16px]',
	'dashboard-toolbar-dropdown-text':
		'[font-size:0.82em] [font-weight:700] h-[16px] [line-height:16px] min-w-[16px] [text-align:center]',
	'dashboard-widget-inline-cfg-btn':
		'w-[20px] h-[20px] [flex-shrink:0] flex [align-items:center] [justify-content:center] [cursor:pointer] [color:var(--db-text-muted)] [opacity:0.55] motion-safe:[transition:opacity_0.15s_ease] [&:hover]:[opacity:1] [&:hover]:[color:var(--db-accent)] [&_svg]:w-[13px] [&_svg]:h-[13px]',
	'dashboard-library-config-modal':
		"[&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[border:1px_solid_var(--db-border-input,_var(--background-modifier-border))] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:rounded-[var(--db-radius-sm,_6px)] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:p-[8px_12px] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[background:var(--db-bg-input,_var(--background-modifier-form-field))] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[box-shadow:none] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-modal-input.dashboard-modal-input:is(input[type='text'],_input[type='search']):focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))] [&_.dashboard-modal-input.dashboard-modal-input:is(input[type='text'],_input[type='search']):focus]:[box-shadow:none] p-[0]",
	'dashboard-sidebar-album-frame':
		'[position:relative] [aspect-ratio:1_/_1] rounded-[var(--db-radius-sm)] [overflow:hidden] [&:hover_.dashboard-sidebar-album-nav]:[opacity:0.9] [&:hover_.dashboard-sidebar-album-nav]:[visibility:visible]',
	'dashboard-sidebar-album-layer':
		'[position:absolute] [inset:0] w-[100%] h-[100%] [object-fit:cover] motion-safe:[transition:opacity_0.6s_ease,_transform_0.6s_ease] [user-select:none] [pointer-events:none]',
	'dashboard-sidebar-album-layer--instant': '',
	'dashboard-sidebar-album-layer--top': '[z-index:var(--layer-content)]',
	'dashboard-sidebar-album-layer--bottom': '[z-index:var(--layer-content)]',
	'dashboard-sidebar-album-layer--start-fade': '[opacity:0]',
	'dashboard-sidebar-album-layer--start-zoom': '[opacity:0] [transform:scale(1.06)]',
	'dashboard-sidebar-album-layer--start-slide-in-right': '[transform:translateX(100%)]',
	'dashboard-sidebar-album-layer--start-slide-in-left': '[transform:translateX(-100%)]',
	'dashboard-sidebar-album-layer--run-slide-out-left': '[transform:translateX(-100%)]',
	'dashboard-sidebar-album-layer--run-slide-out-right': '[transform:translateX(100%)]',
	'dashboard-sidebar-album-index':
		'[position:absolute] [right:6px] [bottom:6px] [background:var(--db-p2-color-1)] [color:var(--db-p2-color-2)] [font-size:0.65em] p-[1px_7px] rounded-[999px] [pointer-events:none] [user-select:none]',
	'dashboard-sidebar-album-nav':
		'[position:absolute] [top:50%] [transform:translateY(-50%)] w-[24px] h-[32px] flex [align-items:center] [justify-content:center] p-[0] [border:none] [background:var(--db-p2-color-3)] [color:var(--db-p2-color-2)] [cursor:pointer] [opacity:0] [visibility:hidden] motion-safe:[transition:opacity_0.15s_ease] [box-shadow:none] [&:hover]:[background:var(--db-p2-color-4)] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-sidebar-album-nav--prev': '[left:0] rounded-[0_var(--db-radius-sm)_var(--db-radius-sm)_0]',
	'dashboard-sidebar-album-nav--next': '[right:0] rounded-[var(--db-radius-sm)_0_0_var(--db-radius-sm)]',
	'dashboard-sidebar-album--single':
		'[&_.dashboard-sidebar-album-nav]:hidden [&_.dashboard-sidebar-album-index]:hidden',
	'dashboard-sidebar-album-placeholder':
		'[aspect-ratio:1_/_1] flex [flex-direction:column] [align-items:center] [justify-content:center] gap-[6px] [border:1px_dashed_var(--db-border-card)] rounded-[var(--db-radius-sm)] [color:var(--db-text-muted)] [font-size:0.75em] [user-select:none]',
	'dashboard-sidebar-album-placeholder-icon': 'flex [opacity:0.5] [&_svg]:w-[22px] [&_svg]:h-[22px]',
	'dashboard-sidebar-album-placeholder-text': 'p-[0_10px] [text-align:center]',
	'dashboard-section-name-input':
		'[flex:1] min-w-[0] [box-sizing:border-box] p-[7px_10px] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-5))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [color:var(--db-text,_var(--text-normal))] [font-size:0.9em] [&:focus]:[border-color:var(--db-accent,_var(--interactive-accent))] h-[30px]',
	'dashboard-modal-btn':
		'[&.is-disabled]:[opacity:0.45] [&.is-disabled]:[pointer-events:none] p-[6px_16px] rounded-[var(--db-radius-sm,_6px)] [font-size:0.9em] [cursor:pointer] [background:var(--db-bg-btn,_var(--background-modifier-hover))] [border:1px_solid_var(--db-border-btn,_var(--background-modifier-border))] [color:var(--db-text,_var(--text-normal))] motion-safe:[transition:_opacity_0.15s_ease] [&:hover]:[background:var(--db-bg-btn-hover,_var(--background-modifier-hover))] h-[var(--input-height)]',
	'dashboard-task-input':
		'w-[100%] [-webkit-appearance:none] [appearance:none] [background:none] [border:none] [box-shadow:none] [color:var(--db-text-muted)] [font-size:0.9em] p-[4px_0] [&::placeholder]:[color:var(--db-text-faint)] [&::placeholder]:[opacity:0.5] [&:focus]:[color:var(--db-text)] max-[641px]:[font-size:0.85em] max-[641px]:p-[3px_0]',
	'dashboard-progress': 'flex [align-items:center] gap-[8px] [margin-bottom:6px]',
	'dashboard-progress-bar': '[flex:1] h-[6px] [background:var(--db-bg-hover)] rounded-[3px] [overflow:hidden]',
	'dashboard-progress-fill':
		'h-[100%] [background:linear-gradient(90deg,_var(--db-progress-from),_var(--db-progress-to))] rounded-[3px]',
	'dashboard-modal':
		'rounded-[var(--db-radius-lg,_12px)] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] [background:var(--db-bg-modal,_var(--db-bg-card,_var(--background-secondary)))] [backdrop-filter:var(--db-backdrop-blur,_blur(24px))] [-webkit-backdrop-filter:var(--db-backdrop-blur,_blur(24px))] [color:var(--db-text,_var(--text-normal))] p-[28px_32px_24px] [&.dashboard-modal--compact]:p-[18px_20px_16px] [&.modal]:[background:transparent] [&.modal]:[border:none] [&.modal]:[box-shadow:none] [&_h2]:[color:var(--db-accent,_var(--text-normal))] [&_h2]:[border-bottom:1px_solid_var(--db-border,_var(--background-modifier-border))] [&_h2]:[padding-bottom:10px] [&_h2]:[margin-bottom:4px] [&_.dashboard-modal-form]:flex [&_.dashboard-modal-form]:[flex-direction:column] [&_.dashboard-modal-form]:gap-[16px] [&_.dashboard-modal-form]:[margin-top:16px] max-[641px]:[backdrop-filter:none] max-[641px]:[-webkit-backdrop-filter:none] max-[641px]:rounded-[var(--db-radius-md)] [&_.dashboard-section-name-input]:[border:1px_solid_var(--db-border-card,_var(--db-p2-color-29))] [&_.dashboard-section-name-input]:[background:var(--db-bg-input,_var(--background-modifier-form-field))] [&_.dashboard-section-name-input]:[box-shadow:none] [&_.dashboard-section-name-input:focus]:[border-color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-library-config-section':
		'[background:var(--db-bg-hover,_var(--db-p2-color-6))] [border:1px_solid_var(--db-border,_var(--db-p2-color-7))] rounded-[10px] p-[12px] [margin-bottom:16px]',
	'dashboard-modal-form':
		'[&_label]:[font-size:0.9em] [&_label]:[font-weight:500] [&_label]:block [&_label]:[margin-bottom:4px] [&_label]:[color:var(--db-text,_var(--text-normal))]',
	'dashboard-modal-input':
		'w-[100%] p-[8px_12px] [border:1px_solid_var(--db-border-input,_var(--background-modifier-border))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [color:var(--db-text,_var(--text-normal))] [font-size:0.95em] [&:focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))]',
	'dashboard-modal-footer':
		'flex gap-[8px] [justify-content:flex-end] [margin-top:16px] [padding-top:12px] [border-top:1px_solid_var(--db-border,_var(--background-modifier-border))]',
	'dashboard-modal-btn--cancel': '[color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-modal-btn--confirm':
		'[background:var(--db-accent,_var(--interactive-accent))] [border-color:transparent] [color:var(--db-text-inverse,_var(--text-on-accent))] [font-weight:500] [&:hover]:[background:var(--db-accent,_var(--interactive-accent))] [&:hover]:[opacity:0.88]',
	'dashboard-modal-color-input':
		'w-[40px] h-[32px] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] rounded-[var(--db-radius-sm,_6px)] [background:none] [cursor:pointer] p-[2px] [&::-webkit-color-swatch-wrapper]:p-[0] [&::-webkit-color-swatch]:[border:none] [&::-webkit-color-swatch]:rounded-[4px] w-[38px] h-[28px] p-[0] [border:1px_solid_var(--db-border,_var(--background-modifier-border))] rounded-[6px] [background:transparent]',
	'dashboard-library-calendar-popup':
		'[background:var(--db-bg-modal,_var(--db-bg,_var(--background-primary)))] [color:var(--db-text,_var(--text-normal))] [border-color:var(--db-border-card,_var(--background-modifier-border))] [&_.dashboard-task-reminder-calendar-day]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-task-reminder-calendar-day--today]:[color:var(--db-accent,_var(--interactive-accent))] [&_.dashboard-task-reminder-calendar-day--selected]:[background:var(--db-accent,_var(--interactive-accent))] [&_.dashboard-task-reminder-calendar-day--selected]:[color:var(--db-text-inverse,_var(--text-on-accent))] [&_.dashboard-task-reminder-calendar-day--in-range]:[background:color-mix(in_srgb,_var(--db-accent,_var(--db-p2-color-9))_20%,_transparent)] [&_.dashboard-task-reminder-calendar-day--in-range]:rounded-[0] [&_.dashboard-task-reminder-calendar-day--other-month]:[color:var(--db-text-muted,_var(--text-faint))] [&_.dashboard-task-reminder-calendar-nav_span]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-task-reminder-calendar-nav_button]:[color:var(--db-text-muted,_var(--text-muted))] [&_.dashboard-task-reminder-calendar-nav_button:hover]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-task-reminder-calendar-nav_button:hover]:[background:var(--db-bg-card-hover,_var(--db-p2-color-10))] [&_.dashboard-task-reminder-popup-btns_button]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-task-reminder-popup-btns_button.mod-cta]:[color:var(--db-p2-color-2)] [&_.dashboard-task-reminder-time]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-task-reminder-time_[role=combobox]]:[background:var(--db-bg-input,_var(--db-bg-card))] [&_.dashboard-task-reminder-time_[role=combobox]]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-task-reminder-time_[role=combobox]]:[border-color:var(--db-border-input,_var(--db-border-card))]',
	'dashboard-library-calendar-status':
		'[font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] [text-align:center]',
	'dashboard-library-content': 'p-[0_0_8px_0] [flex:1] min-h-[0] min-w-[0] flex [flex-direction:column]',
	'dashboard-library-toolbar':
		'[flex-shrink:0] flex [align-items:center] gap-[8px] p-[6px_8px] [background:var(--db-bg-card,_var(--db-p2-color-11))] rounded-[var(--db-radius-md,_10px)] [margin-bottom:8px] [flex-wrap:wrap]',
	'dashboard-library-pagination': '[flex-shrink:0] p-[4px_0_0_0]',
	'dashboard-library-search':
		'[flex:1] min-w-[120px] max-w-[240px] p-[4px_10px] [border:1px_solid_var(--db-border-input,_var(--db-p2-color-10))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-input,_var(--db-p2-color-12))] [color:var(--db-text,_var(--text-normal))] [font-size:0.75em] [&:focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))] [&::placeholder]:[color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-library-sort':
		'p-[4px_8px] [border:1px_solid_var(--db-border-input,_var(--db-p2-color-10))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-input,_var(--db-p2-color-12))] [color:var(--db-text,_var(--text-normal))] [font-size:0.75em] [cursor:pointer] [&:focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))]',
	'dashboard-library-sort-dir':
		'[cursor:pointer] p-[4px] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted,_var(--text-muted))] flex [align-items:center] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&:hover]:[background:var(--db-bg-hover,_var(--db-p2-color-12))]',
	'dashboard-library-view-toggle':
		'flex gap-[2px] [background:var(--db-bg-input,_var(--db-p2-color-12))] rounded-[var(--db-radius-sm,_6px)] p-[2px]',
	'dashboard-library-view-btn':
		'[cursor:pointer] p-[4px_8px] rounded-[4px] [color:var(--db-text-muted,_var(--text-muted))] flex [align-items:center] [font-size:0.75em] motion-safe:[transition:_transform_0.15s_ease] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&:hover]:[background:var(--db-bg-hover,_var(--db-p2-color-12))] [&.active]:[background:var(--db-bg-btn,_var(--db-p2-color-13))] [&.active]:[color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-library-config-hint':
		'[&.is-hidden]:hidden [font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] [margin-bottom:6px]',
	'dashboard-library-toolbar-spacer': '[flex:1]',
	'dashboard-library-count':
		'[font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] whitespace-nowrap [margin-left:auto]',
	'dashboard-library-page-size':
		'p-[3px_6px] [border:1px_solid_var(--db-border-input,_var(--db-p2-color-10))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-input,_var(--db-p2-color-12))] [color:var(--db-text-muted,_var(--text-muted))] [font-size:0.6875em] [cursor:pointer] [&:focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))] [&.is-hidden]:hidden',
	'dashboard-library-filter-btn':
		'[cursor:pointer] p-[4px] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted,_var(--text-muted))] flex [align-items:center] motion-safe:[transition:_transform_0.15s_ease] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&:hover]:[background:var(--db-bg-hover,_var(--db-p2-color-12))] [&.active]:[color:var(--db-accent,_var(--interactive-accent))] [&.active]:[background:var(--db-bg-btn,_var(--db-p2-color-13))]',
	'dashboard-library-filter-tags':
		'flex gap-[4px] [flex-wrap:nowrap] [align-items:center] min-w-[0] [flex:0_1_auto] [overflow:hidden]',
	'dashboard-library-filter-tag':
		'inline-flex [align-items:center] gap-[4px] p-[2px_8px] rounded-[10px] [font-size:0.6875em] [background:var(--db-bg-btn,_var(--db-p2-color-13))] [color:var(--db-accent,_var(--interactive-accent))] [border:1px_solid_transparent] whitespace-nowrap max-w-[160px] min-w-[0]',
	'dashboard-library-filter-tag-label': '[overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap min-w-[0]',
	'dashboard-library-filter-tag-x':
		'[cursor:pointer] [font-size:0.875em] [line-height:1] [opacity:0.6] motion-safe:[transition:opacity_0.15s_ease] [&:hover]:[opacity:1]',
	'dashboard-library-filter-popup':
		'[position:relative] [margin-top:4px] p-[12px] rounded-[var(--db-radius-md,_10px)] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-14))] [background:var(--db-bg-modal,_var(--db-bg,_var(--background-primary)))] max-w-[320px] [box-shadow:0_4px_16px_var(--db-p2-color-15)] [z-index:var(--layer-content)] [color:var(--db-text,_var(--db-p2-color-16))]',
	'dashboard-library-quickfilter-row': '[margin-bottom:8px]',
	'dashboard-library-quickfilter-label':
		'block [font-size:0.75em] [color:var(--db-text-muted,_var(--text-muted))] [margin-bottom:4px]',
	'dashboard-library-filter-popup-prop':
		'p-[4px_8px] [border:1px_solid_var(--db-p2-color-17)] rounded-[6px] [background:var(--db-p2-color-18)] [color:var(--db-p2-color-19)] [font-size:0.75em] min-w-[120px]',
	'dashboard-library-empty':
		'p-[40px_20px] [text-align:center] [color:var(--db-text-muted,_var(--text-muted))] [font-size:0.8125em]',
	'dashboard-library-list': 'flex [flex-direction:column] gap-[2px]',
	'dashboard-library-list-item':
		'flex [align-items:center] gap-[12px] p-[6px_10px] rounded-[var(--db-radius-sm,_6px)] [cursor:pointer] [&:hover]:[background:var(--db-bg-card-hover,_var(--db-p2-color-8))]',
	'dashboard-library-table':
		'w-[100%] [border-collapse:collapse] [font-size:0.75em] [&_th]:[text-align:left] [&_th]:p-[6px_10px] [&_th]:[font-weight:600] [&_th]:[color:var(--db-text-muted,_var(--text-muted))] [&_th]:[border-bottom:1px_solid_var(--db-border,_var(--db-p2-color-10))] [&_th]:[font-size:0.6875em] [&_th]:[text-transform:uppercase] [&_th]:[letter-spacing:0.5px] [&_th]:[cursor:pointer] [&_th]:whitespace-nowrap [&_th:hover]:[color:var(--db-text,_var(--text-normal))] [&_td]:p-[6px_10px] [&_td]:[color:var(--db-text,_var(--text-normal))] [&_td]:[border-bottom:1px_solid_var(--db-border,_var(--db-p2-color-20))] [&_td]:[overflow:hidden] [&_td]:[text-overflow:ellipsis] [&_td]:whitespace-nowrap [&_td]:max-w-[200px] [&_tr]:[cursor:pointer] [&_tbody_tr:hover]:[background:var(--db-bg-card-hover,_var(--db-p2-color-8))] [&_tr:hover_.dashboard-library-table-delete]:[opacity:1]',
	'dashboard-library-table-edit-input':
		'w-[100%] p-[2px_4px] [border:1px_solid_var(--db-accent,_var(--interactive-accent))] rounded-[3px] [background:var(--db-bg-input,_var(--db-p2-color-12))] [color:var(--db-text,_var(--text-normal))] [font-size:0.75em] [box-sizing:border-box]',
	'dashboard-library-config-section-title':
		'[font-size:0.8125em] [font-weight:600] [color:var(--db-text,_var(--text-normal))] [margin-bottom:8px]',
	'dashboard-library-config-filters': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-library-config-inline-row': 'flex [align-items:center] gap-[8px] [margin-top:6px]',
	'dashboard-library-config-inline-label': '[font-size:0.75em] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-library-config-number':
		'w-[64px] h-[26px] p-[0_6px] [box-sizing:border-box] [font-size:0.75em] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-library-filter-property':
		'p-[4px_8px] [border:1px_solid_var(--db-border-input,_var(--db-p2-color-10))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-p2-color-11))] [color:var(--db-text,_var(--text-normal))] [font-size:0.75em] max-w-[200px] [&:focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))] h-[30px]',
	'dashboard-library-filter-chip':
		'p-[2px_8px] rounded-[10px] [font-size:0.6875em] [background:var(--db-bg-btn,_var(--db-p2-color-13))] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] motion-safe:[transition:_transform_0.1s_ease] [border:1px_solid_transparent] [&:hover]:[border-color:var(--db-accent,_var(--interactive-accent))] [&.active]:[background:var(--db-accent,_var(--interactive-accent))] [&.active]:[color:var(--db-p2-color-21)] [&.active]:[border-color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-library-filter-empty':
		'[font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] p-[2px_4px]',
	'dashboard-modal-header': 'flex [align-items:center] [justify-content:space-between] [margin-bottom:16px]',
	'dashboard-modal-title': '[font-size:1em] [font-weight:600]',
	'dashboard-alltasks-exclude-chips': 'flex [flex-wrap:wrap] gap-[6px] [margin-bottom:8px]',
	'dashboard-alltasks-exclude-chip':
		'inline-flex [align-items:center] gap-[4px] [font-size:0.75em] p-[2px_8px] rounded-[999px] [background:var(--db-bg-hover,_var(--db-p2-color-10))] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-alltasks-exclude-chip-x':
		'[cursor:pointer] [opacity:0.6] [font-weight:700] [&:hover]:[opacity:1] [&:hover]:[color:var(--db-p2-color-22)]',
	'dashboard-weread-widgets': 'flex [flex-direction:column] gap-[18px] [flex:1] min-h-[0] [overflow-y:auto]',
	'dashboard-weread-widget': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-weread-widget-title':
		'[font-size:0.8em] [font-weight:600] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-pager': 'flex [align-items:center] [justify-content:center] gap-[12px] [margin-top:8px]',
	'dashboard-weread-pager-btn':
		'inline-flex [align-items:center] [justify-content:center] min-w-[26px] h-[24px] p-[0_6px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-btn,_var(--db-p2-color-13))] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] [&:hover:not(:disabled)]:[color:var(--db-accent,_var(--interactive-accent))] [&:hover:not(:disabled)]:[border-color:var(--db-accent,_var(--interactive-accent))] [&:disabled]:[opacity:0.4] [&:disabled]:[cursor:default]',
	'dashboard-weread-pager-info': '[font-size:0.75em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-cfg-list': 'flex [flex-direction:column] gap-[8px] [margin-bottom:8px]',
	'dashboard-weread-cfg-row':
		'flex [align-items:flex-start] gap-[6px] p-[8px] rounded-[var(--db-radius-sm,_6px)] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-8))]',
	'dashboard-weread-cfg-main': 'flex [align-items:center] gap-[6px] [flex:1] min-w-[0] [flex-wrap:wrap]',
	'dashboard-weread-cfg-title': '[flex:1] min-w-[100px] h-[30px] [font-size:13px] md:[font-size:13px] p-[4px_8px]',
	'dashboard-weread-cfg-ops': 'flex [align-items:center] gap-[2px] [flex-shrink:0]',
	'dashboard-weread-cfg-op':
		'inline-flex [align-items:center] [justify-content:center] w-[26px] h-[26px] p-[0] rounded-[var(--db-radius-sm,_6px)] [background:transparent] [border:none] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] [&:hover:not(:disabled)]:[color:var(--db-accent,_var(--interactive-accent))] [&:disabled]:[opacity:0.35] [&:disabled]:[cursor:default]',
	'dashboard-weread-cfg-add': '[margin-top:4px]',
	'dashboard-weread-content': 'min-h-[60px]',
	'dashboard-weread-groups': 'flex [flex-direction:column] gap-[18px]',
	'dashboard-weread-group':
		'[--weread-group-accent:var(--db-accent,_var(--interactive-accent))] flex [flex-direction:column] gap-[9px]',
	'dashboard-weread-group--finished': '[--weread-group-accent:var(--color-green,_var(--db-p2-color-23))]',
	'dashboard-weread-group--ideas': '[--weread-group-accent:var(--color-green,_var(--db-p2-color-23))]',
	'dashboard-weread-group--notStarted': '[--weread-group-accent:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-group--never': '[--weread-group-accent:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-group--none': '[--weread-group-accent:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-group--audio': '[--weread-group-accent:var(--color-orange,_var(--db-p2-color-24))]',
	'dashboard-weread-group--recent30': '[--weread-group-accent:var(--color-orange,_var(--db-p2-color-24))]',
	'dashboard-weread-group--article': '[--weread-group-accent:var(--color-cyan,_var(--db-p2-color-25))]',
	'dashboard-weread-group--highlights': '[--weread-group-accent:var(--color-cyan,_var(--db-p2-color-25))]',
	'dashboard-weread-group-head':
		'grid [grid-template-columns:24px_minmax(0,_1fr)_auto] [align-items:center] gap-[7px] min-h-[34px] p-[5px_9px_5px_7px] [border-left:3px_solid_var(--weread-group-accent)] rounded-[0_var(--db-radius-sm,_6px)_var(--db-radius-sm,_6px)_0] [background:linear-gradient(90deg,_color-mix(in_srgb,_var(--weread-group-accent)_12%,_transparent),_transparent_78%)]',
	'dashboard-weread-group-icon':
		'inline-flex [align-items:center] [justify-content:center] w-[24px] h-[24px] rounded-[7px] [color:var(--weread-group-accent)] [background:color-mix(in_srgb,_var(--weread-group-accent)_12%,_transparent)] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-weread-group-name':
		'[font-size:0.78em] [font-weight:650] [letter-spacing:0.01em] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-weread-group-count':
		'min-w-[22px] p-[1px_7px] [border:1px_solid_color-mix(in_srgb,_var(--weread-group-accent)_28%,_transparent)] rounded-[999px] [font-size:0.64em] [font-variant-numeric:tabular-nums] [text-align:center] [color:var(--weread-group-accent)]',
	'dashboard-weread-hint': 'p-[20px_8px] [text-align:center]',
	'dashboard-weread-hint-title': '[font-size:0.85em] [color:var(--db-text,_var(--text-normal))] [margin-bottom:4px]',
	'dashboard-weread-hint-desc': '[font-size:0.75em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-grid': 'grid [grid-template-columns:repeat(auto-fill,_minmax(110px,_1fr))] gap-[10px]',
	'dashboard-weread-book': 'flex [flex-direction:column] gap-[4px]',
	'dashboard-weread-book-cover':
		'w-[100%] [aspect-ratio:3_/_4] [background-size:cover] [background-position:center] rounded-[var(--db-radius-sm,_6px)] [background-color:var(--db-bg-btn,_var(--db-p2-color-13))]',
	'dashboard-weread-book-cover--placeholder': '[background-image:none] flex',
	'dashboard-weread-book-info': 'flex [flex-direction:column] gap-[2px]',
	'dashboard-weread-book-title':
		'[font-size:0.78em] [font-weight:600] [color:var(--db-text,_var(--text-normal))] [line-height:1.3] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [overflow:hidden]',
	'dashboard-weread-book-author':
		'[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-weread-book-pct': '[font-size:0.65em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-book-meta': 'flex [align-items:center] [justify-content:space-between] gap-[5px]',
	'dashboard-weread-progress-meta': 'flex [align-items:center] [justify-content:space-between] gap-[5px]',
	'dashboard-weread-book-kind':
		'[font-size:0.61em] [line-height:1.35] [color:var(--db-text-muted,_var(--text-muted))] p-[1px_5px] rounded-[4px] [background:var(--db-bg-btn,_var(--db-p2-color-13))]',
	'dashboard-weread-book-notes':
		'[font-size:0.61em] [line-height:1.35] [color:var(--db-text-muted,_var(--text-muted))] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-weread-book-state':
		'[font-size:0.61em] [line-height:1.35] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-progress':
		'h-[3px] rounded-[2px] [background:var(--db-bg-btn,_var(--db-p2-color-8))] [overflow:hidden] [margin-top:2px]',
	'dashboard-weread-progress-fill': 'h-[100%] [background:var(--db-accent,_var(--interactive-accent))] rounded-[2px]',
	'dashboard-weread-stat-panel':
		'grid [grid-template-columns:minmax(172px,_0.78fr)_minmax(0,_1.75fr)_minmax(128px,_0.62fr)] [align-items:stretch] rounded-[var(--db-radius-md,_10px)] [background:var(--db-bg-card,_var(--db-p2-color-11))] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] [overflow:hidden] min-w-[0] @max-[521px]:[grid-template-columns:1fr] max-[521px]:[grid-template-columns:1fr]',
	'dashboard-weread-stat-panel-shelf':
		'flex [flex-direction:column] [align-items:center] [justify-content:center] gap-[10px] p-[14px_12px] [background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_10%,_var(--db-bg-card,_var(--db-p2-color-11)))] [border-right:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] @max-[521px]:[border-right:none] @max-[521px]:[border-bottom:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] max-[521px]:[border-right:none] max-[521px]:[border-bottom:1px_solid_var(--db-border-card,_var(--db-p2-color-8))]',
	'dashboard-weread-stat-panel-mid':
		'flex [flex-direction:column] [align-items:center] [justify-content:center] gap-[8px] p-[14px_14px] min-w-[0] [border-right:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] @max-[521px]:[border-right:none] @max-[521px]:[border-bottom:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] max-[521px]:[border-right:none] max-[521px]:[border-bottom:1px_solid_var(--db-border-card,_var(--db-p2-color-8))]',
	'dashboard-weread-heatmap':
		'grid [grid-auto-flow:column] [grid-template-rows:repeat(7,_auto)] gap-[2px] w-[100%] [align-content:stretch]',
	'dashboard-weread-heatmap-cell':
		'[aspect-ratio:1] rounded-[2px] min-w-[0] [background:var(--db-bg-hover,_var(--db-p2-color-26))]',
	'dashboard-weread-heatmap-cell--today': '[box-shadow:0_0_0_1.5px_var(--db-text,_var(--text-normal))]',
	'dashboard-weread-heatmap-cell--blank': '[background:transparent]',
	'dashboard-weread-stat-panel-right':
		'flex [flex-direction:column] min-w-[0] @max-[521px]:[flex-direction:row] max-[521px]:[flex-direction:row]',
	'dashboard-weread-stat-panel-cell':
		'[flex:1] flex [flex-direction:column] [align-items:center] [justify-content:center] gap-[4px] p-[12px_10px] min-w-[0] [&_+_.dashboard-weread-stat-panel-cell]:[border-top:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] @max-[521px]:[&_+_.dashboard-weread-stat-panel-cell]:[border-top:none] @max-[521px]:[&_+_.dashboard-weread-stat-panel-cell]:[border-left:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] max-[521px]:[&_+_.dashboard-weread-stat-panel-cell]:[border-top:none] max-[521px]:[&_+_.dashboard-weread-stat-panel-cell]:[border-left:1px_solid_var(--db-border-card,_var(--db-p2-color-8))]',
	'dashboard-weread-donut-wrap': '[position:relative] w-[108px] h-[108px] [flex-shrink:0]',
	'dashboard-weread-donut-svg': 'block',
	'dashboard-weread-donut-center':
		'[position:absolute] [inset:0] flex [flex-direction:column] [align-items:center] [justify-content:center] gap-[1px] [pointer-events:none]',
	'dashboard-weread-donut-total':
		'[font-size:1.15em] [font-weight:700] [color:var(--db-text,_var(--text-normal))] [line-height:1.1]',
	'dashboard-weread-donut-unit': '[font-size:0.6em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-donut-seg--finished': '[stroke:var(--color-green,_var(--db-p2-color-23))]',
	'dashboard-weread-donut-seg--reading': '[stroke:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-weread-donut-seg--notStarted': '[stroke:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-legend': 'flex [flex-direction:column] gap-[4px] w-[100%] max-w-[138px]',
	'dashboard-weread-legend-item': 'flex [align-items:center] gap-[6px] min-w-[0]',
	'dashboard-weread-legend-dot--finished':
		'w-[8px] h-[8px] rounded-[50%] [flex-shrink:0] [background:var(--color-green,_var(--db-p2-color-23))]',
	'dashboard-weread-legend-dot--reading':
		'w-[8px] h-[8px] rounded-[50%] [flex-shrink:0] [background:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-weread-legend-dot--notStarted':
		'w-[8px] h-[8px] rounded-[50%] [flex-shrink:0] [background:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-legend-label':
		'[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-weread-legend-count':
		'[font-size:0.68em] [font-weight:700] [color:var(--db-text,_var(--text-normal))] [font-variant-numeric:tabular-nums]',
	'dashboard-weread-kpi-caption-extra':
		'[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))] [font-variant-numeric:tabular-nums]',
	'dashboard-weread-stat-value':
		'[font-size:1.1em] [font-weight:700] [color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-weread-stat-label':
		'[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))] [text-align:center]',
	'dashboard-weread-stats-wrap': 'flex [flex-direction:column] gap-[14px] min-w-[0] [container-type:inline-size]',
	'dashboard-weread-stats-toggle':
		'flex gap-[2px] [background:var(--db-bg-hover,_var(--db-p2-color-26))] rounded-[8px] p-[2px] w-[fit-content] [margin-left:auto]',
	'dashboard-weread-stats-toggle-btn':
		'[border:none] [background:transparent] [color:var(--db-text-muted,_var(--text-muted))] [font-size:0.72em] [font-weight:500] p-[4px_12px] rounded-[6px] [cursor:pointer] [box-shadow:none] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&.active]:[background:var(--db-bg-card,_var(--db-p2-color-8))] [&.active]:[color:var(--db-text,_var(--text-normal))] [&.active]:[font-weight:600]',
	'dashboard-weread-stats-body':
		'grid [grid-template-columns:repeat(2,_minmax(0,_1fr))] gap-[14px] min-w-[0] [&_>_.dashboard-weread-hint]:[grid-column:1_/_-1] max-[641px]:[grid-template-columns:1fr]',
	'dashboard-weread-stats-block': 'min-w-[0]',
	'dashboard-weread-stats-block--wide': '[grid-column:1_/_-1]',
	'dashboard-weread-stats-section': 'flex [flex-direction:column] gap-[8px] min-w-[0]',
	'dashboard-weread-stats-section-head': 'flex [align-items:baseline] [justify-content:space-between] gap-[8px]',
	'dashboard-weread-stats-section-title':
		'[font-size:0.78em] [font-weight:600] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-weread-streak':
		'[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))] [font-variant-numeric:tabular-nums] [flex-shrink:0]',
	'dashboard-weread-trend-svg': 'block w-[100%] h-[auto]',
	'dashboard-weread-trend-bar': '[fill:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-weread-trend-tick': '[font-size:9px] [fill:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-topread': 'flex [flex-direction:column] gap-[6px]',
	'dashboard-weread-topread-row':
		'flex [align-items:center] [justify-content:space-between] gap-[8px] p-[6px_8px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-hover,_var(--db-p2-color-27))]',
	'dashboard-weread-topread-meta': 'min-w-[0]',
	'dashboard-weread-topread-title':
		'[font-size:0.74em] [font-weight:600] [color:var(--db-text,_var(--text-normal))] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-weread-topread-author':
		'[font-size:0.64em] [color:var(--db-text-muted,_var(--text-muted))] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-weread-topread-time':
		'[font-size:0.68em] [color:var(--db-accent,_var(--interactive-accent))] [font-variant-numeric:tabular-nums] [flex-shrink:0]',
	'dashboard-weread-prefercat': 'flex [flex-direction:column] gap-[6px]',
	'dashboard-weread-prefercat-row':
		'grid [grid-template-columns:minmax(56px,_88px)_1fr_auto] [align-items:center] gap-[8px] min-w-[0]',
	'dashboard-weread-prefercat-name':
		'[font-size:0.7em] [color:var(--db-text,_var(--text-normal))] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-weread-prefercat-bar-wrap':
		'h-[6px] rounded-[3px] [background:var(--db-bg-hover,_var(--db-p2-color-26))] [overflow:hidden]',
	'dashboard-weread-prefercat-bar': 'h-[100%] rounded-[3px] [background:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-weread-prefercat-val':
		'[font-size:0.64em] [color:var(--db-text-muted,_var(--text-muted))] [font-variant-numeric:tabular-nums] [flex-shrink:0]',
	'dashboard-weread-notebooks': 'flex [flex-direction:column] gap-[4px]',
	'dashboard-weread-notebook':
		'rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-p2-color-20))] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-10))] [overflow:hidden]',
	'dashboard-weread-notebook-head': 'flex [align-items:center] gap-[8px] p-[8px_10px] [cursor:pointer]',
	'dashboard-weread-notebook-meta': 'flex [flex-direction:column] gap-[2px] min-w-[0] [flex:1] [margin-right:auto]',
	'dashboard-weread-notebook-count': '[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-weread-notebook-chevron': '[color:var(--db-text-muted,_var(--text-muted))] [font-size:0.8em]',
	'dashboard-weread-notebook-detail': 'hidden [flex-direction:column] gap-[4px] p-[6px_10px_10px]',
	'dashboard-weread-notebook-detail--open': 'flex',
	'dashboard-weread-highlight':
		'[font-size:0.75em] [line-height:1.5] [color:var(--db-text,_var(--text-normal))] [border-left:2px_solid_var(--db-accent,_var(--interactive-accent))] p-[2px_0_2px_8px]',
	'dashboard-ticktick-widgets': 'flex [flex-direction:column] gap-[18px] [flex:1] min-h-[0] [overflow-y:auto]',
	'dashboard-ticktick-hint': 'p-[14px_8px] [text-align:center]',
	'dashboard-ticktick-hint-title': '[font-size:0.85em] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-ticktick-hint-desc':
		'[font-size:0.72em] [color:var(--db-text-muted,_var(--text-muted))] [margin-top:4px]',
	'dashboard-ticktick-list': 'flex [flex-direction:column] gap-[4px]',
	'dashboard-ticktick-row':
		'flex [align-items:flex-start] gap-[8px] p-[6px_8px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-p2-color-20))] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-10))] [&:hover_.dashboard-ticktick-edit-btn]:[opacity:0.8]',
	'dashboard-ticktick-check':
		'flex [align-items:center] [justify-content:center] w-[16px] h-[16px] [margin-top:3px] [flex-shrink:0] [color:var(--db-text-faint,_var(--text-faint))] [&_svg]:w-[16px] [&_svg]:h-[16px] [cursor:pointer]',
	'dashboard-ticktick-check--done': '[color:var(--db-p2-color-28)]',
	'dashboard-ticktick-main': 'flex [flex-direction:column] gap-[2px] min-w-[0] [flex:1]',
	'dashboard-ticktick-title-line': 'flex [align-items:center] gap-[6px] [flex-wrap:wrap]',
	'dashboard-ticktick-title': '[font-size:0.82em] [line-height:1.3] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-ticktick-title--done': '[text-decoration:line-through] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-ticktick-badge':
		'[font-size:0.62em] p-[1px_6px] rounded-[8px] [background:var(--db-bg-btn,_var(--db-p2-color-13))] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-ticktick-meta': '[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-ticktick-proj-dot': 'w-[8px] h-[8px] rounded-[50%] [flex-shrink:0]',
	'dashboard-ticktick-group-name': '[font-size:0.78em] [font-weight:600] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-ticktick-group-count': '[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-ticktick-login-status': 'min-h-[18px] m-[6px_0]',
	'dashboard-ticktick-login-info': '[font-size:0.78em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-ticktick-login-error': '[font-size:0.78em] [color:var(--db-danger,_var(--db-p2-color-22))]',
	'dashboard-ticktick-manual':
		'[margin-top:16px] [padding-top:12px] [border-top:1px_solid_var(--db-border-card,_var(--db-p2-color-10))]',
	'dashboard-weread-notebook-import':
		'inline-flex [align-items:center] [justify-content:center] w-[26px] h-[26px] p-[0] rounded-[var(--db-radius-sm,_6px)] [background:transparent] [background-image:none] [box-shadow:none] [border:none] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] [flex-shrink:0] [&:hover:not(:disabled)]:[color:var(--db-accent,_var(--interactive-accent))] [&:disabled]:[opacity:0.5] [&:disabled]:[cursor:default]',
	'dashboard-weread-cfg-filter-group': 'w-[100%]',
	'dashboard-weread-cfg-grouping':
		'grid [grid-template-columns:minmax(90px,_auto)_minmax(140px,_1fr)] [align-items:center] gap-[8px] w-[100%] [margin-top:4px] [&_.dashboard-weread-cfg-filter-label]:[margin-bottom:0] max-[601px]:[grid-template-columns:1fr] max-[601px]:gap-[4px]',
	'dashboard-weread-cfg-filter-panel':
		'grid [grid-template-columns:repeat(2,_minmax(0,_1fr))] gap-[11px_14px] w-[100%] [margin-top:4px] p-[10px] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] rounded-[var(--db-radius-md,_10px)] [background:color-mix(in_srgb,_var(--db-bg-card,_var(--background-secondary))_82%,_transparent)] max-[601px]:[grid-template-columns:1fr]',
	'dashboard-weread-cfg-filter-panel-title':
		'[grid-column:1_/_-1] [font-size:0.72em] [font-weight:650] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-weread-cfg-filter-label':
		'[font-size:0.68em] [color:var(--db-text-muted,_var(--text-muted))] [margin-bottom:4px]',
	'dashboard-weread-cfg-chip':
		'inline-flex [align-items:center] p-[2px_9px] rounded-[10px] [font-size:0.72em] [cursor:pointer] [background:var(--db-bg-btn,_var(--db-p2-color-13))] [color:var(--db-text-muted,_var(--text-muted))] [border:1px_solid_transparent] motion-safe:[transition:_transform_0.12s_ease] [&:hover]:[border-color:var(--db-accent,_var(--interactive-accent))] [&.active]:[background:var(--db-accent,_var(--interactive-accent))] [&.active]:[color:var(--db-p2-color-2)] [&.active]:[border-color:var(--db-accent,_var(--interactive-accent))] h-auto [line-height:1.3]',
	'dashboard-weread-cfg-stats-list': 'flex [flex-direction:column] gap-[2px] [margin-top:6px]',
	'dashboard-weread-cfg-stats-row':
		'flex [align-items:center] gap-[8px] p-[4px_6px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-p2-color-20))] [position:relative]',
	'dashboard-weread-cfg-stats-row--hidden': '[opacity:0.55]',
	'dashboard-weread-cfg-stats-handle':
		'inline-flex [align-items:center] [color:var(--db-text-muted,_var(--text-muted))] [cursor:grab] [flex-shrink:0] [&:active]:[cursor:grabbing]',
	'dashboard-weread-cfg-stats-label': '[font-size:0.8em] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-ticktick-edit-btn':
		'inline-flex [align-items:center] [justify-content:center] w-[20px] h-[20px] [opacity:0] motion-safe:[transition:opacity_0.12s_ease] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] [&:hover]:[color:var(--db-accent,_var(--interactive-accent))] [&:hover]:[opacity:1] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-ticktick-proj-grid': 'grid [grid-template-columns:repeat(auto-fill,_minmax(240px,_1fr))] gap-[10px]',
	'dashboard-ticktick-proj-card':
		'flex [flex-direction:column] gap-[6px] p-[10px] rounded-[var(--db-radius-md,_10px)] [background:var(--db-bg-card,_var(--db-p2-color-12))] [border:1px_solid_var(--db-border-card,_var(--db-p2-color-8))] [border-top:3px_solid_var(--proj-color,_var(--db-accent,_var(--db-p2-color-30)))] min-h-[0] [&_.dashboard-ticktick-list]:max-h-[360px] [&_.dashboard-ticktick-list]:[overflow-y:auto] [&:hover_.dashboard-ticktick-card-resize]:[border-right-color:var(--db-border-card,_var(--db-p2-color-34))]',
	'dashboard-ticktick-proj-card-head': 'flex [align-items:center] gap-[6px] [margin-bottom:2px]',
	'dashboard-ticktick-readonly-hint':
		'p-[6px_10px] [margin-bottom:8px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-p2-color-31)] [border:1px_solid_var(--db-p2-color-32)] [color:var(--db-p2-color-33)] [font-size:0.72em] [line-height:1.4]',
	'dashboard-ticktick-proj-row':
		'flex gap-[10px] [flex:1] min-h-[0] [overflow-x:auto] [overflow-y:hidden] [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] [&:hover]:[scrollbar-color:color-mix(in_srgb,_var(--db-accent)_18%,_transparent)_transparent] [&_.dashboard-ticktick-proj-card]:[flex:0_0_280px] [&_.dashboard-ticktick-proj-card]:min-w-[280px] [&_.dashboard-ticktick-proj-card]:max-w-[400px] [&_.dashboard-ticktick-proj-card]:[position:relative]',
	'dashboard-dataview-validation':
		'min-h-[18px] [font-size:11.5px] [&.is-error]:[color:var(--text-error,_var(--db-p2-color-35))]',
	'dashboard-sidebar-music-top': 'flex [align-items:center] gap-[6px] w-[100%] [margin-bottom:8px]',
	'dashboard-sidebar-music-title-icon':
		'flex [align-items:center] [flex-shrink:0] [opacity:0.85] [color:var(--db-accent)] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-sidebar-music-top-spacer': '[flex:1]',
	'dashboard-sidebar-music-icon-btn':
		'w-[20px] h-[20px] flex [align-items:center] [justify-content:center] [cursor:pointer] [opacity:0.35] [color:var(--db-text-muted)] motion-safe:[transition:opacity_0.15s] [flex-shrink:0] [&:hover]:[opacity:0.8] [&_svg]:w-[13px] [&_svg]:h-[13px]',
	'dashboard-sidebar-music-play':
		'[opacity:0.65] [color:var(--db-text)] [&:hover]:[opacity:0.95] [&_svg]:w-[16px] [&_svg]:h-[16px]',
	'dashboard-sidebar-music-now': 'flex [align-items:center] gap-[8px] [margin-bottom:6px]',
	'dashboard-sidebar-music-cover':
		'[position:relative] w-[44px] h-[44px] [flex-shrink:0] flex [align-items:center] [justify-content:center] rounded-[var(--db-radius-sm,_6px)] [overflow:hidden] [background:var(--db-bg-section,_var(--db-p2-color-36))]',
	'dashboard-sidebar-music-cover-img': 'w-[100%] h-[100%] [object-fit:cover] block',
	'dashboard-sidebar-music-cover-glyph':
		'[position:absolute] [inset:0] flex [align-items:center] [justify-content:center] [color:var(--db-text-muted)] [opacity:0.4] [&_svg]:w-[18px] [&_svg]:h-[18px]',
	'dashboard-sidebar-music-info': '[flex:1] min-w-[0] flex [flex-direction:column] gap-[2px]',
	'dashboard-sidebar-music-name':
		'[font-size:0.78em] [font-weight:600] [color:var(--db-text)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-sidebar-music-artist':
		'[font-size:0.65em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-sidebar-music-lyric':
		'[flex:1] min-w-[0] [font-size:0.68em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [user-select:none]',
	'dashboard-sidebar-music-progress':
		'flex [align-items:center] gap-[6px] [margin-bottom:6px] [&_.dashboard-sidebar-music-time:last-child]:[text-align:right]',
	'dashboard-sidebar-music-time':
		'[font-size:0.6em] [color:var(--db-text-muted)] min-w-[28px] [user-select:none] [font-variant-numeric:tabular-nums]',
	'dashboard-sidebar-music-bar': '[flex:1] [cursor:pointer] min-w-[0]',
	'dashboard-sidebar-music-controls': 'flex [align-items:center] gap-[4px]',
	'dashboard-sidebar-music-vol-area':
		"[&_input[type='range']]:w-[58px] [&_input[type='range']]:[accent-color:var(--db-accent)]",
	'dashboard-sidebar-music-popover':
		'[position:fixed] [z-index:var(--layer-content)] flex [flex-direction:column] max-h-[min(440px,_70vh)] [background:var(--db-bg-modal,_var(--db-bg-card))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-md)] [box-shadow:0_14px_36px_var(--db-p2-color-37)] [backdrop-filter:var(--db-backdrop-blur)] [-webkit-backdrop-filter:var(--db-backdrop-blur)] p-[10px] [overflow:hidden] [&_.dashboard-sidebar-music-results]:[flex:1] [&_.dashboard-sidebar-music-results]:min-h-[0] [&_.dashboard-sidebar-music-results]:max-h-[none]',
	'dashboard-sidebar-music-popover-body': 'flex [flex-direction:column] min-h-[0] [flex:1]',
	'dashboard-sidebar-music-row':
		'flex [align-items:center] gap-[6px] p-[4px_6px] rounded-[var(--db-radius-sm,_6px)] [cursor:pointer] [&:hover]:[background:var(--db-bg-card-hover,_var(--db-p2-color-38))]',
	'dashboard-sidebar-music-row--active':
		'[background:color-mix(in_srgb,_var(--db-accent)_12%,_transparent)] [&_.dashboard-sidebar-music-row-name]:[color:var(--db-accent)]',
	'dashboard-sidebar-music-row--vip': '[opacity:0.45] [cursor:default]',
	'dashboard-sidebar-music-row-play':
		'flex [align-items:center] [flex-shrink:0] [color:var(--db-accent)] [&_svg]:w-[10px] [&_svg]:h-[10px]',
	'dashboard-sidebar-music-row-label': '[flex:1] min-w-[0] flex [flex-direction:column] gap-[1px]',
	'dashboard-sidebar-music-row-name':
		'[font-size:0.7em] [color:var(--db-text)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-sidebar-music-row-sub':
		'[font-size:0.6em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-sidebar-music-vip-badge':
		'[flex-shrink:0] [font-size:0.55em] [font-weight:700] p-[1px_4px] rounded-[4px] [color:var(--db-bg-card,_var(--db-p2-color-2))] [background:color-mix(in_srgb,_var(--db-accent)_65%,_var(--db-text-muted))] [user-select:none]',
	'dashboard-sidebar-music-row-del':
		'w-[18px] h-[18px] flex [align-items:center] [justify-content:center] [flex-shrink:0] [cursor:pointer] [opacity:0.25] [color:var(--db-text-muted)] [&:hover]:[opacity:0.75] [&_svg]:w-[11px] [&_svg]:h-[11px]',
	'dashboard-sidebar-music-results':
		'max-h-[200px] [overflow-y:auto] flex [flex-direction:column] gap-[1px] [margin-top:4px]',
	'dashboard-sidebar-music-search-input':
		'w-[100%] min-w-[0] [box-sizing:border-box] [background:var(--db-bg-section,_var(--db-p2-color-36))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text)] [font-size:0.68em] p-[5px_8px] [&:focus]:[border-color:var(--db-accent)] [&::placeholder]:[color:var(--db-text-muted)] h-[var(--input-height)]',
	'dashboard-sidebar-music-import-input':
		'w-[100%] min-w-[0] [box-sizing:border-box] [background:var(--db-bg-section,_var(--db-p2-color-36))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text)] [font-size:0.68em] p-[5px_8px] [&:focus]:[border-color:var(--db-accent)] [&::placeholder]:[color:var(--db-text-muted)] [flex:1] w-[auto] h-[var(--input-height)]',
	'dashboard-sidebar-music-import-row': 'flex [align-items:center] gap-[4px] [margin-top:6px]',
	'dashboard-sidebar-music-text-btn':
		'[flex-shrink:0] [font-size:0.62em] p-[4px_9px] rounded-[var(--db-radius-sm,_6px)] [border:1px_solid_var(--db-border-card)] [color:var(--db-text)] [cursor:pointer] [user-select:none] whitespace-nowrap [&:hover]:[border-color:var(--db-accent)] [&:hover]:[color:var(--db-accent)]',
	'dashboard-sidebar-music-empty':
		'[font-size:0.65em] [color:var(--db-text-muted)] p-[10px_4px] [text-align:center] [user-select:none]',
	'dashboard-sidebar-music-panel-foot': 'flex [justify-content:flex-end] [margin-top:4px]',
	'dashboard-rss-content': 'flex [flex-direction:column] gap-[8px] min-h-[0]',
	'dashboard-rss-toolbar':
		'flex [align-items:center] gap-[8px] [flex-wrap:wrap] [&_.dashboard-toolbar-dropdown]:[flex-shrink:0]',
	'dashboard-rss-count': '[font-size:11px] [color:var(--db-text-faint)]',
	'dashboard-rss-markread':
		'inline-flex [align-items:center] [justify-content:center] w-[26px] h-[26px] rounded-[var(--db-radius-sm)] [color:var(--db-text-faint)] [cursor:pointer] [&:hover]:[color:var(--db-accent)] [&:hover]:[background:var(--db-bg-hover)] [&_svg]:w-[15px] [&_svg]:h-[15px]',
	'dashboard-rss-refreshing': '[font-size:11px] [color:var(--db-text-faint)]',
	'dashboard-rss-list':
		'flex [flex-direction:column] gap-[6px] [overflow-y:auto] min-h-[0] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] [&:hover]:[scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent]',
	'dashboard-rss-item':
		'flex [align-items:center] gap-[10px] p-[8px_10px] rounded-[var(--db-radius-md)] [background:var(--db-bg-card)] [border:1px_solid_var(--db-border-card)] [cursor:pointer] [&:hover]:[background:var(--db-bg-card-hover)] [&.is-read_.dashboard-rss-dot]:[background:var(--db-border-card)] [&.is-read_.dashboard-rss-item-title]:[color:var(--db-text-faint)] [&.is-read_.dashboard-rss-item-title]:[font-weight:500]',
	'dashboard-rss-dot': 'w-[7px] h-[7px] rounded-[50%] [background:var(--db-accent)] [flex-shrink:0]',
	'dashboard-rss-item-main': '[flex:1] min-w-[0] flex [flex-direction:column] gap-[3px]',
	'dashboard-rss-item-title':
		'[font-size:13px] [font-weight:600] [color:var(--db-text)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [line-height:1.4]',
	'dashboard-rss-item-meta':
		'flex [align-items:center] gap-[8px] [font-size:11px] [color:var(--db-text-faint)] min-w-[0] [overflow:hidden]',
	'dashboard-rss-item-feed':
		'[color:color-mix(in_srgb,_var(--db-accent)_65%,_var(--db-text))] min-w-[0] [flex:0_1_auto] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-rss-item-date': '[flex-shrink:0]',
	'dashboard-rss-item-save':
		'inline-flex [align-items:center] [justify-content:center] w-[32px] h-[32px] [flex-shrink:0] p-[0] [border:none] rounded-[var(--db-radius-sm)] [background:transparent] [box-shadow:none] [color:var(--db-text-muted)] [cursor:pointer] [&:hover]:[color:var(--db-accent)] [&:hover]:[background:var(--db-bg-hover)] [&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:[flex-shrink:0] [&.is-busy]:[opacity:0.5] [&.is-busy]:[pointer-events:none]',
	'dashboard-rss-empty': '[font-size:12px] [color:var(--db-text-faint)] p-[10px_4px] [text-align:center]',
	'dashboard-rss-empty-config': 'flex [flex-direction:column] [align-items:center] gap-[6px] p-[26px_12px]',
	'dashboard-rss-empty-config-icon': '[color:var(--db-text-faint)] [&_svg]:w-[28px] [&_svg]:h-[28px]',
	'dashboard-rss-empty-config-text': '[font-size:13px] [color:var(--db-text-muted)]',
	'dashboard-rss-empty-config-hint': '[font-size:11px] [color:var(--db-text-faint)] [margin-bottom:8px]',
	'dashboard-rss-reader-wrap':
		'flex [flex-direction:column] min-h-[0] h-[100%] p-[18px_20px_6px] h-[calc(100%_-_0.75em)]',
	'dashboard-rss-reader-header':
		'flex [align-items:flex-start] gap-[12px] [padding-bottom:12px] [border-bottom:1px_solid_var(--db-border)] [flex-shrink:0]',
	'dashboard-rss-reader-headmain': '[flex:1] min-w-[0]',
	'dashboard-rss-reader-title': '[font-size:17px] [font-weight:700] [color:var(--db-text)] [line-height:1.35]',
	'dashboard-rss-reader-meta':
		'flex [align-items:center] gap-[10px] [flex-wrap:wrap] [font-size:12px] [color:var(--db-text-faint)] [margin-top:5px]',
	'dashboard-rss-reader-feed': '[color:color-mix(in_srgb,_var(--db-accent)_65%,_var(--db-text))]',
	'dashboard-rss-reader-actions': 'flex [align-items:flex-start] gap-[6px] [flex-shrink:0] [margin-left:auto]',
	'dashboard-rss-reader-save':
		'inline-flex [align-items:center] gap-[7px] [flex-shrink:0] h-[32px] p-[0_14px] [border:1px_solid_color-mix(in_srgb,_var(--db-accent)_45%,_transparent)] rounded-[999px] [background:color-mix(in_srgb,_var(--db-accent)_16%,_transparent)] [box-shadow:none] [color:var(--db-text)] [font-size:12.5px] [font-weight:600] [cursor:pointer] whitespace-nowrap [&:hover]:[background:color-mix(in_srgb,_var(--db-accent)_26%,_transparent)] [&.is-saved]:[border-color:color-mix(in_srgb,_var(--db-text-muted)_40%,_transparent)] [&.is-saved]:[background:var(--db-bg-hover)] [&.is-saved]:[color:var(--db-text-muted)] [&.is-saved]:[font-weight:500]',
	'dashboard-rss-reader-btn':
		'inline-flex [align-items:center] [justify-content:center] w-[32px] h-[32px] p-[0] [border:none] rounded-[var(--db-radius-sm)] [background:transparent] [box-shadow:none] [color:var(--db-text-muted)] [cursor:pointer] [&:hover]:[color:var(--db-accent)] [&:hover]:[background:var(--db-bg-hover)] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:[flex-shrink:0]',
	'dashboard-rss-reader-body':
		'[flex:1] min-h-[0] [overflow-y:auto] [overscroll-behavior:contain] [margin-top:12px] [padding-right:8px] [font-size:14px] [line-height:1.7] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] [&:hover]:[scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&_img]:max-w-[100%]',
	'dashboard-rss-cfg-list': 'flex [flex-direction:column] gap-[8px] [margin-bottom:8px]',
	'dashboard-rss-cfg-row':
		'flex [align-items:center] gap-[8px] [&.is-error_.dashboard-rss-cfg-url]:[border-color:var(--db-danger)]',
	'dashboard-rss-cfg-groups': 'flex [flex-direction:column] gap-[6px] [margin-bottom:8px]',
	'dashboard-rss-cfg-group-row':
		'flex [align-items:center] gap-[8px] p-[4px_8px] rounded-[var(--db-radius-sm)] [background:var(--db-bg-hover)]',
	'dashboard-rss-cfg-group-name':
		'[flex:1] min-w-[0] [font-size:12px] [color:var(--db-text)] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-rss-cfg-group-remove': '[&_svg]:w-[14px] [&_svg]:h-[14px] [&_svg]:[flex-shrink:0]',
	'dashboard-rss-cfg-group-add-row': 'flex [align-items:center] gap-[8px]',
	'dashboard-rss-cfg-group-add-input': '[flex:1] min-w-[0] h-[30px]',
	'dashboard-rss-cfg-group-select': '[flex:0_0_auto] max-w-[130px]',
	'dashboard-rss-cfg-groupby-row': 'flex [align-items:center] gap-[8px] [margin-bottom:8px]',
	'dashboard-rss-cfg-groupby-label': '[font-size:12px] [color:var(--db-text-muted)] [flex-shrink:0]',
	'dashboard-rss-cfg-groupby-select': '[flex:0_0_auto]',
	'dashboard-rss-cfg-opml-row': 'flex [align-items:center] [justify-content:flex-end] gap-[8px] [margin-top:6px]',
	'dashboard-rss-cfg-opml-btn': '[font-size:12px]',
	'dashboard-rss-cfg-name': '[flex:0_0_24%] min-w-[0] h-[34px]',
	'dashboard-rss-cfg-url': '[flex:1] min-w-[0] h-[34px]',
	'dashboard-rss-cfg-status':
		'[flex-shrink:0] [font-size:10.5px] p-[1px_7px] rounded-[999px] whitespace-nowrap max-w-[88px] [overflow:hidden] [text-overflow:ellipsis] [cursor:help] [&.is-error]:[color:var(--db-danger)] [&.is-error]:[background:color-mix(in_srgb,_var(--db-danger)_12%,_transparent)] [&.is-error]:[border:1px_solid_color-mix(in_srgb,_var(--db-danger)_30%,_transparent)]',
	'dashboard-rss-cfg-remove':
		'inline-flex [align-items:center] [justify-content:center] w-[34px] h-[34px] [flex-shrink:0] p-[0] [border:none] rounded-[var(--db-radius-sm)] [background:transparent] [box-shadow:none] [color:var(--db-text-faint)] [cursor:pointer] [&:hover]:[color:var(--db-danger)] [&:hover]:[background:var(--db-bg-hover)] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:[flex-shrink:0]',
	'dashboard-rss-cfg-add': '[margin-top:4px]',
	'dashboard-rss-cfg-folder-row': 'flex [align-items:center] gap-[8px]',
	'dashboard-rss-cfg-folder': '[flex:1] min-w-[0] h-[30px]',
};
export function p2Classes(names: string | undefined): string {
	return cn(...(names ?? '').split(/\s+/).flatMap((name) => [name, layout[name]]));
}
