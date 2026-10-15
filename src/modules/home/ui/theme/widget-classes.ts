// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: styles.css
// Static Tailwind recipes retain upstream selector names for visual comparison. No runtime CSS is generated.
import { cn } from '../../../../ui/lib/utils';
const layout: Record<string, string> = {
	'dashboard-widget-cfg-btn':
		'[position:absolute] [top:8px] [right:8px] [z-index:var(--layer-menu)] [visibility:hidden] [background:none] [border:none] [box-shadow:none] [color:var(--db-text-muted)] w-[20px] h-[20px] [box-sizing:border-box] p-[0] flex [align-items:center] [justify-content:center] [cursor:pointer] [opacity:0] motion-safe:[transition:opacity_0.15s_ease,_color_0.15s_ease] [&_svg]:w-[13px] [&_svg]:h-[13px]',
	'dashboard-library-config-modal':
		"[&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[border:1px_solid_var(--db-border-input,_var(--background-modifier-border))] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:rounded-[var(--db-radius-sm,_6px)] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:p-[8px_12px] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[background:var(--db-bg-input,_var(--background-modifier-form-field))] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[box-shadow:none] [&_.dashboard-modal-input.dashboard-modal-input:not(.dashboard-section-name-input):is(input[type='text'],_input[type='search'])]:[color:var(--db-text,_var(--text-normal))] [&_.dashboard-modal-input.dashboard-modal-input:is(input[type='text'],_input[type='search']):focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))] [&_.dashboard-modal-input.dashboard-modal-input:is(input[type='text'],_input[type='search']):focus]:[box-shadow:none] p-[0]",
	'dashboard-expense-backfill-date': 'w-[140px] [box-sizing:border-box] [color-scheme:light_dark]',
	'dashboard-expense-backfill-row': 'flex [align-items:center] gap-[6px] min-w-[0]',
	'dashboard-expense-backfill-currency': '[flex-shrink:0] [color:var(--db-text-muted)]',
	'dashboard-expense-backfill-amount': '[flex:1_1_auto] min-w-[0]',
	'dashboard-expense-backfill-category':
		'[-webkit-appearance:menulist] [appearance:menulist] [flex:0_1_auto] w-[38%] min-w-[0]',
	'dashboard-sidebar-anniversary':
		'flex [flex-direction:column] [justify-content:center] [align-items:center] [text-align:center] gap-[2px]',
	'dashboard-sidebar-anniversary-title':
		'[font-size:0.8em] [font-weight:600] [color:var(--db-text)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-sidebar-anniversary-value':
		'[font-size:1.6em] [font-weight:700] [line-height:1.2] [color:var(--db-accent)]',
	'dashboard-sidebar-anniversary-date': '[font-size:0.68em] [color:var(--db-text-muted)]',
	'dashboard-modal-countdown-row': 'flex [flex-direction:column] gap-[4px] [margin-bottom:16px]',
	'dashboard-modal-countdown-label': '[font-size:0.85em] [color:var(--text-muted)]',
	'dashboard-modal-countdown-hint': '[font-size:0.75em] [color:var(--text-faint)]',
	'dashboard-modal-countdown-select': 'h-[auto] min-h-[36px] [-webkit-appearance:menulist] [appearance:menulist]',
	'dashboard-pomodoro-activity-selector':
		'[position:relative] [flex:0_1_auto] min-w-[0] flex [justify-content:center]',
	'dashboard-pomodoro-activity-trigger':
		'flex [align-items:center] [justify-content:center] gap-[5px] [cursor:pointer] p-[3px_10px] rounded-[10px] motion-safe:[transition:background_0.15s,_opacity_0.15s] max-w-[100%] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-pomodoro-activity-trigger--set':
		'[font-size:0.7em] [color:var(--db-text)] [font-weight:500] [&_span]:[overflow:hidden] [&_span]:[text-overflow:ellipsis] [&_span]:whitespace-nowrap [&_span]:max-w-[100px]',
	'dashboard-pomodoro-activity-placeholder': '[font-size:0.65em] [color:var(--db-accent)]',
	'dashboard-pomodoro-activity-color-dot': 'w-[6px] h-[6px] rounded-[50%] [flex-shrink:0]',
	'dashboard-pomodoro-activity-panel':
		'[position:absolute] [top:100%] [left:50%] [transform:translateX(-50%)] [z-index:var(--layer-menu)] [background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[8px] p-[8px] w-[180px] [box-shadow:0_4px_16px_var(--db-record-color-1)] [margin-top:4px]',
	'dashboard-pomodoro-activity-panel-input':
		'w-[100%] [background:var(--db-bg-hover)] [border:1px_solid_var(--db-border-card)] rounded-[6px] p-[5px_8px] [font-size:0.75em] [color:var(--db-text)] [&:focus]:[border-color:var(--db-accent)]',
	'dashboard-pomodoro-activity-chips': 'flex [flex-wrap:wrap] gap-[4px] [margin-top:6px]',
	'dashboard-pomodoro-activity-chip':
		'flex [align-items:center] gap-[4px] p-[3px_8px] rounded-[10px] [background:var(--db-bg-hover)] [font-size:0.65em] [color:var(--db-text)] [cursor:pointer] motion-safe:[transition:opacity_0.15s] max-w-[100%] [&:hover]:[opacity:0.75] [&_span]:[overflow:hidden] [&_span]:[text-overflow:ellipsis] [&_span]:whitespace-nowrap',
	'dashboard-pomodoro-stats-overlay':
		'[position:fixed] [top:0] [left:0] w-[100%] h-[100%] [background:var(--db-record-color-2)] flex [align-items:center] [justify-content:center] [z-index:var(--layer-menu)]',
	'dashboard-pomodoro-stats-modal':
		'[background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-lg,_12px)] p-[20px] max-w-[380px] w-[90%] max-h-[80vh] [overflow-y:auto] [box-shadow:0_8px_32px_var(--db-record-color-3)]',
	'dashboard-pomodoro-stats-header':
		'flex [justify-content:space-between] [align-items:center] gap-[10px] [margin-bottom:16px] @max-[901px]:[flex-wrap:wrap] @max-[901px]:[&_.dashboard-pomodoro-stats-close]:[order:2] max-[901px]:[flex-wrap:wrap] max-[901px]:[&_.dashboard-pomodoro-stats-close]:[order:2]',
	'dashboard-pomodoro-stats-header-title': '[font-size:1.3em] [font-weight:700] [color:var(--db-text)]',
	'dashboard-pomodoro-stats-close':
		'[cursor:pointer] [color:var(--db-text-muted)] w-[24px] h-[24px] flex [align-items:center] [justify-content:center] rounded-[4px] motion-safe:[transition:background_0.15s] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-pomodoro-stats-summary': 'flex gap-[8px] [margin-bottom:16px]',
	'dashboard-pomodoro-stats-card':
		'[flex:1] [background:var(--db-bg-hover)] rounded-[8px] p-[10px_8px] [text-align:center]',
	'dashboard-pomodoro-stats-card-value': '[font-size:1em] [font-weight:700] [color:var(--db-accent)]',
	'dashboard-pomodoro-stats-card-label': '[font-size:0.65em] [color:var(--db-text-muted)] [margin-top:2px]',
	'dashboard-pomodoro-stats-section':
		'[margin-bottom:0] [background:var(--db-bg-hover,_var(--db-record-color-29))] [border:1px_solid_var(--db-border,_var(--db-record-color-40))] rounded-[10px] p-[12px]',
	'dashboard-pomodoro-stats-section--hidden': 'hidden',
	'dashboard-pomodoro-stats-section-title':
		'[font-size:0.7em] [font-weight:600] [color:var(--db-text-muted)] [text-transform:uppercase] [letter-spacing:0.06em] [margin-bottom:8px]',
	'dashboard-pomodoro-range-toggle': 'flex gap-[2px] [background:var(--db-bg-hover)] rounded-[6px] p-[2px]',
	'dashboard-pomodoro-range-btn':
		'[flex:1] [text-align:center] [font-size:0.82em] [font-weight:500] [color:var(--db-text-muted)] p-[5px_12px] rounded-[5px] [cursor:pointer] whitespace-nowrap motion-safe:[transition:background_0.15s,_color_0.15s]',
	'dashboard-pomodoro-range-btn--active':
		'[background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [color:var(--db-accent)] [font-weight:700] [box-shadow:0_1px_4px_var(--db-record-color-4)]',
	'dashboard-pomodoro-donut-container': 'flex [flex-direction:column] [align-items:center] gap-[12px]',
	'dashboard-pomodoro-donut-svg': 'block',
	'dashboard-pomodoro-donut-bg': '[stroke:var(--db-bg-hover)]',
	'dashboard-pomodoro-donut-center-value': '[fill:var(--db-text)] [font-size:0.875em] [font-weight:700]',
	'dashboard-pomodoro-donut-center-label': '[fill:var(--db-text-muted)] [font-size:0.5625em]',
	'dashboard-pomodoro-donut-empty': '[font-size:0.75em] [color:var(--db-text-faint)] [text-align:center] p-[24px_0]',
	'dashboard-pomodoro-donut-legend': 'flex [flex-direction:column] gap-[6px] w-[100%]',
	'dashboard-pomodoro-donut-legend-item': 'flex [align-items:center] gap-[6px]',
	'dashboard-pomodoro-donut-legend-dot': 'w-[8px] h-[8px] rounded-[50%] [flex-shrink:0]',
	'dashboard-pomodoro-donut-legend-name':
		'[font-size:0.7em] [color:var(--db-text)] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-pomodoro-donut-legend-pct':
		'[font-size:0.65em] [font-weight:600] [color:var(--db-text)] w-[32px] [text-align:right] [flex-shrink:0]',
	'dashboard-pomodoro-donut-legend-time':
		'[font-size:0.6em] [color:var(--db-text-muted)] w-[48px] [text-align:right] [flex-shrink:0]',
	'dashboard-pomodoro-stats-record-dot': 'w-[6px] h-[6px] rounded-[50%] [flex-shrink:0]',
	'dashboard-pomodoro-stats-record-row':
		'flex [align-items:center] gap-[8px] p-[4px_0] [border-bottom:1px_solid_var(--db-bg-hover)] [&:last-child]:[border-bottom:none]',
	'dashboard-pomodoro-stats-record-date': '[font-size:0.6em] [color:var(--db-text-faint)] w-[65px] [flex-shrink:0]',
	'dashboard-pomodoro-stats-record-activity':
		'[font-size:0.7em] [color:var(--db-text)] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-pomodoro-stats-record-duration': '[font-size:0.6em] [color:var(--db-text-muted)] [flex-shrink:0]',
	'dashboard-pomodoro-stats-modal--wide':
		'max-w-[1040px] w-[94%] max-h-[86vh] p-[22px_26px] flex [flex-direction:column] [container-type:inline-size] [&_.dashboard-pomodoro-stats-summary]:grid [&_.dashboard-pomodoro-stats-summary]:[grid-template-columns:1fr_1fr] [&_.dashboard-pomodoro-stats-summary]:gap-[6px] [&_.dashboard-pomodoro-stats-summary]:[flex-wrap:wrap] [&_.dashboard-pomodoro-stats-summary]:[margin-bottom:0] max-[901px]:max-w-[420px] max-[901px]:max-h-[80vh]',
	'dashboard-pomodoro-stats-header-right':
		'flex [align-items:center] gap-[10px] [margin-left:auto] @max-[901px]:[order:3] @max-[901px]:[flex-basis:100%] @max-[901px]:[justify-content:flex-start] @max-[901px]:[margin-left:0] max-[901px]:[order:3] max-[901px]:[flex-basis:100%] max-[901px]:[justify-content:flex-start] max-[901px]:[margin-left:0]',
	'dashboard-pomodoro-stats-body':
		'grid [grid-template-columns:230px_minmax(0,_1fr)_300px] [grid-template-rows:minmax(0,_1fr)] gap-[18px] [overflow-y:auto] min-h-[0] [flex:1] [padding-top:4px] @max-[901px]:[grid-template-columns:1fr] @max-[901px]:[grid-template-rows:auto] max-[901px]:[grid-template-columns:1fr] max-[901px]:[grid-template-rows:auto]',
	'dashboard-pomodoro-kpi-col': 'flex [flex-direction:column] gap-[8px] min-w-[0]',
	'dashboard-pomodoro-kpi-trophy':
		'flex [align-items:center] gap-[10px] [background:linear-gradient(135deg,_var(--db-record-color-5),_var(--db-record-color-6))] [border:1px_solid_var(--db-record-color-7)] rounded-[10px] p-[10px_12px]',
	'dashboard-pomodoro-kpi-trophy-icon': '[color:var(--db-record-color-8)] flex',
	'dashboard-pomodoro-kpi-trophy-text': 'flex [flex-direction:column]',
	'dashboard-pomodoro-kpi-trophy-value': '[font-size:0.95em] [font-weight:700] [color:var(--db-text)]',
	'dashboard-pomodoro-kpi-trophy-label': '[font-size:0.62em] [color:var(--db-text-muted)] [margin-top:1px]',
	'dashboard-pomodoro-stats-card-value-row': 'flex [flex-direction:column] [align-items:center] gap-[2px]',
	'dashboard-pomodoro-stats-card-delta': '[font-size:0.58em] [font-weight:600] p-[1px_4px] rounded-[4px]',
	'dashboard-pomodoro-stats-card-delta--up':
		'[color:var(--db-record-color-9)] [background:var(--db-record-color-10)]',
	'dashboard-pomodoro-stats-card-delta--down':
		'[color:var(--db-record-color-11)] [background:var(--db-record-color-12)]',
	'dashboard-pomodoro-mid-col': 'flex [flex-direction:column] gap-[6px] min-w-[0]',
	'dashboard-pomodoro-donut-wrap': 'flex [justify-content:center]',
	'dashboard-pomodoro-donut-container--wide': '[align-items:stretch]',
	'dashboard-pomodoro-donut-segment': '[cursor:pointer] motion-safe:[transition:stroke-width_0.12s]',
	'dashboard-pomodoro-donut-legend--grid':
		'grid [grid-template-columns:1fr_1fr] gap-[5px_14px] @max-[901px]:[grid-template-columns:1fr] max-[901px]:[grid-template-columns:1fr]',
	'dashboard-pomodoro-trend-container': 'min-h-[176px]',
	'dashboard-pomodoro-trend-svg': 'block',
	'dashboard-pomodoro-trend-bar': 'motion-safe:[transition:opacity_0.12s] [&:hover]:[opacity:0.75]',
	'dashboard-pomodoro-trend-tick': '[fill:var(--db-text-faint)] [font-size:0.5em]',
	'dashboard-pomodoro-right-col': 'flex [flex-direction:column] gap-[6px] min-w-[0]',
	'dashboard-pomodoro-stats-header-titlewrap':
		'@max-[901px]:[order:1] @max-[901px]:[flex:1] flex [flex-direction:column] gap-[2px] min-w-[0] max-[901px]:[order:1] max-[901px]:[flex:1]',
	'dashboard-pomodoro-stats-section-title-row': 'flex [align-items:baseline] [justify-content:space-between]',
	'dashboard-pomodoro-stats-section-hint': '[font-size:0.6em] [color:var(--db-text-faint)]',
	'dashboard-pomodoro-rank-row':
		'[margin-bottom:7px] [cursor:pointer] rounded-[6px] p-[2px_4px] m-[0_-4px_7px] motion-safe:[transition:background_0.12s] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-pomodoro-rank-head': 'flex [align-items:center] gap-[6px] [margin-bottom:3px]',
	'dashboard-pomodoro-rank-name':
		'[font-size:0.68em] [color:var(--db-text)] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-pomodoro-rank-time': '[font-size:0.6em] [color:var(--db-text-muted)] [flex-shrink:0]',
	'dashboard-pomodoro-rank-bar-wrap': 'h-[6px] rounded-[3px] [background:var(--db-bg-hover)] [overflow:hidden]',
	'dashboard-pomodoro-rank-bar': 'h-[100%] rounded-[3px]',
	'dashboard-pomodoro-heatmap-container': '[line-height:0]',
	'dashboard-pomodoro-heatmap-grid':
		'grid [grid-template-columns:repeat(auto-fill,_12px)] [grid-auto-rows:12px] gap-[3px] [justify-content:center] w-[100%]',
	'dashboard-pomodoro-heatmap-cell': 'rounded-[3px] [background:var(--db-bg-hover)]',
	'dashboard-pomodoro-recent-container':
		'max-h-[190px] [overflow-y:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
	'dashboard-habit-stats-overlay':
		'[position:fixed] [top:0] [left:0] w-[100%] h-[100%] [background:var(--db-record-color-2)] flex [align-items:center] [justify-content:center] [z-index:var(--layer-menu)]',
	'dashboard-habit-stats-modal':
		'[background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-lg,_12px)] p-[20px] max-w-[480px] w-[90%] max-h-[80vh] [overflow-y:auto] [box-shadow:0_8px_32px_var(--db-record-color-3)]',
	'dashboard-habit-stats-header': 'flex [justify-content:space-between] [align-items:center] [margin-bottom:14px]',
	'dashboard-habit-stats-title': '[font-size:1.2em] [font-weight:700] [color:var(--db-text)]',
	'dashboard-habit-stats-close':
		'[cursor:pointer] [color:var(--db-text-muted)] w-[24px] h-[24px] flex [align-items:center] [justify-content:center] rounded-[4px] motion-safe:[transition:background_0.15s] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-habit-stats-body': 'flex [flex-direction:column] gap-[12px]',
	'dashboard-habit-stats-empty':
		'[font-size:0.85em] [color:var(--db-text-muted)] [text-align:center] p-[24px_0] [opacity:0.75]',
	'dashboard-habit-stats-card':
		'[background:var(--db-bg-hover)] [border:1px_solid_var(--db-border-card)] rounded-[8px] p-[12px]',
	'dashboard-habit-stats-card-head': 'flex [align-items:center] gap-[6px] [margin-bottom:10px]',
	'dashboard-habit-stats-card-name':
		'[font-size:0.9em] [font-weight:600] [color:var(--db-text)] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-habit-stats-card-head-spacer': '[flex:1]',
	'dashboard-habit-stats-grip':
		'inline-flex [align-items:center] [flex-shrink:0] w-[16px] [cursor:grab] [color:var(--db-text-muted)] [opacity:0.45] [touch-action:none] motion-safe:[transition:opacity_0.15s_ease,_color_0.15s_ease] [&:hover]:[opacity:1] [&:hover]:[color:var(--db-text)] [&:active]:[cursor:grabbing] [&_svg]:w-[14px] [&_svg]:h-[14px] [&_svg]:block',
	'dashboard-habit-stats-card--dragging': '[opacity:0.4]',
	'dashboard-habit-stats-card--drop-before': '[box-shadow:0_-2px_0_0_var(--db-accent)]',
	'dashboard-habit-stats-card--drop-after': '[box-shadow:0_2px_0_0_var(--db-accent)]',
	'dashboard-habit-stats-card--ghost': '[pointer-events:none]',
	'dashboard-habit-stats-icon-btn':
		'w-[22px] h-[22px] flex [align-items:center] [justify-content:center] [cursor:pointer] [opacity:0.3] [color:var(--db-text-muted)] motion-safe:[transition:opacity_0.15s] [flex-shrink:0] [&:hover]:[opacity:0.75]',
	'dashboard-habit-stats-icon-btn--danger':
		'[&:hover]:[color:var(--text-error,_var(--db-record-color-13))] [&:hover]:[opacity:0.9]',
	'dashboard-habit-stats-chips': 'flex gap-[8px] [margin-bottom:10px]',
	'dashboard-habit-stats-chip':
		'[flex:1] flex [align-items:center] [justify-content:center] gap-[7px] [background:var(--db-bg-card)] rounded-[7px] p-[6px_8px]',
	'dashboard-habit-stats-chip-icon':
		'flex [align-items:center] [color:var(--db-accent)] [flex-shrink:0] [&_svg]:w-[13px] [&_svg]:h-[13px]',
	'dashboard-habit-stats-chip-value':
		'[font-size:0.82em] [font-weight:700] [color:var(--db-text)] [line-height:1.15]',
	'dashboard-habit-stats-chip-label': '[font-size:0.6em] [color:var(--db-text-muted)] [line-height:1.15]',
	'dashboard-habit-stats-heatmap-section': 'flex [flex-direction:column] gap-[6px]',
	'dashboard-habit-stats-heatmap-head': 'flex [justify-content:flex-end]',
	'dashboard-habit-stats-heatmap-hint': '[font-size:0.62em] [color:var(--db-text-muted)] [opacity:0.7]',
	'dashboard-habit-stats-heatmap-wrap': '[position:relative] w-[100%]',
	'dashboard-habit-stats-heatmap-grid':
		'grid [grid-template-columns:repeat(auto-fill,_12px)] [grid-auto-rows:12px] gap-[3px] [justify-content:center] w-[100%]',
	'dashboard-habit-stats-heatmap-cell': 'rounded-[3px] [background:var(--db-record-color-14)]',
	'dashboard-habit-stats-heatmap-cell--done': '[background:var(--db-accent)]',
	'dashboard-habit-stats-heatmap-empty':
		'[position:absolute] [inset:0] flex [align-items:center] [justify-content:center] [font-size:0.65em] [color:var(--db-text-muted)] [opacity:0.75] [text-align:center] [pointer-events:none]',
	'dashboard-pomodoro-tagmanager': 'max-w-[560px]',
	'dashboard-pomodoro-tagmanager-hint': '[font-size:0.7em] [color:var(--db-text-muted)] m-[-8px_0_12px]',
	'dashboard-pomodoro-tagmanager-list':
		'flex [flex-direction:column] gap-[6px] max-h-[46vh] [overflow-y:auto] [padding-right:2px]',
	'dashboard-pomodoro-tagmanager-row': 'flex [flex-direction:column] gap-[6px]',
	'dashboard-pomodoro-tagmanager-chip':
		'inline-flex [align-items:center] gap-[7px] [align-self:flex-start] max-w-[100%] p-[6px_14px] rounded-[999px] [background:var(--db-bg-hover)] [border:1px_solid_var(--db-border-card)] [cursor:pointer] motion-safe:[transition:border-color_0.15s,_background_0.15s] [&:hover]:[border-color:var(--db-accent)] [&:hover]:[background:var(--db-bg-hover-strong,_var(--db-bg-hover))]',
	'dashboard-pomodoro-tagmanager-chip--pinned':
		'[border-color:color-mix(in_srgb,_var(--db-accent)_45%,_transparent)] [background:color-mix(in_srgb,_var(--db-accent)_10%,_var(--db-bg-hover))]',
	'dashboard-pomodoro-tagmanager-chip-name':
		'[font-size:0.8em] [font-weight:600] [color:var(--db-text)] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-pomodoro-tagmanager-chip-pin': '[color:var(--db-accent)] flex [opacity:0.85]',
	'dashboard-pomodoro-tagmanager-actions': 'hidden gap-[6px] [flex-wrap:wrap] [padding-left:4px]',
	'dashboard-pomodoro-tagmanager-row--open': '[&_.dashboard-pomodoro-tagmanager-actions]:flex',
	'dashboard-pomodoro-tagmanager-action':
		'flex [align-items:center] gap-[5px] p-[5px_11px] rounded-[999px] [border:1px_solid_var(--db-border-card)] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [font-size:0.68em] [font-weight:500] [color:var(--db-text-muted)] [cursor:pointer] motion-safe:[transition:border-color_0.15s,_color_0.15s,_background_0.15s] [&:hover]:[border-color:var(--db-accent)] [&:hover]:[color:var(--db-text)]',
	'dashboard-pomodoro-tagmanager-action--danger':
		'[&:hover]:[border-color:var(--db-danger,_var(--db-record-color-11))] [&:hover]:[color:var(--db-danger,_var(--db-record-color-11))]',
	'dashboard-pomodoro-tagmanager-action-icon': 'flex',
	'dashboard-pomodoro-tagmanager-action-label': 'whitespace-nowrap',
	'dashboard-pomodoro-tagmanager-prompt':
		'[margin-top:12px] p-[12px] [background:var(--db-bg-hover)] rounded-[10px] flex [flex-direction:column] gap-[8px]',
	'dashboard-pomodoro-tagmanager-prompt-label': '[font-size:0.72em] [color:var(--db-text)]',
	'dashboard-pomodoro-tagmanager-prompt-input':
		'[background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[6px] [color:var(--db-text)] [font-size:0.75em] p-[6px_8px] w-[100%] [&:focus]:[border-color:var(--db-accent)]',
	'dashboard-pomodoro-tagmanager-prompt-select':
		'[background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[6px] [color:var(--db-text)] [font-size:0.75em] p-[6px_8px] w-[100%] [&:focus]:[border-color:var(--db-accent)]',
	'dashboard-pomodoro-tagmanager-prompt-error':
		'[font-size:0.65em] [color:var(--db-danger,_var(--db-record-color-11))] min-h-[0]',
	'dashboard-pomodoro-tagmanager-prompt-btns': 'flex gap-[8px] [justify-content:flex-end]',
	'dashboard-pomodoro-tagmanager-prompt-cancel':
		'[border:none] rounded-[6px] p-[6px_14px] [font-size:0.72em] [font-weight:600] [cursor:pointer] motion-safe:[transition:opacity_0.15s] [background:var(--db-bg-hover)] [color:var(--db-text-muted)] [&:hover]:[opacity:0.85]',
	'dashboard-pomodoro-tagmanager-prompt-ok':
		'[border:none] rounded-[6px] p-[6px_14px] [font-size:0.72em] [font-weight:600] [cursor:pointer] motion-safe:[transition:opacity_0.15s] [background:var(--db-accent)] [color:var(--background-primary,_var(--db-record-color-15))] [&:hover]:[opacity:0.85]',
	'dashboard-pomodoro-tagmanager-prompt-ok--danger': '[background:var(--db-danger,_var(--db-record-color-11))]',
	'dashboard-pomodoro-settings':
		'w-[520px] max-w-[92vw] [&_.dashboard-modal-body]:max-h-[68vh] [&_.dashboard-modal-body]:[overflow-y:auto]',
	'dashboard-pomodoro-settings-section':
		'[margin-bottom:16px] [padding-bottom:12px] [border-bottom:1px_solid_var(--db-border,_var(--background-modifier-border))] [&:last-child]:[border-bottom:none] [&:last-child]:[margin-bottom:0] [&:last-child]:[padding-bottom:0] [&_h3]:m-[0_0_4px] [&_h3]:[font-size:1em]',
	'dashboard-pomodoro-settings-desc': 'm-[0_0_10px] [font-size:0.8em] [color:var(--db-text-muted)] [opacity:0.85]',
	'dashboard-pomodoro-settings-reminder': 'w-[90px]',
	'dashboard-pomodoro-settings-bg-row': 'flex [align-items:center] gap-[10px]',
	'dashboard-pomodoro-settings-bg-desc':
		'[flex:1] min-w-[0] [font-size:0.75em] [color:var(--db-text-muted)] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-pomodoro-insight':
		'[font-size:0.8em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] max-w-[520px]',
	'dashboard-pomodoro-filterbar': 'hidden [align-items:center] gap-[8px] m-[4px_0_0]',
	'dashboard-pomodoro-filterbar--visible': 'flex',
	'dashboard-pomodoro-filterbar-chip':
		'flex [align-items:center] gap-[6px] [background:var(--db-bg-hover)] [border:1px_solid_var(--db-border-card)] rounded-[999px] p-[3px_10px] [font-size:0.68em] [color:var(--db-text)]',
	'dashboard-pomodoro-filterbar-clear':
		'[cursor:pointer] [color:var(--db-text-muted)] flex p-[2px] rounded-[4px] [&:hover]:[color:var(--db-text)] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-pomodoro-kpi-group': 'flex [flex-direction:column] gap-[6px]',
	'dashboard-pomodoro-kpi-group-title':
		'[font-size:0.6em] [font-weight:700] [color:var(--db-text-faint)] [text-transform:uppercase] [letter-spacing:0.08em] [margin-top:2px]',
	'dashboard-pomodoro-kpi-group--hist': '[opacity:0.92] [&_.dashboard-pomodoro-stats-card-value]:[font-size:0.85em]',
	'dashboard-pomodoro-kpi-hero':
		'[position:relative] [background:var(--db-bg-hover)] rounded-[10px] p-[12px_10px] flex [flex-direction:column] gap-[6px]',
	'dashboard-pomodoro-kpi-hero--gauge': '[align-items:center]',
	'dashboard-pomodoro-kpi-hero-gauge': 'block',
	'dashboard-pomodoro-kpi-hero-gauge-value': '[fill:var(--db-text)] [font-size:1.15em] [font-weight:800]',
	'dashboard-pomodoro-kpi-hero-label': '[font-size:0.62em] [color:var(--db-text-muted)] [text-align:center]',
	'dashboard-pomodoro-kpi-hero-edit':
		'[position:absolute] [top:6px] [right:6px] w-[20px] h-[20px] flex [align-items:center] [justify-content:center] [cursor:pointer] [color:var(--db-text-faint)] rounded-[5px] motion-safe:[transition:color_0.15s,_background_0.15s] [&_svg]:w-[11px] [&_svg]:h-[11px] [&:hover]:[color:var(--db-accent)] [&:hover]:[background:var(--db-bg)]',
	'dashboard-pomodoro-goal-editor':
		'[background:var(--db-bg-hover)] [border:1px_solid_var(--db-border-card)] rounded-[10px] p-[10px_12px] flex [align-items:center] [justify-content:space-between] gap-[8px]',
	'dashboard-pomodoro-goal-editor-label': '[font-size:0.68em] [color:var(--db-text)] [font-weight:600]',
	'dashboard-pomodoro-goal-editor-controls': 'flex [align-items:center] gap-[8px]',
	'dashboard-pomodoro-goal-editor-step':
		'[border:1px_solid_var(--db-border-card)] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [color:var(--db-text)] w-[26px] h-[26px] flex [align-items:center] [justify-content:center] rounded-[6px] [cursor:pointer] motion-safe:[transition:border-color_0.15s] [&:hover]:[border-color:var(--db-accent)] [&:hover]:[color:var(--db-accent)]',
	'dashboard-pomodoro-goal-editor-value':
		'[font-size:1em] [font-weight:800] [color:var(--db-accent)] min-w-[26px] [text-align:center] [font-variant-numeric:tabular-nums]',
	'dashboard-pomodoro-kpi-streak':
		'flex [align-items:center] gap-[8px] [background:linear-gradient(135deg,_var(--db-record-color-16),_var(--db-record-color-17))] [border:1px_solid_var(--db-record-color-18)] rounded-[10px] p-[9px_12px]',
	'dashboard-pomodoro-kpi-streak-icon': '[color:var(--db-record-color-19)] flex',
	'dashboard-pomodoro-kpi-streak-value':
		'[font-size:1.15em] [font-weight:800] [color:var(--db-text)] [line-height:1]',
	'dashboard-pomodoro-kpi-streak-label': '[font-size:0.62em] [color:var(--db-text-muted)]',
	'dashboard-pomodoro-kpi-streak-hint':
		'[font-size:0.62em] [color:var(--db-record-color-19)] [margin-left:auto] [text-align:right] whitespace-nowrap',
	'dashboard-pomodoro-stats-card--good': '[&_.dashboard-pomodoro-stats-card-value]:[color:var(--db-record-color-9)]',
	'dashboard-pomodoro-stats-card--warn': '[&_.dashboard-pomodoro-stats-card-value]:[color:var(--db-record-color-19)]',
	'dashboard-pomodoro-gauge-value': '[fill:var(--db-text)] [font-size:1.625em] [font-weight:800]',
	'dashboard-pomodoro-gauge-hint':
		'[text-align:center] [font-size:0.7em] [color:var(--db-text-muted)] [margin-top:6px]',
	'dashboard-pomodoro-gauge-hint--good': '[color:var(--db-record-color-9)] [font-weight:600]',
	'dashboard-pomodoro-trend-goal-line': '[stroke:var(--db-text-faint)] [stroke-width:1] [opacity:0.7]',
	'dashboard-pomodoro-trend-goal-label': '[fill:var(--db-text-faint)] [font-size:0.5625em]',
	'dashboard-pomodoro-trend-bar--clickable': '[cursor:pointer]',
	'dashboard-pomodoro-hour-section': '[margin-bottom:0]',
	'dashboard-pomodoro-hour-container': 'flex [align-items:flex-end] gap-[2px] h-[68px] [padding-top:4px]',
	'dashboard-pomodoro-hour-cell':
		'[flex:1] flex [flex-direction:column] [align-items:center] gap-[2px] min-w-[0] [&:hover_.dashboard-pomodoro-hour-bar]:[opacity:1]',
	'dashboard-pomodoro-hour-bar':
		'w-[100%] max-w-[14px] rounded-[2px] [background:var(--db-accent)] [opacity:0.55] motion-safe:[transition:opacity_0.12s]',
	'dashboard-pomodoro-hour-cell--peak':
		'[&_.dashboard-pomodoro-hour-bar]:[opacity:1] [&_.dashboard-pomodoro-hour-bar]:[box-shadow:0_0_0_1px_color-mix(in_srgb,_var(--db-accent)_40%,_transparent)]',
	'dashboard-pomodoro-hour-bar--empty': '[background:var(--db-bg-hover)]',
	'dashboard-pomodoro-hour-tick': '[font-size:0.52em] [color:var(--db-text-faint)] h-[10px]',
	'dashboard-pomodoro-rank-row--active': '[background:var(--db-bg-hover)] [outline:1px_solid_var(--db-accent)]',
	'dashboard-pomodoro-heatmap-wrap': '[position:relative]',
	'dashboard-pomodoro-heatmap-legend':
		'flex [align-items:center] gap-[3px] [margin-top:5px] [justify-content:flex-end]',
	'dashboard-pomodoro-heatmap-legend-swatch':
		'w-[10px] h-[10px] rounded-[2.5px] [background:var(--db-bg-hover)] [border:1px_solid_var(--db-border-card)]',
	'dashboard-pomodoro-heatmap-legend-label': '[font-size:0.55em] [color:var(--db-text-faint)] m-[0_2px]',
	'dashboard-pomodoro-heatmap-empty':
		'[position:absolute] [inset:0] flex [align-items:center] [justify-content:center] [background:color-mix(in_srgb,_var(--db-bg)_55%,_transparent)] rounded-[8px] [font-size:0.7em] [color:var(--db-text-muted)] [text-align:center] p-[0_12px]',
	'dashboard-pomodoro-timeline-container':
		'flex [flex-direction:column] max-h-[230px] [overflow-y:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
	'dashboard-pomodoro-timeline-item':
		"[position:relative] p-[0_0_10px_0] [margin-left:5px] [border-left:2px_solid_var(--db-bg-hover)] [padding-left:12px] [&:last-child]:[padding-bottom:0] [&:last-child]:[border-left-color:transparent] [&::before]:[content:''] [&::before]:[position:absolute] [&::before]:[left:-5px] [&::before]:[top:3px] [&::before]:w-[8px] [&::before]:h-[8px] [&::before]:rounded-[50%] [&::before]:[background:var(--db-accent)]",
	'dashboard-pomodoro-timeline-head': 'flex [align-items:center] gap-[7px]',
	'dashboard-pomodoro-timeline-time':
		'[font-size:0.62em] [color:var(--db-text-faint)] w-[38px] [flex-shrink:0] [font-variant-numeric:tabular-nums]',
	'dashboard-pomodoro-timeline-activity':
		'flex [align-items:center] gap-[5px] [font-size:0.7em] [color:var(--db-text)] [flex:1] [overflow:hidden] [text-variant:ellipsis] whitespace-nowrap [&_span]:[overflow:hidden] [&_span]:[text-overflow:ellipsis] [&_span]:whitespace-nowrap',
	'dashboard-pomodoro-timeline-duration': '[font-size:0.62em] [color:var(--db-text-muted)] [flex-shrink:0]',
	'dashboard-pomodoro-timeline-done': '[color:var(--db-record-color-9)] flex [flex-shrink:0]',
	'dashboard-pomodoro-timeline-sub':
		'flex [align-items:center] gap-[4px] [font-size:0.6em] [color:var(--db-text-muted)] [margin-top:3px] [padding-left:45px]',
	'dashboard-pomodoro-timeline-sub-icon': 'flex [opacity:0.7]',
	'dashboard-pomodoro-timeline-interruptions': '[color:var(--db-record-color-19)]',
	'dashboard-pomodoro-timeline-empty': 'flex [flex-direction:column] [align-items:center] gap-[10px] p-[18px_0_12px]',
	'dashboard-pomodoro-timeline-empty-text': '[font-size:0.7em] [color:var(--db-text-faint)]',
	'dashboard-pomodoro-timeline-start':
		'[border:none] rounded-[8px] [background:var(--db-accent)] [color:var(--background-primary,_var(--db-record-color-15))] [font-size:0.72em] [font-weight:600] p-[7px_18px] [cursor:pointer] motion-safe:[transition:opacity_0.15s] [&:hover]:[opacity:0.85]',
	'dashboard-pomodoro-drilldown':
		'[position:absolute] [top:60px] [left:50%] [transform:translateX(-50%)] w-[min(420px,_90%)] max-h-[60%] [overflow-y:auto] [background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-lg,_12px)] [box-shadow:0_12px_40px_var(--db-record-color-20)] p-[14px_16px] [z-index:var(--layer-menu)]',
	'dashboard-pomodoro-drilldown-head':
		'flex [align-items:center] [justify-content:space-between] [margin-bottom:8px]',
	'dashboard-pomodoro-drilldown-title': '[font-size:0.8em] [font-weight:700] [color:var(--db-text)]',
	'dashboard-pomodoro-stats-record-interruptions':
		'[font-size:0.6em] [color:var(--db-record-color-19)] [flex-shrink:0]',
	'dashboard-expense-stats-overlay':
		'[position:fixed] [top:0] [left:0] w-[100%] h-[100%] [background:var(--db-record-color-2)] flex [align-items:center] [justify-content:center] [z-index:var(--layer-menu)]',
	'dashboard-expense-stats-modal':
		'[background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-lg,_12px)] p-[20px] max-w-[380px] w-[90%] max-h-[80vh] [overflow-y:auto] [box-shadow:0_8px_32px_var(--db-record-color-3)]',
	'dashboard-expense-stats-modal--wide':
		'max-w-[1040px] w-[94%] max-h-[86vh] p-[22px_26px] flex [flex-direction:column] [container-type:inline-size] max-[901px]:max-w-[420px] max-[901px]:max-h-[80vh] max-[641px]:w-[96%] max-[641px]:p-[16px]',
	'dashboard-expense-stats-header':
		'flex [justify-content:space-between] [align-items:center] [margin-bottom:16px] gap-[10px] [flex-wrap:wrap] max-[641px]:[justify-content:flex-start]',
	'dashboard-expense-stats-header-titlewrap': 'flex [flex-direction:column] gap-[2px] min-w-[0]',
	'dashboard-expense-stats-header-title': '[font-size:1.3em] [font-weight:700] [color:var(--db-text)]',
	'dashboard-expense-insight': '[font-size:0.72em] [color:var(--db-text-muted)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-stats-header-right':
		'flex [align-items:center] gap-[10px] [flex-wrap:wrap] [justify-content:flex-end]',
	'dashboard-expense-range-toggle': 'flex gap-[2px] [background:var(--db-bg-hover)] rounded-[6px] p-[2px]',
	'dashboard-expense-range-btn':
		'[text-align:center] [font-size:0.82em] [font-weight:500] [color:var(--db-text-muted)] p-[5px_12px] rounded-[5px] [cursor:pointer] whitespace-nowrap motion-safe:[transition:background_0.15s,_color_0.15s]',
	'dashboard-expense-range-btn--active':
		'[background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [color:var(--db-accent)] [font-weight:700] [box-shadow:0_1px_4px_var(--db-record-color-4)]',
	'dashboard-expense-year-nav': 'hidden [align-items:center] gap-[2px]',
	'dashboard-expense-year-nav--visible': 'flex',
	'dashboard-expense-year-nav-btn':
		'w-[24px] h-[24px] flex [align-items:center] [justify-content:center] [cursor:pointer] [color:var(--db-text-muted)] rounded-[5px] motion-safe:[transition:background_0.15s,_color_0.15s] [&:hover]:[background:var(--db-bg-hover)] [&:hover]:[color:var(--db-text)]',
	'dashboard-expense-year-nav-btn--disabled': '[opacity:0.25] [pointer-events:none]',
	'dashboard-expense-year-nav-label':
		"[font-size:0.85em] [font-weight:600] [color:var(--db-text)] min-w-[48px] [text-align:center] [font-variant-numeric:tabular-nums] p-[3px_14px_3px_6px] rounded-[5px] [cursor:pointer] [position:relative] motion-safe:[transition:background_0.15s] [&:hover]:[background:var(--db-bg-hover)] [&::after]:[content:''] [&::after]:[position:absolute] [&::after]:[right:4px] [&::after]:[top:50%] [&::after]:[transform:translateY(-65%)] [&::after]:[border:4px_solid_transparent] [&::after]:[border-top-color:var(--db-text-muted)] [&::after]:[border-bottom-width:0] [&::after]:[pointer-events:none]",
	'dashboard-expense-year-nav-label--wide': 'min-w-[172px] whitespace-nowrap',
	'dashboard-expense-subrange-toggle':
		'hidden gap-[2px] [background:var(--db-bg-input,_var(--db-record-color-21))] rounded-[var(--db-radius-sm,_6px)] p-[2px]',
	'dashboard-expense-subrange-toggle--visible': 'flex',
	'dashboard-expense-subrange-btn':
		'[cursor:pointer] p-[3px_8px] rounded-[4px] [color:var(--db-text-muted)] [font-size:0.7em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease] [&:hover]:[color:var(--db-text)]',
	'dashboard-expense-subrange-btn--active':
		'[background:var(--db-bg-btn,_var(--db-record-color-22))] [color:var(--db-accent)] [font-weight:600]',
	'dashboard-expense-level-toggle':
		'flex gap-[2px] [background:var(--db-bg-input,_var(--db-record-color-21))] rounded-[var(--db-radius-sm,_6px)] p-[2px]',
	'dashboard-expense-level-btn':
		'[cursor:pointer] p-[2px_7px] rounded-[4px] [color:var(--db-text-muted)] [font-size:0.66em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease] [&:hover]:[color:var(--db-text)]',
	'dashboard-expense-level-btn--active':
		'[background:var(--db-bg-btn,_var(--db-record-color-22))] [color:var(--db-accent)] [font-weight:600]',
	'dashboard-expense-type-toggle':
		'flex gap-[2px] [background:var(--db-bg-input,_var(--db-record-color-21))] rounded-[var(--db-radius-sm,_6px)] p-[2px]',
	'dashboard-expense-type-btn':
		'[cursor:pointer] p-[4px_10px] rounded-[4px] [color:var(--db-text-muted)] [font-size:0.75em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease] [&:hover]:[color:var(--db-text)]',
	'dashboard-expense-type-btn--active':
		'[background:var(--db-bg-btn,_var(--db-record-color-22))] [color:var(--db-accent)] [font-weight:600]',
	'dashboard-expense-stats-close':
		'[cursor:pointer] [color:var(--db-text-muted)] w-[24px] h-[24px] flex [align-items:center] [justify-content:center] rounded-[4px] motion-safe:[transition:background_0.15s] [flex-shrink:0] [&:hover]:[background:var(--db-bg-hover)]',
	'dashboard-expense-stats-body':
		"grid [grid-template-columns:minmax(250px,_300px)_minmax(0,_1fr)] [grid-template-rows:auto_auto] [grid-template-areas:'kpi_mid'_'kpi_right'] gap-[18px] [overflow-y:auto] [scrollbar-width:none] min-h-[0] [flex:1] [padding-top:4px] [&::-webkit-scrollbar]:w-[0] [&::-webkit-scrollbar]:h-[0] @max-[701px]:[grid-template-columns:1fr] @max-[701px]:[grid-template-rows:auto] @max-[701px]:[grid-template-areas:'kpi'_'mid'_'right'] max-[901px]:[grid-template-columns:1fr] max-[901px]:[grid-template-rows:auto] max-[901px]:[grid-template-areas:'kpi'_'mid'_'right']",
	'dashboard-expense-kpi-col':
		'[grid-area:kpi] flex [flex-direction:column] gap-[8px] min-w-[0] [&_>_.dashboard-expense-stats-section]:[margin-top:6px]',
	'dashboard-expense-stats-summary': 'grid [grid-template-columns:1fr_1fr] gap-[6px]',
	'dashboard-expense-stats-card':
		'[background:var(--db-bg-hover)] rounded-[8px] p-[10px_8px] [text-align:center] min-w-[0]',
	'dashboard-expense-stats-card-value-row': 'flex [flex-direction:column] [align-items:center] gap-[2px]',
	'dashboard-expense-stats-card-value':
		'[font-size:1em] [font-weight:700] [color:var(--db-accent)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-stats-card-delta':
		'[font-size:0.58em] [font-weight:600] p-[1px_4px] rounded-[4px] whitespace-nowrap',
	'dashboard-expense-stats-card-delta--up': '[color:var(--db-record-color-9)] [background:var(--db-record-color-10)]',
	'dashboard-expense-stats-card-delta--down':
		'[color:var(--db-record-color-11)] [background:var(--db-record-color-12)]',
	'dashboard-expense-stats-card-label': '[font-size:0.65em] [color:var(--db-text-muted)] [margin-top:2px]',
	'dashboard-expense-stats-section': '[margin-bottom:14px]',
	'dashboard-expense-stats-section-title':
		'[font-size:0.7em] [font-weight:600] [color:var(--db-text-muted)] [text-transform:uppercase] [letter-spacing:0.06em] [margin-bottom:8px]',
	'dashboard-expense-stats-section-title-row':
		'flex [align-items:baseline] [justify-content:space-between] gap-[6px]',
	'dashboard-expense-stats-section-hint': '[font-size:0.6em] [color:var(--db-text-faint)] whitespace-nowrap',
	'dashboard-expense-records-viewall':
		'flex [align-items:center] gap-[1px] [font-size:0.62em] [font-weight:600] [color:var(--db-accent)] [cursor:pointer] whitespace-nowrap [flex-shrink:0] [opacity:0.85] motion-safe:[transition:opacity_0.15s] [&:hover]:[opacity:1]',
	'dashboard-expense-records-viewall-icon': 'flex [align-items:center] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-expense-mid-col': '[grid-area:mid] flex [flex-direction:column] gap-[12px] min-w-[0]',
	'dashboard-expense-right-col': '[grid-area:right] flex [flex-direction:column] gap-[12px] min-w-[0]',
	'dashboard-expense-donut-container': 'flex [flex-direction:column] [align-items:center] gap-[12px]',
	'dashboard-expense-donut-wrap': 'flex [justify-content:center]',
	'dashboard-expense-donut-svg': 'block w-[100%] max-w-[200px] h-[auto]',
	'dashboard-expense-donut-bg': '[stroke:var(--db-bg-hover)]',
	'dashboard-expense-donut-segment': '[cursor:pointer]',
	'dashboard-expense-donut-center-value': '[fill:var(--db-text)] [font-size:0.875em] [font-weight:700]',
	'dashboard-expense-donut-center-label': '[fill:var(--db-text-muted)] [font-size:0.5625em]',
	'dashboard-expense-donut-empty': '[font-size:0.75em] [color:var(--db-text-faint)] [text-align:center] p-[24px_0]',
	'dashboard-expense-donut-legend': 'flex [flex-direction:column] gap-[6px] w-[100%]',
	'dashboard-expense-donut-legend--grid':
		'grid [grid-template-columns:1fr_1fr] gap-[6px_12px] max-[901px]:[grid-template-columns:1fr]',
	'dashboard-expense-donut-legend-item': 'flex [align-items:center] gap-[6px] min-w-[0]',
	'dashboard-expense-donut-legend-dot': 'w-[8px] h-[8px] rounded-[50%] [flex-shrink:0]',
	'dashboard-expense-donut-legend-name':
		'[font-size:0.7em] [color:var(--db-text)] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-expense-donut-legend-pct':
		'[font-size:0.65em] [font-weight:600] [color:var(--db-text)] w-[32px] [text-align:right] [flex-shrink:0]',
	'dashboard-expense-donut-legend-amount':
		'[font-size:0.6em] [color:var(--db-text-muted)] [text-align:right] [flex-shrink:0] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-trend-container': 'min-h-[140px] [position:relative]',
	'dashboard-expense-trend-svg': 'block',
	'dashboard-expense-trend-bar': 'motion-safe:[transition:opacity_0.12s] [&:hover]:[opacity:0.75]',
	'dashboard-expense-trend-tick': '[fill:var(--db-text-faint)] [font-size:0.5em]',
	'dashboard-expense-lines-container': 'min-h-[140px] [position:relative]',
	'dashboard-expense-lines-svg': 'block',
	'dashboard-expense-lines-legend': 'flex [justify-content:flex-end] gap-[12px] [margin-bottom:4px]',
	'dashboard-expense-lines-legend-item': 'gap-[5px]',
	'dashboard-expense-lines-legend-name': '[font-size:0.65em] [color:var(--db-text-muted)] whitespace-nowrap',
	'dashboard-expense-lines-baseline': '[stroke:var(--db-border-card)] [stroke-width:1]',
	'dashboard-expense-lines-line': '[fill:none] [stroke-width:1.5] [stroke-linejoin:round] [stroke-linecap:round]',
	'dashboard-expense-lines-dot': '[stroke:none]',
	'dashboard-expense-lines-slot': '[fill:transparent] [pointer-events:all]',
	'dashboard-expense-lines-guide':
		'[stroke:var(--db-text-faint)] [stroke-width:1] [stroke-dasharray:3_3] [opacity:0] motion-safe:[transition:opacity_0.1s]',
	'dashboard-expense-lines-guide--visible': '[opacity:0.7]',
	'dashboard-expense-chart-tip':
		'[position:absolute] [pointer-events:none] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [color:var(--db-text)] [font-size:0.62em] [line-height:1.35] p-[3px_8px] rounded-[6px] [border:1px_solid_var(--db-border-card)] [box-shadow:0_3px_10px_var(--db-record-color-23)] whitespace-nowrap [z-index:var(--layer-menu)] [opacity:0] motion-safe:[transition:opacity_0.1s]',
	'dashboard-expense-chart-tip--visible': '[opacity:1]',
	'dashboard-expense-rank-row': '[margin-bottom:7px]',
	'dashboard-expense-rank-head': 'flex [align-items:center] gap-[6px] [margin-bottom:3px]',
	'dashboard-expense-rank-name':
		'[font-size:0.68em] [color:var(--db-text)] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-expense-rank-amount':
		'[font-size:0.62em] [color:var(--db-text-muted)] [flex-shrink:0] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-rank-bar-wrap': 'h-[4px] rounded-[2px] [background:var(--db-bg-hover)] [overflow:hidden]',
	'dashboard-expense-rank-bar': 'h-[100%] rounded-[2px]',
	'dashboard-expense-records-scroll': 'max-h-[500px] [overflow:auto] [scrollbar-width:thin]',
	'dashboard-expense-records-table':
		'w-[100%] [border-collapse:collapse] [&_th]:[position:sticky] [&_th]:[top:0] [&_th]:[z-index:var(--layer-menu)] [&_th]:[background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [&_th]:[font-size:0.6em] [&_th]:[font-weight:600] [&_th]:[color:var(--db-text-muted)] [&_th]:[text-transform:uppercase] [&_th]:[letter-spacing:0.05em] [&_th]:[text-align:left] [&_th]:p-[4px_6px] [&_th]:[border-bottom:1px_solid_var(--db-border-card)] [&_th]:whitespace-nowrap [&_th:nth-child(2)]:[text-align:right] [&_td]:[font-size:0.68em] [&_td]:p-[5px_6px] [&_td]:[border-bottom:1px_solid_color-mix(in_srgb,_var(--db-border-card)_50%,_transparent)] [&_td]:[vertical-align:middle] [&_td]:whitespace-nowrap [&_tbody_tr:hover_td]:[background:var(--db-bg-hover)] [&_tbody_tr:hover_.dashboard-expense-records-delete]:[opacity:1]',
	'dashboard-expense-records-type':
		'w-[20px] [&_>_div]:flex [&_>_div]:[align-items:center] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-expense-records-type--expense': '[color:var(--db-danger,_var(--db-record-color-11))]',
	'dashboard-expense-records-type--income': '[color:var(--db-record-color-9)]',
	'dashboard-expense-records-amount':
		'[text-align:right] [font-weight:600] [color:var(--db-text)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-records-amount--income': '[color:var(--db-record-color-9)]',
	'dashboard-expense-records-category':
		'[color:var(--db-text-muted)] max-w-[100px] [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-expense-records-note':
		'max-w-[80px] [overflow:hidden] [text-overflow:ellipsis] [color:var(--db-text-faint)] max-[641px]:max-w-[90px]',
	'dashboard-expense-records-date': '[color:var(--db-text-muted)] [font-variant-numeric:tabular-nums] w-[1%]',
	'dashboard-expense-records-actions': 'w-[26px]',
	'dashboard-expense-records-delete':
		'w-[20px] h-[20px] flex [align-items:center] [justify-content:center] [cursor:pointer] [color:var(--db-text-faint)] rounded-[4px] [opacity:0] motion-safe:[transition:opacity_0.15s,_color_0.15s,_background_0.15s] [&:focus-visible]:[opacity:1] [&:hover]:[color:var(--db-danger,_var(--db-record-color-11))] [&:hover]:[background:var(--db-record-color-24)] [&_svg]:w-[12px] [&_svg]:h-[12px] max-[901px]:[opacity:0.6]',
	'dashboard-expense-ledger-overlay':
		'[position:fixed] [inset:0] [background:var(--db-record-color-2)] flex [align-items:center] [justify-content:center] [z-index:var(--layer-menu)]',
	'dashboard-expense-ledger-modal':
		'[background:var(--db-bg-modal,_var(--background-primary,_var(--db-bg)))] [border:1px_solid_var(--db-border-card)] rounded-[var(--db-radius-lg,_12px)] max-w-[1080px] w-[94%] max-h-[86vh] p-[18px_20px_14px] flex [flex-direction:column] [box-shadow:0_8px_32px_var(--db-record-color-3)] max-[641px]:w-[96%] max-[641px]:p-[14px]',
	'dashboard-expense-ledger-toolbar':
		'flex [align-items:center] gap-[10px_14px] [flex-wrap:wrap] [margin-bottom:12px]',
	'dashboard-expense-ledger-filters':
		'flex [align-items:center] gap-[6px] [flex-wrap:wrap] [flex:1_1_auto] min-w-[0]',
	'dashboard-expense-ledger-actions': 'flex [align-items:center] gap-[6px] [flex-shrink:0]',
	'dashboard-expense-ledger-select':
		'[-webkit-appearance:menulist] [appearance:menulist] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [border:1px_solid_var(--db-border-input,_var(--db-record-color-25))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted)] [font-size:0.72em] p-[4px_6px] [cursor:pointer] max-w-[150px] [&:focus]:[color:var(--db-text)] [&:focus]:[border-color:var(--db-accent)]',
	'dashboard-expense-ledger-select--category': 'max-w-[130px]',
	'dashboard-expense-ledger-date':
		'w-[118px] [box-sizing:border-box] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [border:1px_solid_var(--db-border-input,_var(--db-record-color-25))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted)] [font-size:0.72em] p-[4px_6px] [color-scheme:light_dark]',
	'dashboard-expense-ledger-search':
		'w-[150px] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [border:1px_solid_var(--db-border-input,_var(--db-record-color-25))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text)] [font-size:0.72em] p-[4px_8px] [&:focus]:[border-color:var(--db-accent)] max-[641px]:w-[120px]',
	'dashboard-expense-ledger-btn':
		'[background:var(--db-bg-btn,_var(--db-record-color-22))] [border:1px_solid_var(--db-border-btn,_color-mix(in_srgb,_var(--db-accent)_30%,_transparent))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-accent)] [font-size:0.72em] [font-weight:600] p-[4px_12px] [cursor:pointer] whitespace-nowrap motion-safe:[transition:background_0.15s,_opacity_0.15s] [&:hover:not(:disabled)]:[background:var(--db-bg-btn-hover,_var(--db-record-color-26))] [&:disabled]:[opacity:0.4] [&:disabled]:[cursor:default]',
	'dashboard-expense-ledger-btn--ghost':
		'[background:transparent] [color:var(--db-text-muted)] [border-color:var(--db-border-card)] [&:hover]:[color:var(--db-text)]',
	'dashboard-expense-ledger-btn--danger':
		'[background:var(--db-record-color-24)] [border-color:var(--db-record-color-27)] [color:var(--db-danger,_var(--db-record-color-11))] [&:hover:not(:disabled)]:[background:var(--db-record-color-28)]',
	'dashboard-expense-ledger-file': 'hidden',
	'dashboard-expense-ledger-wrap':
		'[flex:1] min-h-[0] [overflow:auto] [scrollbar-width:thin] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_70%,_transparent)] rounded-[var(--db-radius-sm,_6px)]',
	'dashboard-expense-ledger-table':
		'w-[100%] min-w-[730px] [border-collapse:collapse] [table-layout:fixed] [&_tbody_tr:nth-child(even)_td]:[background:color-mix(in_srgb,_var(--db-bg-hover)_45%,_transparent)] [&_tbody_tr:hover_td]:[background:var(--db-bg-hover)] [&_tbody_tr:hover_.dashboard-expense-ledger-action]:[opacity:1] max-[641px]:min-w-[670px]',
	'dashboard-expense-ledger-th':
		'[position:sticky] [top:0] [z-index:var(--layer-menu)] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-bg)))] [color:var(--db-text-muted)] [font-size:0.66em] [font-weight:600] [text-transform:uppercase] [letter-spacing:0.04em] [text-align:left] p-[6px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_60%,_transparent)] whitespace-nowrap [cursor:pointer] [user-select:none] [&:hover]:[color:var(--db-text)]',
	'dashboard-expense-ledger-th-check': '[cursor:default] w-[34px]',
	'dashboard-expense-ledger-th-actions': '[cursor:default] w-[34px] w-[58px]',
	'dashboard-expense-ledger-th-date': 'w-[92px]',
	'dashboard-expense-ledger-th-amount': 'w-[100px] [text-align:right]',
	'dashboard-expense-ledger-th-type': 'w-[84px]',
	'dashboard-expense-ledger-th-primary': 'w-[92px]',
	'dashboard-expense-ledger-th-category': 'w-[118px]',
	'dashboard-expense-ledger-sort': '[margin-left:3px] [color:var(--db-accent)]',
	'dashboard-expense-ledger-td-check':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap',
	'dashboard-expense-ledger-td-date':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap [color:var(--db-text-muted)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-ledger-td-type':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap',
	'dashboard-expense-ledger-td-primary':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [color:var(--db-text-muted)]',
	'dashboard-expense-ledger-td-category':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-expense-ledger-td-amount':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap [text-align:right] [font-weight:600] [color:var(--db-text)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-ledger-td-note':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [color:var(--db-text-faint)]',
	'dashboard-expense-ledger-td-actions':
		'[font-size:0.72em] p-[5px_8px] [border:1px_solid_color-mix(in_srgb,_var(--db-border-card)_45%,_transparent)] [vertical-align:middle] whitespace-nowrap w-[56px] [text-align:right]',
	'dashboard-expense-ledger-row--selected':
		'[&_td]:[background:color-mix(in_srgb,_var(--db-accent)_10%,_transparent)]',
	'dashboard-expense-ledger-check': '[accent-color:var(--db-accent)] w-[13px] h-[13px] [cursor:pointer]',
	'dashboard-expense-ledger-type-icon':
		'inline-flex [align-items:center] [margin-right:4px] [vertical-align:middle] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-expense-ledger-action':
		'inline-flex [align-items:center] [justify-content:center] w-[20px] h-[20px] [margin-left:4px] rounded-[4px] [cursor:pointer] [color:var(--db-text-faint)] [opacity:0.55] [vertical-align:middle] motion-safe:[transition:opacity_0.15s,_color_0.15s,_background_0.15s] [&:focus-visible]:[opacity:1] [&:hover]:[background:var(--db-bg-hover)] [&:hover]:[color:var(--db-text)] [&_svg]:w-[13px] [&_svg]:h-[13px]',
	'dashboard-expense-ledger-empty':
		'[text-align:center] [color:var(--db-text-faint)] [font-size:0.75em] p-[36px_0] [border:none] [background:transparent]',
	'dashboard-expense-ledger-footer':
		'flex [align-items:center] [justify-content:space-between] gap-[10px] [flex-wrap:wrap] [margin-top:10px]',
	'dashboard-expense-ledger-footer-info':
		'[font-size:0.68em] [color:var(--db-text-muted)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-ledger-pager': 'flex [align-items:center] gap-[6px]',
	'dashboard-expense-ledger-pager-btn': '[&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-expense-ledger-pager-label':
		'[font-size:0.68em] [color:var(--db-text-muted)] min-w-[72px] [text-align:center] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-catmgr': '[text-align:left] max-w-[460px] [align-items:stretch]',
	'dashboard-expense-catmgr-body':
		'flex [flex-direction:column] gap-[14px] max-h-[50vh] [overflow-y:auto] m-[0_0_14px]',
	'dashboard-expense-catmgr-section-title':
		'[font-size:0.72em] [font-weight:600] [color:var(--db-text-muted)] [margin-bottom:6px]',
	'dashboard-expense-catmgr-subtitle':
		'[font-size:0.66em] [font-weight:600] [color:var(--db-text-faint)] m-[8px_0_2px]',
	'dashboard-expense-catmgr-empty': '[font-size:0.72em] [color:var(--db-text-faint)] [margin-bottom:6px]',
	'dashboard-expense-catmgr-row': 'flex [align-items:center] gap-[6px] p-[2px_0] rounded-[4px]',
	'dashboard-expense-catmgr-grip':
		'flex [align-items:center] [color:var(--db-text-faint)] [opacity:0.5] [cursor:grab] [flex-shrink:0] [&:hover]:[opacity:1] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-expense-catmgr-row--dragging': '[opacity:0.45]',
	'dashboard-expense-catmgr-row--drop-before': '[box-shadow:0_-2px_0_0_var(--db-accent)]',
	'dashboard-expense-catmgr-row--drop-after': '[box-shadow:0_2px_0_0_var(--db-accent)]',
	'dashboard-expense-catmgr-name':
		'[flex:1] min-w-[0] [font-size:0.8em] [color:var(--db-text)] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-expense-catmgr-primary':
		'[flex-shrink:0] max-w-[118px] [font-size:0.68em] p-[2px_4px] [box-sizing:border-box] [color:var(--db-text-muted)]',
	'dashboard-expense-catmgr-usage':
		'[flex-shrink:0] [font-size:0.66em] [color:var(--db-text-faint)] [font-variant-numeric:tabular-nums]',
	'dashboard-expense-catmgr-move': 'flex gap-[1px] [flex-shrink:0]',
	'dashboard-expense-catmgr-move-btn':
		'flex [align-items:center] [justify-content:center] w-[16px] h-[16px] rounded-[3px] [cursor:pointer] [color:var(--db-text-faint)] motion-safe:[transition:color_0.15s,_background_0.15s] [&:hover]:[color:var(--db-text)] [&:hover]:[background:var(--db-bg-hover)] [&_svg]:w-[11px] [&_svg]:h-[11px]',
	'dashboard-expense-catmgr-move-btn--disabled': '[opacity:0.2] [pointer-events:none]',
	'dashboard-expense-catmgr-delete':
		'flex [align-items:center] [justify-content:center] w-[20px] h-[20px] [flex-shrink:0] rounded-[4px] [cursor:pointer] [color:var(--db-text-faint)] motion-safe:[transition:color_0.15s,_background_0.15s] [&:hover]:[color:var(--db-danger,_var(--db-record-color-11))] [&:hover]:[background:var(--db-record-color-24)] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-expense-catmgr-add': 'flex gap-[6px] [margin-top:6px]',
	'dashboard-expense-catmgr-input': '[flex:1] min-w-[0] [font-size:0.8em] p-[5px_8px] [box-sizing:border-box]',
	'dashboard-sidebar-reading':
		'flex [flex-direction:column] gap-[0] p-[0] [&:hover_.dashboard-reading-add-btn]:[opacity:0.25] [&:hover_.dashboard-reading-stats-btn]:[opacity:0.25]',
	'dashboard-reading-title-row': 'flex [align-items:center] gap-[4px] p-[8px_10px_6px]',
	'dashboard-reading-title': '[font-size:0.8em] [font-weight:600] [color:var(--db-text)]',
	'dashboard-reading-title-spacer': '[flex:1]',
	'dashboard-reading-add-btn':
		'[cursor:pointer] [opacity:0] motion-safe:[transition:opacity_0.2s] p-[2px] [&:hover]:[opacity:0.6]',
	'dashboard-reading-stats-btn': '[cursor:pointer] [opacity:0] motion-safe:[transition:opacity_0.2s] p-[2px]',
	'dashboard-reading-scroll':
		'flex [flex-direction:column] gap-[8px] max-h-[240px] [overflow-y:auto] p-[0_10px_10px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
	'dashboard-reading-book-card':
		'[position:relative] flex gap-[10px] p-[10px] rounded-[10px] [background:var(--db-bg-hover,_var(--db-record-color-29))] [border:1px_solid_var(--db-border,_var(--db-record-color-30))] motion-safe:[transition:background_0.2s,_border-color_0.2s,_box-shadow_0.2s,_color_0.2s,_transform_0.2s] [&:hover_.dashboard-reading-book-card-edit]:[opacity:0.4] [&:hover_.dashboard-reading-book-card-remove]:[opacity:0.4]',
	'dashboard-reading-book-card--active':
		'[background:var(--db-bg-active,_var(--db-record-color-31))] [border-color:var(--db-accent,_var(--db-record-color-32))]',
	'dashboard-reading-book-card-cover-wrap':
		'w-[48px] h-[64px] rounded-[4px] [background-size:cover] [background-position:center] [flex-shrink:0] [box-shadow:0_2px_6px_var(--db-record-color-4)]',
	'dashboard-reading-book-card-cover-placeholder':
		'w-[100%] h-[100%] rounded-[4px] [background:linear-gradient(135deg,_var(--db-accent,_var(--db-record-color-32))_0%,_var(--db-accent-dim,_var(--db-record-color-33))_100%)] flex [align-items:center] [justify-content:center] [font-size:0.55em] [font-weight:600] [color:var(--db-record-color-15)] [text-align:center] p-[4px_3px] [line-height:1.3] [word-break:break-all] [overflow:hidden]',
	'dashboard-reading-book-card-info':
		'[flex:1] flex [flex-direction:column] [justify-content:center] gap-[2px] [overflow:hidden] min-w-[0]',
	'dashboard-reading-book-card-title':
		'[font-size:0.78em] [font-weight:600] [color:var(--db-text)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [line-height:1.3]',
	'dashboard-reading-book-card-author':
		'[font-size:0.65em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-reading-book-card-timer':
		'flex [align-items:center] [justify-content:space-between] [margin-top:4px] gap-[6px]',
	'dashboard-reading-book-card-time':
		'[font-size:0.72em] [font-weight:600] [font-variant-numeric:tabular-nums] [color:var(--db-text-muted)] [letter-spacing:0.3px]',
	'dashboard-reading-book-card-time--active': '[color:var(--db-accent,_var(--db-record-color-32))] [font-size:0.8em]',
	'dashboard-reading-book-card-actions': 'flex [align-items:center] gap-[4px]',
	'dashboard-reading-book-card-btn':
		'flex [align-items:center] [justify-content:center] w-[26px] h-[26px] rounded-[50%] [cursor:pointer] motion-safe:[transition:background_0.15s,_border-color_0.15s,_box-shadow_0.15s,_color_0.15s,_transform_0.15s] [flex-shrink:0]',
	'dashboard-reading-book-card-btn--play':
		'[background:var(--db-accent,_var(--db-record-color-32))] [color:var(--db-record-color-15)] [&:hover]:[opacity:0.85] [&:hover]:[transform:scale(1.05)] [&_svg]:[color:var(--db-record-color-15)] [&_svg]:w-[12px] [&_svg]:h-[12px] [&_svg]:[margin-left:1px]',
	'dashboard-reading-book-card-btn--pause':
		'[background:var(--db-text-muted,_var(--db-record-color-34))] [color:var(--db-record-color-15)] [&:hover]:[opacity:0.85] [&_svg]:[color:var(--db-record-color-15)] [&_svg]:w-[11px] [&_svg]:h-[11px]',
	'dashboard-reading-book-card-btn--stop':
		'[background:transparent] [border:1.5px_solid_var(--db-border,_var(--db-record-color-1))] [color:var(--db-text-muted)] [&:hover]:[border-color:var(--db-danger,_var(--db-record-color-11))] [&:hover]:[color:var(--db-danger,_var(--db-record-color-11))] [&_svg]:[color:inherit] [&_svg]:w-[10px] [&_svg]:h-[10px]',
	'dashboard-reading-book-card-edit':
		'[position:absolute] [top:4px] w-[18px] h-[18px] flex [align-items:center] [justify-content:center] rounded-[50%] [cursor:pointer] [opacity:0] motion-safe:[transition:opacity_0.2s] [left:4px] [&:hover]:[opacity:1] [&_svg]:w-[10px] [&_svg]:h-[10px] [&_svg]:[color:var(--db-text-muted)]',
	'dashboard-reading-book-card-remove':
		'[position:absolute] [top:4px] w-[18px] h-[18px] flex [align-items:center] [justify-content:center] rounded-[50%] [cursor:pointer] [opacity:0] motion-safe:[transition:opacity_0.2s] [right:4px] [&:hover]:[opacity:1] [&_svg]:w-[10px] [&_svg]:h-[10px] [&_svg]:[color:var(--db-text-muted)]',
	'dashboard-reading-book-overlay':
		'[position:fixed] [top:0] [left:0] [right:0] [bottom:0] [background:var(--db-record-color-2)] flex [align-items:center] [justify-content:center] [z-index:var(--layer-menu)]',
	'dashboard-reading-book-modal':
		'[background:var(--db-bg-modal,_var(--background-secondary,_var(--db-record-color-15)))] rounded-[var(--db-radius-lg,_12px)] w-[90%] max-w-[400px] max-h-[70vh] flex [flex-direction:column] [overflow:hidden] [box-shadow:0_8px_32px_var(--db-record-color-3)]',
	'dashboard-reading-book-header':
		'flex [align-items:center] [justify-content:space-between] p-[12px_16px] [border-bottom:1px_solid_var(--db-border,_var(--db-record-color-35))]',
	'dashboard-reading-book-header-title': '[font-size:0.9em] [font-weight:600]',
	'dashboard-reading-book-close': '[cursor:pointer] [opacity:0.5] p-[4px] [&:hover]:[opacity:1]',
	'dashboard-reading-book-input-area': 'p-[10px_16px]',
	'dashboard-reading-book-input':
		'w-[100%] p-[8px_12px] rounded-[8px] [border:1px_solid_var(--db-border,_var(--db-record-color-1))] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-record-color-15)))] [color:var(--db-text)] [font-size:0.85em] [&:focus]:[border-color:var(--db-accent,_var(--db-record-color-32))]',
	'dashboard-reading-book-results':
		'[flex:1] [overflow-y:auto] p-[0_16px_12px] flex [flex-direction:column] gap-[6px]',
	'dashboard-reading-book-searching':
		'[font-size:0.75em] [color:var(--db-text-muted)] [text-align:center] p-[16px_0]',
	'dashboard-reading-book-no-results':
		'[font-size:0.75em] [color:var(--db-text-muted)] [text-align:center] p-[16px_0]',
	'dashboard-reading-book-item':
		'flex [align-items:center] gap-[10px] p-[8px] rounded-[8px] [cursor:pointer] motion-safe:[transition:background_0.2s] [&:hover]:[background:var(--db-bg-hover,_var(--db-record-color-36))]',
	'dashboard-reading-book-item-cover':
		'w-[32px] h-[42px] rounded-[3px] [background-size:cover] [background-position:center] [flex-shrink:0] [box-shadow:0_1px_3px_var(--db-record-color-35)]',
	'dashboard-reading-book-item-nocover':
		'w-[32px] h-[42px] rounded-[3px] [background:var(--db-bg-hover,_var(--db-record-color-30))] [flex-shrink:0]',
	'dashboard-reading-book-item-info': 'flex [flex-direction:column] [overflow:hidden]',
	'dashboard-reading-book-item-title':
		'[font-size:0.8em] [font-weight:500] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-reading-book-item-author':
		'[font-size:0.7em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-reading-book-manual':
		'flex [align-items:center] gap-[6px] [padding-top:8px] [border-top:1px_solid_var(--db-border,_var(--db-record-color-37))] [margin-top:4px]',
	'dashboard-reading-book-manual-label': '[font-size:0.7em] [color:var(--db-text-muted)] [flex-shrink:0]',
	'dashboard-reading-book-manual-input':
		'[flex:1] p-[4px_8px] rounded-[6px] [border:1px_solid_var(--db-border,_var(--db-record-color-1))] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-record-color-15)))] [color:var(--db-text)] [font-size:0.75em] [&:focus]:[border-color:var(--db-accent,_var(--db-record-color-32))]',
	'dashboard-reading-book-manual-btn':
		'p-[4px_10px] rounded-[6px] [border:none] [background:var(--db-accent,_var(--db-record-color-32))] [color:var(--db-record-color-15)] [font-size:0.7em] [cursor:pointer] [flex-shrink:0]',
	'dashboard-reading-book-list': 'flex [flex-direction:column] gap-[6px]',
	'dashboard-reading-book-list-row':
		'flex [align-items:center] gap-[8px] p-[6px_0] [&_.dashboard-reading-stats-record-del]:flex [&_.dashboard-reading-stats-record-del]:[align-items:center] [&_.dashboard-reading-stats-record-del]:[justify-content:center] [&_.dashboard-reading-stats-record-del]:w-[20px] [&_.dashboard-reading-stats-record-del]:h-[20px] [&_.dashboard-reading-stats-record-del]:rounded-[4px] [&_.dashboard-reading-stats-record-del]:[cursor:pointer] [&_.dashboard-reading-stats-record-del]:[opacity:0] [&_.dashboard-reading-stats-record-del]:motion-safe:[transition:opacity_0.15s,_background_0.15s] [&_.dashboard-reading-stats-record-del]:[flex-shrink:0] [&:hover_.dashboard-reading-stats-record-del]:[opacity:0.5]',
	'dashboard-reading-book-list-cover':
		'w-[24px] h-[32px] rounded-[2px] [background-size:cover] [background-position:center] [flex-shrink:0]',
	'dashboard-reading-book-list-nocover':
		'w-[24px] h-[32px] rounded-[2px] [background:var(--db-bg-hover,_var(--db-record-color-30))] [flex-shrink:0]',
	'dashboard-reading-book-list-info': '[flex:1] [overflow:hidden]',
	'dashboard-reading-book-list-title':
		'[font-size:0.7em] [font-weight:500] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-reading-book-list-author':
		'[font-size:0.6em] [color:var(--db-text-muted)] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-reading-book-list-meta': 'flex [flex-direction:column] [align-items:flex-end] [flex-shrink:0]',
	'dashboard-reading-book-list-duration': '[font-size:0.7em] [font-weight:500]',
	'dashboard-reading-book-card-sessions': '[font-size:0.6em] [color:var(--db-text-muted)]',
	'dashboard-reading-book-card-progress': 'flex [align-items:center] gap-[6px] [margin-top:4px]',
	'dashboard-reading-book-card-progress-bar':
		'[flex:1] h-[3px] rounded-[2px] [background:var(--db-border,_var(--db-record-color-37))] [overflow:hidden]',
	'dashboard-reading-book-card-progress-fill':
		'h-[100%] rounded-[2px] [background:var(--db-accent,_var(--db-record-color-32))] motion-safe:[transition:width_0.3s_ease]',
	'dashboard-reading-book-card-progress-fill--done': '[background:var(--db-record-color-9)]',
	'dashboard-reading-book-card-progress-text':
		'[font-size:0.55em] [color:var(--db-text-muted)] [flex-shrink:0] min-w-[30px] [text-align:right]',
	'dashboard-reading-end-overlay':
		'[position:fixed] [top:0] [left:0] [right:0] [bottom:0] [background:var(--db-record-color-2)] flex [align-items:center] [justify-content:center] [z-index:var(--layer-menu)]',
	'dashboard-reading-end-modal':
		'[background:var(--db-bg-modal,_var(--background-secondary,_var(--db-record-color-15)))] rounded-[var(--db-radius-lg,_14px)] w-[88%] max-w-[380px] [overflow:hidden] [box-shadow:0_12px_40px_var(--db-record-color-38)]',
	'dashboard-reading-end-header': 'flex [align-items:center] [justify-content:space-between] p-[16px_18px_12px]',
	'dashboard-reading-end-title': '[font-size:0.95em] [font-weight:600] [color:var(--db-text)]',
	'dashboard-reading-end-close': '[cursor:pointer] [opacity:0.4] p-[2px] [&:hover]:[opacity:1]',
	'dashboard-reading-end-body': 'p-[0_18px_16px] flex [flex-direction:column] gap-[12px]',
	'dashboard-reading-end-row': 'flex [align-items:center] [justify-content:space-between]',
	'dashboard-reading-end-label': '[font-size:0.8em] [color:var(--db-text-muted)]',
	'dashboard-reading-end-value': '[font-size:0.8em] [font-weight:500] [color:var(--db-text)]',
	'dashboard-reading-end-section': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-reading-end-section-title': '[font-size:0.78em] [font-weight:600] [color:var(--db-text)]',
	'dashboard-reading-end-mode-toggle':
		'flex gap-[2px] [background:var(--db-bg-hover,_var(--db-record-color-36))] rounded-[6px] p-[2px] [margin-bottom:4px]',
	'dashboard-reading-end-mode-btn':
		'[flex:1] [text-align:center] p-[4px_8px] rounded-[5px] [font-size:0.7em] [color:var(--db-text-muted)] [cursor:pointer] motion-safe:[transition:background_0.15s,_border-color_0.15s,_box-shadow_0.15s,_color_0.15s,_transform_0.15s]',
	'dashboard-reading-end-mode-btn--active':
		'[background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-record-color-15)))] [color:var(--db-text)] [font-weight:500] [box-shadow:0_1px_3px_var(--db-record-color-37)]',
	'dashboard-reading-end-inputs': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-reading-end-page-readonly':
		'w-[100%] p-[8px_10px] rounded-[8px] [background:var(--db-bg-hover,_var(--db-record-color-36))] [color:var(--db-text-muted)] [font-size:0.85em] [text-align:center]',
	'dashboard-reading-end-page-row': 'flex [align-items:center] gap-[10px]',
	'dashboard-reading-end-page-col': '[flex:1] flex [flex-direction:column] gap-[4px]',
	'dashboard-reading-end-page-label': '[font-size:0.7em] [color:var(--db-text-muted)]',
	'dashboard-reading-end-page-input':
		'w-[100%] p-[8px_10px] rounded-[8px] [border:1px_solid_var(--db-border,_var(--db-record-color-1))] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-record-color-15)))] [color:var(--db-text)] [font-size:0.85em] [text-align:center] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:[-webkit-appearance:none] [&::-webkit-inner-spin-button]:m-[0] [&::-webkit-outer-spin-button]:[-webkit-appearance:none] [&::-webkit-outer-spin-button]:m-[0] [&:focus]:[border-color:var(--db-accent,_var(--db-record-color-32))]',
	'dashboard-reading-end-page-input--total': 'max-w-[80px]',
	'dashboard-reading-end-page-arrow':
		'[color:var(--db-text-muted)] [font-size:0.85em] [flex-shrink:0] [margin-top:16px]',
	'dashboard-reading-end-total-row': 'flex [align-items:center] gap-[8px]',
	'dashboard-reading-end-finished': 'flex [align-items:center] gap-[8px]',
	'dashboard-reading-end-checkbox':
		'w-[16px] h-[16px] [accent-color:var(--db-accent,_var(--db-record-color-32))] [cursor:pointer]',
	'dashboard-reading-end-checkbox-label': '[font-size:0.78em] [color:var(--db-text)] [cursor:pointer]',
	'dashboard-reading-end-footer':
		'flex [align-items:center] [justify-content:flex-end] gap-[8px] p-[12px_18px_16px] [border-top:1px_solid_var(--db-border,_var(--db-record-color-30))]',
	'dashboard-reading-end-btn':
		'p-[7px_16px] rounded-[8px] [border:none] [font-size:0.8em] [font-weight:500] [cursor:pointer] motion-safe:[transition:background_0.15s,_border-color_0.15s,_box-shadow_0.15s,_color_0.15s,_transform_0.15s]',
	'dashboard-reading-end-btn--cancel':
		'[background:transparent] [color:var(--db-text-muted)] [&:hover]:[color:var(--db-text)]',
	'dashboard-reading-end-btn--discard':
		'[background:transparent] [color:var(--db-text-muted)] [border:1px_solid_var(--db-border,_var(--db-record-color-4))] [&:hover]:[border-color:var(--db-danger,_var(--db-record-color-11))] [&:hover]:[color:var(--db-danger,_var(--db-record-color-11))]',
	'dashboard-reading-end-btn--confirm':
		'[background:var(--db-accent,_var(--db-record-color-32))] [color:var(--db-record-color-15)] [&:hover]:[opacity:0.9]',
	'dashboard-reading-end-btn--delete':
		'[background:transparent] [color:var(--db-danger,_var(--db-record-color-11))] [border:1px_solid_var(--db-record-color-39)] [margin-left:auto] [&:hover]:[background:var(--db-danger,_var(--db-record-color-11))] [&:hover]:[color:var(--db-record-color-15)] [&:hover]:[border-color:var(--db-danger,_var(--db-record-color-11))]',
	'dashboard-reading-stats-content':
		'flex [flex-direction:column] gap-[10px] p-[0_14px_16px] [overflow-y:auto] max-h-[calc(70vh_-_52px)]',
	'dashboard-reading-stats-card':
		'[background:var(--db-bg-hover,_var(--db-record-color-29))] rounded-[10px] p-[12px] [border:1px_solid_var(--db-border,_var(--db-record-color-40))]',
	'dashboard-reading-stats-card-title':
		'[font-size:0.78em] [font-weight:600] [color:var(--db-text)] [margin-bottom:10px]',
	'dashboard-reading-stats-summary': 'grid [grid-template-columns:1fr_1fr] gap-[8px]',
	'dashboard-reading-stats-summary-item':
		'flex [flex-direction:column] [align-items:center] p-[8px_4px] rounded-[8px] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-record-color-15)))] gap-[2px]',
	'dashboard-reading-stats-summary-value':
		'[font-size:1em] [font-weight:700] [color:var(--db-text)] [line-height:1.3]',
	'dashboard-reading-stats-summary-label': '[font-size:0.6em] [color:var(--db-text-muted)]',
	'dashboard-reading-stats-range':
		'flex gap-[2px] [background:var(--db-bg-modal-raised,_var(--background-primary,_var(--db-record-color-15)))] rounded-[6px] p-[2px] [margin-bottom:8px]',
	'dashboard-reading-stats-range-btn':
		'[flex:1] [text-align:center] p-[4px_8px] rounded-[5px] [font-size:0.68em] [color:var(--db-text-muted)] [cursor:pointer] motion-safe:[transition:background_0.15s,_border-color_0.15s,_box-shadow_0.15s,_color_0.15s,_transform_0.15s]',
	'dashboard-reading-stats-range-btn--active':
		'[background:var(--db-accent,_var(--db-record-color-32))] [color:var(--db-record-color-15)] [font-weight:500]',
	'dashboard-reading-stats-empty': '[font-size:0.72em] [color:var(--db-text-muted)] [text-align:center] p-[12px_0]',
	'dashboard-reading-stats-record':
		'flex [align-items:center] gap-[8px] p-[6px_0] [border-bottom:1px_solid_var(--db-border,_var(--db-record-color-36))] [&:last-child]:[border-bottom:none] [&:hover_.dashboard-reading-stats-record-del]:[opacity:0.5]',
	'dashboard-reading-stats-record-date':
		'[font-size:0.68em] [color:var(--db-text-muted)] [flex-shrink:0] min-w-[56px]',
	'dashboard-reading-stats-record-book':
		'[font-size:0.72em] [font-weight:500] [color:var(--db-text)] [flex:1] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-reading-stats-record-dur': '[font-size:0.68em] [color:var(--db-text-muted)] [flex-shrink:0]',
	'dashboard-reading-stats-record-del':
		'flex [align-items:center] [justify-content:center] w-[20px] h-[20px] rounded-[4px] [cursor:pointer] [opacity:0] motion-safe:[transition:opacity_0.15s,_background_0.15s] [flex-shrink:0] [&:hover]:[opacity:1] [&:hover]:[background:var(--db-record-color-41)] [&_svg]:w-[12px] [&_svg]:h-[12px] [&_svg]:[color:var(--db-record-color-11)]',
	'dashboard-sidebar-lunar': 'flex [flex-direction:column] gap-[6px] [position:relative]',
	'dashboard-sidebar-year-progress': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-sidebar-year-progress-header': 'flex [align-items:baseline] [justify-content:space-between] gap-[8px]',
	'dashboard-sidebar-year-progress-year': '[font-size:1.15em] [font-weight:600] [color:var(--db-text-primary)]',
	'dashboard-sidebar-year-progress-percent':
		'[font-size:0.95em] [font-weight:600] [color:var(--db-accent)] [font-variant-numeric:tabular-nums]',
	'dashboard-sidebar-year-progress-left':
		'[font-size:0.8em] [color:var(--db-text-muted)] [font-variant-numeric:tabular-nums]',
	'dashboard-sidebar-year-progress-bar': '[margin-bottom:0] [&_.dashboard-progress-bar]:h-[8px]',
	'dashboard-sidebar-year-progress-sub':
		'flex [justify-content:space-between] gap-[8px] [font-size:0.78em] [color:var(--db-text-muted)] [font-variant-numeric:tabular-nums]',
	'dashboard-sidebar-lunar-header': 'flex [flex-direction:column] [align-items:center] gap-[4px]',
	'dashboard-sidebar-lunar-meta':
		'flex [flex-wrap:wrap] [justify-content:center] gap-[4px_8px] [font-size:0.8em] [color:var(--db-text-muted)]',
	'dashboard-sidebar-lunar-ganzhi': '[opacity:0.85]',
	'dashboard-sidebar-lunar-zodiac': '[opacity:0.85]',
	'dashboard-sidebar-lunar-jieqi': '[color:var(--db-accent)] [font-weight:500] [opacity:1]',
	'dashboard-sidebar-lunar-date':
		'[font-size:1.3em] [font-weight:700] [color:var(--db-accent)] [letter-spacing:0.04em] [text-align:center] [margin-top:2px] flex [align-items:center] [justify-content:center] gap-[6px]',
	'dashboard-sidebar-lunar-badges': 'flex [flex-wrap:wrap] gap-[4px]',
	'dashboard-sidebar-lunar-badge':
		'inline-flex [align-items:center] p-[2px_8px] rounded-[var(--db-radius-sm,_8px)] [font-size:0.75em] [font-weight:500] [line-height:1.4]',
	'dashboard-sidebar-lunar-badge--holiday':
		'[background:var(--db-record-color-42)] [color:var(--db-record-color-43)]',
	'dashboard-sidebar-lunar-badge--inline': '[font-size:0.55em] [flex-shrink:0]',
	'dashboard-sidebar-lunar-badge--festival':
		'[background:var(--db-record-color-44)] [color:var(--db-record-color-45)]',
	'dashboard-sidebar-lunar-badge--work': '[background:var(--db-record-color-46)] [color:var(--db-accent)]',
	'dashboard-sidebar-lunar-badge--weekend':
		'[background:var(--db-record-color-47)] [color:var(--db-record-color-48)]',
	'dashboard-sidebar-lunar-almanac': 'flex [flex-wrap:wrap] [justify-content:center]',
	'dashboard-sidebar-lunar-almanac-text':
		'[font-size:0.85em] [color:var(--db-text-muted)] [font-weight:400] [line-height:1.5] [text-align:center]',
	'dashboard-sidebar-lunar-fortune-btn':
		'[position:absolute] [top:10px] [left:6px] [font-size:1.1em] [cursor:pointer] [opacity:0.6] motion-safe:[transition:opacity_0.2s,_transform_0.2s] [line-height:1] [z-index:var(--layer-menu)] [&:hover]:[opacity:1] [&:hover]:[transform:scale(1.15)]',
	'dashboard-sidebar-calendar':
		'[position:relative] [overflow:hidden] [&_.dashboard-library-toolbar-spacer]:hidden [&_.dashboard-calendar-content]:p-[0] [&_.dashboard-calendar-nav]:flex [&_.dashboard-calendar-nav]:[align-items:center] [&_.dashboard-calendar-nav]:gap-[2px] [&_.dashboard-calendar-nav]:[margin-bottom:6px] [&_.dashboard-calendar-nav-label]:[flex:1] [&_.dashboard-calendar-nav-label]:min-w-[0] [&_.dashboard-calendar-nav-label]:[text-align:center] [&_.dashboard-calendar-nav-label]:[font-size:0.85em] [&_.dashboard-calendar-nav-label]:[font-weight:600] [&_.dashboard-calendar-nav-label]:[color:var(--db-text)] [&_.dashboard-calendar-nav-label]:whitespace-nowrap [&_.dashboard-calendar-nav-label]:[overflow:hidden] [&_.dashboard-calendar-nav-label]:[text-overflow:ellipsis] [&_.dashboard-calendar-nav-btn]:[flex-shrink:0] [&_.dashboard-calendar-nav-btn]:w-[22px] [&_.dashboard-calendar-nav-btn]:h-[22px] [&_.dashboard-calendar-nav-btn]:flex [&_.dashboard-calendar-nav-btn]:[align-items:center] [&_.dashboard-calendar-nav-btn]:[justify-content:center] [&_.dashboard-calendar-nav-btn]:[cursor:pointer] [&_.dashboard-calendar-nav-btn]:rounded-[var(--db-radius-sm,_6px)] [&_.dashboard-calendar-nav-btn]:[color:var(--db-text-muted)] [&_.dashboard-calendar-nav-btn]:motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease] [&_.dashboard-calendar-nav-btn:hover]:[background:var(--db-bg-hover)] [&_.dashboard-calendar-nav-btn:hover]:[color:var(--db-text)] [&_.dashboard-calendar-nav-btn_svg]:w-[14px] [&_.dashboard-calendar-nav-btn_svg]:h-[14px] [&_.dashboard-calendar-today-btn]:[flex-shrink:0] [&_.dashboard-calendar-today-btn]:flex [&_.dashboard-calendar-today-btn]:[align-items:center] [&_.dashboard-calendar-today-btn]:[justify-content:center] [&_.dashboard-calendar-today-btn]:w-[22px] [&_.dashboard-calendar-today-btn]:h-[22px] [&_.dashboard-calendar-today-btn]:p-[0] [&_.dashboard-calendar-today-btn]:[background:none] [&_.dashboard-calendar-today-btn]:[background-color:transparent] [&_.dashboard-calendar-today-btn]:[border:none] [&_.dashboard-calendar-today-btn]:[box-shadow:none] [&_.dashboard-calendar-today-btn]:[cursor:pointer] [&_.dashboard-calendar-today-btn]:rounded-[var(--db-radius-sm,_6px)] [&_.dashboard-calendar-today-btn]:[color:var(--db-text-muted)] [&_.dashboard-calendar-today-btn]:motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease] [&_.dashboard-calendar-today-btn:hover]:[background:var(--db-bg-hover)] [&_.dashboard-calendar-today-btn:hover]:[color:var(--db-accent)] [&_.dashboard-calendar-today-btn_svg]:w-[14px] [&_.dashboard-calendar-today-btn_svg]:h-[14px] [&_.dashboard-calendar-view-toggle]:[flex-shrink:0] [&_.dashboard-library-view-btn]:p-[3px_5px] [&_.dashboard-library-view-btn_svg]:w-[13px] [&_.dashboard-library-view-btn_svg]:h-[13px] [&_.dashboard-calendar.is-compact_.dashboard-calendar-body]:grid [&_.dashboard-calendar.is-compact_.dashboard-calendar-body]:[grid-template-columns:repeat(7,_1fr)] [&_.dashboard-calendar.is-compact_.dashboard-calendar-body]:gap-[2px] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:[aspect-ratio:1_/_1] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:flex [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:[flex-direction:column] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:[align-items:center] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:[justify-content:center] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:gap-[2px] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:p-[0] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:min-h-[0] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell]:rounded-[var(--db-radius-sm,_6px)] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell-num]:[font-size:0.78em] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell-num]:[line-height:1] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-clickable]:[cursor:pointer] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-clickable]:motion-safe:[transition:background_0.12s_ease] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-clickable:hover]:[background:var(--db-bg-hover)] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-today]:[background:color-mix(in_srgb,_var(--db-accent)_22%,_transparent)] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-today]:[color:var(--db-text)] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-today]:[font-weight:700] [&_.dashboard-calendar.is-compact_.dashboard-calendar-cell.is-outside]:[opacity:0.4] [&_.dashboard-calendar.is-compact_.dashboard-calendar-more]:hidden',
	'dashboard-calendar-refresh-btn':
		'inline-flex [align-items:center] [justify-content:center] w-[30px] h-[30px] [margin-top:4px] p-[0] [background:transparent] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] rounded-[var(--db-radius-sm,_6px)] [cursor:pointer] [color:var(--db-text-muted)] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease,_border-color_0.15s_ease] [&:hover]:[background:var(--db-bg-hover)] [&:hover]:[color:var(--db-accent)] [&:hover]:[border-color:var(--db-accent)] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-calendar-cell-dot':
		'w-[5px] h-[5px] rounded-[50%] [background:var(--db-accent)] [flex-shrink:0] [&.is-done]:[background:var(--db-text-faint,_var(--db-text-muted,_var(--text-muted)))] [&.is-done]:[opacity:0.55]',
	'dashboard-calendar-day-preview':
		'[position:fixed] [z-index:var(--layer-menu)] min-w-[180px] max-w-[360px] max-h-[min(60vh,_420px)] flex [flex-direction:column] [background:var(--db-bg-modal,_var(--background-primary))] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] rounded-[var(--db-radius-md)] [box-shadow:0_10px_32px_var(--db-record-color-49)] [color:var(--db-text,_var(--text-normal))] [font-size:1em] [line-height:1.45] [overflow:hidden] [pointer-events:none]',
	'dashboard-calendar-day-preview-list':
		'flex [flex-direction:column] gap-[3px] p-[8px] [overflow-y:auto] [scrollbar-width:thin] [&_.dashboard-calendar-event]:flex [&_.dashboard-calendar-event]:[align-items:center] [&_.dashboard-calendar-event]:gap-[8px] [&_.dashboard-calendar-event]:[font-size:0.95em] [&_.dashboard-calendar-event]:p-[5px_7px] [&_.dashboard-calendar-event]:rounded-[var(--db-radius-sm,_6px)] [&_.dashboard-calendar-event]:[border-left:3px_solid_transparent] [&_.dashboard-calendar-event.prio-high]:[border-left-color:var(--db-prio-high,_var(--db-record-color-43))] [&_.dashboard-calendar-event.prio-medium]:[border-left-color:var(--db-prio-medium,_var(--db-record-color-45))] [&_.dashboard-calendar-event.prio-low]:[border-left-color:var(--db-prio-low,_var(--db-record-color-50))] [&_.dashboard-calendar-event.is-overdue]:[background:color-mix(in_srgb,_var(--db-prio-high,_var(--db-record-color-43))_16%,_transparent)] [&_.dashboard-calendar-event.is-done_.dashboard-calendar-event-text]:[text-decoration:line-through] [&_.dashboard-calendar-event.is-done_.dashboard-calendar-event-text]:[opacity:0.6] [&_.dashboard-calendar-event-time]:[font-size:0.92em] [&_.dashboard-calendar-event-time]:[font-weight:600] [&_.dashboard-calendar-event-time]:[color:var(--db-text-muted,_var(--text-muted))] [&_.dashboard-calendar-event-time]:[flex-shrink:0] [&_.dashboard-calendar-event-time]:[font-variant-numeric:tabular-nums] [&_.dashboard-calendar-event-text]:[flex:1] [&_.dashboard-calendar-event-text]:min-w-[0] [&_.dashboard-calendar-event-text]:[overflow:hidden] [&_.dashboard-calendar-event-text]:[text-overflow:ellipsis] [&_.dashboard-calendar-event-text]:whitespace-nowrap',
	'dashboard-calendar':
		'[&.is-compact_.dashboard-calendar-cell-list]:hidden flex [flex-direction:column] gap-[4px] [&.is-compact_.dashboard-calendar-cell]:min-h-[64px] [&.is-compact_.dashboard-calendar-cell.has-tasks]:[cursor:pointer] [&.is-compact_.dashboard-calendar-cell.has-tasks:hover]:[background:var(--db-bg-card-hover,_var(--db-record-color-76))] [&.is-full_.dashboard-calendar-cell]:h-[clamp(104px,_16vh,_200px)] [&.is-full_.dashboard-calendar-cell]:[border-color:color-mix(in_srgb,_var(--db-text,_var(--db-record-color-92))_16%,_transparent)] [&.is-full_.dashboard-calendar-cell.is-today]:[background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_16%,_transparent)] [&.is-full_.dashboard-calendar-cell.is-today]:[border-color:var(--db-accent,_var(--interactive-accent))] [&.is-full_.dashboard-calendar-cell.is-today_.dashboard-calendar-cell-num]:[color:var(--db-accent,_var(--text-accent))] [&.is-full_.dashboard-calendar-cell.is-today_.dashboard-calendar-cell-num]:[font-weight:700] [&.is-full_.dashboard-calendar-cell-num.is-clickable]:[cursor:pointer] [&.is-full_.dashboard-calendar-cell-num.is-clickable]:rounded-[4px] [&.is-full_.dashboard-calendar-cell-num.is-clickable]:m-[-2px_-5px] [&.is-full_.dashboard-calendar-cell-num.is-clickable]:p-[2px_5px] [&.is-full_.dashboard-calendar-cell-num.is-clickable]:[align-self:flex-start] [&.is-full_.dashboard-calendar-cell-num.is-clickable:hover]:[background:var(--db-bg-hover,_var(--db-record-color-78))] [&.is-full_.dashboard-calendar-cell-num.is-clickable:hover]:[color:var(--db-text,_var(--text-normal))] [&.is-full_.dashboard-calendar-cell-num.is-clickable:focus-visible]:[outline:2px_solid_var(--db-accent,_var(--interactive-accent))] [&.is-full_.dashboard-calendar-cell-num.is-clickable:focus-visible]:[outline-offset:1px] [&.dashboard-calendar--week]:flex [&.dashboard-calendar--week]:[flex-direction:column] [&.dashboard-calendar--week]:gap-[4px] [&.is-full_.dashboard-calendar-event]:[font-size:0.8125em] [&.is-full_.dashboard-calendar-event]:p-[3px_6px] [&.is-full_.dashboard-calendar-event]:[line-height:1.45] [&.is-full_.dashboard-calendar-event-time]:[font-size:0.8125em] [&.is-full_.dashboard-calendar-event-text_.dashboard-wikilink]:[pointer-events:none]',
	'fortune-overlay':
		'[position:fixed] [inset:0] [z-index:var(--layer-menu)] flex [align-items:center] [justify-content:center] [background:var(--db-record-color-51)] [backdrop-filter:blur(2px)] [-webkit-backdrop-filter:blur(2px)]',
	'fortune-card':
		"flex [flex-direction:column] [align-items:center] p-[36px_28px_28px] min-w-[260px] max-w-[300px] m-[0_auto] [background:linear-gradient(160deg,_var(--db-record-color-52)_0%,_var(--db-record-color-53)_40%,_var(--db-record-color-54)_100%)] [border:2px_solid_var(--db-record-color-55)] rounded-[4px] [box-shadow:0_2px_12px_var(--db-record-color-56),_inset_0_0_30px_var(--db-record-color-57)] [color:var(--db-record-color-58)] [position:relative] [&::before]:[content:''] [&::before]:[position:absolute] [&::before]:[top:6px] [&::before]:[left:6px] [&::before]:[right:6px] [&::before]:[bottom:6px] [&::before]:[border:1px_solid_var(--db-record-color-59)] [&::before]:rounded-[2px] [&::before]:[pointer-events:none]",
	'fortune-card-title':
		'[font-size:1.5em] [font-weight:700] [color:var(--db-record-color-60)] [margin-bottom:6px] [letter-spacing:0.12em] [text-align:center]',
	'fortune-card-subtitle':
		'[font-size:0.85em] [color:var(--db-record-color-61)] [margin-bottom:24px] [letter-spacing:0.04em] [text-align:center]',
	'fortune-category-grid': 'grid [grid-template-columns:repeat(3,_1fr)] gap-[10px] w-[100%]',
	'fortune-category-btn':
		'flex [flex-direction:column] [align-items:center] gap-[8px] p-[16px_8px] rounded-[4px] [background:var(--db-record-color-62)] [border:1.5px_solid_var(--db-record-color-55)] [cursor:pointer] motion-safe:[transition:background_0.2s,_border-color_0.2s,_box-shadow_0.2s,_color_0.2s,_transform_0.2s] [color:var(--db-record-color-58)] [&:hover]:[background:var(--db-record-color-63)] [&:hover]:[border-color:var(--db-record-color-60)] [&:hover]:[transform:translateY(-2px)] [&:hover]:[box-shadow:0_2px_8px_var(--db-record-color-64)]',
	'fortune-category-emoji': '[font-size:1.5em] [line-height:1]',
	'fortune-category-label':
		'[font-size:0.9em] [color:var(--db-record-color-58)] [font-weight:600] [letter-spacing:0.06em]',
	'fortune-card--result': 'p-[32px_24px_24px] min-w-[240px] max-w-[280px]',
	'fortune-result-header':
		'flex [flex-direction:column] [align-items:center] gap-[8px] w-[100%] [margin-bottom:16px]',
	'fortune-result-seal':
		"inline-flex [align-items:center] [justify-content:center] w-[56px] h-[56px] [border:2.5px_solid_var(--db-record-color-65)] rounded-[50%] [color:var(--db-record-color-65)] [font-size:0.85em] [font-weight:800] [letter-spacing:0.04em] [line-height:1.2] [text-align:center] [transform:rotate(-8deg)] [position:relative] [&::after]:[content:''] [&::after]:[position:absolute] [&::after]:[inset:3px] [&::after]:[border:1px_solid_var(--db-record-color-66)] [&::after]:rounded-[50%] [&::after]:[pointer-events:none]",
	'fortune-result-seal--super': '[background:var(--db-record-color-67)]',
	'fortune-result-seal--good':
		'[background:var(--db-record-color-68)] [border-color:var(--db-record-color-69)] [color:var(--db-record-color-69)] [&::after]:[border-color:var(--db-record-color-70)]',
	'fortune-result-seal--medium':
		'[background:var(--db-record-color-71)] [border-color:var(--db-record-color-61)] [color:var(--db-record-color-61)] [&::after]:[border-color:var(--db-record-color-72)]',
	'fortune-result-category':
		'[position:absolute] [top:10px] [right:10px] [font-size:0.75em] [color:var(--db-record-color-73)] [font-weight:500] [letter-spacing:0.04em] [z-index:var(--layer-menu)]',
	'fortune-result-divider':
		'w-[80%] h-[1px] [background:linear-gradient(90deg,_transparent,_var(--db-record-color-55),_transparent)] m-[0_auto_20px]',
	'fortune-result-verse':
		'[writing-mode:vertical-rl] [text-orientation:mixed] [font-size:1.2em] [line-height:2.2] [color:var(--db-record-color-58)] [font-weight:600] [letter-spacing:0.08em] h-[180px] m-[0_auto_20px] [text-align:start] p-[0_8px]',
	'fortune-flip-container': '[perspective:1000px] w-[100%]',
	'fortune-flip-card':
		'[position:relative] w-[100%] [transform-style:preserve-3d] motion-safe:[transition:transform_0.6s_ease]',
	'fortune-flip-card--flipped': '[transform:rotateY(180deg)]',
	'fortune-flip-front': '[backface-visibility:hidden]',
	'fortune-flip-back':
		'[position:absolute] [top:0] [left:0] w-[100%] h-[100%] [backface-visibility:hidden] [transform:rotateY(180deg)] flex [flex-direction:column] [align-items:center] [justify-content:center] gap-[16px] p-[0_4px] [overflow-y:auto]',
	'fortune-result-reveal-btn':
		'inline-flex [align-items:center] [justify-content:center] p-[8px_20px] [border:2px_solid_var(--db-record-color-65)] rounded-[4px] [font-size:0.9em] [font-weight:700] [cursor:pointer] [background:transparent] [color:var(--db-record-color-65)] [letter-spacing:0.1em] motion-safe:[transition:background_0.2s,_border-color_0.2s,_box-shadow_0.2s,_color_0.2s,_transform_0.2s] [transform:rotate(-2deg)] [&:hover]:[background:var(--db-record-color-65)] [&:hover]:[color:var(--db-record-color-52)]',
	'fortune-result-reveal-btn--hidden': '[opacity:0] [pointer-events:none]',
	'fortune-result-reveal-btn--show': '[opacity:1] [pointer-events:auto] motion-safe:[transition:opacity_0.5s_ease]',
	'fortune-back-title':
		'[font-size:1.1em] [font-weight:700] [color:var(--db-record-color-60)] [letter-spacing:0.1em] [margin-bottom:4px]',
	'fortune-back-interpretation':
		'w-[100%] [font-size:0.95em] [line-height:2] [color:var(--db-record-color-58)] p-[16px] [background:var(--db-record-color-74)] rounded-[4px] [border:1px_solid_var(--db-record-color-69)]',
	'fortune-verse-char': '[opacity:0]',
	'fortune-result-back-btn':
		'[margin-top:20px] [font-size:0.8em] [color:var(--db-record-color-73)] [cursor:pointer] [opacity:0.7] motion-safe:[transition:opacity_0.2s] [text-decoration:underline] [text-underline-offset:2px] [letter-spacing:0.04em] [&:hover]:[opacity:1] [&:hover]:[color:var(--db-record-color-60)]',
	'dashboard-modal-btn':
		'[&.is-disabled]:[opacity:0.45] [&.is-disabled]:[pointer-events:none] p-[6px_16px] rounded-[var(--db-radius-sm,_6px)] [font-size:0.9em] [cursor:pointer] [background:var(--db-bg-btn,_var(--background-modifier-hover))] [border:1px_solid_var(--db-border-btn,_var(--background-modifier-border))] [color:var(--db-text,_var(--text-normal))] motion-safe:[transition:background_0.15s_ease,_border-color_0.15s_ease,_opacity_0.15s_ease] [&:hover]:[background:var(--db-bg-btn-hover,_var(--background-modifier-hover))]',
	'dashboard-progress': 'flex [align-items:center] gap-[8px] [margin-bottom:6px]',
	'dashboard-progress-bar': '[flex:1] h-[6px] [background:var(--db-bg-hover)] rounded-[3px] [overflow:hidden]',
	'dashboard-progress-fill':
		'h-[100%] [background:linear-gradient(90deg,_var(--db-progress-from),_var(--db-progress-to))] rounded-[3px] motion-safe:[transition:width_0.3s_ease]',
	'dashboard-progress-text': '[font-size:0.82em] [opacity:0.7] min-w-[36px] [text-align:right]',
	'dashboard-modal':
		'rounded-[var(--db-radius-lg,_12px)] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] [background:var(--db-bg-modal,_var(--db-bg-card,_var(--background-secondary)))] [backdrop-filter:var(--db-backdrop-blur,_blur(24px))] [-webkit-backdrop-filter:var(--db-backdrop-blur,_blur(24px))] [color:var(--db-text,_var(--text-normal))] p-[28px_32px_24px] max-[641px]:[backdrop-filter:none] max-[641px]:[-webkit-backdrop-filter:none] max-[641px]:rounded-[var(--db-radius-md)]',
	'dashboard-library-config-section':
		'[background:var(--db-bg-hover,_var(--db-record-color-29))] [border:1px_solid_var(--db-border,_var(--db-record-color-40))] rounded-[10px] p-[12px] [margin-bottom:16px]',
	'dashboard-modal-quotes':
		'[background:var(--db-bg-hover,_var(--db-record-color-29))] [border:1px_solid_var(--db-border,_var(--db-record-color-40))] rounded-[10px] p-[12px] [margin-bottom:12px]',
	'dashboard-modal-images':
		'[background:var(--db-bg-hover,_var(--db-record-color-29))] [border:1px_solid_var(--db-border,_var(--db-record-color-40))] rounded-[10px] p-[12px] [margin-bottom:12px]',
	'dashboard-modal-quote-color':
		'[background:var(--db-bg-hover,_var(--db-record-color-29))] [border:1px_solid_var(--db-border,_var(--db-record-color-40))] rounded-[10px] p-[12px] [margin-bottom:12px]',
	'dashboard-modal-form':
		'[&_label]:[font-size:0.9em] [&_label]:[font-weight:500] [&_label]:block [&_label]:[margin-bottom:4px] [&_label]:[color:var(--db-text,_var(--text-normal))]',
	'dashboard-modal-input':
		'w-[100%] p-[8px_12px] [border:1px_solid_var(--db-border-input,_var(--background-modifier-border))] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [color:var(--db-text,_var(--text-normal))] [font-size:0.95em] motion-safe:[transition:border-color_0.15s_ease,_box-shadow_0.15s_ease] [&:focus]:[border-color:var(--db-border-input-focus,_var(--interactive-accent))]',
	'dashboard-modal-actions':
		'flex gap-[8px] [justify-content:flex-end] [margin-top:8px] [&_button]:rounded-[var(--db-radius-sm,_6px)]',
	'dashboard-modal-footer':
		'flex gap-[8px] [justify-content:flex-end] [margin-top:16px] [padding-top:12px] [border-top:1px_solid_var(--db-border,_var(--background-modifier-border))]',
	'dashboard-modal-btn--cancel': '[color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-modal-btn--confirm':
		'[background:var(--db-accent,_var(--interactive-accent))] [border-color:transparent] [color:var(--db-text-inverse,_var(--text-on-accent))] [font-weight:500] [&:hover]:[background:var(--db-accent,_var(--interactive-accent))] [&:hover]:[opacity:0.88]',
	'dashboard-modal-btn--danger':
		'[background:var(--db-danger,_var(--db-record-color-13))] [border-color:transparent] [color:var(--db-record-color-15)] [font-weight:500] [&:hover]:[opacity:0.88]',
	'dashboard-modal-quotes-label': 'block [margin-bottom:6px]',
	'dashboard-modal-quotes-list':
		'flex [flex-direction:column] gap-[8px] max-h-[340px] [overflow-y:auto] p-[2px_0] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:[background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)] [&::-webkit-scrollbar-thumb]:rounded-[4px]',
	'dashboard-modal-quote-item':
		'flex [align-items:flex-start] gap-[6px] p-[8px_10px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-hover,_var(--db-record-color-75))] [border:1px_solid_var(--db-border,_var(--db-record-color-76))] [&:hover_.dashboard-modal-quote-delete]:[opacity:1]',
	'dashboard-modal-quote-fields': 'flex [flex-direction:column] gap-[6px] [flex:1] min-w-[0]',
	'dashboard-modal-quote-input': 'min-h-[40px] [resize:vertical]',
	'dashboard-modal-author-input': '[flex:1]',
	'dashboard-modal-quote-delete':
		'[flex-shrink:0] [background:none] [border:none] [box-shadow:none] [color:var(--db-text-faint,_var(--db-record-color-77))] [cursor:pointer] p-[2px_4px] min-h-[0] [line-height:1] [opacity:0] motion-safe:[transition:opacity_0.15s_ease,_color_0.15s_ease] flex [align-items:center] [&:hover]:[color:var(--db-danger,_var(--db-record-color-43))] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-modal-quote-add':
		'[margin-top:6px] [background:var(--db-bg-btn,_var(--db-record-color-78))] [border:1px_dashed_var(--db-border-btn,_var(--db-record-color-79))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted,_var(--db-record-color-80))] p-[6px_14px] [cursor:pointer] [font-size:0.85em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease,_border-color_0.15s_ease] w-[fit-content] [&:hover]:[background:var(--db-bg-btn-hover,_var(--db-record-color-81))] [&:hover]:[border-color:var(--db-border-btn-hover,_var(--db-record-color-82))] [&:hover]:[color:var(--db-text,_var(--db-record-color-83))]',
	'dashboard-modal-images-label': 'block [margin-bottom:6px]',
	'dashboard-modal-images-list':
		'flex [flex-direction:column] gap-[6px] max-h-[200px] [overflow-y:auto] p-[2px_0] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:[background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)] [&::-webkit-scrollbar-thumb]:rounded-[4px]',
	'dashboard-modal-image-item':
		'flex [align-items:center] gap-[6px] [flex-wrap:wrap] [&:hover_.dashboard-modal-image-delete]:[opacity:1]',
	'dashboard-modal-image-focal': '[flex-basis:100%] min-w-[0]',
	'dashboard-modal-image-input': '[flex:1] min-w-[0]',
	'dashboard-modal-image-delete':
		'[flex-shrink:0] [background:none] [border:none] [box-shadow:none] [color:var(--db-text-faint,_var(--db-record-color-77))] [cursor:pointer] p-[2px_4px] min-h-[0] [line-height:1] [opacity:0] motion-safe:[transition:opacity_0.15s_ease,_color_0.15s_ease] flex [align-items:center] [&:hover]:[color:var(--db-danger,_var(--db-record-color-43))] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-modal-image-add':
		'[margin-top:6px] [background:var(--db-bg-btn,_var(--db-record-color-78))] [border:1px_dashed_var(--db-border-btn,_var(--db-record-color-79))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted,_var(--db-record-color-80))] p-[6px_14px] [cursor:pointer] [font-size:0.85em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease,_border-color_0.15s_ease] w-[fit-content] [&:hover]:[background:var(--db-bg-btn-hover,_var(--db-record-color-81))] [&:hover]:[border-color:var(--db-border-btn-hover,_var(--db-record-color-82))] [&:hover]:[color:var(--db-text,_var(--db-record-color-83))]',
	'dashboard-modal-quote-color-label': 'block [margin-bottom:6px]',
	'dashboard-modal-quote-color-row':
		'[&_+_.dashboard-modal-quote-color-label]:[margin-top:10px] flex [align-items:center] gap-[10px]',
	'dashboard-modal-quote-font-select': '[flex:1] min-w-[0]',
	'dashboard-modal-color-input':
		'w-[40px] h-[32px] [border:1px_solid_var(--db-border-card,_var(--db-record-color-81))] rounded-[var(--db-radius-sm,_6px)] [background:none] [cursor:pointer] p-[2px] [&::-webkit-color-swatch-wrapper]:p-[0] [&::-webkit-color-swatch]:[border:none] [&::-webkit-color-swatch]:rounded-[4px] w-[38px] h-[28px] p-[0] [border:1px_solid_var(--db-border,_var(--background-modifier-border))] rounded-[6px] [background:transparent]',
	'dashboard-modal-color-reset':
		'[background:var(--db-bg-btn,_var(--db-record-color-78))] [border:1px_solid_var(--db-border-btn,_var(--db-record-color-79))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted,_var(--db-record-color-80))] p-[6px_14px] [cursor:pointer] [font-size:0.85em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease,_border-color_0.15s_ease] [&:hover]:[background:var(--db-bg-btn-hover,_var(--db-record-color-81))] [&:hover]:[color:var(--db-text,_var(--db-record-color-83))]',
	'dashboard-modal-docs-list':
		'flex [flex-direction:column] gap-[4px] max-h-[200px] [overflow-y:auto] [margin-bottom:4px] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:[background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)] [&::-webkit-scrollbar-thumb]:rounded-[4px]',
	'dashboard-modal-docs-empty': '[opacity:0.5] [font-size:0.85em] p-[8px_0]',
	'dashboard-modal-doc-item':
		'flex [align-items:center] [justify-content:space-between] p-[6px_10px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-hover,_var(--db-record-color-75))] [border:1px_solid_var(--db-border,_var(--db-record-color-76))] [&:hover_.dashboard-modal-doc-remove]:[opacity:1]',
	'dashboard-modal-doc-name':
		'[font-size:0.9em] [flex:1] [overflow:hidden] [text-overflow:ellipsis] whitespace-nowrap',
	'dashboard-modal-doc-remove':
		'[background:none] [border:none] [box-shadow:none] [color:var(--db-text-muted,_var(--db-record-color-80))] [cursor:pointer] p-[0_4px] min-h-[0] [line-height:1] [opacity:0] motion-safe:[transition:opacity_0.15s_ease,_color_0.15s_ease] flex [align-items:center] [&:hover]:[color:var(--db-text)] [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-modal-search-results':
		'flex [flex-direction:column] gap-[2px] max-h-[150px] [overflow-y:auto] [margin-top:4px] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:[background:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_18%,_transparent)] [&::-webkit-scrollbar-thumb]:rounded-[4px]',
	'dashboard-modal-search-hint':
		'p-[12px] [text-align:center] [color:var(--db-text-faint,_var(--db-record-color-77))] [font-size:0.85em]',
	'dashboard-modal-search-item':
		'flex [align-items:center] [justify-content:space-between] p-[6px_10px] rounded-[var(--db-radius-sm,_6px)] [cursor:pointer] motion-safe:[transition:background_0.1s_ease] [&:hover]:[background:var(--db-bg-hover,_var(--db-record-color-75))] [&.is-selected]:[background:var(--db-bg-hover-strong,_var(--db-record-color-84))] [&.is-selected_.dashboard-modal-search-check]:[border-color:var(--db-accent,_var(--db-record-color-86))] [&.is-selected_.dashboard-modal-search-check]:[background:var(--db-accent,_var(--db-record-color-86))] [&.is-selected_.dashboard-modal-search-check]:[color:var(--db-bg,_var(--db-record-color-87))]',
	'dashboard-modal-search-name': '[font-size:0.9em] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-modal-search-path':
		'[font-size:0.78em] [color:var(--db-text-faint,_var(--db-record-color-77))] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [margin-left:12px]',
	'dashboard-modal-search-check':
		'w-[18px] h-[18px] [flex-shrink:0] flex [align-items:center] [justify-content:center] [margin-right:8px] rounded-[4px] [border:1.5px_solid_var(--db-border,_var(--db-record-color-85))] [color:var(--db-accent,_var(--db-record-color-86))] [font-size:0.75em]',
	'dashboard-modal-search-info': 'flex [align-items:center] [justify-content:space-between] [flex:1] min-w-[0]',
	'dashboard-modal-batch-add':
		'w-[100%] [margin-top:8px] p-[8px_16px] flex [align-items:center] [justify-content:center] gap-[6px]',
	'dashboard-library-view-toggle':
		'flex gap-[2px] [background:var(--db-bg-input,_var(--db-record-color-75))] rounded-[var(--db-radius-sm,_6px)] p-[2px]',
	'dashboard-library-view-btn':
		'[cursor:pointer] p-[4px_8px] rounded-[4px] [color:var(--db-text-muted,_var(--text-muted))] flex [align-items:center] [font-size:0.75em] motion-safe:[transition:background_0.15s_ease,_border-color_0.15s_ease,_box-shadow_0.15s_ease,_color_0.15s_ease,_transform_0.15s_ease] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&:hover]:[background:var(--db-bg-hover,_var(--db-record-color-75))] [&.active]:[background:var(--db-bg-btn,_var(--db-record-color-22))] [&.active]:[color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-library-config-view-toggle': 'm-[8px_0_4px_0]',
	'dashboard-library-config-groupby-controls': '[&.is-hidden]:hidden',
	'dashboard-library-config-hint':
		'[&.is-hidden]:hidden [font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] [margin-bottom:6px]',
	'dashboard-library-toolbar-spacer': '[flex:1]',
	'dashboard-library-config-btn':
		'[cursor:pointer] p-[4px] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text-muted,_var(--text-muted))] flex [align-items:center] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&:hover]:[background:var(--db-bg-hover,_var(--db-record-color-75))]',
	'dashboard-library-empty':
		'p-[40px_20px] [text-align:center] [color:var(--db-text-muted,_var(--text-muted))] [font-size:0.8125em]',
	'dashboard-library-config-section-title':
		'[font-size:0.8125em] [font-weight:600] [color:var(--db-text,_var(--text-normal))] [margin-bottom:8px]',
	'dashboard-library-config-filters': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-library-config-inline-row': 'flex [align-items:center] gap-[8px] [margin-top:6px]',
	'dashboard-library-config-inline-label': '[font-size:0.75em] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-library-config-checkbox': 'm-[0] [cursor:pointer]',
	'dashboard-library-config-number':
		'w-[64px] h-[26px] p-[0_6px] [box-sizing:border-box] [font-size:0.75em] [background:var(--db-bg-input,_var(--background-modifier-form-field))] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] rounded-[var(--db-radius-sm,_6px)] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-modal-header': 'flex [align-items:center] [justify-content:space-between] [margin-bottom:16px]',
	'dashboard-modal-title': '[font-size:1em] [font-weight:600]',
	'dashboard-alltasks-content': 'flex [flex-direction:column] gap-[10px]',
	'dashboard-alltasks-area': 'flex [flex-direction:column] gap-[6px] max-h-[560px] [overflow-y:auto]',
	'dashboard-alltasks-status':
		'[&_.dashboard-library-view-btn]:[font-size:0.6875em] [&_.dashboard-library-view-btn]:p-[2px_8px]',
	'dashboard-alltasks-list': 'flex [flex-direction:column] gap-[4px]',
	'dashboard-alltasks-row':
		'flex [align-items:flex-start] gap-[10px] p-[6px_10px] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-record-color-88))] [border:1px_solid_var(--db-border-card,_var(--db-record-color-76))] [&:hover]:[background:var(--db-bg-card-hover,_var(--db-record-color-76))] [&.is-done_.dashboard-alltasks-text]:[text-decoration:line-through] [&.is-done_.dashboard-alltasks-text]:[opacity:0.55] [&_.dashboard-calendar-event-time]:[font-size:0.6875em] [&.is-jumpable]:[cursor:pointer]',
	'dashboard-alltasks-check':
		'[flex-shrink:0] [margin-top:3px] [cursor:pointer] [accent-color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-alltasks-body': '[flex:1] min-w-[0] flex [flex-direction:column] gap-[2px]',
	'dashboard-alltasks-text':
		'[font-size:0.8125em] [color:var(--db-text,_var(--text-normal))] [word-break:break-word] [line-height:1.4] [&_.dashboard-wikilink]:[color:var(--db-accent,_var(--text-accent))] [&_.dashboard-wikilink]:[cursor:pointer] [&_a]:[color:var(--db-accent,_var(--text-accent))] [&_a]:[cursor:pointer]',
	'dashboard-alltasks-reminder': '[font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-alltasks-source': '[flex-shrink:0] flex [flex-direction:column] [align-items:flex-end] gap-[2px]',
	'dashboard-alltasks-chip':
		'[font-size:0.6875em] p-[1px_8px] rounded-[999px] [background:var(--db-bg-hover,_var(--db-record-color-76))] [color:var(--db-text-muted,_var(--text-muted))] max-w-[160px] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [&:hover]:[color:var(--db-accent,_var(--text-accent))]',
	'dashboard-alltasks-date': '[font-size:0.625em] [color:var(--db-text-muted,_var(--text-muted))] [opacity:0.7]',
	'dashboard-alltasks-prio':
		'[flex-shrink:0] [margin-top:3px] w-[18px] h-[18px] rounded-[999px] flex [align-items:center] [justify-content:center] [font-size:0.625em] [font-weight:700] [color:var(--db-record-color-15)]',
	'dashboard-alltasks-prio--high': '[background:var(--db-record-color-43)]',
	'dashboard-alltasks-prio--medium': '[background:var(--db-record-color-45)]',
	'dashboard-alltasks-prio--low': '[background:var(--db-record-color-89)]',
	'dashboard-alltasks-due':
		'[font-size:0.625em] [color:var(--db-text-muted,_var(--text-muted))] [background:var(--db-bg-hover,_var(--db-record-color-78))] p-[1px_6px] rounded-[999px] [&.is-overdue]:[color:var(--db-record-color-15)] [&.is-overdue]:[background:var(--db-record-color-43)]',
	'dashboard-alltasks-groups': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-alltasks-group':
		'flex [flex-direction:column] gap-[4px] [&.is-collapsed_.dashboard-alltasks-list]:hidden',
	'dashboard-alltasks-group-header':
		'flex [align-items:center] gap-[6px] p-[3px_4px] [cursor:pointer] [user-select:none] rounded-[var(--db-radius-sm,_6px)] [&:hover]:[background:var(--db-bg-hover,_var(--db-record-color-75))]',
	'dashboard-alltasks-group-chevron':
		'[color:var(--db-text-muted,_var(--text-muted))] flex [&_svg]:w-[14px] [&_svg]:h-[14px]',
	'dashboard-alltasks-group-title': '[font-size:0.75em] [font-weight:600] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-alltasks-group-count':
		'[font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] [background:var(--db-bg-hover,_var(--db-record-color-78))] p-[0_6px] rounded-[999px]',
	'dashboard-alltasks-group-more':
		'p-[4px_8px] [font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))] [font-style:italic]',
	'dashboard-alltasks-kanban-more':
		'[margin-top:4px] [font-size:0.6875em] [text-align:center] [color:var(--db-text-muted,_var(--text-muted))] [font-style:italic]',
	'dashboard-alltasks-cap-notice':
		'[margin-top:8px] p-[6px_10px] [font-size:0.75em] [text-align:center] [color:var(--db-text-muted,_var(--text-muted))] [background:var(--db-bg-hover,_var(--db-record-color-88))] rounded-[var(--db-radius-sm,_6px)]',
	'dashboard-alltasks-kanban':
		'flex gap-[5px] [overflow-x:auto] min-w-[0] [padding-bottom:4px] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,_var(--db-accent)_24%,_transparent)_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-track]:[background:transparent] [&::-webkit-scrollbar-thumb]:[background:color-mix(in_srgb,_var(--db-accent)_24%,_transparent)] [&::-webkit-scrollbar-thumb]:rounded-[2px] [&::-webkit-scrollbar-thumb]:motion-safe:[transition:background_0.2s_ease] [&::-webkit-scrollbar-thumb:hover]:[background:color-mix(in_srgb,_var(--db-accent)_38%,_transparent)] [&_.dashboard-library-kanban-col]:min-w-[200px] [&_.dashboard-library-kanban-col]:[flex:1] [&_.dashboard-library-kanban-col]:max-w-[280px]',
	'dashboard-alltasks-kanban-empty':
		'[justify-content:center] [color:var(--db-text-muted,_var(--text-muted))] [font-size:0.75em] [opacity:0.5]',
	'dashboard-alltasks-card':
		'p-[6px_8px] [&.is-done_.dashboard-alltasks-card-title]:[text-decoration:line-through] [&.is-done_.dashboard-alltasks-card-title]:[opacity:0.55]',
	'dashboard-alltasks-card-top': 'flex [align-items:center] gap-[6px] [margin-bottom:3px]',
	'dashboard-alltasks-card-title': '[font-size:0.75em] [line-height:1.35] [word-break:break-word]',
	'dashboard-alltasks-card-open':
		'[margin-left:auto] [color:var(--db-text-muted,_var(--text-muted))] flex [cursor:pointer] [&_svg]:w-[13px] [&_svg]:h-[13px] [&:hover]:[color:var(--db-accent,_var(--text-accent))]',
	'dashboard-alltasks-card-source':
		'[font-size:0.625em] [color:var(--db-text-muted,_var(--text-muted))] [opacity:0.7] [margin-left:6px]',
	'dashboard-alltasks-exclude-chips': 'flex [flex-wrap:wrap] gap-[6px] [margin-bottom:8px]',
	'dashboard-alltasks-exclude-chip':
		'inline-flex [align-items:center] gap-[4px] [font-size:0.75em] p-[2px_8px] rounded-[999px] [background:var(--db-bg-hover,_var(--db-record-color-76))] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-alltasks-exclude-chip-x':
		'[cursor:pointer] [opacity:0.6] [font-weight:700] [&:hover]:[opacity:1] [&:hover]:[color:var(--db-record-color-43)]',
	'dashboard-calendar-content': 'flex [flex-direction:column] gap-[8px]',
	'dashboard-calendar-nav': 'flex [align-items:center] gap-[6px]',
	'dashboard-calendar-nav-btn':
		'flex [align-items:center] [justify-content:center] w-[26px] h-[26px] rounded-[var(--db-radius-sm,_6px)] [cursor:pointer] [color:var(--db-text-muted,_var(--text-muted))] [&:hover]:[background:var(--db-bg-hover,_var(--db-record-color-76))] [&:hover]:[color:var(--db-text,_var(--text-normal))] [&_svg]:w-[16px] [&_svg]:h-[16px]',
	'dashboard-calendar-nav-label':
		'[font-size:0.8125em] [font-weight:600] [color:var(--db-text,_var(--text-normal))] min-w-[90px] [text-align:center]',
	'dashboard-calendar-today-btn':
		'[font-size:0.6875em] p-[3px_10px] rounded-[999px] [background:var(--db-bg-hover,_var(--db-record-color-76))] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] flex [align-items:center] [&:hover]:[color:var(--db-accent,_var(--text-accent))] [&_svg]:w-[13px] [&_svg]:h-[13px]',
	'dashboard-calendar-host': '[overflow-x:auto]',
	'dashboard-calendar-weekdays': 'grid [grid-template-columns:repeat(7,_1fr)] gap-[2px]',
	'dashboard-calendar-weekday':
		'[font-size:0.625em] [text-align:center] [color:var(--db-text-muted,_var(--text-muted))] p-[2px_0]',
	'dashboard-calendar-body': 'grid [grid-template-columns:repeat(7,_1fr)] gap-[2px]',
	'dashboard-calendar-body--bars': 'flex [flex-direction:column] gap-[2px]',
	'dashboard-calendar-week': 'flex [flex-direction:column] gap-[2px]',
	'dashboard-calendar-barlayer':
		'grid [grid-template-columns:repeat(7,_1fr)] [column-gap:2px] [row-gap:2px] [--dashboard-bar-lane:22px] h-[calc(var(--bar-lanes,_0)_*_var(--dashboard-bar-lane))] [&:empty]:h-[0]',
	'dashboard-calendar-week-days': 'grid [grid-template-columns:repeat(7,_1fr)] gap-[2px]',
	'dashboard-calendar-bar':
		'flex [align-items:center] gap-[3px] min-w-[0] h-[20px] p-[0_6px] [grid-column:var(--bar-cs,_1)_/_span_var(--bar-len,_1)] [grid-row:var(--bar-row,_1)] rounded-[999px] [overflow:hidden] [background:var(--db-bg-hover,_var(--db-record-color-76))] [border:1px_solid_color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_40%,_transparent)] [color:var(--db-text,_var(--text-normal))] [font-size:0.5625em] [line-height:1.2] whitespace-nowrap [cursor:pointer] [user-select:none] [&:hover]:[background:var(--db-bg-hover-strong,_var(--db-bg-hover,_var(--db-record-color-90)))] [&:focus-visible]:[outline:1px_solid_var(--db-accent,_var(--interactive-accent))] [&:focus-visible]:[outline-offset:1px] [&.is-done]:[opacity:0.5] [&.is-done_.dashboard-calendar-bar-text]:[text-decoration:line-through] [&.prio-high]:[background:color-mix(in_srgb,_var(--db-prio-high,_var(--db-record-color-43))_18%,_transparent)] [&.prio-high]:[border-color:color-mix(in_srgb,_var(--db-prio-high,_var(--db-record-color-43))_55%,_transparent)] [&.prio-medium]:[background:color-mix(in_srgb,_var(--db-prio-medium,_var(--db-record-color-45))_18%,_transparent)] [&.prio-medium]:[border-color:color-mix(in_srgb,_var(--db-prio-medium,_var(--db-record-color-45))_55%,_transparent)] [&.prio-low]:[background:color-mix(in_srgb,_var(--db-prio-low,_var(--db-record-color-50))_18%,_transparent)] [&.prio-low]:[border-color:color-mix(in_srgb,_var(--db-prio-low,_var(--db-record-color-50))_55%,_transparent)] [&.is-cont-left]:[border-top-left-radius:0] [&.is-cont-left]:[border-bottom-left-radius:0] [&.is-cont-left]:[border-left-style:dashed] [&.is-cont-left]:[margin-left:-1px] [&.is-cont-right]:[border-top-right-radius:0] [&.is-cont-right]:[border-bottom-right-radius:0] [&.is-cont-right]:[border-right-style:dashed] [&.is-cont-right]:[margin-right:-1px]',
	'dashboard-calendar-bar-time': '[flex-shrink:0] [font-weight:600] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-calendar-bar-text': '[overflow:hidden] [text-overflow:ellipsis] min-w-[0]',
	'dashboard-calendar-mark':
		'flex [flex-shrink:0] [color:var(--db-text-muted,_var(--text-muted))] [opacity:0.7] [&_svg]:w-[11px] [&_svg]:h-[11px]',
	'dashboard-calendar-mark--done': '[opacity:0.8]',
	'dashboard-calendar-cell':
		'min-w-[0] rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-record-color-91))] [border:1px_solid_var(--db-border-card,_var(--db-record-color-78))] p-[3px] flex [flex-direction:column] gap-[2px] [&.is-outside]:[opacity:0.4] [&.is-today]:[border-color:var(--db-accent,_var(--interactive-accent))] [&.is-today]:[box-shadow:0_0_0_1px_var(--db-accent,_var(--interactive-accent))_inset] [&.is-today_.dashboard-calendar-cell-num]:[color:var(--db-accent,_var(--text-accent))]',
	'dashboard-calendar-cell-num':
		'[font-size:0.625em] [font-weight:600] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-calendar-cell-list': 'flex [flex-direction:column] gap-[2px] min-h-[0]',
	'dashboard-calendar-week-row':
		'rounded-[var(--db-radius-sm,_6px)] [background:var(--db-bg-card,_var(--db-record-color-91))] [border:1px_solid_var(--db-border-card,_var(--db-record-color-78))] p-[4px_6px] [&.is-today]:[border-color:var(--db-accent,_var(--interactive-accent))] [&.is-today]:[box-shadow:0_0_0_1px_var(--db-accent,_var(--interactive-accent))_inset] [&.is-today_.dashboard-calendar-week-row-name]:[color:var(--db-accent,_var(--text-accent))]',
	'dashboard-calendar-week-row-head':
		'flex [align-items:center] gap-[6px] [margin-bottom:3px] [&.is-clickable]:[cursor:pointer] [&.is-clickable]:rounded-[4px] [&.is-clickable]:m-[-2px_-4px] [&.is-clickable]:p-[2px_4px] [&.is-clickable:hover]:[background:var(--db-bg-hover,_var(--db-record-color-78))]',
	'dashboard-calendar-week-row-namewrap': 'flex [align-items:baseline] gap-[5px]',
	'dashboard-calendar-week-row-name':
		'[font-size:0.6875em] [font-weight:600] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-calendar-week-row-date': '[font-size:0.625em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-calendar-week-row-count':
		'[margin-left:auto] [font-size:0.625em] [color:var(--db-text-muted,_var(--text-muted))] [background:var(--db-bg-hover,_var(--db-record-color-78))] p-[0_6px] rounded-[999px]',
	'dashboard-calendar-week-row-list': 'gap-[3px]',
	'dashboard-calendar-event':
		'flex [align-items:center] gap-[3px] [font-size:0.5625em] [line-height:1.2] p-[1px_4px] rounded-[4px] [background:var(--db-bg-hover,_var(--db-record-color-78))] [color:var(--db-text,_var(--text-normal))] [overflow:hidden] whitespace-nowrap [text-overflow:ellipsis] [&.is-done]:[opacity:0.5] [&.is-done]:[text-decoration:line-through] [&.is-overdue]:[background:var(--db-record-color-96)] [&.prio-high]:[border-left:2px_solid_var(--db-record-color-43)] [&.prio-medium]:[border-left:2px_solid_var(--db-record-color-45)] [&.prio-low]:[border-left:2px_solid_var(--db-record-color-89)] [&.is-multi]:[background:var(--db-bg-hover,_var(--db-record-color-97))] [&.is-multi_.dashboard-calendar-multi-mark]:[margin-left:auto] [&.is-multi_.dashboard-calendar-multi-mark]:[flex-shrink:0] [&.is-multi_.dashboard-calendar-multi-mark]:flex [&.is-multi_.dashboard-calendar-multi-mark]:[opacity:0.7] [&.is-multi_.dashboard-calendar-multi-mark_svg]:w-[9px] [&.is-multi_.dashboard-calendar-multi-mark_svg]:h-[9px] [&.is-jumpable]:[cursor:pointer]',
	'dashboard-calendar-event-time':
		'[flex-shrink:0] [font-size:0.5625em] [font-variant-numeric:tabular-nums] [color:var(--db-text-muted,_var(--text-muted))] [background:var(--db-record-color-3)] p-[0_3px] rounded-[3px] min-w-[28px] [text-align:center]',
	'dashboard-cal-day-add': 'flex gap-[6px] [align-items:center] [margin-bottom:6px]',
	'dashboard-cal-day-add-title': 'h-[34px] p-[0_10px] [box-sizing:border-box] [flex:1] min-w-[0]',
	'dashboard-cal-day-add-btn': '[flex-shrink:0]',
	'dashboard-cal-day-times': 'flex [flex-wrap:wrap] gap-[4px_10px] [margin-bottom:10px]',
	'dashboard-cal-day-times-group': 'flex [align-items:center] gap-[4px]',
	'dashboard-cal-day-times-label':
		'[font-size:0.75em] [color:var(--db-text-muted,_var(--text-muted))] [flex-shrink:0]',
	'dashboard-cal-day-times-date': 'h-[30px] p-[0_6px] [box-sizing:border-box] w-[132px]',
	'dashboard-cal-day-times-time': 'h-[30px] p-[0_6px] [box-sizing:border-box] w-[86px]',
	'dashboard-calgrid': 'flex [flex-direction:column] h-[100%] min-h-[0]',
	'dashboard-calgrid-head':
		'grid [grid-template-columns:52px_repeat(7,_1fr)] [border-bottom:1px_solid_var(--db-border-card,_var(--db-record-color-76))]',
	'dashboard-calgrid-dayhead':
		'[text-align:center] p-[6px_0_4px] [&.is-today_.dashboard-calgrid-dayhead-date]:[color:var(--db-accent,_var(--interactive-accent))] [&.is-clickable]:[cursor:pointer] [&.is-clickable]:rounded-[4px] [&.is-clickable:hover]:[background:var(--db-bg-hover,_var(--db-record-color-78))] [&.is-clickable:focus-visible]:[outline:2px_solid_var(--db-accent,_var(--interactive-accent))] [&.is-clickable:focus-visible]:[outline-offset:1px]',
	'dashboard-calgrid-dayhead-wd': '[font-size:0.6875em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-calgrid-dayhead-date':
		'[font-size:0.9375em] [font-weight:600] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-calgrid-allday':
		'grid [grid-template-columns:52px_repeat(7,_1fr)] [border-bottom:1px_solid_var(--db-border-card,_var(--db-record-color-76))] min-h-[22px]',
	'dashboard-calgrid-allday-corner':
		'[font-size:0.5625em] [color:var(--db-text-muted,_var(--text-muted))] p-[3px_4px] [align-self:center]',
	'dashboard-calgrid-allday-cell': 'p-[2px_1px] flex [flex-direction:column] gap-[1px] min-w-[0]',
	'dashboard-calgrid-allday-chip':
		'[font-size:0.5625em] [line-height:1.2] [background:var(--db-bg-hover,_var(--db-record-color-78))] rounded-[3px] p-[0_3px] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [&.is-done]:[opacity:0.5] [&.is-done]:[text-decoration:line-through] [&.is-jumpable]:[cursor:pointer] [&.is-jumpable:hover]:[background:var(--db-bg-card-hover,_var(--db-record-color-90))]',
	'dashboard-calgrid-allday-more': '[font-size:0.5625em] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-calgrid-scroll': '[flex:1] min-h-[0] [overflow-y:auto] max-h-[calc(100vh_-_180px)]',
	'dashboard-calgrid-body': 'grid [grid-template-columns:52px_repeat(7,_1fr)] [position:relative]',
	'dashboard-calgrid-hours': '[border-right:1px_solid_var(--db-border-card,_var(--db-record-color-76))]',
	'dashboard-calgrid-hour':
		'h-[48px] [font-size:0.625em] [color:var(--db-text-muted,_var(--text-muted))] [text-align:right] p-[0_4px] [box-sizing:border-box]',
	'dashboard-calgrid-daycol':
		'[position:relative] h-[1152px] min-w-[0] [border-right:1px_solid_var(--db-border-card,_var(--db-record-color-78))] [background-image:linear-gradient(to_bottom,_var(--db-border-card,_var(--db-record-color-78))_1px,_transparent_1px)] [background-size:100%_48px] [background-position:0_0] [&.is-today]:[background-color:var(--db-bg-banner,_var(--db-record-color-93))]',
	'dashboard-calgrid-event':
		'[position:absolute] [left:2px] [right:2px] rounded-[5px] p-[3px_6px] [overflow:hidden] [background:var(--db-bg-card-hover,_var(--db-record-color-76))] [border-left:3px_solid_var(--db-accent,_var(--interactive-accent))] [font-size:0.6875em] [line-height:1.25] [cursor:pointer] [color:var(--db-text,_var(--text-normal))] [&.is-done]:[opacity:0.5] [&.is-done]:[text-decoration:line-through] [&.prio-high]:[border-left-color:var(--db-danger,_var(--db-record-color-94))] [&.prio-medium]:[border-left-color:var(--db-accent-light,_var(--db-record-color-95))]',
	'dashboard-calgrid-event-check': '[margin-right:3px]',
	'dashboard-calgrid-event-time':
		'[font-size:0.5625em] [color:var(--db-text-muted,_var(--text-muted))] [font-variant-numeric:tabular-nums]',
	'dashboard-calgrid-event-title': '[font-weight:500] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-calgrid-nowline':
		"[position:absolute] [left:52px] [right:0] h-[2px] [background:var(--db-danger,_var(--db-record-color-94))] [z-index:var(--layer-menu)] [pointer-events:none] [&::before]:[content:''] [&::before]:[position:absolute] [&::before]:[left:-4px] [&::before]:[top:-3px] [&::before]:w-[8px] [&::before]:h-[8px] [&::before]:rounded-[50%] [&::before]:[background:var(--db-danger,_var(--db-record-color-94))]",
	'dashboard-calendar-event-text': '[overflow:hidden] [text-overflow:ellipsis]',
	'dashboard-calendar-check':
		'w-[11px] h-[11px] [flex-shrink:0] m-[0] [accent-color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-calendar-more': '[font-size:0.5625em] [color:var(--db-text-muted,_var(--text-muted))] p-[0_4px]',
	'dashboard-calendar-fullscreen-modal': 'w-[92vw] max-w-[1100px] h-[88vh]',
	'dashboard-calendar-fullscreen-inner':
		'w-[100%] h-[100%] flex [flex-direction:column] [&_.dashboard-modal-header]:[flex-wrap:wrap] [&_.dashboard-modal-header]:[row-gap:8px]',
	'dashboard-calendar-fullscreen-body':
		'[flex:1] min-h-[0] [overflow:auto] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[flex:1] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:gap-[4px] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[overflow-y:auto] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[overscroll-behavior:contain] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[scrollbar-width:thin] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_30%,_transparent)_transparent]',
	'dashboard-calendar-filter-btn':
		'inline-flex [align-items:center] gap-[4px] [&_svg]:w-[13px] [&_svg]:h-[13px] [&.is-filtered]:[color:var(--db-accent,_var(--interactive-accent))] [&.is-filtered]:[border-color:var(--db-accent,_var(--interactive-accent))]',
	'dashboard-calendar-filter-caret': 'inline-flex [align-items:center] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-calendar-section': '[flex:1] min-h-[0] flex [flex-direction:column]',
	'dashboard-calendar-section-nav':
		'[flex-wrap:wrap] [row-gap:8px] [margin-bottom:8px] [&_.dashboard-calendar-nav-label]:[flex:1] [&_.dashboard-calendar-nav-label]:[text-align:center] [&_.dashboard-calendar-nav-label]:whitespace-nowrap [&_.dashboard-calendar-nav-label]:[overflow:hidden] [&_.dashboard-calendar-nav-label]:[text-overflow:ellipsis]',
	'dashboard-calendar-section-body':
		'[flex:1] min-h-[0] [overflow:auto] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell]:h-[clamp(64px,_9vh,_120px)] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[flex:1] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:gap-[4px] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[overflow-y:auto] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[overscroll-behavior:contain] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[scrollbar-width:thin] [&_.dashboard-calendar.is-full_.dashboard-calendar-cell-list]:[scrollbar-color:color-mix(in_srgb,_var(--db-accent,_var(--interactive-accent))_30%,_transparent)_transparent]',
	'dashboard-modal-mode-header': '[margin-bottom:8px]',
	'dashboard-modal-mode-title': '[font-weight:600] [font-size:0.95em] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-modal-mode-hint': '[font-size:0.8em] [color:var(--db-text-faint,_var(--text-faint))] [margin-top:2px]',
	'dashboard-modal-mode-toggle':
		'flex gap-[6px] [margin-bottom:16px] p-[4px] [background:var(--db-bg-hover,_var(--db-record-color-40))] rounded-[10px]',
	'dashboard-modal-mode-btn':
		'[flex:1] flex [align-items:center] [justify-content:center] gap-[6px] p-[8px_10px] [border:none] rounded-[7px] [background:transparent] [color:var(--db-text-muted,_var(--text-muted))] [cursor:pointer] [font-size:0.92em] motion-safe:[transition:background_0.15s_ease,_color_0.15s_ease,_box-shadow_0.15s_ease] [&_svg]:w-[16px] [&_svg]:h-[16px] [&.active]:[background:var(--db-bg-modal-raised,_var(--db-bg-card,_var(--background-primary)))] [&.active]:[color:var(--db-accent,_var(--text-normal))] [&.active]:[box-shadow:0_1px_3px_var(--db-record-color-4)] [&.active]:[font-weight:600]',
	'dashboard-modal-stats-cols': '[margin-bottom:16px]',
	'dashboard-modal-stats-appear': '[margin-bottom:16px]',
	'dashboard-modal-stats-daily': '[margin-bottom:16px]',
	'dashboard-modal-stats-sub': '[margin-bottom:16px]',
	'dashboard-modal-stats-label':
		'block [font-weight:600] [margin-bottom:8px] [color:var(--db-text,_var(--text-normal))]',
	'dashboard-modal-stats-inline-label':
		'[flex:0_0_auto] [font-size:0.88em] [color:var(--db-text-muted,_var(--text-muted))] min-w-[48px]',
	'dashboard-modal-stats-col-row': 'flex [align-items:center] gap-[10px] [margin-bottom:8px]',
	'dashboard-modal-stats-col-row--top': '[align-items:flex-start]',
	'dashboard-modal-stats-vis':
		'flex [align-items:center] gap-[6px] [cursor:pointer] [font-size:0.9em] [color:var(--db-text,_var(--text-normal))] [flex:0_0_auto] min-w-[56px] [&_input]:m-[0]',
	'dashboard-modal-stats-select': '[flex:1] w-[100%] min-w-[0]',
	'dashboard-modal-stats-right-metrics': '[flex:1] flex [flex-direction:column] gap-[4px]',
	'dashboard-modal-stats-right-title':
		'[font-size:0.8em] [color:var(--db-text-faint,_var(--text-faint))] [margin-bottom:2px]',
	'dashboard-modal-stats-slider': 'flex [align-items:center] gap-[10px] [margin-bottom:10px]',
	'dashboard-modal-stats-range': '[flex:1] m-[0] [accent-color:var(--db-accent,_var(--db-record-color-98))]',
	'dashboard-modal-stats-slider-val':
		'[flex:0_0_auto] min-w-[34px] [text-align:right] [font-size:0.82em] [font-variant-numeric:tabular-nums] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-modal-stats-accent-row': 'flex [align-items:center] gap-[10px]',
	'dashboard-modal-stats-hint': '[margin-top:6px] [font-size:0.8em] [color:var(--db-text-faint,_var(--text-faint))]',
	'dashboard-modal-stats-checkbox':
		'flex [align-items:center] gap-[8px] [cursor:pointer] [font-size:0.92em] [color:var(--db-text,_var(--text-normal))] [&_input]:m-[0]',
	'dashboard-pomodoro-mini':
		'[position:fixed] [right:16px] [bottom:40px] [z-index:var(--layer-menu)] flex [align-items:center] gap-[6px] p-[5px_7px] [background:var(--db-bg-modal,_var(--background-secondary))] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] rounded-[var(--db-radius-lg,_12px)] [box-shadow:var(--db-shadow-card,_0_4px_16px_var(--db-record-color-38))] [color:var(--db-text,_var(--text-normal))] [user-select:none] [cursor:grab] [touch-action:none] [overflow:hidden] motion-safe:[transition:gap_0.2s_ease,_padding_0.2s_ease,_border-radius_0.2s_ease,_background_0.2s_ease,_border-color_0.2s_ease,_box-shadow_0.2s_ease] max-[641px]:[right:12px] max-[641px]:[bottom:calc(64px_+_env(safe-area-inset-bottom,_0px))] max-[641px]:p-[4px_6px] max-[641px]:gap-[5px] [&.dashboard-pomodoro-mini--silent]:gap-[0] [&.dashboard-pomodoro-mini--silent]:p-[5px] [&.dashboard-pomodoro-mini--silent]:rounded-[999px] [&.dashboard-pomodoro-mini--silent]:[background:transparent] [&.dashboard-pomodoro-mini--silent]:[border-color:transparent] [&.dashboard-pomodoro-mini--silent]:[box-shadow:none] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-info]:w-[0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-info]:min-w-[0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-info]:[opacity:0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-info]:[visibility:hidden] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-info]:motion-safe:[transition:width_0.2s_ease,_opacity_0.15s_ease,_visibility_0s_0.2s] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:w-[0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:min-w-[0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:[border-width:0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:[opacity:0] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:[visibility:hidden] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:[pointer-events:none] [&.dashboard-pomodoro-mini--silent_.dashboard-pomodoro-mini-btn]:motion-safe:[transition:width_0.2s_ease,_opacity_0.15s_ease,_border-width_0.2s_ease,_visibility_0s_0.2s]',
	'dashboard-pomodoro-mini-ring-wrap': '[position:relative] w-[28px] h-[28px] [flex-shrink:0]',
	'dashboard-pomodoro-mini-ring': 'w-[28px] h-[28px] block',
	'dashboard-pomodoro-mini-ring-bg':
		'[stroke:var(--db-border-card,_var(--background-modifier-border))] [opacity:0.8]',
	'dashboard-pomodoro-mini-ring-progress':
		'[stroke:var(--db-accent,_var(--interactive-accent))] motion-safe:[transition:stroke-dashoffset_0.9s_linear]',
	'dashboard-pomodoro-mini--break':
		'[&_.dashboard-pomodoro-mini-ring-progress]:[stroke:var(--db-accent-light,_var(--db-accent,_var(--interactive-accent)))]',
	'dashboard-pomodoro-mini-tomato':
		'[position:absolute] [inset:0] flex [align-items:center] [justify-content:center] [font-size:10px] [line-height:1]',
	'dashboard-pomodoro-mini-info':
		'flex [flex-direction:column] gap-[1px] min-w-[44px] [overflow:hidden] motion-safe:[transition:width_0.2s_ease,_opacity_0.15s_ease,_visibility_0s]',
	'dashboard-pomodoro-mini-time':
		'[font-size:13px] [font-weight:700] [letter-spacing:0.4px] [font-variant-numeric:tabular-nums] [line-height:1.2] max-[641px]:[font-size:13px]',
	'dashboard-pomodoro-mini-phase':
		'[font-size:9px] [color:var(--db-text-muted,_var(--text-muted))] whitespace-nowrap [overflow:hidden] [text-overflow:ellipsis] [line-height:1.2]',
	'dashboard-pomodoro-mini--paused': '[&_.dashboard-pomodoro-mini-time]:[opacity:0.65]',
	'dashboard-pomodoro-mini-btn':
		'w-[22px] h-[22px] flex [align-items:center] [justify-content:center] [flex-shrink:0] [overflow:hidden] rounded-[50%] [background:var(--db-bg-btn,_transparent)] [border:1px_solid_var(--db-border-btn,_var(--background-modifier-border))] [color:var(--db-text,_var(--text-normal))] [cursor:pointer] motion-safe:[transition:width_0.2s_ease,_opacity_0.15s_ease,_border-width_0.2s_ease,_background_0.15s_ease,_transform_0.1s_ease,_visibility_0s] [&:hover]:[background:var(--db-bg-hover,_var(--background-modifier-hover))] [&:active]:[transform:scale(0.92)] [&_svg]:w-[10px] [&_svg]:h-[10px] max-[641px]:w-[28px] max-[641px]:h-[28px] max-[641px]:[&_svg]:w-[13px] max-[641px]:[&_svg]:h-[13px]',
	'dashboard-pomodoro-mini-btn--ghost': '[border-color:transparent] [color:var(--db-text-muted,_var(--text-muted))]',
	'dashboard-reading-mini':
		'[position:fixed] [top:46px] [right:12px] [z-index:var(--layer-menu)] flex [align-items:center] gap-[6px] p-[4px_6px] [background:var(--db-bg-modal,_var(--background-secondary))] [border:1px_solid_var(--db-border-card,_var(--background-modifier-border))] rounded-[var(--db-radius-md,_8px)] [box-shadow:var(--db-shadow-card,_0_4px_16px_var(--db-record-color-38))] [color:var(--db-text,_var(--text-normal))] [user-select:none] [cursor:grab] [touch-action:none] [overflow:hidden] max-[641px]:[top:52px] max-[641px]:[right:10px] max-[641px]:p-[4px_6px]',
	'dashboard-reading-mini-icon':
		'flex [align-items:center] [color:var(--db-accent,_var(--interactive-accent))] [flex-shrink:0] [&_svg]:w-[12px] [&_svg]:h-[12px]',
	'dashboard-reading-mini-time':
		'[font-size:12px] [font-weight:700] [letter-spacing:0.4px] [font-variant-numeric:tabular-nums] [line-height:1.2] whitespace-nowrap [text-align:center]',
	'dashboard-reading-mini--paused': '[&_.dashboard-reading-mini-time]:[opacity:0.6]',
	'dashboard-reading-mini-btn':
		'w-[20px] h-[20px] flex [align-items:center] [justify-content:center] [flex-shrink:0] rounded-[50%] [background:var(--db-bg-btn,_transparent)] [border:1px_solid_var(--db-border-btn,_var(--background-modifier-border))] [color:var(--db-text,_var(--text-normal))] [cursor:pointer] motion-safe:[transition:background_0.15s_ease,_transform_0.1s_ease] [&:hover]:[background:var(--db-bg-hover,_var(--background-modifier-hover))] [&:active]:[transform:scale(0.92)] [&_svg]:w-[9px] [&_svg]:h-[9px] max-[641px]:w-[26px] max-[641px]:h-[26px] max-[641px]:[&_svg]:w-[11px] max-[641px]:[&_svg]:h-[11px]',
};
export function widgetClasses(names: string | undefined): string {
	return cn(...(names ?? '').split(/\s+/).flatMap((name) => [name, layout[name]]));
}
