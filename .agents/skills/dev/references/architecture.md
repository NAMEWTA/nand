# 架构

移动文件、跨区导入、添加命令或重命名任何持久化内容之前先读本文。重构目标以 [02 架构文档](../../../../docs/refor/02-架构文档.md) 和 [00 决策记录](../../../../docs/refor/00-决策记录.md) 为准；历史架构背景可按需查阅[开发文档索引](../../../../speculo/.speculo/specdev/.config/domain-layout.md)。阶段 2 工具链按这些目标更新检查器；React/Preact 并存约定见 [ui 技能](../../ui/SKILL.md)。

## 分区

```
src/app/            插件入口（main.ts）、模块注册表、设置运行时、命令、功能区、
                    工作台叶子与组合（app/workbench）、契约（app/contracts）
src/shell/          React 工作台外壳：图标轨、可选侧栏、页面框、状态栏（用 import() 加载）
src/ui/             设计系统：components（shadcn）、lib（cn）、react（挂载/Portal）、tailwind、styles、fonts
src/theme/          主题样式、Markdown 样式、把它们应用到每个窗口的运行时
src/host/           多个模块共用的 Obsidian 与桌面适配器
src/shared/         工具函数、设置 DSL 与存储、存储辅助、i18n 运行时与启动词典
src/types/          环境类型声明
src/modules/<id>/   home | agent | browser | archives | automations | notifications | icons | comments | sync
  manifest.ts       纯数据描述，启动时加载
  api.ts            其他模块可导入的类型和 serviceKey()/contributionPoint() 常量
  module.ts         懒加载入口：创建 ModuleInstance
  settings.ts       模块的设置模式
  i18n.ts           模块的文案
  core/             模型、解析、调度、纯规则（不用宿主包）
  platform/         Obsidian 与库的读写；platform/desktop/ 放 Node 与 Electron 代码
  services/         模块业务装配、zustand/vanilla 仓库
  contrib/          对其他模块贡献点的贡献
  ui/               页面、面板、设置页、对话框
  styles/           模块的 CSS（列在 src/styles.json）
native/pty-server/  Rust 终端辅助程序（stdio 帧）
test/               共用样本与跨模块测试（用户格式黄金样本）
```

## 导入矩阵

由 `scripts/verify-architecture.mjs`（`pnpm test:architecture`）检查，覆盖值导入和类型导入，在 TypeScript 擦除之后检查，包括字面量 `import()` 与运行时循环。没有基线：任何违规都会失败。

`src/app/contracts/` 可被除 `shared` 和 `host` 之外的所有区导入；下表省略了它。

| 来自 | 可以导入 |
|---|---|
| `shared` | `shared` |
| `host` | `shared`、`host` |
| `theme` | `shared`、`theme` |
| `ui` | `shared`、`theme`、`ui`；React / React DOM、Radix 等允许的 UI 生态包 |
| `shell` | `shared`、`theme`、`ui`、`shell`、`host`；允许的 React UI 生态包 |
| `app` | `shared`、`host`、`theme`、`ui`、`app`；模块的 `manifest.ts`、`api.ts`、`settings.ts`；`shell` 和模块的 `module.ts` 只能通过 `import()` |
| 模块 `core` | 自己的 `core` 和 `api.ts`、`shared`、其他模块的 `api.ts` |
| 模块 `platform` | 自己的 `core`、`platform`、`api.ts`；`shared`、`host`；其他模块的 `api.ts` |
| 模块 `services` | 自己的 `core`、`platform`、`services`、`contrib`、`api.ts`、`settings.ts`、`i18n.ts`；`shared`、`host`、`theme`；其他模块的 `api.ts`；`zustand/vanilla`（不含 React 绑定） |
| 模块 `contrib` | 自己的 `core`、`platform`、`contrib`、`api.ts`；`shared`、`host`；其他模块的 `api.ts` |
| 模块 `ui` | 整个模块（除 `module.ts` 和 `manifest.ts`）；`shared`、`host`、`theme`、`ui`、`shell`；其他模块的 `api.ts`；允许的 React UI 生态包（含 zustand 的 React 订阅） |
| `module.ts` | 自己的 `core`、`platform`、`services`、`contrib`、`api.ts`、`settings.ts`、`i18n.ts`、`manifest.ts`；`shared`、`host`、`theme`；其他模块的 `api.ts`；自己的 `ui` 只能通过 `import()` |
| `manifest.ts` | 自己的 `api.ts`、其他模块的 `api.ts`；自己的 `module.ts` 只能在 `load()` 里通过 `import()` |
| `api.ts` | 自己的 `core`（类型）、其他模块的 `api.ts`；只导出类型和键常量 |
| `settings.ts` | 自己的 `core`、自己的 `api.ts`；`shared`、`host`、`theme`；其他模块的 `api.ts` |
| `i18n.ts` | 不导入模块代码 |

