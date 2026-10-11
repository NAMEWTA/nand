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
   - `settingsPage`：`async () => (await import('./ui/settings-page')).…`，
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
6. 把模块的 CSS 放在 `styles/` 下，在 `src/styles.json` 里列出每个文件，然后运行 `node scripts/build-styles.mjs --write`。选择器限定在模块自己的类名前缀下（见 ui 技能）。
7. 在 `scripts/bundle-budget.json` 的 `moduleActivationBytes` 下为它的激活闭包添加预算。

## 工作台页面

1. 把功能 id 加入 `WORKBENCH_FEATURES`，把它的所属模块加入 `FEATURE_MODULES`（`src/app/contracts/workbench.ts`）；如果有分区，还要加到 `src/shell/navigation-state.ts` 的 `sections`。
2. 在 `src/app/workbench/compose-workbench.ts` 里添加一个贡献：图标轨位置、导航（标签键、图标、子分区）、`panel`（来自模块提供的服务，用 `peek` 读取）、`availability`（是否启用、是否受支持、是否就绪）、`stateKeys`（页面可以保存在叶子里的内容），以及 `create: modulePage('<module>', '<page>')`。
3. 在 `ui/<page>-page.ts` 里实现页面加载器。它返回 `PageCreate`：给定原生表面上下文、目标、已保存状态和中止信号，返回 `{ surface, navigate, getTarget?, getState?, restore? }`。表面是 `NativeSurface` 的子类。渲染规则属于 ui 技能。
4. 如果面板或标题要读取模块状态，通过 `api.ts` 里的服务暴露（例如 `HOME_WORKBENCH`、`AGENT_WORKBENCH`、`SYNC_WORKBENCH`），并让 compose-workbench `watch` 它，这样服务出现、变化或消失时 shell 会刷新。

浏览器的 `BROWSER_WORKSPACE` 服务在普通浏览启动时不读取任务文件；首次任务动作或页面调用 `initialize` 才加载本地 Markdown 和设备日志。`multi-ai` 使用任务自己的资源 ID，普通网页才由 shell 自动分配 ID；贡献的 `resourceTabs(target)` 区分这两种行为。任务页面不因恢复或渲染而打开官网，显式打开的 guest 仍归 BrowserModule 管理。暂停包括正在写入轮次文档、尚未进入发送器的操作。

浏览器任务与控制 API、桥接命令共享 `PageOwnership`：任务按 page/profile/generation 持有执行权，普通控制命令继续使用既有同页串行队列；只读观察不夺焦点。暂停或人工接管撤销旧操作的 admission，晚到的已知提交回执仍保留。预检逐一读取已选目标；仅就绪预览冻结子集，不改任务的发送集合；恢复动作重新观察，不自动重发。目标增删只改变当前绑定，旧轮次和答案快照保留。

任务的重采集只读取已确认回执对应的答案，保留所有采集版本；最新不完整版本不会被旧完整版本替代。单站重发通过 `previewRetry` 冻结原轮次提示词、当前绑定和最后一次尝试，再由 `retrySend` 消费一次预览并写入新的发送意图。未知尝试保留，已接受提交不能走此重发入口；保存重试只处理本地证据。

答案比较按同轮 exchange/capture ID 固定 2–3 个版本，重采集不替换已选内容；旧版本明确标记。`followUp` 只选择原账号、原会话的一个目标并保留草稿，不派发输入；后续仍经过普通预览和发送合同。采集来源、版本和消息身份可查看，未核实的模型名称不推断。

手选片段保存在 exchange 的独立 `selections` 中，始终不完整，并保留原页面、账号、实例和选区边界；比较和可选综合按明确的片段 ID 读取，不能改写 `currentCaptureId`。用户适配规则在工作区的 `适配规则/` 下用可见 Markdown 保存；有限 CSS 选择器交给固定的只读 DOM 程序，不能提供脚本。候选规则只在 `UserAdapters` 的本次验证任务里可用；提交复用 `WorkspaceSender` 的落盘意图和原生页面占用。单次发送、当前答案再次核对和启用分别执行，编辑作废验证，撤回立即阻止旧调用。任务绑定和预览保存适配规则版本，规则切换要求重新检查目标。

