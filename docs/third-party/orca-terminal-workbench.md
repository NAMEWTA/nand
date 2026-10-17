# Orca 改编范围

NAND 改编了 [Orca](https://github.com/stablyai/orca)（stablyai/orca）的部分内容。Orca 使用 MIT 许可证，Copyright (c) 2026 Lovecast Inc.。完整的 [MIT 许可证](orca-LICENSE.txt)保持原文，并嵌入构建产物 `main.js` 的许可证声明。署名摘要见 [NOTICE](../../NOTICE)（仅英文）。

每个改编的源文件都在头部注释里写明上游。下面的上游提交只用来标识代码取自何处，并不表示 NAND 跟随 Orca 的最新版本。

| 上游 | 提交 |
|---|---|
| 当前工作台、智能体、浏览器、自动化和设计系统 | [464bd5a54b3364021c5cc0319859616e5ec41bbf](https://github.com/stablyai/orca/tree/464bd5a54b3364021c5cc0319859616e5ec41bbf) |
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
| 默认继承真实环境（464bd5a `local-pty-spawn-environment.ts`）；系统默认账号不注入 CLI home、Claude 系统默认不设 `CLAUDE_CONFIG_DIR`（`claude-profile-router.ts`、`runtime-home-service-home-routing.ts`） | `src/modules/agent/platform/desktop/agents/system-homes.ts`（真实目录解析）、`accounts.ts`（系统/托管账号环境）、`credentials.ts`（旧默认账号数据识别）、`pty/runtime-environment.ts` |
| 登录 shell 环境探测（464bd5a `startup/login-shell-environment.ts`） | `src/modules/agent/platform/desktop/detection/shell-path.ts`；仅保留 PATH、CLI 目录变量、密钥与代理变量，有超时，Windows 跳过 |
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

NAND 使用自己的 Obsidian 叶子、主题令牌和 stdio 辅助进程（协议 3）；界面统一采用 React，旧 Preact 运行时与迁移包装已经移除。不使用 Orca 的应用状态树、窗格树、Electron 主进程和私有的 xterm 渲染补丁。回归测试覆盖被改编的行为，不构成与 Orca 应用兼容的保证。

## 工作台外壳、状态栏与设置框架（464bd5a）

| 上游文件（相对 `src/renderer/src/`） | NAND 中的位置与适配 |
|---|---|
| `app-shell/AppWorkspaceShell.tsx` | `src/shell/ShellRoot.tsx`：保留 flex 外框，换成 Obsidian 叶子宽度、独立页面根、图标轨与 Sheet 导航。文档将上游目录写在 components 下，实际位于 app-shell。 |
| `components/sidebar/index.tsx` | `src/shell/panel/SidePanel.tsx`：通用列表与宽度分隔条，范围 220～500px；不带 worktree 功能。 |
| `components/status-bar/StatusBarSurface.tsx` | `src/shell/status-bar/mount-usage.tsx`：用量项触发器和向上弹出的用量面板，挂在 Obsidian 底部状态栏的用量项里（不再有工作台内部的 24px 容器）。 |
| `components/status-bar/StatusBarProviderSegment.tsx`、`UsageRosterPanel.tsx` | 同名 NAND 用量组件：替换为现有 `controller.usage` 适配快照；详细/精简、百分比、阈值、分钟边界倒计时与排序。 |
| `components/settings/Settings.tsx`、`settings-page-renderer.tsx`、`SearchableSetting.tsx`、`settings-search.ts` | `src/app/settings/react/`：保留 renderer 的独立滚动区、`gap-10 px-8 pt-10 pb-24 max-w-4xl` 内容容器、空结果态，以及设置行与搜索包装；分类由 NAND PanelModel 提供，搜索移到内容顶部，模块状态和 React 设置生命周期由 NAND 提供。 |

底部状态栏不包含 Orca 的 SSH、资源监视、宠物或更新通知。组件样板直接由新设置页渲染 React 组件。所有模块设置已统一 React 加载接口；旧 DOM 包装与临时 settingsPageKind 字段均已移除。

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

阶段 4b 已接入历史面板、看板、快捷命令和智能体管理。工作区服务与归一化为 NAND 实现；保留每窗格的原生会话标识与账号信息，但不会在启动时自动重启进程。普通 Shell 的输出停顿不作为智能体完成事件。


## 智能体历史、管理和统计（464bd5a，阶段 4b）

上游路径相对 `src/renderer/src/components/`，版权与 MIT 许可沿用本页顶部说明。

| 上游文件 | NAND 中的位置与适配 |
|---|---|
| `right-sidebar/AiVaultPanelHeader.tsx`、`AiVaultPanelControls.tsx`、`AiVaultSessionVirtualList.tsx`、`AiVaultSessionRow.tsx`、`AiVaultSessionDetails.tsx` | `agent/ui/history/SessionHistoryPanel.tsx`；保留侧栏、控制菜单、详情和虚拟列表布局；扫描、账号校验、标注与导出接入 NativeHistory。 |
| `dashboard/AgentDashboardDrawer.tsx`、`DashboardAgentRow.tsx`、`sidebar/WorkspaceKanbanCard.tsx` | `agent/ui/dashboard/AgentBoard.tsx`；从 NAND 会话仓库派生四列，预览来自 Hook 或原生历史，隐藏标签组时暂停渲染资源。 |
| `tab-bar/TabBarQuickCommandsButton.tsx`、`TabBarQuickCommandsMenu.tsx`、`terminal-quick-commands/TerminalQuickCommandDialog.tsx` | `agent/ui/quick-commands/`；保留分体按钮、分组菜单及编辑 Dialog，设置存入 `agent.quickCommands`；智能体提示词走现有输入就绪协议。 |
| `WorktreeJumpPalette.tsx` | `agent/ui/jump/JumpPalette.tsx`；CommandDialog、最近标签、历史与命令；不引入 worktree 或 Orca IPC。 |
| `settings/AgentsPane.tsx`、`AgentDetectionCatalog.tsx`、`AgentCatalogRow.tsx`、`AgentLaunchDefaultsEditor.tsx`、`TerminalPane.tsx`、`QuickCommandsPane.tsx`、`SettingsFormControls.tsx` | `agent/ui/settings/`；保留检测目录、覆盖编辑、终端设置和快捷命令布局，服务与持久化由 NAND 管理。 |
| `stats/StatsPane.tsx`、`StatCard.tsx`、`ClaudeUsageDailyChart.tsx`、`UsageRecentSessionsTable.tsx`、`usage-overview-sections.tsx` | `agent/ui/usage/`；计数来自本设备 stats.json，token 来自只读原生日志；chart.js 按需加载，未知模型或费用不推测。 |

账号菜单由 `AGENT_USAGE` 的模块仓库供数；设置页子区通过通用 `SettingsPageHost.resourceId` 接收导航。历史“全部”仍只读本库账号，恢复入口继续验证工作目录。


## 浏览器标签（464bd5a，阶段 5）

| 上游文件 | NAND 中的位置与适配 |
|---|---|
| `src/renderer/src/components/browser-pane/browser-client-page-retained-elements.ts`、`browser-client-page-position-driver.ts` | `src/modules/browser/platform/desktop/retained-page.ts`：按 Document 保留宿主，使用共享帧循环、ResizeObserver、滚动与尺寸同步；`<webview>` 不换父节点。接入 NAND 的库内 Session 和页面释放。 |
| `src/shared/browser-url.ts` | `browser/core/url.ts`：地址分类，扩展百度和 HTTPS 自定义模板，保留凭据与协议拒绝规则。 |
| `src/main/browser/browser-cookie-detection-types.ts`、`browser-cookie-key.ts`、`browser-cookie-decryption.ts`、`browser-cookie-import-policy.ts` | `browser/platform/desktop/cookies/{detect,keys,decrypt,policy}.ts`：本机目录、密钥、CBC/GCM、域名及 Google 排除；SQLite 通过 NAND 的协议 3 控制消息读取库内临时副本，文件导入与写入回滚为 NAND 接点。 |
| `src/main/browser/browser-process-user-agent.ts`、`browser-session-ua.ts`、`browser-google-auth-ua.ts` | `browser/platform/desktop/user-agent.ts`：每个资料 Session 的清理 UA、Google 登录兼容与引用计数清理，不改宿主全局 UA。 |
| `browser-pane/assemble-chrome/browser-navigation-control-row.tsx`、`browser-chrome-toolbar.tsx`、`BrowserAddressBar.tsx`、`BrowserAddressBarSuggestionList.tsx`、`BrowserFind.tsx`、`browser-toolbar-menu-dropdown.tsx`；`browser-pane/navigate/browser-page-download-list.tsx`、`browser-load-failure-overlay.tsx` | `browser/ui/BrowserChrome.tsx`、`ui/cookies/CookieImport.tsx`：保留工具栏／菜单／查找／下载布局与 Tailwind 类，改用 NAND 的 zustand 页面状态、词典、所属窗口 Portal 与设置服务。 |
| `settings/BrowserPane.tsx`、`BrowserSearchEngineSetting.tsx`、`BrowserProfileRow.tsx`、`BrowserLinkRoutingSetting.tsx`、`BrowserNewProfileDialog.tsx` | `browser/ui/settings/BrowserSettings.tsx`、`NewProfileDialog.tsx`：设置行、资料列表与新建对话框；数据写入 NAND 的每设备文件。 |
| `browser-pane/annotate/MarkupOverlay.tsx`、`MarkupToolbar.tsx`、`MarkupDrawButton.tsx`；`assemble-chrome/browser-chrome-element-tool-buttons.tsx` | `browser/ui/design/`：截图绘制层与独立 `MarkupToolbar.tsx` 保留上游图标、Tooltip、色块／线宽／字号 Popover 结构与类名。复用 NAND 的既有六种绘制工具及 markup-model 算法；不新增橡皮工具，文字输入与完成／取消为宿主截图流程接点。预览按阶段 5 设计采用锚定 Popover，材料只经 `AGENT_SESSIONS.attachMaterial` 发送至输入区，不提交。 |
| `tab-bar/SortableTab.tsx` | `agent/ui/browser/BrowserWorkspaceTab.tsx`：与终端一致的标签尺寸、焦点／激活类，增加网页图标、资料切换及网页上下文菜单；`BrowserTabView.tsx` 只经 `browser/api.ts` 挂载与渲染。 |

表中组件路径未写前缀时，相对上游 `src/renderer/src/components/`。原始许可保留在 [orca-LICENSE.txt](orca-LICENSE.txt)。不引入 Orca IPC、数据目录或自动发送行为；原生 SQLite 读取使用 NAND 已有 rusqlite，无新增依赖。

## 档案、通知、同步、图标及设置（464bd5a，阶段 9a）

| 上游文件（相对 `src/renderer/src/components/`） | NAND 中的位置与适配 |
|---|---|
| `settings/SettingsFormControls.tsx`、`SettingsSection.tsx`、`SearchableSetting.tsx` | `archives/ui/` 的表单、筛选与设置，`icons/ui/settings/sections.tsx`、图标规则对话框，`comments/ui/settings-page.tsx`、`sync/ui/settings-page.tsx` 与 `app/settings/react/BuiltInSettings.tsx`：使用既有阶段 2 组件和双栏设置行，搜索命中高亮共用 `ui/react/settings-search.tsx`。 |
| `right-sidebar/source-control/commit/commit-message-composer.tsx`、`right-sidebar/source-control/sync/git-history-row.tsx` | `sync/ui/sync-presentation.tsx`：复用提交输入框和历史行布局／类名；动作和历史数据仍由 NAND Git 服务提供，行目标按 NAND 无障碍规则增至 32px，不引入上游远程、图历史或 AI 提交服务。 |
| 阶段 2 已署名的 `ui/*` 原语及设置／列表组合 | 档案列表和详情、通知收件箱、图标选择／规则／使用检查、内容搜索和编辑：替换旧 DOM 或 Preact 呈现；保留 NAND 的数据格式、业务服务和功能，图标模型与匹配算法仍沿用 Iconic 移植。 |

`ui/react/dialog.tsx` 是 NAND 的外部命令适配器：弹窗进入所属窗口的 Portal，关闭、所属表面移除或窗口关闭时释放 React 根并恢复焦点。图标对话框与同步确认按需加载；模块激活不提前加载 React 弹窗代码。共享旧原语、旧 CSS 与 Preact 依赖已在收尾移除。
