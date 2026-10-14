# Orca 来源与适配范围

NAND 改编了 [Orca](https://github.com/stablyai/orca)（stablyai/orca）的部分内容。Orca 使用 MIT 许可证，Copyright (c) 2026 Lovecast Inc.。完整的 [MIT 许可证](orca-LICENSE.txt)保持原文，并嵌入构建产物 `main.js` 的许可证声明。署名摘要见 [NOTICE](../../NOTICE)（仅英文）。

每个改编的源文件都在头部注释里写明上游。下面的上游提交只用来标识代码取自何处，并不表示 NAND 跟随 Orca 的最新版本。

| 上游 | 提交 |
|---|---|
| Agent 运行时、自动化调度 | [27b823f934f739bc85914dd717b776835f60bcf7](https://github.com/stablyai/orca/tree/27b823f934f739bc85914dd717b776835f60bcf7) |
| 终端工作台（Orca v1.4.217） | [11d97896628d90c4990365127812667b00e28c82](https://github.com/stablyai/orca/tree/11d97896628d90c4990365127812667b00e28c82) |
| 浏览器 | [d74388f8a2dad2bd4bbfe3b937aba66e6648258b](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b) |

## 终端工作台（11d97896）

| Orca 的部分 | NAND 中的位置 |
|---|---|
| `recent-tab-switching` | `src/modules/agent/core/terminal/recent-sessions.ts`：稳定的最近使用顺序、去重、移除失效身份、活动会话优先。旧建议选择器已移除；工作区最近标签顺序现由 `core/workspace/ops.ts` 管理。 |
| `pane-fit-resize-observer`、`pane-fit-client-size` | `src/modules/agent/ui/terminal/stable-terminal-fit.ts`：合并尺寸检查，等待稳定的字符尺寸，避免重复调整 PTY 大小。使用所属窗口和公开的 `FitAddon` 接口。 |
| `terminal-webgl-hidden-retention` | `src/modules/agent/ui/terminal/hidden-renderer-retention.ts`：实例级 LRU，最多保留两个隐藏的图形上下文。可见的渲染器不拥有 PTY 的生命周期。 |
| `terminal-structural-replay-coordinator`、滚动缓冲快照、滚动意图 | `src/modules/agent/ui/terminal/terminal-presentation.ts`：依据权威的 headless 快照重放，与实时输出串行衔接，并恢复滚动意图。 |

## Agent 运行时与自动化调度（27b823f）

| Orca 的部分 | NAND 中的位置 |
|---|---|
| 共享的 Agent 配置：启动命令、权限参数、安装与升级命令、用量类型 | `src/modules/agent/core/launch/catalog.ts`（同时承载自动化的提示词传递方式） |
| 原生恢复能力集合 | `src/modules/agent/services/agent-runtime.ts` |
| 原生会话布局、Claude 项目路径编码、历史范围 | `src/modules/agent/platform/desktop/history/scope.ts`；历史格式见 `native/pty-server/src/agent_data.rs` |
| 原生生命周期钩子与扩展 | `src/modules/agent/platform/desktop/hooks/native-extensions.ts` |
| 调度与 cron 解析、下一次触发时间计算 | `src/modules/automations/core/schedule/`（`automation-cron-field-parsing.ts`、`automation-cron-occurrence.ts`、`automation-schedule-occurrences.ts`、`automation-schedule-parsing.ts`） |

## 浏览器（d74388f）

| Orca 的部分 | NAND 中的位置 |
|---|---|
| 无障碍树快照遍历 | `src/modules/browser/core/snapshot-ax-tree-walk.ts`、`src/modules/browser/platform/desktop/snapshot-engine.ts` |
| 可交互元素发现 | `src/modules/browser/platform/desktop/snapshot-cursor-interactive-elements.ts` |
| 截图标注模型 | `src/modules/browser/core/markup-model.ts` |
| 元素抓取上下文 | `src/modules/browser/platform/desktop/grab-script.ts` |
| 调试器租约归属 | `src/modules/browser/platform/desktop/debugger-lease.ts` |
| 弹窗分类 | `src/modules/browser/platform/desktop/guest-policy.ts` |
| 网址分类 | `src/shared/web-url.ts` |

## React 设计系统（464bd5a）

上游提交：`464bd5a54b3364021c5cc0319859616e5ec41bbf`。

| Orca 的部分 | NAND 中的位置 |
|---|---|
| `src/renderer/src/components/ui/*.tsx` | `src/ui/components/`：保留布局、尺寸、交互与变体；改用 NAND 令牌、i18n、所属窗口 Portal 和 IME 保护。上游缺少的 AlertDialog、Resizable、Table、Skeleton 按 shadcn/ui new-york-v4 配方补齐。 |
| `components/settings/SettingsFormControls.tsx` | `src/ui/components/nand/SettingsFormControls.tsx`：设置行、开关行、分段控件、徽标、小节标题、颜色和数字输入。 |
| `components/settings/SettingsDisabledControlTooltip.tsx` | `src/ui/components/nand/SettingsDisabledControlTooltip.tsx`：禁用控件的可聚焦提示包装。 |
| `components/ShortcutKeyCombo.tsx` | `src/ui/components/nand/ShortcutKeyCombo.tsx`：快捷键键帽。平台判断改用 Obsidian API。 |
| `components/status-bar/icons.tsx` | `src/ui/components/nand/agent-icons/`：Claude、OpenAI/Codex、Gemini SVG 组件；Gemini 实例标识改用 React `useId`。 |

紧凑控件保留上游视觉尺寸，通过预留空间与透明伪元素补足 NAND 的 32/44px 命中范围。动效时长改用宿主令牌，过渡限于 transform/opacity。27 个基础组件和设置禁用提示包装的文件头包含固定提交与原路径。

4 个 shadcn 补齐项的来源配方路径为 `shadcn-ui/ui/apps/v4/registry/new-york-v4/ui/{alert-dialog,resizable,table,skeleton}.tsx`，版权为 Copyright (c) 2023 shadcn，MIT。未记录该配方的固定提交，不把兼容版本（React 19、Radix UI 1.6.7、react-resizable-panels 3.0.6）当成上游提交；没有声称与某个官方版本逐字一致。

## NAND 不采用的部分

NAND 使用自己的 Obsidian 叶子、主题令牌和 stdio 辅助进程（协议 3）；设计系统采用 React，旧 Preact 界面在迁移期保留。不使用 Orca 的应用状态树、窗格树、Electron 主进程和私有的 xterm 渲染补丁。回归测试覆盖被改编的行为，不构成与 Orca 应用兼容的保证。

## 工作台外壳、状态栏与设置框架（464bd5a）

| 上游文件（相对 `src/renderer/src/`） | NAND 中的位置与适配 |
|---|---|
| `app-shell/AppWorkspaceShell.tsx` | `src/shell/ShellRoot.tsx`：保留 flex 外框，换成 Obsidian 叶子宽度、独立页面根、图标轨与 Sheet 导航。文档将上游目录写在 components 下，实际位于 app-shell。 |
| `components/sidebar/index.tsx` | `src/shell/panel/SidePanel.tsx`：通用列表与宽度分隔条，范围 220～500px；不带 worktree 功能。 |
| `components/status-bar/StatusBarSurface.tsx` | `src/shell/status-bar/StatusBar.tsx`、`UsageCluster.tsx`：24px 容器、左右簇、向上弹出的用量菜单与测量标记。 |
| `components/status-bar/StatusBarProviderSegment.tsx`、`UsageRosterPanel.tsx` | 同名 NAND 用量组件：替换为现有 `controller.usage` 适配快照；详细/精简、百分比、阈值、分钟边界倒计时与排序。 |
| `components/status-bar/status-bar-usage-collapse.ts` | `src/shell/status-bar/collapse.ts`：按阶段 3 明确的算法先精简，再从右向左折叠，隐藏片段继续测量。 |
| `components/status-bar/StatusBarVisibilityMenu.tsx` | `src/shell/status-bar/VisibilityMenu.tsx`：改用当前窗口 ContextMenu，偏好进入 app 设置命名空间。 |
| `components/settings/Settings.tsx`、`settings-page-renderer.tsx`、`SearchableSetting.tsx`、`settings-search.ts` | `src/app/settings/react/`：保留 renderer 的独立滚动区、`gap-10 px-8 pt-10 pb-24 max-w-4xl` 内容容器、空结果态，以及设置行与搜索包装；分类由 NAND PanelModel 提供，搜索按 NAND 要求移到内容顶部，模块状态和旧 DOM 渲染器生命周期由 NAND 提供。 |

底部状态栏不包含 Orca 的 SSH、资源监视、宠物或更新通知。组件样板直接由新设置页渲染 React 组件。旧模块设置仍通过单一 DOM 容器包装，以显式 `settingsPageKind: 'react'` 区分后续 React 设置组件；阶段 9 移除旧渲染路径。

## 自动化页面与参数校验（464bd5a）

上游界面路径相对 `src/renderer/src/components/automations/`。所有改编文件头包含原始文件路径，MIT 版权归 Lovecast Inc.。

| 上游文件或职责 | NAND 中的位置与适配 |
|---|---|
| `AutomationsPage.tsx`、`AutomationsPageSurface.tsx`、`AutomationsPageTopBar.tsx` | `src/modules/automations/ui/AutomationsPage.tsx`、`TopBar.tsx`；保留页面容器与面包屑，接入 NAND 页面状态及独立 ReactSurface。 |
| 列表工具栏、搜索、筛选、表格和 `AutomationListLocalRow.tsx` | `ui/list/`；保留表格网格、固定首列与表头、悬停按钮布局，删除远程操作和浏览器流程，接入七种 NAND 动作。 |
| 编辑对话框、内容区、设置栏、计划与会话选择 | `ui/editor/`；保留 1080px 双栏 Dialog 与右侧 360px 设置栏，接入 vault 目录、命令、笔记、待办、时区与预检。 |
| `AutomationDetail.tsx`、`AutomationsDetailPane.tsx`、`AutomationPromptDisclosure.tsx` 及运行记录 | `ui/detail/`、`ui/runs/`；采用 NAND 本设备运行快照、预检结果和终端 API。 |
| 额外参数白名单 | `src/shared/automation/extra-args.ts`；允许模型、推理强度与 Claude 附加目录，使用参数数组传入 CLI，拒绝未授权参数。 |

模板为 NAND 自有数据；调度、持久化、60 秒预检进程、资源释放与看板来源仍使用 NAND 的服务，不引入 Orca IPC、远程同步或工作流引擎。已删除动作的旧文档只保留原文供显式删除，不迁移或执行。

## 智能体工作区核心（464bd5a，阶段 4a）

| 上游文件（相对 `src/renderer/src/components/`） | NAND 中的位置与适配 |
|---|---|
| `sidebar/SidebarNav.tsx`、`sidebar/worktree-card-surface.tsx`、`sidebar/StatusIndicator.tsx` | `src/modules/agent/ui/sidebar/AgentSidebar.tsx`：保留导航、状态分组与两行卡片的尺寸、布局和类名；数据来自工作区仓库，通过所属叶子的导航槽位 Portal 渲染。 |
| `tab-bar/tab-bar-surface.tsx`、`SortableTab.tsx`、`TerminalTabLeadingIcon.tsx` | `ui/tabs/`、`ui/create/NewTabMenu.tsx`：单层标签带、激活线、关闭/颜色/置顶、拖放与新建菜单；导航开关放在首组，页面与历史入口放在末组。 |
| `tab-bar/TabBarCreateEntry.tsx`、`TabBarCreateEntryRow.tsx`、`tab-bar-surface.tsx` | `ui/create/Omnibox.tsx`：保留输入框、条目与终端动作/智能体/设置的分组和分隔线，接入 cmdk、NAND 的智能体目录、输入分类与创建服务。浏览器引擎缺失时保留输入并显示禁用原因。 |
| `tab-group/TabGroupSplitNodeTree.tsx`、`TabGroupPanel.tsx`、`TabGroupDropOverlay.tsx` | `ui/workspace/`：最多四组，保持分隔条、四边放置区；布局存入每设备的工作区文件。 |
| `terminal-pane/TerminalContextMenu.tsx`、`TerminalProcessExitOverlay.tsx` | `ui/terminal/TerminalTabView.tsx`：菜单与退出条带、窗格状态/标题和平分操作；重置经 NAND 权威终端模型同步，复制上下文使用最近 200 行。`TerminalSearch.tsx` 恢复 NAND 原有大小写/正则/前后项与未匹配反馈，保留 xterm/PTY、Hook、附件与原生会话恢复接口。 |
| `AgentStateDot.tsx`、`AgentWorkingSpinner.tsx`、`AgentQuestionIcon.tsx` | `src/ui/components/nand/StatusDot.tsx`、`AgentWorkingSpinner.tsx`、`AgentQuestionIcon.tsx`：状态图标和动效，改用 NAND 语义令牌、i18n、所属窗口 Tooltip；保留已有 `StatusDot.status` 调用兼容。 |

历史面板、看板、快捷命令和智能体管理属于阶段 4b，核心页面预留入口。工作区服务与归一化为 NAND 实现；保留每窗格的原生会话标识与账号信息，但不会在启动时自动重启进程。普通 Shell 的输出停顿不作为智能体完成事件。
