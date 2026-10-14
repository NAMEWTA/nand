# 编写模块

模块是有自己生命周期的懒加载功能。契约是 `src/app/contracts/module.ts`；`src/modules/notifications/` 是最小的完整示例，`src/modules/comments/` 展示编辑器集成，`src/modules/sync/` 是默认关闭的桌面专属模块，`src/modules/home/` 是大型模块。

## 文件

| 文件 | 内容 | 加载时机 |
|---|---|---|
| `manifest.ts` | `ModuleManifest`：id、order、图标、标题与描述的键、平台、`defaultEnabled`、激活方式、提供和贡献的点、`load: () => import('./module')` | 启动时（只放数据） |
| `api.ts` | 其他模块可以使用的类型，以及 `serviceKey()` / `contributionPoint()` 常量 | 启动时（只放类型和键） |
| `module.ts` | `export default function create<Name>Module(context): ModuleInstance` | 模块启用时 |
| `settings.ts` | 命名空间的模式（`defineSettings` 或 `domainSettings`） | `app` 绑定它时在启动时，否则随模块 |
| `i18n.ts` | `export const messages = { en: {…}, zh: {…} }` | 随 `module.ts` |
| `core/`、`platform/`、`services/`、`contrib/`、`ui/`、`styles/` | 见 `architecture.md` 的分区表 | 随模块或更晚 |

值得了解的清单字段：

- `platforms`：`{ desktop, mobile }`。需要 Node 或 Electron 的功能设 `mobile: false`。不受支持的模块状态是 `unsupported`，永不加载。
- `defaultEnabled`：`app` 命名空间里模块开关的初始值。会启动进程或联系远端的模块（同步）用 `false`。
- `activation`：`startup`（插件加载期间；失败只把这个模块标为失败）、`layout-ready`（工作区布局就绪之后）或 `on-demand`（页面、命令或服务第一次需要它时）。

## 添加模块

1. 把 id 加入 `ModuleId` 和 `MODULE_IDS`（`src/app/contracts/module.ts`）。`app` 命名空间里的模块开关由这个列表生成（`src/app/settings/app-schema.ts`）。
2. 编写 `manifest.ts`，并加入 `MANIFESTS`（`src/app/manifests.ts`）。`order` 决定启用顺序（停用时反向）。
3. 编写 `module.ts`。在文件顶部调用 `registerMessages(messages)`（以及它读取的 `shared/i18n/lazy/*` 词典）。工厂函数可以做轻量准备；读写和监听器放进 `activate()`。返回：
   - `services` / `contributions`，形式为 `[key, value]` 对（值只在 `activate()` 之后才存在时可以用 getter），
   - `pages`：`{ <page>: async () => (await import('./ui/<page>-page')).create…(…) }`，
   - `settingsPage`：懒加载并返回 React 设置组件（见下文），
   - `activate(signal)` 和 `dispose(reason)`（`'disabled' | 'unload'`）。
4. 使用 context 而不是插件实例：
   - 设置用 `context.settings.bind(name, schema)`（见 `settings-and-i18n.md`），
   - 必须随模块结束的东西用 `context.lifetime`（`registerEvent`、`registerDomEvent`、`register`），
   - 命令面板命令用 `context.commands.add({ id, name, nameKey, … })`，
   - 编辑器功能用 `context.editor.addExtension(…)` / `addPostProcessor(…)`，
   - 与其他模块交互用 `context.services`（`peek`、`acquire`、`watch`）和 `context.contributions`，
   - 显示工作台页面用 `context.shell.open(target)`，图标轨或面板显示的状态变化后调用 `context.shell.refresh()`，
   - 平台选择用 `context.env`（`desktop`、`mobile`、`phone`）。
5. 把 `i18n.ts` 加入 `scripts/module-strings.ts`，让测试和验证脚本看得到这些文案。
6. 把模块的 CSS 放在 `styles/` 下，在 `src/styles.json` 里列出每个文件，按 [构建参考](build-and-release.md) 重建样式。新界面优先使用 Tailwind；必要的作者 CSS 限定在模块根类下（见 ui 技能）。
7. 在 `scripts/bundle-budget.json` 的 `moduleActivationBytes` 下为它的激活闭包添加预算。