答案逐站采集、逐站保存，已启动的采集全部收尾。可见文档写入失败后，新观察仍通过 `DurableState.preserveDraft` 更新本次运行的恢复草稿；不因此重试发送。工作台恢复目录按设备与文件夹固定定位，位于 `.nand/recovery/drafts/`；各次运行用独立文件，重启写入失败不覆盖先前快照。用户明确选择快照，草稿和当前文档经验证、预览与三方合并；派生的重启状态不阻碍已收答案恢复。读取本地答案不依赖有效发送日志，恢复不创建 provider session。

浏览器流程由 `BrowserWorkflows` 执行有限类型步骤，复用 `ScopedBrowserExecutor`、页面占用和原生输入队列；填写的预期当前值必须在队列派发前再次核对。页面元素定位使用快照中的唯一角色与名称，重复元素不能通过显示序号变成唯一匹配。模板及运行步骤分别保存在工作区 `流程/`、`流程/运行/` 的可见 Markdown；声明秘密变量时不持久化 DOM 证据、观察值或结果正文。暂停释放页面占用；恢复未知动作只检查后置结果，不重放。

`automations/api.ts` 的 `AUTOMATION_WORKFLOW_RUNNERS` 接受 browser 的可撤销贡献，`AUTOMATION_WORKFLOW_INVOCATIONS` 提供持久调用、回执、取消和打开结果；收集不得激活缺席模块。共享 `browser-workflow` 动作只保存 workflowId/version、公开变量和明确 pageId/profileId 范围。自动化拥有唯一 runId、调度与运行日志，非终态 handle 的 completion 决定完成状态；browser 仅保存步骤文档，不建立第二套调度器。手动核对授权及秘密值只在内存传递；后台动作不能绕过原生最终确认。关闭所有者取消运行，关闭 browser 中断运行，重启不重放。

本地外接由 `BROWSER_EXTERNAL_ACCESS` 服务及现有 shell 的 `browser/access` 页面提供，`BrowserGrants` 只在内存保存限定任务、page/profile/generation、操作、期限和符号化结果。打开管理页不启动 bridge，明确创建授权后才使用既有本地 IPC。连接环境只返回一次，任务通过 `NAND_BROWSER_TASK` 绑定；传输注册表以 SHA-256 token hash 索引，到期计时器撤回等待中的操作。外接复用 `ScopedBrowserExecutor`、`PageOwnership` 和原生队列，填写必须带 `expectedValue`，提交能力仍经原页面最终确认。接管页面撤回该页全部外接授权；关闭模块清理授权和连接，重启不恢复。

原有全局 `agentAccess` 开关独立于限定授权，关闭立即使旧凭据和排队输入失效，再启用轮换凭据。bridge 和生成 CLI 的错误只返回符号化 code/reason/retryAction，不传原生异常正文；不得将授权令牌、DOM 正文或确认内容写入授权事件历史。普通终端仍用 `withoutBrowserEnvironment` 清理全部 `NAND_BROWSER_*` 变量。

## 设置页

`settingsPage` 返回渲染函数 `(container, host) => void`；`host.refresh()` 重绘，`host.keep(off)` 在页面显示期间保持一个订阅。要把它列进工作台设置，把产品加入 `src/app/settings/nav.ts`（`SettingsProduct`、`ORDER`、`ModuleGates`、`PRODUCT_MODULES`），把它的标签和图标加入 `src/app/workbench/settings-categories.ts`。使用绑定到设置句柄的原生 `Setting` 行；Obsidian 设置页只放入口行（`src/app/settings/entry-tab.ts`）。

设置宿主在页面隐藏、关闭、重绘或所属模块停用时释放 `host.keep`；停用后退出该模块的设置分类。宿主只在当前模块的渲染入口变化时重新加载，其他模块的状态变化不应清空正在编辑的草稿。异步渲染和版本计算仍需忽略已经失效的结果。

## 与其他模块交互

