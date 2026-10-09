[English](0001-module-contract.md) | 简体中文

# ADR-0001：模块契约与注册表

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

NAND 提供九个功能，它们的成本、平台支持和故障模式各不相同。每个功能都要能独立启动和停止，停止后不留残余，失败时不拖垮整个插件。功能之间还要在不互相导入的前提下协作。

## 决定

**分区。** 源码分为 `app`（组合根，启动时加载）、`shell`（工作台界面）、`ui`（设计系统）、`theme`、`host`（Obsidian 与桌面适配）、`shared`（纯工具、设置存储、存储辅助、i18n 运行时）和 `modules/<id>`。模块根目录有 `manifest.ts`、`api.ts`、`module.ts`、`settings.ts` 和 `i18n.ts`，以及目录 `core`（领域规则，不使用宿主包）、`platform`（库与桌面 IO；Node 与 Electron 只能出现在 `desktop/` 下）、`services`、`contrib` 和 `ui`。

**导入方向。** 一张导入矩阵规定每个分区能导入什么。`scripts/verify-architecture.mjs` 对值导入、类型导入、字面量 `import()`、运行时环和桶文件导入执行检查；还拒绝 `core` 与 `shared` 中出现宿主包和宿主全局对象，以及 `desktop/` 目录之外出现 Node、Electron 和 `window.require`。任何违例都会失败，没有基线。一个模块只能通过另一个模块的 `api.ts` 到达它。

**清单。** 每个模块有纯数据的 `ModuleManifest`：编号、顺序、图标、标题与描述键、支持的平台、`defaultEnabled`、激活时机（`startup`、`layout-ready` 或 `on-demand`）、提供的服务、参与的贡献点，以及 `load()`——进入模块代码的唯一入口。`src/app/manifests.ts` 列出全部清单。

**注册表。** 当模块在 `app` 设置命名空间中的开关打开且平台受支持时，`ModuleRegistry` 创建该模块。模块依次经过 `off` 或 `unsupported`、`idle`、`loading`、`active`、`disposing`，或者处于 `failed`。模块按清单顺序启用，按相反顺序停用。模块在加载、激活或释放时抛错，会被标为 failed 并上报；其他模块继续运行，下一次应用开关时重试。同一模块的状态转换串行执行。

**上下文。** 模块得到一个 `ModuleContext`：编号、app、插件清单、运行环境、`lifetime`、设置存储、服务、贡献点、外壳访问、命令和编辑器访问。它拿不到插件实例。通过 `lifetime`、`commands` 和 `editor` 注册的一切，会在模块释放时移除，因此关闭模块后不留监听器、命令、编辑器扩展、body 类或进程。

**协作。** 模块之间通过所有者 `api.ts` 中用 `serviceKey` 和 `contributionPoint` 声明的服务与贡献点协作。`peek` 只在所有者已激活时返回服务，从不激活它。`acquire` 激活所有者，并返回租约，所有者停止时租约的 `revoked` 信号中止。`watch` 跟踪可用性。例子有：`home` 与 `archives` 贡献的自动化来源，`automations` 贡献的通知打开器。

## 影响

功能可以在运行时关闭再打开。新增模块需要一份清单、一个 `module.ts`，如有对外暴露的内容还要一个 `api.ts`。代价是用端口和组合代码取代直接调用。

## 依据

[模块契约](../../../../src/app/contracts/module.ts)、[注册表](../../../../src/app/modules/registry.ts)、[清单列表](../../../../src/app/manifests.ts)、[架构检查](../../../../scripts/verify-architecture.mjs)。`pnpm test:architecture`；注入加载、激活和释放故障的注册表测试；真实 Obsidian 探针中的模块开关检查。
