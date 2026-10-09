[English](0002-lazy-loading-and-budgets.md) | 简体中文

# ADR-0002：懒加载与打包预算

状态：已接受。已于 2026-10-08 对照代码核对。

## 问题

Obsidian 只加载一个 `main.js`。在单个 CommonJS 文件里，启动代码的任何一条静态导入，都会让被导入的代码在启动时执行，不论用户是否使用该功能。插件带有大型库（终端模拟器、图表、日历、图标数据），不加管理的导入会让每次 Obsidian 启动都为这些库付出代价。

## 决定

- **一个包，惰性初始化。** esbuild 把 `src/app/main.ts` 构建为一个不做代码拆分的 CommonJS `main.js`。只能经 `import()` 到达的文件会被包进惰性初始化器，在首次导入时执行。启动代码里的一条静态边，会把目标的整个闭包拉进启动集合。
- **哪些是启动代码。** `src/app/main.ts` 及其静态导入：注册表、设置运行时、清单、所有 `api.ts`、设置 schema、工作台与评论叶子类、主题运行时和启动词典。
- **哪些是懒加载。** 外壳在工作台叶子打开时加载。模块代码经 `manifest.load()` 加载。页面和设置页在首次使用时，从模块实例的 `pages` 与 `settingsPage` 加载器加载。重型库（`chart.js`、`lunar-typescript`、xterm、图标数据）在模块内部的第二层 `import()` 之后加载。`module.ts` 从不静态导入自己的 `ui/`。导入说明符是字面量，没有任何东西靠导入副作用来注册自己。
- **预算。** `scripts/check-bundle.mjs` 用 esbuild metafile 在内存中构建，计算启动时执行的集合和每个模块的激活闭包。`scripts/bundle-budget.json` 保存上限：启动 120 KiB、每个模块的激活上限、不得进入启动集合的库清单，以及 `main.js`（3.75 MiB）和 `styles.css`（720 KiB）的总量上限。超出任一上限时 `pnpm run check:bundle` 失败，CI 会运行它。当前数值见[当前基线](../context/current-baseline.ZH.md)。
- **总量只降不升。** 总量上限限制增长。提高上限需要在提出该修改的 change 中写明理由。
- **样式。** Obsidian 只允许一份样式表，CSS 无法懒加载。`styles.css` 是一份已提交的文件，由 `src/styles.json` 列出的作者文件按该顺序（即层叠顺序）拼接。作用于 Obsidian 自身界面的模块规则，挂在模块只在启用期间才添加的 body 类之下。

## 影响

懒加载的文件仍然作为同一个文件的一部分被读取和预解析，所以总量要有自己的上限。启动代码不能使用模块的内部实现，只能读取清单和 `api.ts`。

## 依据

[打包检查](../../../../scripts/check-bundle.mjs)、[预算](../../../../scripts/bundle-budget.json)、[esbuild 选项](../../../../scripts/esbuild-options.mjs)。CI 中的 `pnpm run check:bundle`；`pnpm test:architecture` 拒绝 `app` 到模块内部、`module.ts` 到自己 `ui/` 的静态边。
