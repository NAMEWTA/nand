# 设计系统

代码：`src/ui/styles/000-foundation.css`（令牌）、`src/ui/styles/001-primitives.css`（`nand-ui-*` 类名）、`src/ui/primitives/`（Preact 组件和原生封装）。一切都派生自 Obsidian 变量，所以当前的 Obsidian 主题、社区主题和 NAND 主题样式都能贯通。不要在模块里重新定义令牌。

## 令牌

| 用途 | 令牌 |
|---|---|
| 间距（4px 基准） | `--nand-space-1` … `--nand-space-8` |
| 圆角 | `--nand-radius-xs` 4px（小标签、轨道）、`-sm` 6px（控件、行）、`-md` 8px（卡片、浮层）、`-lg` 12px（对话框）、`-pill` |
| 表面 | `--nand-surface`、`--nand-surface-muted`、`--nand-surface-hover`、`--nand-surface-active` |
| 边框 | `--nand-border`、`--nand-border-color`、`--nand-border-color-strong` |
| 强调色 | `--nand-accent`、`--nand-accent-soft`（选中填充）、`--nand-accent-softer`（放置目标）、`--nand-accent-border`，文字用 `--text-accent` |
| 状态（仅表达含义） | `--nand-tone-success`、`-warning`、`-error`、`-info` |
| 层级阴影 | `--nand-shadow-xs` 静止、`-sm` 悬停、`-md` 浮层、`-lg` 悬浮 |
| 字号 | `--nand-text-caption`、`-body`、`-title`、`-heading`；文字颜色 `--text-normal`、`--text-muted`、`--text-faint` |
| 控件 | `--nand-control-height-sm` 28px、`--nand-control-height` 32px、`-lg` 36px、`--nand-touch-target` 44px、`--nand-icon-size` 16px |
| 外壳 | `--nand-rail-width` 52px、`--nand-panel-width`、`--nand-header-height` 44px、`--nand-list-row-height` 32px |
| 层 | `--nand-z-base`、`-sticky`、`-overlay`、`-popover`、`-modal`、`-toast`（最高 50） |
| 动效 | `--nand-duration-fast` 120ms、`--nand-duration` 180ms、`--nand-duration-slow` 240ms、`--nand-ease` |
| 焦点 | `--nand-focus-ring` |

需要对齐的数字（计数、金额、时间）使用 `font-variant-numeric: tabular-nums`。嵌套圆角等于外层圆角减去内边距。

## 原语

`src/ui/primitives/` 里的 Preact 组件：

| 组件 | 用途 |
|---|---|
| `Button`（变体 default/primary/ghost/danger，尺寸 sm/md）、`IconButton` | 操作；`IconButton` 需要 `label`（它会成为 `aria-label` 和提示） |
| `TextField`、`SearchField` | 带标签的输入框／文本域；面板和列表搜索 |
| `Tabs`（分段式，`aria-pressed`）、`TabStrip` | 小范围的互斥选择；页面区的资源标签 |
| `ListItem` | 可选中的行，带图标、元信息、徽标和悬停操作 |
| `Badge`、`SaveStatus`、`Skeleton`、`EmptyState` / `renderEmptyState` | 状态标签、保存中／已保存／错误、加载占位、空／停用／错误状态 |
| `Icon` | 组件里的 Obsidian `setIcon` |
| `openDialog`、`promptText` | 带 Preact 内容的 Obsidian `Modal`；单字段输入框 |
| `showMenu` | 由条目生成的 Obsidian `Menu` |
| `localized-dom`、`localized-form` | 无需重绘就能跟随语言的原生标签 |

`001-primitives.css` 里只有 CSS 的构件：`nand-ui-card`（`is-interactive`、`is-selected`）、`nand-ui-btn`、`nand-ui-btn-ghost`、`nand-ui-icon-btn`、`nand-ui-segmented`、`nand-ui-field`、`nand-ui-badge`（`--accent`、`--success`、`--warning`、`--error`、`--info`）、`nand-ui-dot`、`nand-ui-list`、`nand-ui-list-item`（`-title`、`-meta`）、`nand-ui-section-label`、`nand-ui-toolbar`、`nand-ui-spacer`、`nand-ui-stack`、`nand-ui-divider`、`nand-ui-scroll`、`nand-ui-panel-muted`。

shell 模式（`src/shell/`）：`Rail`、`SidePanel`、`PageHeader`。设置页使用原生 `Setting` 行，并用 `setHeading()` 分组。

## 组合

- 每个页面或对话框只有一个主操作。次要操作用 ghost 或图标按钮；破坏性操作用 danger 变体或 `mod-warning`。
- 先用留白分隔，其次用弱化的表面，最后才用细边框。静止的卡片不同时使用强边框和重阴影。
- 悬停只变化一级（填充、边框或一级阴影）。不做缩放跳变。
- 默认中性；颜色用来标记选中和含义，从不用于装饰。
- 层级靠字重和字号：标题 600，正文常规，元信息用 `--text-muted` 的小字。
- 组与组之间的间距至少是组内间距的两倍。卡片内边距 12–16px。
- 阅读和表单页面限制宽度（760–960px）；看板、终端和浏览器使用全宽。
- 空、加载和错误状态要经过设计并居中，使用同样的令牌。

## CSS 规则

由 `pnpm run lint:css` 强制（stylelint，`stylelint.config.mjs`；列在只减不增的基线 `scripts/stylelint-baseline.json` 里的文件，可以保留为它们列出的违规）：

- 除 `src/theme/` 和令牌层之外，不用字面量颜色（十六进制、`rgb()`、`hsl()`……）。
- 不用 `!important`，不用 `:has`。
- `z-index` 只通过 `--nand-z-*` 令牌。
- 没有重复选择器。
- 限定在模块的类名下；给 Obsidian 自身 DOM 设样式的规则挂在模块激活期间添加的 body 类名下（`body.nand-iconic-enabled`、`body.nand-theme--…`）。

看板的 `--db-*` 变量是在全局令牌基础上一次性定义的别名（`src/modules/home/styles/004-root.css`）。它们属于看板及其对话框；新的界面使用 `--nand-*` 令牌。

## 库

允许：`preact`（`react` 导入用 `preact/compat`）、Obsidian 自带的控件（`Setting`、`Menu`、`Modal`、`SuggestModal`、`setIcon`、`setTooltip`）、在单个窗口内拖动用的指针事件、chart.js（懒加载，首页图表）、xterm.js（智能体）。

拒绝：React 19 / `react-dom`、MUI、Chakra、Ant Design、shadcn、Tailwind、Bootstrap、styled-components、Emotion、dnd-kit、react-beautiful-dnd、flatpickr、choices.js、取色器包。如果用这些做不到，就停下来说明。
