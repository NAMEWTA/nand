# 设计系统

唯一视觉规范是 [03 设计系统](../../../../docs/refor/03-设计系统.md)。本文是实施速查；完整令牌取值、组件变体、尺寸和上游文件映射以该文档为准。React 19 + shadcn/ui（new-york-v4）组件放在 `src/ui/components/`，NAND 组合组件放在 `components/nand/`；组件约定见 [ui 技能](../SKILL.md)。

## 令牌速查

令牌定义在 `src/ui/styles/tokens.css` 的 `.nand-ui` 上，默认派生自 Obsidian 变量，经 `src/ui/tailwind/index.css` 的 `@theme inline` 映射。组件优先写语义工具类（如 `bg-card text-muted-foreground`），不直接写颜色值。

| 用途 | 令牌或工具类 |
|---|---|
| 页面、卡片、弹层 | `--background` / `--foreground`、`--card` / `--card-foreground`、`--popover` / `--popover-foreground` |
| 主操作、次要操作、弱化内容、悬停 | `--primary`、`--secondary`、`--muted`、`--accent` 及各自 `-foreground` |
| 危险、边线、输入、焦点 | `--destructive` / `--destructive-foreground`、`--border`、`--input`、`--ring` |
| 侧栏 | `--sidebar`、`--sidebar-foreground`、`--sidebar-accent`、`--sidebar-accent-foreground`、`--sidebar-border` |
| 状态、智能体等待、图表 | `--status-success`、`--status-warning`、`--status-error`、`--status-info`、`--status-working`、`--agent-question`、`--chart-1`～`--chart-5` |
| 字体 | `--nd-font-sans`（Geist + 中文系统回退）、`--nd-font-mono`（Geist Mono）；终端字体独立设置 |
| 圆角 | `--radius: 0.625rem`；`rounded-sm/md/lg/xl` = 6/8/10/14px，药丸用 `rounded-full` |
| 间距、字号 | 4px 基准；`text-3xs/2xs/xs/sm` = 10/11/12/14px；密集行 `text-[13px]`，数字 `tabular-nums` |
| 阴影 | 细线 → `shadow-xs` + 细线 → 弹层 `shadow-floating`，不另造层级 |
| 层级 | 粘性内容用规范指定的 `z-10`；拖拽、菜单、模态框、提示、通知分别用 `--layer-dragged-item`、`--layer-menu`、`--layer-modal`、`--layer-tooltip`、`--layer-notice`（如 `z-[var(--layer-menu)]`） |
| 动效 | `--anim-duration-fast`、`--anim-duration-moderate`；细则见 [动效与无障碍](motion-a11y.md) |

默认跟随 Obsidian；可选 `body[data-nand-palette="orca"] .nand-ui` 中性配色（含 destructive、status-*、chart-*、agent-question，亮/暗各一套）；属性由插件在每个窗口的 `<body>` 上统一设置，嵌套或直接挂在 body 下的 `.nand-ui` 都命中同一套令牌，新增表面不要自己写 `data-palette`。看板没有独立主题：`.nand-dashboard-root` 把 `--db-*` 全部从这组全局令牌派生（`src/modules/home/ui/theme/tokens.css`），不要在看板里写十六进制颜色或新增主题。看板弹窗加 `nand-dashboard-root` 以获得 `--db-*`，圆角、模糊等装饰覆盖由 `useDashboardAppearance` 镜像。主题字体开关默认关，界面默认统一 Geist。

## 组件清单

| 用途 | `src/ui/components/` |
|---|---|
| 操作与表单 | `Button`、`Input`、`Textarea`、`Label`、`Select`、`Switch`、`Checkbox`、`Slider`、`Progress` |
| 切换与容器 | `Toggle`、`ToggleGroup`、`Tabs`、`ScrollArea`、`Separator`、`Collapsible`、`Accordion`、`Resizable` |
| 菜单与选择 | `DropdownMenu`、`ContextMenu`、`Command`（cmdk） |
| 弹层 | `Tooltip`、`Popover`、`HoverCard`、`Dialog`、`Sheet`、`AlertDialog` |
| 展示与反馈 | `Badge`、`Card`、`Skeleton`、`Table`、`Toaster` / `toast`（sonner） |
| NAND 组合 | `EmptyState`、`SettingsSection`、`SettingsRow`、`SettingsSwitchRow`、`SegmentedControl`、`SettingsBadge`、`StatusDot`、`AgentIcon`、`ObsidianIcon`、`ShortcutKeyCombo`、`RelativeTime`、`InlineRename`、`ConfirmDialog`、`PathPicker`、`IconPicker`、`ColorField`、`NumberField` |

