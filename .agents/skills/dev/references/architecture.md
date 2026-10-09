# 架构

移动文件、跨区导入、添加命令或重命名任何持久化内容之前先读本文。这些规则背后的原因见[开发文档索引](../../../../speculo/.speculo/specdev/.config/domain-layout.ZH.md)里列出的架构决定。

## 分区

```
src/app/            插件入口（main.ts）、模块注册表、设置运行时、命令、功能区、
                    工作台叶子与组合（app/workbench）、契约（app/contracts）
src/shell/          工作台界面：图标轨、侧栏、页头、页面管理（用 import() 加载）
src/ui/             设计系统：令牌、原语、原生 Modal/Menu 封装
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
  services/         模块内部的装配
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
| `ui` | `shared`、`theme`、`ui` |
| `shell` | `shared`、`theme`、`ui`、`shell`、`host` |
| `app` | `shared`、`host`、`theme`、`ui`、`app`；模块的 `manifest.ts`、`api.ts`、`settings.ts`；`shell` 和模块的 `module.ts` 只能通过 `import()` |
| 模块 `core` | 自己的 `core` 和 `api.ts`、`shared`、其他模块的 `api.ts` |
| 模块 `platform` | 自己的 `core`、`platform`、`api.ts`；`shared`、`host`；其他模块的 `api.ts` |
| 模块 `services` | 自己的 `core`、`platform`、`services`、`contrib`、`api.ts`、`settings.ts`、`i18n.ts`；`shared`、`host`、`theme`；其他模块的 `api.ts` |
| 模块 `contrib` | 自己的 `core`、`platform`、`contrib`、`api.ts`；`shared`、`host`；其他模块的 `api.ts` |
| 模块 `ui` | 整个模块（除 `module.ts` 和 `manifest.ts`）；`shared`、`host`、`theme`、`ui`、`shell`；其他模块的 `api.ts` |
| `module.ts` | 自己的 `core`、`platform`、`services`、`contrib`、`api.ts`、`settings.ts`、`i18n.ts`、`manifest.ts`；`shared`、`host`、`theme`；其他模块的 `api.ts`；自己的 `ui` 只能通过 `import()` |
| `manifest.ts` | 自己的 `api.ts`、其他模块的 `api.ts`；自己的 `module.ts` 只能在 `load()` 里通过 `import()` |
| `api.ts` | 自己的 `core`（类型）、其他模块的 `api.ts`；只导出类型和键常量 |
| `settings.ts` | 自己的 `core`、自己的 `api.ts`；`shared`、`host`、`theme`；其他模块的 `api.ts` |
| `i18n.ts` | 不导入模块代码 |

检查器还强制以下规则：

- `electron`、Node 内置模块和 `window.require(...)` 只能出现在 `desktop/` 文件夹下。core 和 shared 代码不使用任何宿主包（`obsidian`、`electron`、`preact`、`react`、`@codemirror/*`、`@xterm/*`），也不使用 `window`、`document`、`navigator`、`process`、`HTMLElement` 这类宿主全局。
- 不要在自己的目录树内部导入包含它的桶文件（`index.ts`）。
- 运行时导入循环（包括经过懒加载导入形成的循环）会失败。

ESLint 另外规定：`desktop/` 文件夹之外不得使用 `process`、`Buffer`、`__dirname`、`__filename`、`global`。

## 启动与懒加载

esbuild 构建一个不拆分代码的 CommonJS `main.js`。只能通过 `import()` 到达的文件被包进懒初始化器，首次导入时才运行；启动代码里只要有一条静态边，就会把它的整个闭包拉进启动集合。因此：

- 启动代码是 `src/app/main.ts` 及它静态导入的内容：注册表、设置运行时、清单、`api.ts` 文件、设置模式、工作台叶子（`app/workbench/workbench-leaf.ts`）、评论叶子、主题运行时和启动词典。
- 打开工作台叶子时才加载 shell（`import('../../shell/host/workbench-surface')`）。
- 模块代码通过 `manifest.load()` 加载；页面和设置页在首次使用时从 `pages` / `settingsPage` 加载器加载；体积大的库（chart.js、lunar、xterm、图标数据）放在模块内部的第二层 `import()` 之后。
- 说明符必须是字面量。不要依赖导入的副作用来注册任何东西。
- `pnpm run check:bundle` 报告启动集合和每个模块的激活闭包，超出预算（`scripts/bundle-budget.json`）就失败。`--files` 按大小列出每个启动输入。

## 模块系统

`src/app/manifests.ts` 列出所有清单；`ModuleRegistry`（`src/app/modules/registry.ts`）在 `app` 命名空间里的开关打开且平台受支持时创建模块，按清单的 `order` 启用、反向停用，并隔离失败（加载、`activate` 或 `dispose` 抛错的模块进入 `failed`，在图标轨和设置里显示；其他模块继续）。开关的初始值来自清单的 `defaultEnabled`。状态有：`off`、`unsupported`、`idle`、`loading`、`active`、`disposing`、`failed`。重新启用会创建新实例。

模块之间通过以下方式通信：

- **服务**（所有者 `api.ts` 里的 `ServiceKey<T>`）：`peek` 只在所有者处于激活状态时返回值，从不激活它；`acquire` 激活所有者并返回租约，所有者停止时租约的 `revoked` 信号中止；`watch` 跟随可用性变化。
- **贡献点**（`ContributionPoint<T>`）：例如首页和档案贡献的自动化来源，自动化贡献的通知打开器。

契约是 `src/app/contracts/module.ts`；怎样编写模块见 `module-authoring.md`。

## 工作台

只有一个工作台视图（`app/workbench/workbench-leaf.ts` 里的 `WORKBENCH_VIEW_TYPE`）。叶子保存自己的状态，打开时加载 shell 表面。`app/workbench/compose-workbench.ts` 声明图标轨条目（功能、图标、面板、可用性），并通过 `plugin.activateModule(id)` 和 `ModuleInstance.pages` 把每个功能对应到模块页面。功能及其所属模块是 `app/contracts/workbench.ts` 里的 `WORKBENCH_FEATURES` / `FEATURE_MODULES`。shell 行为和页面契约属于 ui 技能。

评论侧栏（`app/workbench/comments-leaf.ts`）是唯一的另一种视图；它显示评论模块的面板服务，或「开启模块」的提示状态。

## 命令

| 种类 | 位置 |
|---|---|
| shell 命令（打开工作台、打开某个模块的页面、切换主题样式、复制引用） | `src/app/commands.ts`、`src/app/copy-commands.ts`；模块的命令用 `checkCallback` 判断 `plugin.moduleState(id) === 'active'` |
| 模块命令 | 在模块内部用 `context.commands.add(...)`（停用时自动移除）；传入 `nameKey` 让名称跟随语言 |
| 其他模块必须写出的 id | `src/shared/commands.ts` 里的 `NAND_COMMANDS` |

id 不带插件 id 前缀；名称里不写「命令」二字；没有默认快捷键。

## 持久化名称

没有记录在案的决定，不要重命名它们；它们是用户数据或用户配置。

| 数据 | 位置 | 负责方 |
|---|---|---|
| 设置（整个库） | `.nand/config/settings.json`（`{ version: 1, namespaces: { app, theme, home, … } }`） | `app/settings/runtime.ts` |
| 设置（本机） | `.nand/config/devices/<device-id>.json` | 同上；设备范围的字段（智能体 Shell 与路径、音乐音量、面板尺寸） |
| 设备 id | Obsidian 本地存储键 `nand.device-id`，从不在库里 | `host/obsidian/storage/device-id.ts` |
| 评论线程 | `.nand/editor/comments/` | 评论（`editor-comments.md`） |
| 图标与规则 | `.nand/icons/iconic.json` + `.backupN`（上游 Iconic 的模式） | 图标 |
| 自动化运行 | `.nand/automation/<device-id>/runtime.json`；定义在 `NAND/自动化/<名称>-<id>/操作.md` | 自动化 |
| 通知 | `.nand/notifications/<device-id>/inbox.json` | 通知 |
| Git 同步的设备状态 | `<git dir>/nand-sync.json`（自动同步的时钟与暂停；在 `.git` 内，从不提交） | 同步 |
| 智能体历史标注、自动化会话与缓存 | `.nand/terminal-agent/<device-id>/`（`history.json`、`automation-sessions.json`；`index.sqlite` 是可重建的缓存） | 智能体 |
| 智能体生命周期钩子脚本 | `~/.nand/hooks/nand-automation-hook.cjs`，注册在各 CLI 自己的设置里，并留有 `.nand-backup` 副本 | 智能体 |
| 终端辅助程序 | `<插件目录>/binaries/nand-pty-<平台>-<架构>[.exe]` 和 `nand-pty.json`（版本与摘要） | 智能体 |
| 浏览历史与站点授权 | `.nand/browser/<device-id>/state.json` | 浏览器 |
| 恢复草稿与看板冲突 | `.nand/recovery/drafts/`、`.nand/recovery/dashboard/conflicts/` | 共享存储、首页 |
| 缓存 | `.nand/cache/`（微信读书进度） | 首页 |
| 记录 | `NAND/习惯/`、`NAND/记账/`、`NAND/番茄钟/`、`NAND/阅读/` 下的 Markdown | 首页 |
| 档案 | 配置的可见文件夹（默认 `档案`）、`个人档案/<姓名>/基本信息.md`、`企业档案/<名称>/基本信息.md` | 档案 |
| 看板 | 用户的看板笔记 | 首页（`platform/board/`） |
| Electron 分区 | `persist:nand-browser-<库本地 id>`、`persist:nand-dashboard-music-<库名>`、`persist:nand-dashboard-web` | 浏览器、首页 |
| 库本地的界面状态 | `App.saveLocalStorage` 键 `nand.*` | 所属模块 |
| 功能区 id | `src/app/ribbon.ts` 里的 `ribbon-<id>`（id 稳定，标签会翻译） | app |

Obsidian Sync 不同步以点开头的文件夹，所以 `.nand/` 需要 Git、iCloud、Syncthing 等；使用指南里会说明。

## TypeScript

`strict`、`noUncheckedIndexedAccess`、`noImplicitReturns`、`useUnknownInCatchVariables`，目标 ES2021。未处理的 Promise 是错误（有意不等待时用 `void`）。不要在 Promise 回调里返回 Obsidian 的链式控件（`nand/no-obsidian-thenable`）。文件和文件夹用 kebab-case；Preact 组件文件用 PascalCase；其他文件导入的常量（视图类型、键）用 `SCREAMING_SNAKE`。只用相对路径导入。