## 工作台页面

1. 在 `src/app/contracts/workbench.ts` 的 `WORKBENCH_FEATURES` / `FEATURE_MODULES` 注册功能与所属模块；分区加入 `src/shell/navigation-state.ts` 的允许列表。功能列表见 [架构参考](architecture.md)，浏览器标签、批注和看板记录不注册为独立工作台功能。
2. 在 `src/app/workbench/compose-workbench.ts` 声明贡献：图标轨位置、导航、`availability`、`stateKeys` 和 `create: modulePage('<module>', '<page>')`。`chrome?: PageChrome` 默认为 `'standard'`，首页、智能体工作区、自动化用 `'none'`。
3. `panel?: (context: PanelContext) => PanelModel | undefined` 是可选的；既不提供 `panel`、也不声明自定义 `navigationContext` 时，没有 shell 侧栏。首页和自动化不提供侧栏；智能体页面用 `createPortal` 渲染到 `context.navigationEl`。
4. `ui/` 的页面加载器返回 `PageCreate`：接收表面上下文、目标、已保存状态、中止信号，返回 `{ surface, navigate, getTarget?, getState?, restore? }`。`surface` 使用 `src/ui/react/surface.tsx` 的 `ReactSurface`，继承 `NativeSurface`；每页一个 React 根，隐藏保留、关闭卸载，`NandProviders` 处理所属文档、Portal、语言和错误边界。
5. `'none'` 页面自备标题或身份、`context.openPageMenu(event)` 菜单，以及需要时的 `context.togglePanel()` 导航开关；专注模式仍提供返回完整工作台的入口。详细 UI 合同见 [shell 参考](../../ui/references/shell.md)。
6. 面板、标题、状态从 `api.ts` 服务取只读快照（如 `HOME_WORKBENCH`、`AGENT_WORKBENCH`、`SYNC_WORKBENCH`），compose-workbench 通过 `watch` 更新；可选能力用 `peek`，不因显示状态启动模块。
7. 贡献可提供 `statusSegments?: () => readonly StatusSegment[]`。段包含 `id/icon/label/order`，可选 `tone: 'neutral' | 'running' | 'attention' | 'error'`、`count`、`target`；`label` 是翻译后的文案。用量不是普通段，shell 从 `AGENT_USAGE` 单独读取。

浏览器引擎在 `browser/api.ts` 暴露 `BROWSER_HOST`，由智能体工作区创建、挂载浏览器标签；页面宿主、Profile、Cookie 导入、下载、查找和权限仍归 browser。Design Mode 的元素与截图材料通过进程内服务附加到智能体输入框。

## 设置页

目标接口由 `settingsPage` 懒加载并返回 React 组件，例如 `settingsPage: () => import('./ui/settings/XxxSettings').then(m => m.default)`。在工作台设置导航中注册分类（`src/app/settings/nav.ts` 与 `src/app/workbench/settings-categories.ts`）；页面使用 `SettingsSection` / `SettingsRow` / `SettingsSwitchRow`，通过设置句柄读取和更新值。Obsidian 设置页 `src/app/settings/entry-tab.ts` 仅保留打开工作台设置的入口按钮。

迁移期宿主仍支持旧 `(container, host) => void` 渲染函数，由 React 包装容器挂载：`host.refresh()` 重绘，`host.keep(off)` 绑定显示期间订阅；阶段 9 删除旧路径。新设置只写 React，组件订阅在卸载时清理。宿主在隐藏、关闭、重绘或模块停用时释放旧宿主资源；停用后退出对应分类，不因无关模块变化丢失草稿，异步结果必须检查是否失效。

状态仓库放在 `services/`，变换放 `core/`，组件只订阅并调用动作；具体边界见 [架构参考](architecture.md)。

## 与其他模块交互