Button 变体为 `default/secondary/outline/ghost/link/destructive`；取消不是危险操作。图标用 `lucide-react`，只有用户配置的 Obsidian 图标名通过 `ObsidianIcon` 包装 `setIcon`。设置页用 React 设置行；自动化编辑、外观工作室和统计使用设计规定的大对话框。可编辑批注浮窗用受控 `Popover`，不能用 `Tooltip` 或 `HoverCard` 装表单。

保留上游 Tailwind 类名与 `data-slot`；类名由 `cn()` 合并，调用方 `className` 最后传入。`tailwind-merge` 登记自定义字号 `2xs/3xs`，防止与文字颜色类冲突。表单关联 Label 和说明；IME 组合期间不响应 Enter 提交。可访问名称、焦点和触控尺寸见动效与无障碍参考。

## CSS 与 Portal

隔离算法见 [02 架构文档 §5](../../../../docs/refor/02-架构文档.md#5-样式构建流水线)：

- 所有 React 根带 `.nand-ui`；Tailwind 输出展开 `@layer`，顶层选择器追加 `:is(.nand-ui, .nand-ui *):not(#\#)`，把 `:root/:host` 变量限定到 `.nand-ui`。保留上游类名，不添加类名前缀。
- 中和层只清除 NAND 作用域内的宿主表单样式，跳过 `.markdown-rendered`、`.nand-native`、`.cm-editor`。Obsidian `MarkdownRenderer` 的外层加 `nand-native`。
- 每个 Document 共用按引用计数管理的 `div.nand-ui.nand-portal-root`（`display: contents`）。Radix 的所有 Portal 和 sonner 均使用所属窗口的容器；最后一个使用者释放时移除。
- 能用 Tailwind 就不手写 CSS。xterm、CodeMirror、动画关键帧等作者 CSS 放在所属模块的 `styles/`，以 `.nand-ui` 或模块根类限定。主题令牌和看板主题放在各自专用文件。
- 字面量颜色只在 `src/theme/`、令牌层和获准的看板主题文件中出现；模块布局只用语义令牌。不用 `!important`，不自造裸数字 z-index；粘性元素的 `z-10` 是规范指定例外。
- `pnpm run lint:css` 检查作者 CSS，手写规则不使用 `:has`；上游 Tailwind 的 `has-*` 变体随生成产物保留。`build/tailwind.scoped.css` 和 `src/ui/styles/fonts.generated.css` 不参与作者样式检查。构建顺序见 [构建参考](../../dev/references/build-and-release.md)。

## 允许的库

| 用途 | 允许 |
|---|---|
| 运行时与组件 | `react`、`react-dom`（19 系列）、`radix-ui`、shadcn/ui 源码 |
| 样式与变体 | `tailwindcss` / `@tailwindcss/cli`（v4）、`tw-animate-css`、`class-variance-authority`、`clsx`、`tailwind-merge` |
| 图标、搜索、提示 | `lucide-react`、`cmdk`、`sonner` |
| 状态 | `zustand`；服务层只用 `zustand/vanilla`，分区规则见 dev 架构参考 |
| 拖拽、虚拟列表、分屏 | `@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`、`@tanstack/react-virtual`、`react-resizable-panels` |
| 专用渲染 | chart.js（按需加载图表）、xterm.js / `@xterm/*`（终端） |
| 宿主集成 | Obsidian `MarkdownRenderer`、`FuzzySuggestModal`、工作台外 `Notice`、原生设置入口与菜单适配 |

不引入第二套界面库（MUI、Chakra、Ant Design、Bootstrap 等）或 CSS-in-JS。组件来源、版权注释、字体许可和分发声明见 [许可参考](../../dev/references/licensing.md)。