UI 包允许列表见 [设计系统参考](../../ui/references/design-system.md)。允许服务导入 `zustand/vanilla` 不代表允许 `zustand` 的 React 绑定或 React 组件进入服务、core、shared；跨模块仍只经 `api.ts`。

检查器还强制以下规则：

- `electron`、Node 内置模块和 `window.require(...)` 只能出现在 `desktop/` 文件夹下。core 和 shared 代码不使用任何宿主包（`obsidian`、`electron`、`react`、`react-dom`、`radix-ui`、迁移期 `preact`、`@codemirror/*`、`@xterm/*`），也不使用 `window`、`document`、`navigator`、`process`、`HTMLElement` 这类宿主全局。
- 不要在自己的目录树内部导入包含它的桶文件（`index.ts`）。
- 运行时导入循环（包括经过懒加载导入形成的循环）会失败。

ESLint 另外规定：`desktop/` 文件夹之外不得使用 `process`、`Buffer`、`__dirname`、`__filename`、`global`。

## 启动与懒加载

esbuild 构建一个不拆分代码的 CommonJS `main.js`。只能通过 `import()` 到达的文件被包进懒初始化器，首次导入时才运行；启动代码里只要有一条静态边，就会把它的整个闭包拉进启动集合。因此：

- 启动代码是 `src/app/main.ts` 及它静态导入的内容：注册表、设置运行时、清单、`api.ts` 文件、设置模式、工作台叶子（`app/workbench/workbench-leaf.ts`）、评论叶子、主题运行时和启动词典。
- React、React DOM、Radix 及组件渲染代码不得进入启动集合；`api.ts` 只保留类型和键，不能因声明设置组件或状态段而静态导入 UI。
- 打开工作台叶子时才加载 shell（`import('../../shell/host/workbench-surface')`）。
- 模块代码通过 `manifest.load()` 加载；页面和设置页在首次使用时从 `pages` / `settingsPage` 加载器加载；体积大的库（chart.js、lunar、xterm、图标数据）放在模块内部的第二层 `import()` 之后。
- 说明符必须是字面量。不要依赖导入的副作用来注册任何东西。
- `pnpm run check:bundle` 报告启动集合和每个模块的激活闭包，超出预算（`scripts/bundle-budget.json`）就失败。`--files` 按大小列出每个启动输入。

## 模块系统

`src/app/manifests.ts` 列出所有清单；`ModuleRegistry`（`src/app/modules/registry.ts`）在 `app` 命名空间里的开关打开且平台受支持时创建模块，按清单的 `order` 启用、反向停用，并隔离失败（加载、`activate` 或 `dispose` 抛错的模块进入 `failed`，在图标轨和设置里显示；其他模块继续）。开关的初始值来自清单的 `defaultEnabled`。状态有：`off`、`unsupported`、`idle`、`loading`、`active`、`disposing`、`failed`。重新启用会创建新实例。

模块之间通过以下方式通信：

