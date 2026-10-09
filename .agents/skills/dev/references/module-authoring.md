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

## 设置页

`settingsPage` 返回渲染函数 `(container, host) => void`；`host.refresh()` 重绘，`host.keep(off)` 在页面显示期间保持一个订阅。要把它列进工作台设置，把产品加入 `src/app/settings/nav.ts`（`SettingsProduct`、`ORDER`、`ModuleGates`、`PRODUCT_MODULES`），把它的标签和图标加入 `src/app/workbench/settings-categories.ts`。使用绑定到设置句柄的原生 `Setting` 行；Obsidian 设置页只放入口行（`src/app/settings/entry-tab.ts`）。

## 与其他模块交互

- 需要另一个模块的能力：从它的 `api.ts` 导入键；功能可选且不应因此开启对方时用 `peek`（状态、面板数据），用户主动要求时用 `acquire`（租约的 `revoked` 信号告诉你所有者已停止）。
- 提供能力：把接口和键放进自己的 `api.ts`，在 `services` 里返回值，并在清单的 `provides` 里列出键。
- 让别人接入：在自己的 `api.ts` 里声明 `contributionPoint`；贡献者在 `contributions` 里返回 `[point, value]`，并在 `contributes` 下列出。用 `context.contributions.collect(point)` 收集。
- 永远不要导入另一个模块的内部实现，也不要去碰插件实例。

## 生命周期检查清单

- [ ] `dispose()` 释放计时器、监听器、进程、叶子之外的 DOM 和 body 类名；`dispose('unload')` 不向用户弹出提示
- [ ] 命令和编辑器扩展都通过 `context.commands` / `context.editor`
- [ ] 在运行的库里关闭再开启模块可用（探针和模块自己的测试覆盖它）
- [ ] 启动集合不变（`pnpm run check:bundle`），架构检查通过
