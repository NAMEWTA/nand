# NAND 分层重构记录

更新：2026-09-28。源码分层、原生 PTY 与终端渲染分离、界面状态隔离，以及此前列出的看板业务面板 Preact 迁移均已实现。旧源码入口和不再使用的渲染转发已移除，不提供发布前兼容层。当前架构门禁覆盖 580 个生产 TypeScript/TSX 模块。

## 目录与依赖

| 目录 | 职责 | 可以依赖 |
| --- | --- | --- |
| `src/plugin` | Obsidian 入口、模块注册、设置总模型、跨领域工作流 | 所有层 |
| `src/view` | 按功能聚合的业务面板、组件、工作台组合、原生 UI 接入 | view、platform、core、shared |
| `src/platform` | Obsidian/Vault、桌面文件系统、Rust 服务连接等宿主适配 | platform、core、shared |
| `src/core` | 领域模型、应用规则、解析、调度、状态与存储端口使用 | core、shared |
| `src/shared` | 基础工具、序列化协议、存储接口、国际化 | shared |

`core` 按领域平铺，如 `automations`、`notifications`、`agent-launch`、`pty`、`contacts`、`comments`、`expense`、`habit`。功能界面及相关可视组件就近放在 `view/<domain>`；真正跨领域的视觉基础组件放在 `view/primitives`。不把插件拆成发布型 packages，不增加后台进程、路由或服务容器。

`pnpm test:architecture` 检查类型及运行时依赖方向、core/shared 的宿主依赖、内部回引聚合入口、运行时循环；循环分析包含字面量动态导入和 require。动态计算的模块名不在静态图解析范围内，门禁也不证明事件回调没有业务递归。

## Obsidian 与 Preact 的分工

Obsidian 的 Plugin、Component、ItemView、Modal、Setting、Menu、命令与注册卸载继续负责宿主集成。Preact 负责业务界面的 JSX、状态和交互。设置、选择器、原生菜单、拖拽布局支架等宿主 UI 接入保留原生实现。

面板通过 props 接收状态、操作与明确的宿主能力，不导入插件类。`TerminalWorkbench` 通过 sessions/history/usage 插槽组合内容；看板的原生区块装配器直接挂载对应面板。同一面板可以放进叶子、区块或原生 Modal，无需复制领域逻辑。

MarkdownRenderer、CodeMirror、xterm、Chart.js 保留其原生渲染容器；effect 只负责这些原生资源的接入和清理。业务面板不通过 effect 调用旧的命令式渲染器。Native Modal 管理焦点、层叠与关闭；关闭时卸载其 Preact 根，模块关闭或插件卸载统一关闭其业务弹窗，阅读/番茄钟服务所属叶子关闭时清理对应弹窗。

## 本轮完成的看板迁移

| 功能 | 组件入口 | 保留和修复的行为 |
| --- | --- | --- |
| 任务、项目、便笺与卡片 | `cards/TaskPanel`、`ProjectPanel`、`MemoPanel`、`CardPanel` | 多层折叠、编辑取消、Enter/blur 单次提交、拖拽/触摸、链接预览、Markdown 异步结果与卸载隔离 |
| 图表、天气、追踪 | `cards/WeatherPanel`、`TrackerPanel` 和卡片图表容器 | 原生 Chart.js 生命周期、天气异步刷新、数据更新 |
| 文档库 | `library/LibraryPanel`、`LibraryViews`、`LibraryKanban` | 搜索、分页、分组折叠、多视图、属性写回；拖拽失败回滚，保留多值属性的其他成员 |
| 日历与日程 | `calendar/CalendarPanel`、`CalendarGrids`、`CalendarModalPanel`、`DayPreview` | 月/周/时间轴、筛选、任务勾选、添加日任务、悬浮预览、原生 Modal |
| 图片与视频 | `media/MediaPanel`、`MediaViews`、`MediaLightboxPanel` | 分组、标签/日期/文件夹筛选、改名、灯箱；视频可见时挂载，离屏、来源替换和卸载释放解码资源 |
| DQL | `dataview/DataviewPanel`、`ResultViews`、`Values` | 表格、列表、任务、日历、热力图、筛选排序分页；查询刷新保留结果面板和搜索输入 |
| 微信读书 | `weread/WereadPanel`、`WereadStats` | 书架与统计组合、阅读状态、统计模式、异步请求过期结果保护；统计读取不覆盖进度存储 |
| 网页与速记 | `web/WebPanel`、`notes/QuickNotesPanel` | iframe/webview 原生容器、加载/刷新、快捷笔记操作 |
| 通用部件 | `widgets` 下的相册、农历、年进度、周历、倒计时、纪念日面板 | 各自拥有计时器，使用所属 Window，卸载清理；相册刷新保留当前图片 |
| 快捷入口、最近文档、横幅 | `notes/QuickActionsPanel`、`ui/RecentDocsPanel`、`banner/BannerStatsPanel`、`BannerQuotePanel` | 快捷按钮拖动排序、文档打开、统计与语录轮播 |
| 阅读、音乐、习惯 | `reading`、`music`、`habit` 下的面板 | 独立服务订阅、共享数据更新、列表/输入稳定、阅读弹窗和悬浮计时器、习惯统计 |
| 记账 | `expense/ExpensePanel`、`ExpenseStatsPanel`、`ExpenseLedgerPanel`、`ExpenseCharts` | 分类/周期统计、SVG 图表、账本筛选排序、分页、编辑/批量删除、CSV 导入导出、更新保留选择与滚动 |
| 番茄钟 | `pomodoro/PomodoroPanel`、`PomodoroStatsPanel`、`PomodoroTagsPanel`、`PomodoroMiniPanel` | 计时/休息、标签管理、目标、热力图、时间线、日期下钻；年趋势按月展示，活动筛选覆盖各时间范围 |