- 需要另一个模块的能力：从它的 `api.ts` 导入键；功能可选且不应因此开启对方时用 `peek`（状态、面板数据），用户主动要求时用 `acquire`（租约的 `revoked` 信号告诉你所有者已停止）。
- 提供能力：把接口和键放进自己的 `api.ts`，在 `services` 里返回值，并在清单的 `provides` 里列出键。
- 让别人接入：在自己的 `api.ts` 里声明 `contributionPoint`；贡献者在 `contributions` 里返回 `[point, value]`，并在 `contributes` 下列出。用 `context.contributions.collect(point)` 收集。
- 永远不要导入另一个模块的内部实现，也不要去碰插件实例。

首页组件通过 `home/api.ts` 的 `HOME_WIDGETS` 贡献，一个模块只贡献一个 `{ kinds }` bundle。类型在提供方内唯一，首页用 `(provider, kind.key)` 索引；不同模块可同名。`instances()` 返回提供方现有配置的稳定引用，成员顺序与 `memberId/provider/kind/instanceId` 存在各看板 Markdown 中。删除成员不删除实例，缺席的提供方或实例仍显示占位。

实例增删、改名或配置改变时，bundle 可通过 `subscribeInstances(listener)` 通知首页刷新目录与已挂载成员；内容列表的普通更新由提供方自己的视图订阅处理。首页在贡献替换或停用时释放实例订阅，通知不会改写看板成员或启动提供方。

`module.ts` 注入懒加载的 `render(host, context)`；`contrib/` 不导入 UI。挂载上下文包含所属窗口、文档、看板与成员标识，以及 `signal/register/reportError`。资源创建后立即 `register`，异步挂载完成后也须检查 `signal`；返回的清理函数和已注册的同一函数只执行一次。异步更新错误交给 `reportError`，React 视图使用 `ErrorBoundary` 隔离渲染错误。收集组件时使用 `{ activate: false }` 并监听贡献变化，不因显示占位启动其他模块。

## 生命周期检查清单

智能体技能派发通过 `agent/api.ts` 的 `AGENT_DISPATCH`（只 `peek`）调用，`AgentDispatchRequest` 带稳定 `invocationId/source/agentId/destination/finalPrompt/files`，返回 `started/pasted/timeout/rejected` 交付回执。`AUTOMATION_INVOCATIONS` 复用自动化的运行存储，先保存快照再执行，相同 ID 和负载返回同一回执。fresh 走既有 `AgentRuntimePort.start`；existing 走 `AGENT_SESSIONS.attachMaterial`，验证所选智能体与运行中的交互会话，仅粘贴一次、不加 Enter、不归调用方拥有。页面取消释放等待资源，不把交付回执当作模型完成，也不擅自结束已接受任务。模板用纯 `shared/agent-prompt.ts` 单次替换；确认后提交用户编辑的最终文本，不重新套模板。看板按钮声明保存在 `skills` YAML，组件挂载仍受 `HomeWidgetContext` 生命周期约束。

技能目录使用公共 `AGENT_SKILLS`（只 `peek`），`list(agentId, signal)` 仅在选择器打开或显式刷新时调用。`remember` 必须在按钮保存成功后调用，取消草稿不记忆；`forget` 只删名称记忆。名称只来自 `SKILL.md` frontmatter 或目录名，合并时保留来源；DataAdapter 返回完整库内路径，不再拼接根目录。`agent` 设备设置的 `knownSkills` 按智能体隔离，`skillDirectories` 为空时零库外扫描，额外目录和 `~` 只由 desktop 适配器处理。移动端的 agent 激活仅提供此目录，不导入终端控制器、不发布终端/派发服务。显式调用能力来自 `shared/agent-skill-capabilities.ts`，文档证据见用户指南，未知能力只允许无技能名的普通提示词。

- [ ] `dispose()` 释放计时器、监听器、进程、叶子之外的 DOM 和 body 类名；`dispose('unload')` 不向用户弹出提示
- [ ] 命令和编辑器扩展都通过 `context.commands` / `context.editor`
- [ ] 在运行的库里关闭再开启模块可用（探针和模块自己的测试覆盖它）
- [ ] 启动集合不变（`pnpm run check:bundle`），架构检查通过