`agent` 可在移动端激活可移植的技能目录；`module.ts` 在 `context.env.desktop` 为假时止于此处。终端控制器及其 desktop 依赖只在桌面分支动态加载，终端页面仍由工作台的桌面可用性守卫限制。消费者不要把目录可用误当成终端或派发服务可用。

- **服务**（所有者 `api.ts` 里的 `ServiceKey<T>`）：`peek` 只在所有者处于激活状态时返回值，从不激活它；`acquire` 激活所有者并返回租约，所有者停止时租约的 `revoked` 信号中止；`watch` 跟随可用性变化。
- **贡献点**（`ContributionPoint<T>`）：例如首页和档案贡献的自动化来源，自动化贡献的通知打开器。

契约是 `src/app/contracts/module.ts`；怎样编写模块见 `module-authoring.md`。

## 工作台

只有一个工作台视图（`app/workbench/workbench-leaf.ts` 里的 `WORKBENCH_VIEW_TYPE`）。叶子保存自己的状态，打开时加载 shell 表面。`app/workbench/compose-workbench.ts` 声明图标轨条目（功能、图标、面板、可用性），并通过 `plugin.activateModule(id)` 和 `ModuleInstance.pages` 把每个功能对应到模块页面。功能及其所属模块是 `app/contracts/workbench.ts` 里的 `WORKBENCH_FEATURES` / `FEATURE_MODULES`。目标功能列表为 `dashboard`、`terminal`、`contacts`、`automations`、`notifications`、`icons`、`sync`、`content`、`settings`。`terminal` 属于 `agent`，显示名称为「智能体」；`contacts` 属于 `archives`。`browser` 保留为引擎模块，通过 `BROWSER_HOST` 给智能体标签提供能力；批注使用右侧栏视图，记录使用看板弹窗，不再贡献独立工作台功能。shell 的 `chrome`、可选侧栏和状态栏行为见 [ui shell 参考](../../ui/references/shell.md)。

评论侧栏（`app/workbench/comments-leaf.ts`）是唯一的另一种视图；布局就绪后按设置用 `workspace.ensureSideLeaf()` 放入右侧栏，挂载评论模块的 React 面板，停用时保留「开启模块」的提示状态。

## 命令

| 种类 | 位置 |
|---|---|
| shell 命令（打开工作台、打开某个模块的页面、切换主题样式、复制引用） | `src/app/commands.ts`、`src/app/copy-commands.ts`；模块的命令用 `checkCallback` 判断 `plugin.moduleState(id) === 'active'` |
| 模块命令 | 在模块内部用 `context.commands.add(...)`（停用时自动移除）；传入 `nameKey` 让名称跟随语言 |
| 其他模块必须写出的 id | `src/shared/commands.ts` 里的 `NAND_COMMANDS` |

id 不带插件 id 前缀；名称里不写「命令」二字；没有默认快捷键。

## 状态管理

- `services/` 用 `zustand/vanilla` 的 `createStore` 创建模块仓库，随模块停止订阅与持久化；状态变换放在 `core/` 的纯函数中。
- 同模块 `ui/` 用 `useStore(store, selector)` 只读订阅并调用服务动作，不直接 `setState` 或读写磁盘。选择器返回稳定引用；数组/对象用 `useShallow` 或稳定空值。
- 跨模块服务只暴露只读快照和 `subscribe`，不把仓库对象传到其他模块。
- 业务仓库落盘用现有 `shared/json-store.ts`，防抖 500ms；失败经 `report()` 告知并保留内存状态。设置继续使用设置存储，临时 UI 状态可用组件 `useState`。

## 持久化名称

全部 NAND 数据以当前 vault/.nand 为唯一根，目标清单对齐 [02 架构文档 §13](../../../../docs/refor/02-架构文档.md)。D01 允许本次重构改变格式，不写旧格式迁移；不能读取的旧文件留在磁盘上，不作为新写入回退。