表中路径均相对于 `src/view/dashboard`，组件文件使用 `.tsx`。保留的原生配置弹窗不属于未迁移的业务面板。

## 已完成的基础拆分

- 插件设置总模型归 `plugin/settings/model.ts`；看板设置不再声明整个插件的模块、语言、档案、编辑器、终端配置。
- 自动化和通知核心接受存储/投递端口；Notice 与系统通知归平台适配器。图标管理器通过注入的对话框契约请求界面。
- TerminalService 持有原生 PtySession、UTF-8 解码和 headless VT 缓冲。浏览器 xterm 由 TerminalRenderers 按需创建，通过 SerializeAddon 接回现有画面。无界面自动化不需要叶子；关闭叶子不会销毁会话。
- `DashboardRenderContext` 隔离各看板的根、图表、拖动状态、扫描签名及打开/预览能力。服务、日历/DQL 缓存、文件名索引按 App 隔离。
- 阅读和番茄钟支持多个 tick/data 订阅者。面板自身订阅并局部更新，原生父视图不再因服务更新而替换整个部件。
- 档案、习惯、记账的应用规则与持久化协调归 core；Vault、焦点事件和宿主能力归 platform。档案保留写冲突检测、关系校验、串行保存与加载版本保护。
- 修复 xterm onBinary 字节串处理；修复异步 Markdown、查询重载和视频来源替换的资源/状态竞态。
- 提醒选择器改为所属文档内的 Preact portal。确认/输入对话框保留原生 DOM，并通过 Obsidian Scope 隔离 Escape；主题取自目标文档，关闭清理监听和延迟焦点。

## 实际参考的实现

ORCA 研究固定在提交 `27b823f934f739bc85914dd717b776835f60bcf7`：

- [AppWorkspaceShell](https://github.com/stablyai/orca/blob/27b823f934f739bc85914dd717b776835f60bcf7/src/renderer/src/app-shell/AppWorkspaceShell.tsx)：工作台组合功能面板。
- [agent-status-store](https://github.com/stablyai/orca/blob/27b823f934f739bc85914dd717b776835f60bcf7/docs/reference/agent-status-store.md)：原生事件与智能体状态分工。
- [TerminalSessionTeardown](https://github.com/stablyai/orca/blob/27b823f934f739bc85914dd717b776835f60bcf7/src/main/daemon/terminal-session-teardown.ts)、[useTerminalParkingFoundation](https://github.com/stablyai/orca/blob/27b823f934f739bc85914dd717b776835f60bcf7/src/renderer/src/components/use-terminal-parking-foundation.ts)：进程销毁与界面保留分别管理。
- [obsidian-preact-template](https://github.com/community-archive/obsidian-preact-template/blob/main/src/index.ts)：Plugin 注册 ItemView，由原生叶子承载 Preact。
- [VS Code Source Code Organization](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)：通用逻辑与平台适配边界。

ORCA 是桌面软件，NAND 是进程内插件，因此只采用上述职责与组合方式，没有照搬 main/preload/renderer 进程拓扑。

## 验证与边界

本轮生产构建通过，`main.js` 已重建；lint 为 0 错误、157 警告。全部 49 个测试入口通过，其中终端 186 项、自动化 23 项、档案 20 项、图标 8 项。发现沙箱对子进程返回 EPERM 后，已在沙箱外重新执行完整测试集并核对实际断言输出，未采用此前只有文件级通过的汇总。

当前可复核的命令结果和构建指纹见 [validation.json](architecture-refactor/validation.json)。`test:card-panels` 使用真实 Preact 与 DOM 测试，已加入 CI，覆盖折叠/编辑、拖拽回滚、Markdown 异步竞态、多个订阅者、视频清理、账本与查询状态、原生弹窗的归属清理。其他看板回归同步改为驱动实际组件；测试入口数与断言数量分别记录。

前一阶段在隔离 Obsidian 1.13.7 和 1.12.4 中验证过五种叶子、终端输出恢复、弹出窗口、无界面 PTY、关闭叶子保留会话、卸载清理，以及习惯/倒计时/纪念日。相关 [截图](architecture-refactor/terminal-1.13.7.png) 和 JSON 中的历史 runtime 数据属于当时构建，**不能作为本轮所有看板界面改写后的实机验证**。

本轮没有重新运行完整 Obsidian GUI 验收；Node DOM 测试不能证明真实拖拽手感、窗口布局或视频解码表现。Windows/macOS、移动端真机、完整外部文件监视以及服务商认证后的实时额度仍没有本轮验收证据。前一阶段 Linux 实机测试曾因监听资源不足而在测试进程禁用 fs.watch，该测试补丁没有进入产品。上述是验收覆盖限制，不是仍待迁移的面板清单。