- 需要另一个模块的能力：从它的 `api.ts` 导入键；功能可选且不应因此开启对方时用 `peek`（状态、面板数据），用户主动要求时用 `acquire`（租约的 `revoked` 信号告诉你所有者已停止）。
- 提供能力：把接口和键放进自己的 `api.ts`，在 `services` 里返回值，并在清单的 `provides` 里列出键。
- 让别人接入：在自己的 `api.ts` 里声明 `contributionPoint`；贡献者在 `contributions` 里返回 `[point, value]`，并在 `contributes` 下列出。用 `context.contributions.collect(point)` 收集。
- 永远不要导入另一个模块的内部实现，也不要去碰插件实例。

首页组件通过 `home/api.ts` 的 `HOME_WIDGETS` 贡献，一个模块只贡献一个 `{ kinds }` bundle。类型在提供方内唯一，首页用 `(provider, kind.key)` 索引；不同模块可同名。`instances()` 返回提供方现有配置的稳定引用，成员顺序与 `memberId/provider/kind/instanceId` 存在各看板 Markdown 中。删除成员不删除实例，缺席的提供方或实例仍显示占位。

实例增删、改名或配置改变时，bundle 可通过 `subscribeInstances(listener)` 通知首页刷新目录与已挂载成员；内容列表的普通更新由提供方自己的视图订阅处理。首页在贡献替换或停用时释放实例订阅，通知不会改写看板成员或启动提供方。

`module.ts` 注入懒加载的 `render(host, context)`；`contrib/` 不导入 UI。挂载上下文包含所属窗口、文档、看板与成员标识，以及 `signal/register/reportError`。资源创建后立即 `register`，异步挂载完成后也须检查 `signal`；返回的清理函数和已注册的同一函数只执行一次。异步更新错误交给 `reportError`，Preact 视图使用 `RenderBoundary` 隔离渲染错误。收集组件时使用 `{ activate: false }` 并监听贡献变化，不因显示占位启动其他模块。

## 生命周期检查清单

智能体技能派发通过 `agent/api.ts` 的 `AGENT_DISPATCH`（只 `peek`）调用，`AgentDispatchRequest` 带稳定 `invocationId/source/agentId/destination/finalPrompt/files`，返回 `started/pasted/timeout/rejected` 交付回执。`AUTOMATION_INVOCATIONS` 复用自动化的运行存储，先保存快照再执行，相同 ID 和负载返回同一回执。fresh 走既有 `AgentRuntimePort.start`；existing 走 `AGENT_SESSIONS.attachMaterial`，验证所选智能体与运行中的交互会话，仅粘贴一次、不加 Enter、不归调用方拥有。页面取消释放等待资源，不把交付回执当作模型完成，也不擅自结束已接受任务。模板用纯 `shared/agent-prompt.ts` 单次替换；确认后提交用户编辑的最终文本，不重新套模板。看板按钮声明保存在 `skills` YAML，组件挂载仍受 `HomeWidgetContext` 生命周期约束。

技能目录使用公共 `AGENT_SKILLS`（只 `peek`），`list(agentId, signal)` 仅在选择器打开或显式刷新时调用。`remember` 必须在按钮保存成功后调用，取消草稿不记忆；`forget` 只删名称记忆。名称只来自 `SKILL.md` frontmatter 或目录名，合并时保留来源；DataAdapter 返回完整库内路径，不再拼接根目录。`agent` 设备设置的 `knownSkills` 按智能体隔离，`skillDirectories` 为空时零库外扫描，额外目录和 `~` 只由 desktop 适配器处理。移动端的 agent 激活仅提供此目录，不导入终端控制器、不发布终端/派发服务。显式调用能力来自 `shared/agent-skill-capabilities.ts`，文档证据见用户指南，未知能力只允许无技能名的普通提示词。

- [ ] `dispose()` 释放计时器、监听器、进程、叶子之外的 DOM 和 body 类名；`dispose('unload')` 不向用户弹出提示
- [ ] 命令和编辑器扩展都通过 `context.commands` / `context.editor`
- [ ] 在运行的库里关闭再开启模块可用（探针和模块自己的测试覆盖它）
- [ ] 启动集合不变（`pnpm run check:bundle`），架构检查通过