| 数据 | 位置 | 负责方 |
|---|---|---|
| 设置（整库） | `.nand/config/settings.json`（`{ version: 1, namespaces: { app, theme, home, agent, browser, automations, comments, … } }`） | app |
| 设置（本机） | `.nand/config/devices/<device-id>.json` | app |
| 快捷命令 | 设置命名空间 `agent.quickCommands` | agent |
| 设备 id | `.nand/config/identity.json`，库内设备映射与宿主只读身份 | host |
| 智能体工作区布局 | `.nand/terminal-agent/<device-id>/workspace.json`（标签组、标签、浏览器地址） | agent |
| 智能体统计 | `.nand/terminal-agent/<device-id>/stats.json` | agent |
| 智能体历史与缓存 | `.nand/terminal-agent/<device-id>/history.json`、`automation-sessions.json`、可重建的 `index.sqlite` | agent |
| 智能体账号与运行文件 | `.nand/agents/<device-id>/accounts/<provider>/<id>/`；生命周期 Hook、配置与事件在账号内的 `runtime/` | agent |
| 终端辅助程序 | `.nand/helpers/<device-id>/<platform-arch>/<version>/`，官方摘要与本机受保护回执 | agent |
| 浏览器 Profile 列表 | `.nand/browser/<device-id>/profiles.json` | browser |
| 浏览器会话与下载 | `.nand/browser/<device-id>/profiles/<id>/session/`、`.nand/browser/<device-id>/profiles/<id>/downloads/` | browser |
| 浏览历史与站点权限 | `.nand/browser/<device-id>/state.json` | browser |
| Cookie 导入临时快照 | `.nand/browser/<device-id>/tmp/`，导入后立即删除 | browser |
| 自动化定义 | `.nand/content/NAND/自动化/<名称>-<id>/操作.md` | automations |
| 自动化运行 | `.nand/automation/<device-id>/runtime.json` | automations |
| 批注 | `.nand/editor/comments/`（`index.json`、`pending.json`、`files/<hash>.json`，version 2） | comments；细则见 [编辑器批注](editor-comments.md) |
| 看板 | `.nand/content/` 内 Markdown，默认 `.nand/content/dashboard.md`，采用 apex 格式，可多份 | home |
| 看板记录 | `.nand/content/NAND/习惯/`、`记账/`、`番茄钟/`、`阅读/` | home |
| 图标与规则 | `.nand/icons/iconic.json` + `.backupN`（Iconic 模式） | icons |
| 通知 | `.nand/notifications/<device-id>/inbox.json` | notifications |
| Git 同步设备状态 | `.nand/sync/<device-id>/<repository-hash>.json` | sync |
| 恢复草稿与看板冲突 | `.nand/recovery/drafts/`、`.nand/recovery/dashboard/conflicts/` | 共享存储、home |
| 缓存 | `.nand/cache/`（微信读书进度） | home |
| 档案 | `.nand/content/` 内文件夹，默认 `档案/个人档案/<姓名>/基本信息.md`、`档案/企业档案/<名称>/基本信息.md` | archives |
| 库本地界面状态 | `.nand/config/` 下的内部状态；叶子状态由宿主保存，业务工作区布局使用上表专用文件 | 所属模块 / shell |
| 功能区 id | `src/app/ribbon.ts` 的 `ribbon-<id>`（稳定 id，标签翻译） | app |

普通笔记、宿主数据、Git 元数据保留原位；已删除功能的旧数据不由插件清理。Obsidian Sync 不同步点开头的文件夹，`.nand/` 需要 Git、iCloud、Syncthing 等。

## TypeScript

`strict`、`noUncheckedIndexedAccess`、`noImplicitReturns`、`useUnknownInCatchVariables`，目标 ES2021。未处理的 Promise 是错误（有意不等待时用 `void`）。不要在 Promise 回调里返回 Obsidian 的链式控件（`nand/no-obsidian-thenable`）。文件和文件夹用 kebab-case；React 业务组件文件用 PascalCase（复制的 shadcn 组件保留上游 kebab-case）；其他文件导入的常量（视图类型、键）用 `SCREAMING_SNAKE`。只用相对路径导入。
